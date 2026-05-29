import datetime
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text
from app.db.session import get_db
from app.db.models import PipelineMetric, Event, PipelineStage
from app.streaming.redis_bus import redis_bus
from app.api.deps import verify_api_key

router = APIRouter(tags=["observability"])

@router.get("/health", response_model=Dict[str, Any])
async def system_health(
    db: AsyncSession = Depends(get_db)
):
    """
    Query system health check.
    Verifies DB status, Redis status, and pipeline heartbeat checks.
    """
    db_healthy = False
    redis_healthy = redis_bus.is_connected
    pipeline_active = False

    # 1. DB ping check
    try:
        await db.execute(text("SELECT 1"))
        db_healthy = True
    except Exception:
        db_healthy = False

    # 2. Pipeline metrics heartbeat check (metrics recorded in past 60s)
    try:
        heartbeat_query = await db.execute(
            select(PipelineMetric)
            .order_by(PipelineMetric.recorded_at.desc())
            .limit(1)
        )
        last_metric = heartbeat_query.scalar_one_or_none()
        if last_metric:
            now = datetime.datetime.utcnow()
            # If database timezone check matches, check if under 60 seconds
            diff = (now - last_metric.recorded_at.replace(tzinfo=None)).total_seconds()
            if diff < 60.0:
                pipeline_active = True
    except Exception:
        pipeline_active = False

    status_str = "ok"
    if not db_healthy:
        status_str = "down"
    elif not redis_healthy or not pipeline_active:
        status_str = "degraded"

    return {
        "status": status_str,
        "checks": {
            "db": "up" if db_healthy else "down",
            "redis": "up" if redis_healthy else "down",
            "pipeline_heartbeat": "up" if pipeline_active else "down"
        }
    }

@router.get("/metrics/latency", response_model=Dict[str, Any])
async def query_pipeline_latency(
    from_time: Optional[datetime.datetime] = Query(None, alias="from"),
    to_time: Optional[datetime.datetime] = Query(None, alias="to"),
    db: AsyncSession = Depends(get_db),
    api_key: str = Depends(verify_api_key)
):
    """Deliver p50/p95/p99 pipeline latencies grouped by execution stages."""
    # In SQLite, full statistical percentiles are not built-in like Postgres PERCENTILE_CONT
    # We load metrics and aggregate statistical values in Python to be fully dual-driver compatible!
    query = select(PipelineMetric)
    
    conditions = []
    if from_time:
        conditions.append(PipelineMetric.recorded_at >= from_time)
    if to_time:
        conditions.append(PipelineMetric.recorded_at <= to_time)
        
    if conditions:
        query = query.where(*conditions)

    result = await db.execute(query)
    metrics = result.scalars().all()

    # Group metrics by stage
    stage_data: Dict[str, List[float]] = {}
    for m in metrics:
        stage_data[m.stage] = stage_data.get(m.stage, [])
        stage_data[m.stage].append(m.latency_ms)

    response = {}
    for stage_str, latencies in stage_data.items():
        if not latencies:
            continue
        sorted_lats = sorted(latencies)
        n = len(sorted_lats)
        
        p50 = sorted_lats[int(n * 0.50)]
        p95 = sorted_lats[int(n * 0.95)] if n > 1 else p50
        p99 = sorted_lats[int(n * 0.99)] if n > 1 else p50

        response[stage_str] = {
            "p50": round(p50, 2),
            "p95": round(p95, 2),
            "p99": round(p99, 2),
            "count": n
        }

    return response

@router.get("/metrics/throughput", response_model=Dict[str, Any])
async def query_throughput(
    db: AsyncSession = Depends(get_db),
    api_key: str = Depends(verify_api_key)
):
    """Query E2E throughput: events ingested vs published and lag indicators."""
    now = datetime.datetime.utcnow()
    one_min_ago = now - datetime.timedelta(minutes=1)

    # Ingest count per minute
    ingest_query = await db.execute(
        select(func.count(Event.id))
        .where(Event.event_type == "detection")
        .where(Event.timestamp >= one_min_ago)
    )
    ingested = ingest_query.scalar() or 0

    # Publish count per minute
    publish_query = await db.execute(
        select(func.count(Event.id))
        .where(Event.event_type.in_(["track_update", "anomaly"]))
        .where(Event.timestamp >= one_min_ago)
    )
    published = publish_query.scalar() or 0

    # Average metrics queue ingestion lag ms
    lag_query = await db.execute(
        select(func.avg(PipelineMetric.latency_ms))
        .where(PipelineMetric.stage == PipelineStage.INGEST)
    )
    avg_lag = lag_query.scalar() or 0.0

    return {
        "events_ingested_per_min": ingested,
        "events_processed_per_min": published,
        "average_ingestion_lag_ms": round(float(avg_lag), 2)
    }

@router.get("/metrics/errors", response_model=List[Dict[str, Any]])
async def list_pipeline_errors(
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
    api_key: str = Depends(verify_api_key)
):
    """paginated list of recent pipeline exceptions recorded."""
    query = (
        select(PipelineMetric)
        .where(PipelineMetric.success == False)
        .order_by(PipelineMetric.recorded_at.desc())
        .limit(limit)
    )
    
    result = await db.execute(query)
    records = result.scalars().all()

    return [
        {
            "id": r.id,
            "stage": r.stage,
            "store_id": str(r.store_id) if r.store_id else None,
            "latency_ms": r.latency_ms,
            "error_code": r.error_code,
            "recorded_at": r.recorded_at
        } for r in records
    ]
