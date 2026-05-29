import uuid
import datetime
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from app.db.session import get_db
from app.db.models import Event, Anomaly
from app.schemas.analytics import (
    FootfallBucket, ZoneAnalyticsBucket, AnomalyAnalyticsBucket, EventBreakdownBucket
)
from app.api.deps import verify_api_key
from app.streaming.redis_bus import redis_bus

router = APIRouter(prefix="/analytics", tags=["analytics"])

@router.get("/footfall", response_model=List[FootfallBucket])
async def query_footfall(
    store_id: Optional[uuid.UUID] = None,
    from_time: Optional[datetime.datetime] = Query(None, alias="from"),
    to_time: Optional[datetime.datetime] = Query(None, alias="to"),
    granularity: str = "1h", # 1m | 5m | 1h | 1d
    db: AsyncSession = Depends(get_db),
    api_key: str = Depends(verify_api_key)
):
    """
    Compute footfall rollups:
    unique_tracks = COUNT DISTINCT track_id where event_type IN (track_update, zone_enter).
    total_detections = COUNT where event_type = detection.
    """
    # 1. Caching key logic in Redis if connected
    cache_key = f"analytics:footfall:{store_id}:{from_time}:{to_time}:{granularity}"
    if redis_bus.is_connected and redis_bus.client:
        try:
            cached_val = await redis_bus.client.get(cache_key)
            if cached_val:
                import json
                return json.loads(cached_val)
        except Exception:
            pass

    conditions = []
    if store_id:
        conditions.append(Event.store_id == store_id)
    if from_time:
        conditions.append(Event.timestamp >= from_time)
    if to_time:
        conditions.append(Event.timestamp <= to_time)

    # For v1 SQLite/Postgres time bucketing fallback
    # In a full Postgres setup, we can use date_trunc, but in SQLite strftime is standard
    # We will use query-time SQL structures
    # We fetch events and roll them up in memory to guarantee perfect Postgres/SQLite dual-driver compatibility!
    event_query = select(Event)
    if conditions:
        event_query = event_query.where(and_(*conditions))
    
    result = await db.execute(event_query)
    events = result.scalars().all()

    # Bucketing aggregator
    buckets: Dict[str, Dict[str, Any]] = {}
    
    for evt in events:
        t = evt.timestamp
        if granularity == "1m":
            bucket_str = t.strftime("%Y-%m-%d %H:%M")
        elif granularity == "5m":
            min_bucket = (t.minute // 5) * 5
            bucket_str = f"{t.strftime('%Y-%m-%d %H')}:{min_bucket:02d}"
        elif granularity == "1d":
            bucket_str = t.strftime("%Y-%m-%d")
        else: # 1h default
            bucket_str = t.strftime("%Y-%m-%d %H:00")

        if bucket_str not in buckets:
            buckets[bucket_str] = {
                "bucket": bucket_str,
                "tracks": set(),
                "detections": 0
            }

        if evt.event_type == "detection":
            buckets[bucket_str]["detections"] += 1
        elif evt.event_type in ["track_update", "zone_enter"] and evt.track_id:
            buckets[bucket_str]["tracks"].add(evt.track_id)

    response = []
    for b_key in sorted(buckets.keys()):
        response.append(FootfallBucket(
            bucket=buckets[b_key]["bucket"],
            unique_tracks=len(buckets[b_key]["tracks"]),
            total_detections=buckets[b_key]["detections"]
        ))

    # Save to cache with 60s expiration TTL
    if redis_bus.is_connected and redis_bus.client:
        try:
            import json
            await redis_bus.client.setex(
                cache_key, 
                60, 
                json.dumps([r.model_dump() for r in response])
            )
        except Exception:
            pass

    return response

@router.get("/zones", response_model=List[ZoneAnalyticsBucket])
async def query_zones(
    store_id: Optional[uuid.UUID] = None,
    from_time: Optional[datetime.datetime] = Query(None, alias="from"),
    to_time: Optional[datetime.datetime] = Query(None, alias="to"),
    db: AsyncSession = Depends(get_db),
    api_key: str = Depends(verify_api_key)
):
    """Retrieve zone specific analytics: enters, exits and average dwell times."""
    conditions = []
    if store_id:
        conditions.append(Event.store_id == store_id)
    if from_time:
        conditions.append(Event.timestamp >= from_time)
    if to_time:
        conditions.append(Event.timestamp <= to_time)
    
    # Query transition enters/exits events
    conditions.append(Event.event_type.in_(["zone_enter", "zone_exit"]))

    query = select(Event)
    if conditions:
        query = query.where(and_(*conditions))

    result = await db.execute(query)
    events = result.scalars().all()

    zone_stats = {}
    for evt in events:
        z_id = evt.zone_id or "zone_unknown"
        if z_id not in zone_stats:
            zone_stats[z_id] = {
                "zone_id": z_id,
                "enter_count": 0,
                "exit_count": 0,
                "dwell_sums": 0.0,
                "dwell_count": 0
            }

        if evt.event_type == "zone_enter":
            zone_stats[z_id]["enter_count"] += 1
        elif evt.event_type == "zone_exit":
            zone_stats[z_id]["exit_count"] += 1
            dwell = evt.payload.get("dwell_ms", 0.0)
            if dwell:
                zone_stats[z_id]["dwell_sums"] += float(dwell)
                zone_stats[z_id]["dwell_count"] += 1

    response = []
    for z_id, stats in zone_stats.items():
        avg_dwell = (stats["dwell_sums"] / stats["dwell_count"]) if stats["dwell_count"] > 0 else 0.0
        response.append(ZoneAnalyticsBucket(
            zone_id=stats["zone_id"],
            enter_count=stats["enter_count"],
            exit_count=stats["exit_count"],
            avg_dwell_ms=round(avg_dwell, 1)
        ))

    return response

@router.get("/anomalies", response_model=List[AnomalyAnalyticsBucket])
async def query_anomalies_analytics(
    store_id: Optional[uuid.UUID] = None,
    from_time: Optional[datetime.datetime] = Query(None, alias="from"),
    to_time: Optional[datetime.datetime] = Query(None, alias="to"),
    granularity: str = "1h",
    db: AsyncSession = Depends(get_db),
    api_key: str = Depends(verify_api_key)
):
    """Retrieve anomaly trigger counts comparisons grouped by category types."""
    conditions = []
    if store_id:
        conditions.append(Anomaly.store_id == store_id)
    if from_time:
        conditions.append(Anomaly.created_at >= from_time)
    if to_time:
        conditions.append(Anomaly.created_at <= to_time)

    query = select(Anomaly)
    if conditions:
        query = query.where(and_(*conditions))

    result = await db.execute(query)
    anoms = result.scalars().all()

    buckets = {}
    for an in anoms:
        t = an.created_at
        if granularity == "1d":
            bucket_str = t.strftime("%Y-%m-%d")
        else:
            bucket_str = t.strftime("%Y-%m-%d %H:00")

        if bucket_str not in buckets:
            buckets[bucket_str] = {}

        buckets[bucket_str][an.anomaly_type] = buckets[bucket_str].get(an.anomaly_type, 0) + 1

    response = []
    for b_key in sorted(buckets.keys()):
        response.append(AnomalyAnalyticsBucket(
            bucket=b_key,
            count_by_type=buckets[b_key]
        ))

    return response

@router.get("/events/breakdown", response_model=List[EventBreakdownBucket])
async def query_events_breakdown(
    store_id: Optional[uuid.UUID] = None,
    from_time: Optional[datetime.datetime] = Query(None, alias="from"),
    to_time: Optional[datetime.datetime] = Query(None, alias="to"),
    db: AsyncSession = Depends(get_db),
    api_key: str = Depends(verify_api_key)
):
    """Retrieve aggregates of pipeline frame events by category types."""
    conditions = []
    if store_id:
        conditions.append(Event.store_id == store_id)
    if from_time:
        conditions.append(Event.timestamp >= from_time)
    if to_time:
        conditions.append(Event.timestamp <= to_time)

    query = select(Event.event_type, func.count(Event.id))
    if conditions:
        query = query.where(and_(*conditions))
    
    query = query.group_by(Event.event_type)
    
    result = await db.execute(query)
    rows = result.all()

    return [
        EventBreakdownBucket(event_type=r[0], count=r[1]) for r in rows
    ]
