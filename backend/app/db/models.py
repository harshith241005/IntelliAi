import uuid
from datetime import datetime
from enum import Enum as PyEnum
from typing import Optional, Dict, Any
from sqlalchemy import String, Float, DateTime, Boolean, ForeignKey, Index, BigInteger, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base

# Enums
class StoreStatus(str, PyEnum):
    ONLINE = "online"
    DEGRADED = "degraded"
    OFFLINE = "offline"

class CameraStatus(str, PyEnum):
    ONLINE = "online"
    DEGRADED = "degraded"
    OFFLINE = "offline"

class SeverityLevel(str, PyEnum):
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"

class AnomalyStatus(str, PyEnum):
    OPEN = "open"
    ACKNOWLEDGED = "acknowledged"
    INVESTIGATING = "investigating"
    RESOLVED = "resolved"

class IncidentStatus(str, PyEnum):
    OPEN = "open"
    INVESTIGATING = "investigating"
    RESOLVED = "resolved"

class PipelineStage(str, PyEnum):
    INGEST = "ingest"
    DETECT = "detect"
    TRACK = "track"
    ENRICH = "enrich"
    PUBLISH = "publish"

# 1. Stores model
class Store(Base):
    __tablename__ = "stores"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    address: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    timezone: Mapped[str] = mapped_column(String(100), default="UTC")
    status: Mapped[StoreStatus] = mapped_column(String(50), default=StoreStatus.ONLINE)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"), onupdate=datetime.utcnow)

    cameras = relationship("Camera", back_populates="store", cascade="all, delete-orphan")

# 2. Cameras model
class Camera(Base):
    __tablename__ = "cameras"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    store_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("stores.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    zone_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    rtsp_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    fps: Mapped[float] = mapped_column(Float, default=30.0)
    model_version: Mapped[str] = mapped_column(String(100), default="YOLOv8-v1")
    status: Mapped[CameraStatus] = mapped_column(String(50), default=CameraStatus.ONLINE)
    last_frame_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"), onupdate=datetime.utcnow)

    store = relationship("Store", back_populates="cameras")

# 3. Events model (immutable, partitioned by day recommended)
class Event(Base):
    __tablename__ = "events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_type: Mapped[str] = mapped_column(String(100), nullable=False)
    schema_version: Mapped[str] = mapped_column(String(10), default="1.0")
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    store_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("stores.id"), nullable=False)
    camera_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("cameras.id"), nullable=False)
    zone_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    track_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    severity: Mapped[SeverityLevel] = mapped_column(String(50), default=SeverityLevel.INFO)
    confidence: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    anomaly_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    correlation_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    payload: Mapped[Dict[str, Any]] = mapped_column(JSONB, default=dict)
    media_url: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"))

# Explicit events indexes
Index("idx_events_timestamp", Event.timestamp.desc())
Index("idx_events_store_timestamp", Event.store_id, Event.timestamp.desc())
Index("idx_events_type_timestamp", Event.event_type, Event.timestamp.desc())
Index("idx_events_track_id", Event.track_id, postgresql_where=text("track_id IS NOT NULL"))
Index("idx_events_correlation_id", Event.correlation_id, postgresql_where=text("correlation_id IS NOT NULL"))

# 4. Anomalies model
class Anomaly(Base):
    __tablename__ = "anomalies"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("events.id"), unique=True, nullable=False)
    store_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("stores.id"), nullable=False)
    camera_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("cameras.id"), nullable=False)
    anomaly_type: Mapped[str] = mapped_column(String(100), nullable=False)
    score: Mapped[float] = mapped_column(Float, default=0.0)
    status: Mapped[AnomalyStatus] = mapped_column(String(50), default=AnomalyStatus.OPEN)
    note: Mapped[Optional[str]] = mapped_column(String(2000), nullable=True)
    acknowledged_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"), onupdate=datetime.utcnow)

# Explicit anomalies status index
Index("idx_anomalies_status_score", Anomaly.status, Anomaly.score.desc())

# 5. Incidents model (correlated event groups)
class Incident(Base):
    __tablename__ = "incidents"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    correlation_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), unique=True, nullable=False, index=True)
    store_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("stores.id"), nullable=False)
    severity: Mapped[SeverityLevel] = mapped_column(String(50), default=SeverityLevel.INFO)
    status: Mapped[IncidentStatus] = mapped_column(String(50), default=IncidentStatus.OPEN)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    event_count: Mapped[int] = mapped_column(default=1)
    opened_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"))
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"), onupdate=datetime.utcnow)

# 6. Pipeline metrics (time-series friendly)
class PipelineMetric(Base):
    __tablename__ = "pipeline_metrics"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    stage: Mapped[PipelineStage] = mapped_column(String(50), nullable=False)
    store_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("stores.id"), nullable=True)
    latency_ms: Mapped[float] = mapped_column(Float, default=0.0)
    success: Mapped[bool] = mapped_column(Boolean, default=True)
    error_code: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"), index=True)
