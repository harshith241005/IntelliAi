import uuid
import logging
from datetime import datetime
from typing import Optional, Dict
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.models import Event

logger = logging.getLogger("store_intelligence.ingest")

# Memory cache for rapid deduplication
_ingested_frames_cache: Dict[str, float] = {}

class FrameIngestPipeline:
    @staticmethod
    async def ingest_frame(
        db_session: AsyncSession,
        camera_id: uuid.UUID,
        frame_id: str,
        captured_at: datetime,
        idempotency_key: Optional[str] = None
    ) -> bool:
        """
        Ingest frame metadata.
        Verifies uniqueness on (camera_id, frame_id) to deduplicate redundant ticks.
        Returns True if newly ingested, False if duplicate.
        """
        # 1. Quick in-memory cache check
        cache_key = f"{camera_id}:{frame_id}"
        if cache_key in _ingested_frames_cache:
            logger.debug(f"Frame already ingested (memory cache match): {cache_key}")
            return False

        # 2. Database validation check
        result = await db_session.execute(
            select(Event)
            .where(Event.camera_id == camera_id)
            .where(Event.payload["frame_id"].as_string() == frame_id)
            .limit(1)
        )
        existing_event = result.scalar_one_or_none()
        
        if existing_event:
            logger.debug(f"Frame already ingested (DB unique constraint match): {cache_key}")
            # Cache it to prevent hit on DB next time
            _ingested_frames_cache[cache_key] = datetime.utcnow().timestamp()
            return False

        # Register in-memory cache
        _ingested_frames_cache[cache_key] = datetime.utcnow().timestamp()
        
        # Limit memory cache size
        if len(_ingested_frames_cache) > 5000:
            # Pop oldest 1000 items
            for k in list(_ingested_frames_cache.keys())[:1000]:
                del _ingested_frames_cache[k]

        return True

ingest_pipeline = FrameIngestPipeline()
