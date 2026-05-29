import asyncio
import json
import logging
from typing import List, Dict, Optional, Set
from fastapi import WebSocket

logger = logging.getLogger("store_intelligence.ws")

class WebSocketConnectionManager:
    def __init__(self):
        # Maps active WebSocket client to filter specifications
        self.active_connections: Dict[WebSocket, Dict[str, Any]] = {}

    async def connect(self, websocket: WebSocket, store_id: Optional[str] = None, min_severity: Optional[str] = None):
        await websocket.accept()
        
        # Save connection details with filters
        self.active_connections[websocket] = {
            "store_id": store_id,
            "min_severity": min_severity
        }
        logger.info(f"New client socket registered. Total clients: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            del self.active_connections[websocket]
            logger.info(f"Client socket disconnected. Remaining: {len(self.active_connections)}")

    async def broadcast_event(self, event_str: str):
        """Dispatch event frame selectively based on subscriber filter preferences."""
        event_data = json.loads(event_str)
        event_store_id = event_data.get("store_id")
        event_severity = event_data.get("severity", "info")

        severity_ranks = {"info": 1, "warning": 2, "critical": 3}
        event_rank = severity_ranks.get(event_severity, 1)

        disconnected_clients = []

        for ws, filters in list(self.active_connections.items()):
            try:
                # 1. Filter: Store ID match
                f_store = filters.get("store_id")
                if f_store and f_store != event_store_id:
                    continue

                # 2. Filter: Severity match
                f_severity = filters.get("min_severity")
                if f_severity:
                    f_rank = severity_ranks.get(f_severity, 1)
                    if event_rank < f_rank:
                        continue

                await ws.send_text(event_str)
            except Exception as e:
                logger.warning(f"Error writing to WebSocket, scheduling disconnect: {e}")
                disconnected_clients.append(ws)

        for ws in disconnected_clients:
            self.disconnect(ws)

    async def run_heartbeat_loop(self):
        """Periodically ping clients to clear dead ghost sockets."""
        while True:
            await asyncio.sleep(30)
            dead_sockets = []
            for ws in list(self.active_connections.keys()):
                try:
                    # Send standard ping
                    await ws.send_json({"type": "ping"})
                except Exception:
                    dead_sockets.append(ws)
            
            for ws in dead_sockets:
                self.disconnect(ws)

ws_manager = WebSocketConnectionManager()
