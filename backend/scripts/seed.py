import asyncio
import uuid
import random
from datetime import datetime, timedelta
from sqlalchemy import select
from app.db.session import async_session
from app.db.models import (
    Store, Camera, Event, Anomaly, Incident, PipelineMetric,
    StoreStatus, CameraStatus, SeverityLevel, AnomalyStatus, IncidentStatus, PipelineStage
)

# Static UUIDs for stable seed state mapping
STORE_UUIDS = [
    uuid.UUID("d3b07384-d113-4a1e-8e6d-62cc6295a001"), # Metrotown Flagship
    uuid.UUID("d3b07384-d113-4a1e-8e6d-62cc6295a002"), # Downtown Express
    uuid.UUID("d3b07384-d113-4a1e-8e6d-62cc6295a003")  # West Broadway Boutique
]

CAMERA_UUIDS = [uuid.uuid4() for _ in range(12)]

ZONES = ["zone_entrance", "zone_checkout", "zone_aisle_electronics", "zone_restricted_loading", "zone_restricted_safe"]

async def seed_database():
    print("Connecting to DB engine for seeding operations...")
    async with async_session() as session:
        # 1. Verify if already seeded
        result = await session.execute(select(Store))
        existing_stores = result.scalars().all()
        if len(existing_stores) >= 3:
            print("Database already contains seed data, skipping seeder routine.")
            return

        print("Seeding 3 Stores...")
        stores = [
            Store(
                id=STORE_UUIDS[0],
                name="Metrotown Flagship Store",
                address="4700 Kingsway, Burnaby, BC",
                timezone="America/Vancouver",
                status=StoreStatus.ONLINE
            ),
            Store(
                id=STORE_UUIDS[1],
                name="Downtown Express",
                address="701 W Georgia St, Vancouver, BC",
                timezone="America/Vancouver",
                status=StoreStatus.DEGRADED
            ),
            Store(
                id=STORE_UUIDS[2],
                name="West Broadway Boutique",
                address="2188 W Broadway, Vancouver, BC",
                timezone="America/Vancouver",
                status=StoreStatus.ONLINE
            )
        ]
        session.add_all(stores)
        await session.flush() # Flushes IDs to memory

        print("Seeding 12 Cameras...")
        cameras = []
        # Store 1 Cameras
        cameras.extend([
            Camera(id=CAMERA_UUIDS[0], store_id=STORE_UUIDS[0], name="Main North Entrance", zone_id="zone_entrance", rtsp_url="rtsp://192.168.1.101/stream", fps=30.0, status=CameraStatus.ONLINE),
            Camera(id=CAMERA_UUIDS[1], store_id=STORE_UUIDS[0], name="Checkout Lanes A-C", zone_id="zone_checkout", rtsp_url="rtsp://192.168.1.102/stream", fps=30.0, status=CameraStatus.ONLINE),
            Camera(id=CAMERA_UUIDS[2], store_id=STORE_UUIDS[0], name="Electronics Shelf Aisle", zone_id="zone_aisle_electronics", rtsp_url="rtsp://192.168.1.103/stream", fps=24.0, status=CameraStatus.ONLINE),
            Camera(id=CAMERA_UUIDS[3], store_id=STORE_UUIDS[0], name="Back Warehouse Door", zone_id="zone_restricted_loading", rtsp_url="rtsp://192.168.1.104/stream", fps=30.0, status=CameraStatus.ONLINE)
        ])
        # Store 2 Cameras
        cameras.extend([
            Camera(id=CAMERA_UUIDS[4], store_id=STORE_UUIDS[1], name="Store Main Entrance", zone_id="zone_entrance", rtsp_url="rtsp://192.168.2.101/stream", fps=30.0, status=CameraStatus.ONLINE),
            Camera(id=CAMERA_UUIDS[5], store_id=STORE_UUIDS[1], name="Aisle Checkout 01", zone_id="zone_checkout", rtsp_url="rtsp://192.168.2.102/stream", fps=30.0, status=CameraStatus.ONLINE),
            Camera(id=CAMERA_UUIDS[6], store_id=STORE_UUIDS[1], name="Main Sales Floor", zone_id="zone_aisle_electronics", rtsp_url="rtsp://192.168.2.103/stream", fps=15.0, status=CameraStatus.ONLINE),
            Camera(id=CAMERA_UUIDS[7], store_id=STORE_UUIDS[1], name="Vault Counter Cash", zone_id="zone_restricted_safe", rtsp_url="rtsp://192.168.2.104/stream", fps=15.0, status=CameraStatus.DEGRADED)
        ])
        # Store 3 Cameras
        cameras.extend([
            Camera(id=CAMERA_UUIDS[8], store_id=STORE_UUIDS[2], name="Boutique Doorway East", zone_id="zone_entrance", rtsp_url="rtsp://192.168.3.101/stream", fps=30.0, status=CameraStatus.ONLINE),
            Camera(id=CAMERA_UUIDS[9], store_id=STORE_UUIDS[2], name="VIP Styling Desk", zone_id="zone_checkout", rtsp_url="rtsp://192.168.3.102/stream", fps=24.0, status=CameraStatus.ONLINE),
            Camera(id=CAMERA_UUIDS[10], store_id=STORE_UUIDS[2], name="Aisle Apparel Central", zone_id="zone_aisle_electronics", rtsp_url="rtsp://192.168.3.103/stream", fps=30.0, status=CameraStatus.ONLINE),
            Camera(id=CAMERA_UUIDS[11], store_id=STORE_UUIDS[2], name="Safe Room Entrance", zone_id="zone_restricted_safe", rtsp_url="rtsp://192.168.3.104/stream", fps=30.0, status=CameraStatus.ONLINE)
        ])
        session.add_all(cameras)
        await session.flush()

        print("Seeding 500 Historical Events spanning past 24 hours...")
        events = []
        now = datetime.utcnow()
        
        # We generate a rolling window of historical track coordinates
        for idx in range(500):
            timestamp = now - timedelta(minutes=2.8 * (500 - idx))
            
            # Select store & camera randomly
            store_idx = random.randint(0, 2)
            store_id = STORE_UUIDS[store_idx]
            cam_offset = store_idx * 4
            camera_id = CAMERA_UUIDS[cam_offset + random.randint(0, 3)]
            
            event_type = random.choice(["detection", "track_update", "heartbeat"])
            zone_id = random.choice(ZONES)
            track_id = f"track_{random.randint(1000, 9999)}"
            severity = SeverityLevel.INFO

            payload = {}
            confidence = random.uniform(0.78, 0.99)
            
            if event_type == "detection":
                payload = {
                    "class": random.choice(["person", "shopping_cart", "backpack"]),
                    "bbox": [random.randint(10, 80), random.randint(10, 80), 24, 48],
                    "frame_id": f"frame_seed_{idx}"
                }
            elif event_type == "track_update":
                payload = {
                    "path": [[random.randint(10, 80), random.randint(10, 80), idx] for _ in range(5)],
                    "velocity": random.uniform(0.1, 1.8),
                    "class": "person"
                }
            elif event_type == "heartbeat":
                payload = {
                    "fps": 29.8,
                    "frames_processed": 5000 + idx,
                    "model_version": "YOLOv8-v1"
                }
                track_id = None
                zone_id = None

            event = Event(
                id=uuid.uuid4(),
                event_type=event_type,
                schema_version="1.0",
                timestamp=timestamp,
                store_id=store_id,
                camera_id=camera_id,
                zone_id=zone_id,
                track_id=track_id,
                severity=severity,
                confidence=confidence,
                payload=payload
            )
            events.append(event)
        
        session.add_all(events)
        await session.flush()

        print("Seeding 20 Anomalies & Correlated Incidents...")
        anomalies = []
        incidents_map = {}

        anomaly_types = ["loitering", "restricted_zone", "crowd_surge", "unattended_object"]

        for i in range(20):
            timestamp = now - timedelta(hours=random.uniform(0.5, 23.5))
            
            # Select store & camera randomly
            store_idx = random.randint(0, 2)
            store_id = STORE_UUIDS[store_idx]
            cam_offset = store_idx * 4
            camera_id = CAMERA_UUIDS[cam_offset + random.randint(0, 3)]
            
            anomaly_type = random.choice(anomaly_types)
            score = random.uniform(0.75, 0.99)
            
            # Determine severity
            severity = SeverityLevel.WARNING
            if anomaly_type == "restricted_zone":
                severity = SeverityLevel.CRITICAL
                zone_id = "zone_restricted_loading" if store_idx == 0 else "zone_restricted_safe"
            else:
                zone_id = "zone_checkout"

            correlation_id = uuid.uuid4()

            # Create base event for anomaly
            base_event = Event(
                id=uuid.uuid4(),
                event_type="anomaly",
                schema_version="1.0",
                timestamp=timestamp,
                store_id=store_id,
                camera_id=camera_id,
                zone_id=zone_id,
                track_id=f"track_anom_{random.randint(100, 999)}",
                severity=severity,
                confidence=0.92,
                anomaly_score=score,
                correlation_id=correlation_id,
                payload={
                    "anomaly_type": anomaly_type,
                    "reason": f"System flagged suspicious behavior: {anomaly_type}",
                    "threshold": 0.85
                },
                media_url="https://images.unsplash.com/photo-1558002038-1055907df827?q=80&w=600&auto=format&fit=crop"
            )
            session.add(base_event)
            await session.flush()

            # Create anomaly details
            status = random.choice([AnomalyStatus.OPEN, AnomalyStatus.ACKNOWLEDGED, AnomalyStatus.INVESTIGATING, AnomalyStatus.RESOLVED])
            anomaly = Anomaly(
                id=uuid.uuid4(),
                event_id=base_event.id,
                store_id=store_id,
                camera_id=camera_id,
                anomaly_type=anomaly_type,
                score=score,
                status=status,
                note="Automatic pipeline alert dispatched. operator triage required.",
                acknowledged_at=timestamp + timedelta(minutes=random.uniform(1, 10)) if status != AnomalyStatus.OPEN else None,
                resolved_at=timestamp + timedelta(minutes=random.uniform(15, 60)) if status == AnomalyStatus.RESOLVED else None
            )
            anomalies.append(anomaly)

            # Auto-create or group correlated incident
            if correlation_id not in incidents_map:
                incident = Incident(
                    id=uuid.uuid4(),
                    correlation_id=correlation_id,
                    store_id=store_id,
                    severity=severity,
                    status=IncidentStatus.RESOLVED if status == AnomalyStatus.RESOLVED else IncidentStatus.INVESTIGATING if status == AnomalyStatus.INVESTIGATING else IncidentStatus.OPEN,
                    title=f"Anomaly: {anomaly_type.replace('_', ' ').title()}",
                    event_count=1,
                    opened_at=timestamp,
                    resolved_at=timestamp + timedelta(minutes=30) if status == AnomalyStatus.RESOLVED else None
                )
                incidents_map[correlation_id] = incident
                session.add(incident)
            else:
                incidents_map[correlation_id].event_count += 1

        session.add_all(anomalies)

        print("Seeding Pipeline Performance Metrics...")
        metrics = []
        for stage in PipelineStage:
            for s_id in STORE_UUIDS:
                metric = PipelineMetric(
                    stage=stage,
                    store_id=s_id,
                    latency_ms=random.uniform(12.5, 48.2),
                    success=True,
                    recorded_at=now - timedelta(minutes=random.randint(1, 60))
                )
                metrics.append(metric)
        session.add_all(metrics)

        # Commit all transactions safely
        await session.commit()
        print("Seeding operations finished successfully! 3 stores, 12 cameras, 500 events, 20 anomalies fully loaded.")

if __name__ == "__main__":
    asyncio.run(seed_database())
