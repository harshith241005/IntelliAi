"""
Event schema and domain models for Store Intelligence System.
All events flow through this schema from detection pipeline → API → analytics.
"""
from typing import Optional, Any, Dict
from enum import Enum
from datetime import datetime
from pydantic import BaseModel, Field
import uuid


class EventType(str, Enum):
    """Event type catalogue as per challenge specification."""
    ENTRY = "ENTRY"
    EXIT = "EXIT"
    ZONE_ENTER = "ZONE_ENTER"
    ZONE_EXIT = "ZONE_EXIT"
    ZONE_DWELL = "ZONE_DWELL"
    BILLING_QUEUE_JOIN = "BILLING_QUEUE_JOIN"
    BILLING_QUEUE_ABANDON = "BILLING_QUEUE_ABANDON"
    REENTRY = "REENTRY"


class EventMetadata(BaseModel):
    """Event metadata - optional contextual information."""
    queue_depth: Optional[int] = Field(None, description="Queue depth when joining billing zone")
    sku_zone: Optional[str] = Field(None, description="Zone label from store_layout.json")
    session_seq: int = Field(0, description="Ordinal position in visitor session")
    group_size: Optional[int] = Field(None, description="Size of group entry")
    group_id: Optional[str] = Field(None, description="Group entry identifier")


class StoreEvent(BaseModel):
    """
    Core event schema - emitted by detection pipeline.
    Every event must validate against this schema.
    """
    event_id: str = Field(
        default_factory=lambda: str(uuid.uuid4()),
        description="Globally unique UUID-v4 for this event"
    )
    store_id: str = Field(..., description="Store identifier from store_layout.json")
    camera_id: str = Field(..., description="Which camera produced this event")
    visitor_id: str = Field(..., description="Re-ID token - unique per visit session")
    event_type: EventType = Field(..., description="Type of event")
    timestamp: str = Field(..., description="ISO-8601 UTC timestamp")
    zone_id: Optional[str] = Field(None, description="Zone name; null for ENTRY/EXIT")
    dwell_ms: int = Field(0, description="Duration in milliseconds; 0 for instantaneous")
    is_staff: bool = Field(False, description="True if classified as store staff")
    confidence: float = Field(..., description="Detection confidence 0.0-1.0")
    metadata: EventMetadata = Field(default_factory=EventMetadata)

    class Config:
        json_schema_extra = {
            "example": {
                "event_id": "550e8400-e29b-41d4-a716-446655440000",
                "store_id": "STORE_BLR_002",
                "camera_id": "CAM_ENTRY_01",
                "visitor_id": "VIS_c8a2f1",
                "event_type": "ZONE_DWELL",
                "timestamp": "2026-03-03T14:22:10Z",
                "zone_id": "SKINCARE",
                "dwell_ms": 8400,
                "is_staff": False,
                "confidence": 0.91,
                "metadata": {
                    "queue_depth": None,
                    "sku_zone": "MOISTURISER",
                    "session_seq": 5
                }
            }
        }

    def dict_exclude_defaults(self) -> Dict[str, Any]:
        """Return dict excluding None values and defaults."""
        return self.dict(exclude_none=True)


class EventBatch(BaseModel):
    """Batch of events for ingestion."""
    events: list[StoreEvent] = Field(..., max_items=500)

    class Config:
        json_schema_extra = {
            "example": {
                "events": [
                    {
                        "event_id": "550e8400-e29b-41d4-a716-446655440000",
                        "store_id": "STORE_BLR_002",
                        "camera_id": "CAM_ENTRY_01",
                        "visitor_id": "VIS_c8a2f1",
                        "event_type": "ENTRY",
                        "timestamp": "2026-03-03T14:22:10Z",
                        "zone_id": None,
                        "dwell_ms": 0,
                        "is_staff": False,
                        "confidence": 0.94,
                        "metadata": {"queue_depth": None, "sku_zone": None, "session_seq": 1}
                    }
                ]
            }
        }
