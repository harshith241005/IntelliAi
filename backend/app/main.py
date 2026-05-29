import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.db.base import Base
from app.db.session import engine
from app.streaming.redis_bus import redis_bus
from app.streaming.ws_manager import ws_manager

# REST & Streaming Routers
from app.api.v1.stores import router as stores_router
from app.api.v1.cameras import router as cameras_router
from app.api.v1.events import router as events_router
from app.api.v1.anomalies import router as anomalies_router
from app.api.v1.incidents import router as incidents_router
from app.api.v1.analytics import router as analytics_router
from app.api.v1.health import router as health_router
from app.api.v1.stream import router as stream_router

# Setup logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("store_intelligence.main")

# Background tasks references
bg_tasks = set()

async def redis_to_ws_broadcaster():
    """Continuously fetch real-time events from Redis Streams and broadcast via WebSockets."""
    logger.info("Starting Redis-to-WS event broker loop...")
    async for event_str in redis_bus.subscribe_stream():
        try:
            await ws_manager.broadcast_event(event_str)
        except Exception as e:
            logger.error(f"Event broadcasting loop error: {e}")

async def mock_frame_pipeline_ticker():
    """Background simulator driving CCTV frame processing ticks across all online cameras."""
    logger.info("Initializing Mock CCTV Frame Pipeline Simulator...")
    await asyncio.sleep(5) # wait for DB seeding to finish
    
    from sqlalchemy.ext.asyncio import AsyncSession
    from app.db.session import async_session
    from app.db.models import Camera, CameraStatus
    from app.pipeline.publisher import pipeline_publisher
    from datetime import datetime

    while True:
        try:
            async with async_session() as session:
                # Load online cameras
                cam_query = await session.execute(
                    select(Camera).where(Camera.status != CameraStatus.OFFLINE)
                )
                online_cameras = cam_query.scalars().all()

                if online_cameras:
                    now = datetime.utcnow()
                    # Trigger frame processing tick for one random online camera to distribute feed loads
                    target_cam = random.choice(online_cameras)
                    frame_id = f"frame_sim_{int(now.timestamp())}_{random.randint(1000, 9999)}"
                    
                    logger.debug(f"Simulator: Processing frame {frame_id} on camera {target_cam.name}")
                    await pipeline_publisher.process_frame(session, target_cam.id, frame_id, now)
        except Exception as e:
            logger.error(f"Simulator frame loop exception: {e}")
        
        await asyncio.sleep(settings.MOCK_EVENT_INTERVAL_MS / 1000.0)

# Import extra helpers needed inside mock pipeline ticker
import random
from sqlalchemy import select

@asynccontextmanager
async def lifespan(app: FastAPI):
    # --- STARTUP HOOK ---
    logger.info("Initializing Store Intelligence Backend lifespans...")
    
    # 1. Automate database tables creation for plug-and-play local running
    async with engine.begin() as conn:
        logger.info("Synchronizing SQLAlchemy declarative metadata schemas...")
        await conn.run_sync(Base.metadata.create_all)

    # 2. Run Database Seeder automatically if DB empty
    try:
        from scripts.seed import seed_database
        await seed_database()
    except Exception as e:
        logger.error(f"Failed to execute automated database seed checklist: {e}")

    # 3. Establish Event Bus connection (Redis / Memory)
    await redis_bus.connect()

    # 4. Spin up WebSocket heartbeat pinger
    heartbeat_task = asyncio.create_task(ws_manager.run_heartbeat_loop())
    bg_tasks.add(heartbeat_task)

    # 5. Spin up Redis-to-WS event multiplexer broker
    broker_task = asyncio.create_task(redis_to_ws_broadcaster())
    bg_tasks.add(broker_task)

    # 6. Spin up Mock CCTV Ingestion Pipeline Ticker if MOCK_PIPELINE is true
    if settings.MOCK_PIPELINE:
        ticker_task = asyncio.create_task(mock_frame_pipeline_ticker())
        bg_tasks.add(ticker_task)

    yield
    # --- SHUTDOWN HOOK ---
    logger.info("Tearing down lifespans...")
    for task in bg_tasks:
        task.cancel()
    await engine.dispose()
    logger.info("Engine disposed. Shutdown nominal.")

# Instantiate FastAPI Core
app = FastAPI(
    title="Store Intelligence Platform API",
    description="Production-grade event-driven retail ops backend powered by CCTV tracking metadata",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# REST v1 sub-routing
v1_app = FastAPI(title="Store Intelligence v1 API")
v1_app.include_router(stores_router)
v1_app.include_router(cameras_router)
v1_app.include_router(events_router)
v1_app.include_router(anomalies_router)
v1_app.include_router(incidents_router)
v1_app.include_router(analytics_router)
v1_app.include_router(stream_router)

# Mount REST v1 sub-application
app.mount("/api/v1", v1_app)
# Mount observability health checks directly on root as requested
app.include_router(health_router, prefix="/api/v1")

@app.get("/", tags=["root"])
async def root_ping():
    return {
        "status": "online",
        "system": "Store Intelligence System Platform Backend Active",
        "docs_endpoints": "/docs"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.API_HOST,
        port=settings.API_PORT,
        reload=False
    )
