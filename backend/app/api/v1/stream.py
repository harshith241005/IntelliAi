import asyncio
import json
import logging
from typing import Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from fastapi.responses import StreamingResponse
from app.streaming.ws_manager import ws_manager
from app.streaming.redis_bus import redis_bus

router = APIRouter(prefix="/events/stream", tags=["streaming"])
logger = logging.getLogger("store_intelligence.stream")

@router.websocket("")
async def websocket_stream(
    websocket: WebSocket,
    store_id: Optional[str] = Query(None),
    min_severity: Optional[str] = Query(None)
):
    """
    WebSocket streaming endpoint.
    Client upgrades socket, subscribes to Redis Pub/Sub fans, and receives heartbeats.
    """
    await ws_manager.connect(websocket, store_id, min_severity)
    
    try:
        # Keep connection open. WebSocket heartbeats handled in manager background loops
        while True:
            # Check for incoming client messages (e.g. client heartbeats or filters)
            data = await websocket.receive_text()
            # If client replies to ping
            msg = json.loads(data)
            if msg.get("type") == "pong":
                # heartbeat nominal
                pass
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket client loop error: {e}")
        ws_manager.disconnect(websocket)

@router.get("/sse")
async def sse_stream(
    store_id: Optional[str] = Query(None),
    min_severity: Optional[str] = Query(None)
):
    """
    Server-Sent Events fallback streaming endpoint.
    Emits pipeline events as standard text/event-stream blocks.
    """
    severity_ranks = {"info": 1, "warning": 2, "critical": 3}

    async def event_generator():
        logger.info(f"SSE client registered: store_id={store_id}, min_severity={min_severity}")
        
        async for event_str in redis_bus.subscribe_stream():
            try:
                # 1. Filter: Store ID match
                event_data = json.loads(event_str)
                if store_id and event_data.get("store_id") != store_id:
                    continue

                # 2. Filter: Severity match
                if min_severity:
                    evt_sev = event_data.get("severity", "info")
                    if severity_ranks.get(evt_sev, 1) < severity_ranks.get(min_severity, 1):
                        continue

                # Standard SSE format
                yield f"event: message\ndata: {event_str}\n\n"
            except Exception as e:
                logger.error(f"SSE generator error: {e}")
                break

    return StreamingResponse(event_generator(), media_type="text/event-stream")
