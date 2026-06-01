import asyncio
import httpx
import json
import logging
from typing import List, Dict, Any, Optional
import time
import sys
from pathlib import Path

# Add backend directory to sys.path to resolve absolute imports when run directly
backend_dir = str(Path(__file__).resolve().parent)
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

try:
    from app.models import StoreEvent, EventBatch
except ImportError:
    from models import StoreEvent, EventBatch

try:
    from pipeline.detect import DetectionPipeline
except ImportError:
    try:
        from detect import DetectionPipeline
    except ImportError:
        from .pipeline.detect import DetectionPipeline

logger = logging.getLogger(__name__)

class PipelineRunner:
    """Runs the YOLO pipeline and sends events to the API."""
    
    def __init__(self, camera_id: str, stream_url: str, api_endpoint: str = "http://localhost:5000/api/events/ingest"):
        self.camera_id = camera_id
        self.stream_url = stream_url
        self.api_endpoint = api_endpoint
        
        # Load layout
        try:
            with open("store_layout.json", "r") as f:
                layout = json.load(f)
                self.zones = [z for z in layout.get("zones", []) if z.get("camera") == camera_id]
        except Exception as e:
            logger.warning(f"Could not load store_layout.json, continuing without zones: {e}")
            self.zones = []
            
        self.pipeline = DetectionPipeline(camera_id, self.zones, model_path="yolov8n.pt")
        self.event_buffer = []

    async def _send_batch(self, events: List[StoreEvent]):
        """Send a batch of events to the backend."""
        if not events:
            return
            
        try:
            # Reformat to backend structure
            batch = EventBatch(events=events)
            
            # Using httpx for async HTTP requests
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    self.api_endpoint,
                    json=batch.model_dump(exclude_none=True),
                    timeout=5.0
                )
                
            if response.status_code in (200, 202):
                logger.info(f"Successfully sent batch of {len(events)} events to {self.api_endpoint}.")
            else:
                logger.error(f"Failed to send batch. Status: {response.status_code}, Response: {response.text}")
                
        except Exception as e:
            logger.error(f"Error sending batch to API: {e}")

    async def run(self, display: bool = False):
        """Run the pipeline reading from stream and producing events."""
        logger.info(f"Starting pipeline for {self.camera_id} from {self.stream_url} (display={display})")
        
        # Start generator
        event_stream = self.pipeline.process_stream(self.stream_url, display=display)
        
        batch_interval = 1.0 # Sender interval in seconds
        last_send_time = time.time()
        
        try:
            for event in event_stream:
                self.event_buffer.append(event)
                
                # Check if it's time to send
                current_time = time.time()
                if current_time - last_send_time >= batch_interval or len(self.event_buffer) >= 50:
                    
                    events_to_send = list(self.event_buffer)
                    self.event_buffer.clear()
                    
                    asyncio.create_task(self._send_batch(events_to_send))
                    last_send_time = current_time
                    
                    # Yield CPU control to let background tasks run
                    await asyncio.sleep(0.001)
                    
        except KeyboardInterrupt:
            logger.info("Pipeline stopped by user")
        finally:
            # Send remaining
            if self.event_buffer:
                await self._send_batch(self.event_buffer)

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--camera", type=str, default="CAM_ENTRY_01")
    parser.add_argument("--source", type=str, default="0", help="Camera index or video path")
    parser.add_argument("--api", type=str, default="http://localhost:5000/api/events/ingest")
    parser.add_argument("--display", type=str, default="false", help="Render OpenCV video preview (true/false)")
    
    args = parser.parse_args()
    
    # Try converting source to int if it's just a digit (for webcam)
    source = int(args.source) if args.source.isdigit() else args.source
    display_flag = args.display.lower() == "true"
    
    runner = PipelineRunner(
        camera_id=args.camera,
        stream_url=source,
        api_endpoint=args.api
    )
    
    logging.basicConfig(level=logging.INFO)
    asyncio.run(runner.run(display=display_flag))
