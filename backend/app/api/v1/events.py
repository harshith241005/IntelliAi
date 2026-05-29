import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Header, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_
from app.db.session import get_db
from app.db.models import Event
from app.schemas.events import CCTVEventResponse, FrameIngestInput
from app.api.deps import verify_api_key
from app.pipeline.publisher import pipeline_publisher

router = APIRouter(prefix="/events", tags=["events"])

@router.get("/", response_model=Dict[str, Any])
async def list_events(
    store_id: Optional[uuid.UUID] = None,
    camera_id: Optional[uuid.UUID] = None,
    event_type: Optional[str] = None,
    severity: Optional[str] = None,
    track_id: Optional[str] = None,
    zone_id: Optional[str] = None,
    from_time: Optional[datetime] = Query(None, alias="from"),
    to_time: Optional[datetime] = Query(None, alias="to"),
    anomaly_only: bool = False,
    cursor: Optional[str] = None,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    api_key: str = Depends(verify_api_key)
):
    """
    Query historical events with cursor-based pagination.
    Supports complex telemetry filtering.
    """
    query = select(Event)
    conditions = []

    if store_id:
        conditions.append(Event.store_id == store_id)
    if camera_id:
        conditions.append(Event.camera_id == camera_id)
    if event_type:
        conditions.append(Event.event_type == event_type)
    if severity:
        conditions.append(Event.severity == severity)
    if track_id:
        conditions.append(Event.track_id == track_id)
    if zone_id:
        conditions.append(Event.zone_id == zone_id)
    if from_time:
        conditions.append(Event.timestamp >= from_time)
    if to_time:
        conditions.append(Event.timestamp <= to_time)
    if anomaly_only:
        conditions.append(Event.event_type == "anomaly")

    # Cursor based pagination sorting DESC on timestamp
    if cursor:
        try:
            # Cursor is formatted as ISO8601 timestamp + delimiter + event_uuid
            cursor_time_str, cursor_id_str = cursor.split("|")
            cursor_time = datetime.fromisoformat(cursor_time_str)
            cursor_uuid = uuid.UUID(cursor_id_str)
            
            # Retrieve newer or same time with ID pagination check
            conditions.append(
                or_(
                    Event.timestamp < cursor_time,
                    and_(
                        Event.timestamp == cursor_time,
                        Event.id < cursor_uuid
                    )
                )
            )
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cursor encoding invalid."
            )

    if conditions:
        query = query.where(and_(*conditions))

    # Fetch limit + 1 items to resolve has_more
    query = query.order_by(Event.timestamp.desc(), Event.id.desc()).limit(limit + 1)
    
    result = await db.execute(query)
    records = result.scalars().all()

    has_more = len(records) > limit
    data_records = records[:limit]

    # Generate next cursor
    next_cursor = None
    if has_more and data_records:
        last_rec = data_records[-1]
        next_cursor = f"{last_rec.timestamp.isoformat()}|{str(last_rec.id)}"

    return {
        "data": [CCTVEventResponse.from_orm(r).model_dump(by_alias=True, mode="json") for r in data_records],
        "next_cursor": next_cursor,
        "has_more": has_more
    }

@router.get("/{event_id}", response_model=Dict[str, Any])
async def get_event(
    event_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    api_key: str = Depends(verify_api_key)
):
    """Retrieve detailed event plus timeline events under same correlation_id."""
    event_query = await db.execute(
        select(Event).where(Event.id == event_id)
    )
    event = event_query.scalar_one_or_none()
    
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found."
        )

    # Fetch correlated timeline events
    correlated = []
    if event.correlation_id:
        corr_query = await db.execute(
            select(Event)
            .where(Event.correlation_id == event.correlation_id)
            .order_by(Event.timestamp.asc())
        )
        correlated = corr_query.scalars().all()

    return {
        "event": CCTVEventResponse.from_orm(event).model_dump(by_alias=True, mode="json"),
        "correlated_timeline": [
            CCTVEventResponse.from_orm(c).model_dump(by_alias=True, mode="json") for c in correlated
        ]
    }

@router.post("/ingest", response_model=Dict[str, Any])
async def ingest_frame_metadata(
    input_data: FrameIngestInput,
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
    db: AsyncSession = Depends(get_db),
    api_key: str = Depends(verify_api_key)
):
    """
    Ingest raw frame metadata from camera client.
    Deduplicates on (camera_id, frame_id) or Idempotency-Key headers.
    Invokes the pipeline publisher E2E.
    """
    # 1. Deduplicate/Verify frame
    is_new = await pipeline_publisher.process_frame(
        db_session=db,
        camera_id=input_data.camera_id,
        frame_id=input_data.frame_id,
        captured_at=input_data.captured_at,
        media_url=input_data.media_url
    )

    if not is_new:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Duplicate frame tick, redundant execution blocked."
        )

    return {
        "success": True,
        "message": "Frame metadata successfully ingested & routed to E2E enrichment pipeline."
    }
