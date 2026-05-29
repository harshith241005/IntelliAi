import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from app.db.session import get_db
from app.db.models import Incident, Event, IncidentStatus
from app.schemas.anomalies import IncidentResponse
from app.schemas.events import CCTVEventResponse
from app.api.deps import verify_api_key

router = APIRouter(prefix="/incidents", tags=["incidents"])

@router.get("/", response_model=List[IncidentResponse])
async def list_incidents(
    store_id: Optional[uuid.UUID] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    severity: Optional[str] = None,
    from_time: Optional[datetime] = Query(None, alias="from"),
    to_time: Optional[datetime] = Query(None, alias="to"),
    db: AsyncSession = Depends(get_db),
    api_key: str = Depends(verify_api_key)
):
    """Query incidents list with time window filtering."""
    query = select(Incident)
    conditions = []

    if store_id:
        conditions.append(Incident.store_id == store_id)
    if status_filter:
        conditions.append(Incident.status == status_filter)
    if severity:
        conditions.append(Incident.severity == severity)
    if from_time:
        conditions.append(Incident.created_at >= from_time)
    if to_time:
        conditions.append(Incident.created_at <= to_time)

    if conditions:
        query = query.where(and_(*conditions))

    query = query.order_by(Incident.created_at.desc())
    
    result = await db.execute(query)
    records = result.scalars().all()

    return [IncidentResponse.from_orm(r) for r in records]

@router.get("/{id}", response_model=Dict[str, Any])
async def get_incident(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    api_key: str = Depends(verify_api_key)
):
    """Fetch incident detailed profile + chronological events correlation timeline."""
    inc_query = await db.execute(
        select(Incident).where(Incident.id == id)
    )
    incident = inc_query.scalar_one_or_none()
    
    if not incident:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Incident profile not found."
        )

    # Query chronological timeline events
    evt_query = await db.execute(
        select(Event)
        .where(Event.correlation_id == incident.correlation_id)
        .order_by(Event.timestamp.asc())
    )
    events = evt_query.scalars().all()

    return {
        "incident": IncidentResponse.from_orm(incident),
        "timeline": [CCTVEventResponse.from_orm(e).model_dump(by_alias=True, mode="json") for e in events]
    }

@router.patch("/{id}", response_model=IncidentResponse)
async def update_incident(
    id: uuid.UUID,
    status_input: str = Query(..., alias="status"),
    db: AsyncSession = Depends(get_db),
    api_key: str = Depends(verify_api_key)
):
    """Idempotently triage incident tracking status."""
    inc_query = await db.execute(
        select(Incident).where(Incident.id == id)
    )
    incident = inc_query.scalar_one_or_none()
    
    if not incident:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Incident not found."
        )

    new_status = status_input.lower()
    if new_status not in [IncidentStatus.OPEN, IncidentStatus.INVESTIGATING, IncidentStatus.RESOLVED]:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid incident status transition."
        )

    incident.status = IncidentStatus(new_status)
    if new_status == IncidentStatus.RESOLVED:
        incident.resolved_at = datetime.utcnow()

    await db.commit()
    await db.refresh(incident)

    return IncidentResponse.from_orm(incident)
