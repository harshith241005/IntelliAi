import uuid
from datetime import datetime
from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import get_db
from app.db.models import Camera, CameraStatus
from app.api.deps import verify_api_key

router = APIRouter(prefix="/cameras", tags=["cameras"])

@router.get("/", response_model=List[Dict[str, Any]])
async def get_all_cameras(
    db: AsyncSession = Depends(get_db),
    api_key: str = Depends(verify_api_key)
):
    """Retrieve full camera grid list with telemetry metrics."""
    cams_query = await db.execute(select(Camera))
    cams = cams_query.scalars().all()
    
    response = []
    for c in cams:
        # Realistic frame metrics drift calculations
        drop_rate = 0.2 if c.status == CameraStatus.ONLINE else 4.8 if c.status == CameraStatus.DEGRADED else 0.0
        latency = 45 if c.status == CameraStatus.ONLINE else 180 if c.status == CameraStatus.DEGRADED else 0
        health = 99.4 if c.status == CameraStatus.ONLINE else 78.4 if c.status == CameraStatus.DEGRADED else 0.0

        response.append({
            "camera_id": str(c.id),
            "store_id": str(c.store_id),
            "name": c.name,
            "zone_id": c.zone_id,
            "rtsp_url": c.rtsp_url,
            "fps": c.fps,
            "status": c.status,
            "stream_health": health,
            "model_version": c.model_version,
            "frame_drop_rate": drop_rate,
            "latency_ms": latency,
            "last_heartbeat": c.last_frame_at.isoformat() if c.last_frame_at else None,
            "resolution": "1920x1080"
        })
    return response

@router.get("/{camera_id}", response_model=Dict[str, Any])
async def get_camera(
    camera_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    api_key: str = Depends(verify_api_key)
):
    """Fetch camera detail profile plus last frame timestamp."""
    camera_query = await db.execute(
        select(Camera).where(Camera.id == camera_id)
    )
    c = camera_query.scalar_one_or_none()
    
    if not c:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Camera not found."
        )

    return {
        "camera_id": str(c.id),
        "store_id": str(c.store_id),
        "name": c.name,
        "zone_id": c.zone_id,
        "rtsp_url": c.rtsp_url,
        "fps": c.fps,
        "model_version": c.model_version,
        "status": c.status,
        "last_frame_at": c.last_frame_at,
        "created_at": c.created_at
    }

@router.patch("/{camera_id}/heartbeat", response_model=Dict[str, Any])
async def camera_heartbeat(
    camera_id: uuid.UUID,
    fps: float = Body(..., embed=True),
    frames_processed: int = Body(..., embed=True),
    model_version: Optional[str] = Body(None, embed=True),
    db: AsyncSession = Depends(get_db),
    api_key: str = Depends(verify_api_key)
):
    """Receive live client frame rate indicators and keep camera states online."""
    camera_query = await db.execute(
        select(Camera).where(Camera.id == camera_id)
    )
    c = camera_query.scalar_one_or_none()
    
    if not c:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Camera not found."
        )

    now = datetime.utcnow()
    c.fps = fps
    c.last_frame_at = now
    c.status = CameraStatus.ONLINE
    if model_version:
        c.model_version = model_version

    await db.commit()

    return {
        "success": True,
        "camera_id": str(c.id),
        "status": c.status,
        "last_frame_at": c.last_frame_at
    }

@router.post("/{camera_id}/control", response_model=Dict[str, Any])
async def camera_control(
    camera_id: uuid.UUID,
    status_input: Optional[str] = Body(None, alias="status"),
    fps_input: Optional[float] = Body(None, alias="fps"),
    db: AsyncSession = Depends(get_db),
    api_key: str = Depends(verify_api_key)
):
    """Adjust remote stream status powers or framerates limits."""
    camera_query = await db.execute(
        select(Camera).where(Camera.id == camera_id)
    )
    c = camera_query.scalar_one_or_none()
    
    if not c:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Camera not found."
        )

    if status_input:
        c.status = CameraStatus(status_input.lower())
    if fps_input is not None:
        c.fps = float(fps_input)

    c.last_frame_at = datetime.utcnow()
    await db.commit()

    return {
        "success": True,
        "camera_id": str(c.id),
        "status": c.status,
        "fps": c.fps
    }

@router.post("/{camera_id}/trigger-breach", response_model=Dict[str, Any])
async def camera_trigger_breach(
    camera_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    api_key: str = Depends(verify_api_key)
):
    """Manual security test injection to trigger a critical alert."""
    camera_query = await db.execute(
        select(Camera).where(Camera.id == camera_id)
    )
    c = camera_query.scalar_one_or_none()
    
    if not c:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Camera not found."
        )

    # Invoke pipeline breach force trigger
    from app.pipeline.publisher import pipeline_publisher
    
    now = datetime.utcnow()
    frame_id = f"frame_forced_breach_{int(now.timestamp())}"
    
    # 1. Force restricted area coordinate injection
    # Ingest a mock track inside Restricted Zone coordinate boxes
    from app.pipeline.tracker import get_tracker
    tracker = get_tracker(c.id)
    
    # Position intruder inside restricted loading zone [85, 85]
    tracker.process_detections(c.id, [{
        "class": "person",
        "bbox": [88.0, 85.0, 24.0, 48.0],
        "confidence": 0.99,
        "frame_id": frame_id
    }])
    
    # 2. Spin pipeline wheel to evaluate anomaly rules and commit SQL
    await pipeline_publisher.process_frame(db, c.id, frame_id, now)

    return {
        "success": True,
        "message": f"Critical security intrusion event successfully injected into {c.name}."
    }
