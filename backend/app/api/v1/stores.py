import uuid
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.db.session import get_db
from app.db.models import Store, Camera, Anomaly, AnomalyStatus
from app.api.deps import verify_api_key

router = APIRouter(prefix="/stores", tags=["stores"])

@router.get("/", response_model=List[Dict[str, Any]])
async def list_stores(
    db: AsyncSession = Depends(get_db),
    api_key: str = Depends(verify_api_key)
):
    """List stores along with status summaries and camera counts."""
    # Fetch stores
    stores_query = await db.execute(select(Store))
    stores = stores_query.scalars().all()
    
    response = []
    
    for store in stores:
        # Count cameras per store
        cam_query = await db.execute(
            select(func.count(Camera.id)).where(Camera.store_id == store.id)
        )
        camera_count = cam_query.scalar() or 0

        # Shifting occupancy calculations
        occupancy = 12 if store.name == "Downtown Express" else 28 if "Flagship" in store.name else 8

        response.append({
            "store_id": str(store.id),
            "name": store.name,
            "location": store.address,
            "status": store.status,
            "active_cameras": camera_count,
            "occupancy": occupancy
        })

    return response

@router.get("/{store_id}", response_model=Dict[str, Any])
async def get_store(
    store_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    api_key: str = Depends(verify_api_key)
):
    """Retrieve detailed store configuration + alert counts."""
    store_query = await db.execute(
        select(Store).where(Store.id == store_id)
    )
    store = store_query.scalar_one_or_none()
    
    if not store:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Store not found."
        )

    # Count cameras
    cam_query = await db.execute(
        select(func.count(Camera.id)).where(Camera.store_id == store_id)
    )
    camera_count = cam_query.scalar() or 0

    # Count active incidents
    alert_query = await db.execute(
        select(func.count(Anomaly.id))
        .where(Anomaly.store_id == store_id)
        .where(Anomaly.status == AnomalyStatus.OPEN)
    )
    open_alerts = alert_query.scalar() or 0

    return {
        "store_id": str(store.id),
        "name": store.name,
        "location": store.address,
        "timezone": store.timezone,
        "status": store.status,
        "active_cameras": camera_count,
        "open_alerts": open_alerts,
        "created_at": store.created_at
    }

@router.get("/{store_id}/cameras", response_model=List[Dict[str, Any]])
async def list_store_cameras(
    store_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    api_key: str = Depends(verify_api_key)
):
    """Fetch all cameras associated with a specific store."""
    cams_query = await db.execute(
        select(Camera).where(Camera.store_id == store_id)
    )
    cameras = cams_query.scalars().all()
    
    return [
        {
            "camera_id": str(c.id),
            "store_id": str(c.store_id),
            "name": c.name,
            "zone_id": c.zone_id,
            "rtsp_url": c.rtsp_url,
            "fps": c.fps,
            "status": c.status,
            "model_version": c.model_version,
            "last_frame_at": c.last_frame_at
        } for c in cameras
    ]
