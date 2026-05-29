from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List
import uuid

class AnomalyUpdateInput(BaseModel):
    status: str
    note: Optional[str] = None

class OperatorNote(BaseModel):
    timestamp: datetime
    operator: str
    text: str

class AnomalyResponse(BaseModel):
    id: uuid.UUID
    event_id: uuid.UUID
    store_id: uuid.UUID
    camera_id: uuid.UUID
    anomaly_type: str
    score: float
    status: str
    note: Optional[str] = None
    acknowledged_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class IncidentResponse(BaseModel):
    id: uuid.UUID
    correlation_id: uuid.UUID
    store_id: uuid.UUID
    severity: str
    status: str
    title: str
    event_count: int
    opened_at: datetime
    resolved_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class IncidentTimelineResponse(BaseModel):
    incident: IncidentResponse
    timeline: List[dict] # Ordered correlated events list
