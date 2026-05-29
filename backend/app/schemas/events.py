from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, Dict, Any, List
import uuid

class FrameIngestInput(BaseModel):
    camera_id: uuid.UUID
    frame_id: str
    captured_at: datetime
    media_url: Optional[str] = None

class EventPayload(BaseModel):
    coordinates: Optional[Dict[str, Any]] = None
    bbox: Optional[List[float]] = None
    label: Optional[str] = None
    class_name: Optional[str] = Field(default=None, alias="class")
    speed: Optional[float] = None
    dwell_time: Optional[float] = None
    dwell_ms: Optional[float] = None
    count: Optional[int] = None
    message: Optional[str] = None
    path: Optional[List[List[float]]] = None
    velocity: Optional[float] = None
    anomaly_type: Optional[str] = None
    reason: Optional[str] = None
    threshold: Optional[float] = None
    title: Optional[str] = None
    assigned_to: Optional[str] = None
    sla_deadline: Optional[datetime] = None
    fps: Optional[float] = None
    frames_processed: Optional[int] = None
    model_version: Optional[str] = None
    stage: Optional[str] = None
    error: Optional[str] = None
    retry_count: Optional[int] = None

    class Config:
        populate_by_name = True

class CCTVEventResponse(BaseModel):
    event_id: uuid.UUID = Field(alias="event_id")
    event_type: str
    schema_version: str = "1.0"
    timestamp: datetime
    store_id: uuid.UUID
    camera_id: uuid.UUID
    zone_id: Optional[str] = None
    track_id: Optional[str] = None
    severity: str
    confidence: Optional[float] = None
    anomaly_score: Optional[float] = None
    correlation_id: Optional[uuid.UUID] = None
    media_url: Optional[str] = None
    payload: Dict[str, Any]

    class Config:
        from_attributes = True
        populate_by_name = True
