import uuid
from datetime import datetime
from typing import Dict, Any, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.models import Event, Anomaly, Incident, SeverityLevel, AnomalyStatus, IncidentStatus
from app.anomaly.rules import AnomalyRulesEvaluator
from app.pipeline.enricher import log_critical_event

class AnomalyEngine:
    @staticmethod
    async def evaluate_track(
        db_session: AsyncSession,
        store_id: uuid.UUID,
        camera_id: uuid.UUID,
        zone_id: str,
        track_id: str,
        label: str,
        dwell_ms: float,
        is_stationary: bool,
        zone_count: int,
        correlation_id: uuid.UUID
    ) -> List[Event]:
        """
        Evaluate a stateful track against all security anomaly rules.
        If triggered, persist anomaly details + create/update correlated incidents.
        """
        now = datetime.utcnow()
        generated_events = []

        # List of rules to execute
        rules_to_run = [
            lambda: AnomalyRulesEvaluator.check_restricted_zone(zone_id),
            lambda: AnomalyRulesEvaluator.check_unattended_object(label, is_stationary, dwell_ms, zone_id),
            lambda: AnomalyRulesEvaluator.check_loitering(dwell_ms, zone_id),
            lambda: AnomalyRulesEvaluator.check_crowd_surge(zone_count, zone_id),
            lambda: AnomalyRulesEvaluator.check_after_hours_motion("UTC")
        ]

        for rule in rules_to_run:
            triggered, score, message = rule()
            if not triggered:
                continue

            # Determine anomaly name
            anomaly_type = "loitering"
            severity = SeverityLevel.WARNING
            
            if "restricted" in message.lower() or "after hours" in message.lower():
                severity = SeverityLevel.CRITICAL
                anomaly_type = "restricted_zone" if "restricted" in message.lower() else "after_hours_motion"
            elif "unattended" in message.lower():
                anomaly_type = "unattended_object"
            elif "crowd" in message.lower():
                anomaly_type = "crowd_surge"

            # 1. Dispatch log tick if critical
            if severity == SeverityLevel.CRITICAL:
                log_critical_event(camera_id, zone_id)

            # 2. Check if we already registered this track ID + anomaly category recently to prevent alert flooding
            # Query recent 1 minute anomalies
            recent_query = await db_session.execute(
                select(Anomaly)
                .where(Anomaly.store_id == store_id)
                .where(Anomaly.camera_id == camera_id)
                .where(Anomaly.anomaly_type == anomaly_type)
                .where(Anomaly.created_at >= now - datetime.timedelta(seconds=60))
            )
            existing_anom = recent_query.scalars().all()
            
            # For track specific loitering/restricted breaches, block flood based on track ID
            track_match = any(track_id in (an.note or "") for an in existing_anom)
            if existing_anom and (track_match or anomaly_type == "crowd_surge"):
                continue

            # 3. Insert canonical Event row
            anomaly_event = Event(
                id=uuid.uuid4(),
                event_type="anomaly",
                schema_version="1.0",
                timestamp=now,
                store_id=store_id,
                camera_id=camera_id,
                zone_id=zone_id,
                track_id=track_id,
                severity=severity,
                confidence=0.95,
                anomaly_score=score,
                correlation_id=correlation_id,
                payload={
                    "anomaly_type": anomaly_type,
                    "reason": message,
                    "threshold": 0.85,
                    "message": message
                },
                media_url="https://images.unsplash.com/photo-1558002038-1055907df827?q=80&w=600&auto=format&fit=crop"
            )
            db_session.add(anomaly_event)
            await db_session.flush()

            # 4. Create Anomaly record
            new_anomaly = Anomaly(
                id=uuid.uuid4(),
                event_id=anomaly_event.id,
                store_id=store_id,
                camera_id=camera_id,
                anomaly_type=anomaly_type,
                score=score,
                status=AnomalyStatus.OPEN,
                note=f"Alert: {message} Track details: {track_id} [Label: {label}]"
            )
            db_session.add(new_anomaly)

            # 5. Create or Update Correlated Incident row
            incident_query = await db_session.execute(
                select(Incident).where(Incident.correlation_id == correlation_id)
            )
            incident = incident_query.scalar_one_or_none()

            if not incident:
                # Create brand new incident
                incident = Incident(
                    id=uuid.uuid4(),
                    correlation_id=correlation_id,
                    store_id=store_id,
                    severity=severity,
                    status=IncidentStatus.OPEN,
                    title=f"Incident: {anomaly_type.replace('_', ' ').title()}",
                    event_count=1,
                    opened_at=now
                )
                db_session.add(incident)
            else:
                # Update incident stats
                incident.event_count += 1
                incident.updated_at = now
                if severity == SeverityLevel.CRITICAL and incident.severity != SeverityLevel.CRITICAL:
                    incident.severity = SeverityLevel.CRITICAL

            generated_events.append(anomaly_event)

        return generated_events
