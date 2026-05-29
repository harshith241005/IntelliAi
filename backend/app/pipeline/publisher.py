import time
import uuid
import logging
from datetime import datetime
from typing import Dict, Any, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.models import Event, Camera, PipelineMetric, PipelineStage, SeverityLevel
from app.pipeline.ingest import ingest_pipeline
from app.pipeline.detector import detector
from app.pipeline.tracker import get_tracker
from app.pipeline.enricher import process_enrichment
from app.anomaly.engine import AnomalyEngine
from app.streaming.redis_bus import redis_bus
from app.schemas.events import CCTVEventResponse

logger = logging.getLogger("store_intelligence.pipeline")

class PipelinePublisher:
    @staticmethod
    async def process_frame(
        db_session: AsyncSession,
        camera_id: uuid.UUID,
        frame_id: str,
        captured_at: datetime,
        media_url: Optional[str] = None
    ) -> bool:
        """
        Main E2E pipeline mediator:
        ingest -> detect -> track -> enrich -> anomaly check -> publish.
        Persists events and publishes telemetry to Redis bus & socket managers.
        """
        now = datetime.utcnow()
        start_time = time.time()
        
        # Latency statistics map
        latencies: Dict[PipelineStage, float] = {}

        # 1. Ingest Stage
        s_ingest = time.time()
        is_new = await ingest_pipeline.ingest_frame(db_session, camera_id, frame_id, captured_at)
        latencies[PipelineStage.INGEST] = (time.time() - s_ingest) * 1000

        if not is_new:
            return False

        # Load camera metadata for zone mapping
        camera_query = await db_session.execute(
            select(Camera).where(Camera.id == camera_id)
        )
        camera = camera_query.scalar_one_or_none()
        if not camera:
            logger.error(f"Ingestion failed: Camera {camera_id} not registered.")
            return False
        
        # Load store_id
        store_id = camera.store_id

        # 2. Detection Stage
        s_detect = time.time()
        detections = detector.detect_frame(camera_id, frame_id)
        latencies[PipelineStage.DETECT] = (time.time() - s_detect) * 1000

        # Save standard raw detections events in SQL
        for det in detections:
            det_event = Event(
                id=uuid.uuid4(),
                event_type="detection",
                schema_version="1.0",
                timestamp=captured_at,
                store_id=store_id,
                camera_id=camera_id,
                zone_id=camera.zone_id,
                severity=SeverityLevel.INFO,
                confidence=det["confidence"],
                payload={
                    "class": det["class"],
                    "bbox": det["bbox"],
                    "frame_id": frame_id
                }
            )
            db_session.add(det_event)

        # 3. Tracking Stage
        s_track = time.time()
        tracker = get_tracker(camera_id)
        active_tracks = tracker.process_detections(camera_id, detections)
        latencies[PipelineStage.TRACK] = (time.time() - s_track) * 1000

        # Group track list to map counts per zone
        zone_counts = {}
        for track in active_tracks:
            z_id, _, _ = process_enrichment(
                store_id, camera_id, camera.name, track.track_id, track.label,
                track.x, track.y, track.velocity, track.is_stationary, track.path
            )
            zone_counts[z_id] = zone_counts.get(z_id, 0) + 1

        # 4. Enrichment & Anomaly Stage
        s_enrich = time.time()
        
        events_to_publish = []

        for track in active_tracks:
            # Map coordinates to zone and compute transition triggers
            zone_id, transitions, correlation_id = process_enrichment(
                store_id, camera_id, camera.name, track.track_id, track.label,
                track.x, track.y, track.velocity, track.is_stationary, track.path
            )
            
            # Save standard track update
            track_event = Event(
                id=uuid.uuid4(),
                event_type="track_update",
                schema_version="1.0",
                timestamp=captured_at,
                store_id=store_id,
                camera_id=camera_id,
                zone_id=zone_id,
                track_id=track.track_id,
                severity=SeverityLevel.INFO,
                confidence=0.92,
                correlation_id=correlation_id,
                payload={
                    "path": track.path,
                    "velocity": track.velocity,
                    "class": track.label,
                    "coordinates": {"x": track.x, "y": track.y, "width": track.w, "height": track.h},
                    "is_stationary": track.is_stationary,
                    "message": f"{track.label} is active in {zone_id.replace('zone_', '')} (speed: {track.velocity}px/s)"
                }
            )
            db_session.add(track_event)
            events_to_publish.append(track_event)

            # Save transitions (enters/exits)
            for trans in transitions:
                trans_event = Event(
                    id=uuid.uuid4(),
                    event_type=trans["event_type"],
                    schema_version="1.0",
                    timestamp=captured_at,
                    store_id=store_id,
                    camera_id=camera_id,
                    zone_id=trans["zone_id"],
                    track_id=track.track_id,
                    severity=SeverityLevel.INFO,
                    confidence=0.95,
                    correlation_id=correlation_id,
                    payload=trans["payload"]
                )
                db_session.add(trans_event)
                events_to_publish.append(trans_event)

            # Evaluate Anomalies
            dwell_ms = (time.time() - track.stationary_since) * 1000 if track.is_stationary and track.stationary_since else 0.0
            
            anom_events = await AnomalyEngine.evaluate_track(
                db_session=db_session,
                store_id=store_id,
                camera_id=camera_id,
                zone_id=zone_id,
                track_id=track.track_id,
                label=track.label,
                dwell_ms=dwell_ms,
                is_stationary=track.is_stationary,
                zone_count=zone_counts.get(zone_id, 1),
                correlation_id=correlation_id
            )
            events_to_publish.extend(anom_events)

        latencies[PipelineStage.ENRICH] = (time.time() - s_enrich) * 1000

        # 5. Publish Stage
        s_publish = time.time()
        
        # Flush to generate all DB IDs and trigger commits
        await db_session.commit()

        # Fanout published events to Redis Bus
        for evt in events_to_publish:
            evt_response = CCTVEventResponse.from_orm(evt)
            # Publish to redis bus stream + fanout
            await redis_bus.publish_event(evt_response.model_dump(by_alias=True, mode="json"))

        # Update last_frame_at metadata on camera
        camera.last_frame_at = now
        await db_session.commit()

        latencies[PipelineStage.PUBLISH] = (time.time() - s_publish) * 1000

        # 6. Save Pipeline Performance Metrics
        for stage, lat in latencies.items():
            metric = PipelineMetric(
                stage=stage,
                store_id=store_id,
                latency_ms=round(lat, 2),
                success=True,
                recorded_at=now
            )
            db_session.add(metric)
        await db_session.commit()

        return True

pipeline_publisher = PipelinePublisher()
