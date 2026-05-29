import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_
from app.db.session import get_db
from app.db.models import Anomaly, Event, Incident, AnomalyStatus
from app.schemas.anomalies import AnomalyResponse, AnomalyUpdateInput
from app.api.deps import verify_api_key

router = APIRouter(prefix="/anomalies", tags=["anomalies"])

@router.get("/", response_model=Dict[str, Any])
async def list_anomalies(
    store_id: Optional[uuid.UUID] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    min_score: Optional[float] = None,
    anomaly_type: Optional[str] = None,
    from_time: Optional[datetime] = Query(None, alias="from"),
    to_time: Optional[datetime] = Query(None, alias="to"),
    cursor: Optional[str] = None,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
    api_key: str = Depends(verify_api_key)
):
    """Query prioritized anomalies dispatch queue with cursor pagination."""
    query = select(Anomaly)
    conditions = []

    if store_id:
        conditions.append(Anomaly.store_id == store_id)
    if status_filter:
        conditions.append(Anomaly.status == status_filter)
    if min_score is not None:
        conditions.append(Anomaly.score >= min_score)
    if anomaly_type:
        conditions.append(Anomaly.anomaly_type == anomaly_type)
    if from_time:
        conditions.append(Anomaly.created_at >= from_time)
    if to_time:
        conditions.append(Anomaly.created_at <= to_time)

    # Priority sorting on status first, then score DESC
    if cursor:
        try:
            # Cursor parsed as priority score + delimiter + UUID
            cursor_score_str, cursor_id_str = cursor.split("|")
            cursor_score = float(cursor_score_str)
            cursor_uuid = uuid.UUID(cursor_id_str)
            
            conditions.append(
                or_(
                    Anomaly.score < cursor_score,
                    and_(
                        Anomaly.score == cursor_score,
                        Anomaly.id < cursor_uuid
                    )
                )
            )
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cursor format invalid."
            )

    if conditions:
        query = query.where(and_(*conditions))

    # Priority sorting: score DESC, id DESC
    query = query.order_by(Anomaly.score.desc(), Anomaly.id.desc()).limit(limit + 1)
    
    result = await db.execute(query)
    records = result.scalars().all()

    has_more = len(records) > limit
    data_records = records[:limit]

    next_cursor = None
    if has_more and data_records:
        last_rec = data_records[-1]
        next_cursor = f"{last_rec.score}|{str(last_rec.id)}"

    return {
        "data": [AnomalyResponse.from_orm(r) for r in data_records],
        "next_cursor": next_cursor,
        "has_more": has_more
    }

@router.get("/{id}", response_model=Dict[str, Any])
async def get_anomaly(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    api_key: str = Depends(verify_api_key)
):
    """Retrieve anomaly profile + linked Event metadata."""
    anom_query = await db.execute(
        select(Anomaly).where(Anomaly.id == id)
    )
    anomaly = anom_query.scalar_one_or_none()
    
    if not anomaly:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Anomaly alert not found."
        )

    # Fetch linked event
    evt_query = await db.execute(
        select(Event).where(Event.id == anomaly.event_id)
    )
    event = evt_query.scalar_one_or_none()

    # Fetch correlated incident details if correlation_id present
    incident = None
    if event and event.correlation_id:
        inc_query = await db.execute(
            select(Incident).where(Incident.correlation_id == event.correlation_id)
        )
        incident = inc_query.scalar_one_or_none()

    return {
        "anomaly": AnomalyResponse.from_orm(anomaly),
        "linked_event": event,
        "linked_incident": incident
    }

@router.patch("/{id}", response_model=AnomalyResponse)
async def update_anomaly_status(
    id: uuid.UUID,
    input_data: AnomalyUpdateInput,
    db: AsyncSession = Depends(get_db),
    api_key: str = Depends(verify_api_key)
):
    """
    Idempotently update security anomaly status logs.
    Handles transitions (Open -> Acknowledged -> Resolved).
    """
    anom_query = await db.execute(
        select(Anomaly).where(Anomaly.id == id)
    )
    anomaly = anom_query.scalar_one_or_none()
    
    if not anomaly:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Anomaly alert not found."
        )

    # Valid status check
    new_status = input_data.status.lower()
    if new_status not in [AnomalyStatus.OPEN, AnomalyStatus.ACKNOWLEDGED, AnomalyStatus.INVESTIGATING, AnomalyStatus.RESOLVED]:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid status transition requested."
        )

    now = datetime.utcnow()
    anomaly.status = AnomalyStatus(new_status)
    
    # Save triage timestamps
    if new_status == AnomalyStatus.ACKNOWLEDGED:
        anomaly.acknowledged_at = now
    elif new_status == AnomalyStatus.RESOLVED:
        if not anomaly.acknowledged_at:
            anomaly.acknowledged_at = now
        anomaly.resolved_at = now
        
    if input_data.note:
        anomaly.note = input_data.note

    await db.commit()
    await db.refresh(anomaly)

    return AnomalyResponse.from_orm(anomaly)
