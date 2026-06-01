"""
Anomaly Detection Engine.
Analyzes events asynchronously to detect operational issues.
"""
from typing import List
import logging
from datetime import datetime, timedelta
from .models import StoreEvent, EventType
from .db import DBManager, DBEvent, AsyncSessionLocal

logger = logging.getLogger(__name__)

class AnomalyDetector:
    
    def __init__(self):
        # Configuration rules
        self.rules = {
            "checkout_queue_length": 5, # max persons in billing zone
            "suspicious_dwell": 300, # seconds
            "zone_overcrowding": 15 # max persons per general zone
        }

    async def _count_active_visitors_in_zone(self, zone_id: str) -> int:
        """Count active visitors in a zone by checking recent ZONE_ENTER and ZONE_EXIT/EXIT events."""
        from sqlalchemy import select
        
        # Consider events in the last 15 minutes
        time_limit = datetime.utcnow() - timedelta(minutes=15)
        
        try:
            async with AsyncSessionLocal() as session:
                # Find unique visitors who ENTERED this zone recently
                enters_query = select(DBEvent.visitor_id.distinct()).where(
                    DBEvent.zone_id == zone_id,
                    DBEvent.event_type == "ZONE_ENTER",
                    DBEvent.timestamp >= time_limit
                )
                enters_res = await session.execute(enters_query)
                enters = {row[0] for row in enters_res.all() if row[0]}
                
                if not enters:
                    return 0
                    
                # Find which of these visitors have exited this zone or exited the store since
                exits_query = select(DBEvent.visitor_id.distinct()).where(
                    DBEvent.visitor_id.in_(list(enters)),
                    DBEvent.event_type.in_(["ZONE_EXIT", "EXIT"]),
                    DBEvent.timestamp >= time_limit
                )
                exits_res = await session.execute(exits_query)
                exits = {row[0] for row in exits_res.all() if row[0]}
                
                active_count = len(enters - exits)
                logger.info(f"Active visitors in {zone_id}: {active_count}")
                return active_count
        except Exception as e:
            logger.error(f"Error counting active visitors in zone {zone_id}: {e}")
            return 0

    async def process_batch(self, events: List[StoreEvent], db: DBManager):
        """Process incoming events against anomaly rules."""
        
        for e in events:
            # 1. Check for Suspicious Dwell
            if e.event_type == EventType.ZONE_DWELL:
                duration_sec = e.dwell_ms / 1000.0
                if duration_sec > self.rules["suspicious_dwell"]:
                    await self._flag_anomaly(
                        db,
                        type="SUSPICIOUS_DWELL",
                        severity="medium",
                        message=f"Visitor {e.visitor_id} dwelling in {e.zone_id} for {int(duration_sec)}s",
                        event=e
                    )
            
            # 2. Check for Billing Queue overcrowding when a visitor joins the billing zone
            if e.event_type == EventType.ZONE_ENTER and e.zone_id == "BILLING":
                active_billing = await self._count_active_visitors_in_zone("BILLING")
                # Add 1 if the current event is not in DB yet
                active_billing = max(active_billing, 1)
                
                if active_billing > self.rules["checkout_queue_length"]:
                    await self._flag_anomaly(
                        db,
                        type="BILLING_QUEUE_SPIKE",
                        severity="high",
                        message=f"Billing queue length exceeds limit ({active_billing}/{self.rules['checkout_queue_length']})",
                        event=e
                    )
                    
            # 3. Check for general Zone Overcrowding when entering any browsing zone
            if e.event_type == EventType.ZONE_ENTER and e.zone_id and e.zone_id != "BILLING":
                active_occupancy = await self._count_active_visitors_in_zone(e.zone_id)
                active_occupancy = max(active_occupancy, 1)
                
                if active_occupancy > self.rules["zone_overcrowding"]:
                    await self._flag_anomaly(
                        db,
                        type="HIGH_OCCUPANCY",
                        severity="high",
                        message=f"Zone {e.zone_id} is overcrowded ({active_occupancy}/{self.rules['zone_overcrowding']})",
                        event=e
                    )

    async def _flag_anomaly(self, db: DBManager, type: str, severity: str, message: str, event: StoreEvent):
        """Register an anomaly in the database."""
        logger.warning(f"ANOMALY [{severity}]: {type} - {message}")
        
        anomaly = {
            "type": type,
            "severity": severity,
            "message": message,
            "trigger_event_id": event.event_id,
            "camera_id": event.camera_id,
            "timestamp": event.timestamp if isinstance(event.timestamp, str) else datetime.now().isoformat() + "Z",
            "status": "active"
        }
        
        await db.insert_anomaly(anomaly)
        
        # Safe import to prevent circular dependency
        from .main import sio
        await sio.emit('alert', {
            "alert_id": anomaly['trigger_event_id'],
            "type": anomaly['type'],
            "status": anomaly['status'],
            "camera_id": anomaly['camera_id'],
            "severity": anomaly['severity'],
            "message": anomaly['message'],
            "created_at": anomaly['timestamp'],
            "event_id": anomaly['trigger_event_id']
        })
