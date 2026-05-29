from pydantic import BaseModel
from typing import List, Dict

class FootfallBucket(BaseModel):
    bucket: str
    unique_tracks: int
    total_detections: int

class ZoneAnalyticsBucket(BaseModel):
    zone_id: str
    enter_count: int
    exit_count: int
    avg_dwell_ms: float

class AnomalyAnalyticsBucket(BaseModel):
    bucket: str
    count_by_type: Dict[str, int]

class EventBreakdownBucket(BaseModel):
    event_type: str
    count: int
