import json
import logging
from typing import Optional, AsyncGenerator
import redis.asyncio as aioredis
from app.config import settings
from app.db.models import Event

logger = logging.getLogger("store_intelligence.redis")

class RedisEventBus:
    def __init__(self):
        self.redis_url = settings.REDIS_URL
        self.client: Optional[aioredis.Redis] = None
        self.is_connected = False
        self._local_subscribers = [] # local in-memory fanout fallback

    async def connect(self):
        try:
            logger.info(f"Connecting to Redis event bus: {self.redis_url}")
            self.client = aioredis.from_url(
                self.redis_url, 
                encoding="utf-8", 
                decode_responses=True,
                socket_connect_timeout=3.0
            )
            await self.client.ping()
            self.is_connected = True
            logger.info("Redis event bus connected successfully.")
        except Exception as e:
            self.is_connected = False
            self.client = None
            logger.warning(f"Redis not available. Degrading gracefully to in-memory Pub/Sub: {e}")

    async def publish_event(self, event_dict: dict):
        event_str = json.dumps(event_dict)
        
        # 1. Publish to Redis Stream + Pub/Sub
        if self.is_connected and self.client:
            try:
                # XADD to Redis Stream
                await self.client.xadd("store-events", {"event": event_str}, max_len=1000, approximate=True)
                # Fanout via PubSub
                await self.client.publish("store-channel", event_str)
                return
            except Exception as e:
                logger.error(f"Failed to publish to Redis, falling back to local fanout: {e}")
                self.is_connected = False
        
        # 2. Local Fallback Fanout (In-Memory)
        for queue in self._local_subscribers:
            await queue.put(event_str)

    async def subscribe_stream(self) -> AsyncGenerator[str, None]:
        """Subscribe to real-time events stream."""
        if self.is_connected and self.client:
            try:
                pubsub = self.client.pubsub()
                await pubsub.subscribe("store-channel")
                
                async for message in pubsub.listen():
                    if message["type"] == "message":
                        yield message["data"]
            except Exception as e:
                logger.error(f"Redis PubSub connection severed, falling back to memory queue: {e}")
                self.is_connected = False

        # In-memory queue fallback subscriber
        import asyncio
        queue = asyncio.Queue()
        self._local_subscribers.append(queue)
        try:
            while True:
                message = await queue.get()
                yield message
        finally:
            self._local_subscribers.remove(queue)

redis_bus = RedisEventBus()
