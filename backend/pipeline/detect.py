"""
Detection pipeline: Process CCTV clips, detect people, track movement, assign visitor tokens.
Uses YOLOv8 for detection + ByteTrack for tracking + spatial analysis for zone classification.
"""
import cv2
import numpy as np
from ultralytics import YOLO
from collections import defaultdict, deque
from datetime import datetime
import uuid
from typing import List, Dict, Tuple, Optional, Any
import logging
import json
from pathlib import Path

try:
    from app.models import StoreEvent, EventType, EventMetadata
except ImportError:
    from .models import StoreEvent, EventType, EventMetadata

logger = logging.getLogger(__name__)


class VisitorTracker:
    """
    Stateful visitor tracking with Re-ID capabilities.
    Maintains visitor sessions across cameras and detects re-entry.
    """
    
    def __init__(self, timeout_seconds: float = 30.0, max_history: int = 100):
        self.timeout_seconds = timeout_seconds
        self.max_history = max_history
        
        # Track active visitors: track_id → visitor state
        self.visitors: Dict[int, Dict[str, Any]] = {}
        
        # History of exited visitors for re-entry detection
        self.exited_visitors: deque = deque(maxlen=max_history)
        
        # Spatial trajectory for Re-ID
        self.trajectories: Dict[int, deque] = defaultdict(lambda: deque(maxlen=50))
        
        self.session_counter = 0
    
    def get_or_create_visitor(self, track_id: int, position: Tuple[float, float], visitor_id: Optional[str] = None) -> str:
        """Get visitor_id for track_id, creating new session if needed."""
        if track_id not in self.visitors:
            visitor_token = visitor_id if visitor_id else self._generate_visitor_id()
            self.visitors[track_id] = {
                "visitor_id": visitor_token,
                "created_at": datetime.now(),
                "last_seen": datetime.now(),
                "current_zone": None,
                "entry_zone_confirmed": False,
                "zone_enter_times": {},  # zone_name -> datetime
                "last_dwell_emission_times": {},  # zone_name -> datetime
                "is_staff": False,
                "confidence": 0.8
            }
        
        self.visitors[track_id]["last_seen"] = datetime.now()
        self.trajectories[track_id].append(position)
        return self.visitors[track_id]["visitor_id"]
    
    def _generate_visitor_id(self) -> str:
        """Generate unique per-session visitor token."""
        self.session_counter += 1
        token = uuid.uuid4().hex[-5:].upper()
        return f"VIS_{token}"
    
    def record_exit(self, track_id: int) -> str:
        """Record visitor exit for re-entry detection."""
        if track_id in self.visitors:
            visitor_state = self.visitors[track_id]
            visitor_id = visitor_state["visitor_id"]
            
            self.exited_visitors.append({
                "visitor_id": visitor_id,
                "exited_at": datetime.now(),
                "trajectory": list(self.trajectories[track_id])
            })
            
            del self.visitors[track_id]
            return visitor_id
        return None
    
    def detect_reentry(self, new_track_id: int, position: Tuple[float, float], 
                       max_time_since_exit: float = 300.0) -> Optional[str]:
        """
        Detect if new detection is re-entry of recently exited visitor.
        Uses spatial + temporal proximity.
        """
        current_time = datetime.now()
        
        for exited in reversed(self.exited_visitors):
            time_diff = (current_time - exited["exited_at"]).total_seconds()
            
            if time_diff > max_time_since_exit:
                continue
            
            # Calculate trajectory similarity
            if exited["trajectory"]:
                last_exit_pos = exited["trajectory"][-1]
                distance = np.linalg.norm(np.array(position) - np.array(last_exit_pos))
                
                # If within 100 pixels, likely re-entry
                if distance < 100:
                    return exited["visitor_id"]
        
        return None
    
    def cleanup_stale(self) -> List[Dict[str, Any]]:
        """Remove visitors not seen for timeout_seconds and return their state."""
        now = datetime.now()
        stale_visitors = []
        
        for track_id, state in list(self.visitors.items()):
            age = (now - state["last_seen"]).total_seconds()
            if age > self.timeout_seconds:
                stale_visitors.append({
                    "track_id": track_id,
                    "visitor_id": state["visitor_id"],
                    "is_staff": state.get("is_staff", False),
                    "confidence": state.get("confidence", 0.8),
                    "last_seen": state["last_seen"],
                    "current_zone": state["current_zone"],
                    "zone_enter_times": state["zone_enter_times"]
                })
                self.record_exit(track_id)
        
        return stale_visitors


class ZoneClassifier:
    """
    Classify detected people into zones using spatial rules.
    Zones defined in store_layout.json.
    """
    
    def __init__(self, store_layout: Dict[str, Any]):
        self.zones = store_layout.get("zones", [])
        self.entry_threshold = store_layout.get("entry_threshold", {})
    
    def classify_zone(self, bbox: Tuple[int, int, int, int], camera_id: str) -> Optional[str]:
        """
        Classify bounding box center into zone.
        bbox format: (x1, y1, x2, y2)
        """
        center_x = (bbox[0] + bbox[2]) / 2
        center_y = (bbox[1] + bbox[3]) / 2
        
        for zone in self.zones:
            if zone.get("camera") != camera_id:
                continue
            
            # Check if center is within zone polygon
            if self._point_in_polygon((center_x, center_y), zone["polygon"]):
                return zone["name"]
        
        return None
    
    @staticmethod
    def _point_in_polygon(point: Tuple[float, float], polygon: List[Tuple[float, float]]) -> bool:
        """Ray casting algorithm for point-in-polygon test."""
        x, y = point
        n = len(polygon)
        inside = False
        
        if n == 0:
            return False
            
        p1x, p1y = polygon[0]
        for i in range(1, n + 1):
            p2x, p2y = polygon[i % n]
            if y > min(p1y, p2y):
                if y <= max(p1y, p2y):
                    if x <= max(p1x, p2x):
                        if p1y != p2y:
                            xinters = (y - p1y) * (p2x - p1x) / (p2y - p1y) + p1x
                        if p1x == p2x or x <= xinters:
                            inside = not inside
            p1x, p1y = p2x, p2y
        
        return inside
    
    def is_entry_zone(self, bbox: Tuple[int, int, int, int], camera_id: str) -> bool:
        """Check if bounding box is in entry threshold zone."""
        center_x = (bbox[0] + bbox[2]) / 2
        center_y = (bbox[1] + bbox[3]) / 2
        
        if camera_id not in self.entry_threshold:
            return False
        
        threshold = self.entry_threshold[camera_id]
        return self._point_in_polygon((center_x, center_y), threshold["polygon"])
    
    def is_exit_zone(self, bbox: Tuple[int, int, int, int], camera_id: str) -> bool:
        """Check if bounding box is leaving (same as entry for bidirectional threshold)."""
        return self.is_entry_zone(bbox, camera_id)


class StaffClassifier:
    """Classify if detected person is store staff (e.g., by uniform detection)."""
    
    def __init__(self):
        pass
    
    def is_staff(self, bbox_rgb: np.ndarray) -> bool:
        """
        Detect if bounding box region contains staff.
        Returns True if likely staff, False otherwise.
        """
        if bbox_rgb.size == 0 or bbox_rgb.shape[0] == 0 or bbox_rgb.shape[1] == 0:
            return False
            
        try:
            hsv = cv2.cvtColor(bbox_rgb, cv2.COLOR_RGB2HSV)
            
            # Check for dark colors (typical uniforms)
            lower_dark = np.array([0, 0, 0])
            upper_dark = np.array([180, 255, 60])
            
            mask = cv2.inRange(hsv, lower_dark, upper_dark)
            dark_ratio = np.sum(mask) / (mask.shape[0] * mask.shape[1] * 255)
            
            return dark_ratio > 0.4  # Uniform match threshold
        except Exception:
            return False


class DetectionPipeline:
    """
    Main detection pipeline: Process video frames, detect/track people, emit events.
    """
    
    def __init__(self, 
                  camera_id: str,
                  zones: List[Dict[str, Any]],
                  model_path: str = "yolov8n.pt"):
        
        self.store_id = "STORE_BLR_002"
        self.camera_id = camera_id
        
        # Load layout helper
        store_layout = {
            "zones": zones,
            "entry_threshold": {
                "CAM_ENTRY_01": {
                    "polygon": [[0, 450], [1280, 450], [1280, 720], [0, 720]]
                }
            }
        }
        
        # Initialize components
        self.yolo = YOLO(model_path)
        self.tracker = VisitorTracker()
        self.zone_classifier = ZoneClassifier(store_layout)
        self.staff_classifier = StaffClassifier()
        
        self.frame_count = 0
        self.events: List[StoreEvent] = []
        
        # Track recent entries for group entry grouping
        self.recent_entries: List[Tuple[datetime, str, str]] = []  # (datetime, visitor_id, group_id)
        
    def process_frame(self, frame: np.ndarray, timestamp: str) -> List[StoreEvent]:
        """
        Process single frame: detect people, track, classify zones, emit events.
        Returns list of events generated in this frame.
        """
        self.frame_count += 1
        frame_events = []
        
        # Parse frame time
        try:
            frame_dt = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
        except Exception:
            frame_dt = datetime.now()
            
        # YOLO detection (person class only)
        results = self.yolo(frame, classes=[0], conf=0.4, verbose=False)
        
        detections = []
        if results and results[0].boxes is not None:
            for box in results[0].boxes:
                x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                conf = float(box.conf[0])
                
                detections.append({
                    "bbox": (int(x1), int(y1), int(x2), int(y2)),
                    "confidence": conf
                })
        
        # Stale cleanups and exit events
        stale_cleanups = self.tracker.cleanup_stale()
        for stale in stale_cleanups:
            # Emit ZONE_DWELL for their current zone if active
            last_zone = stale["current_zone"]
            if last_zone and last_zone in stale["zone_enter_times"]:
                enter_time = stale["zone_enter_times"][last_zone]
                
                # Make last_seen offset-aware to match enter_time
                import datetime as dt
                last_seen_aware = stale["last_seen"]
                if last_seen_aware.tzinfo is None:
                    last_seen_aware = last_seen_aware.replace(tzinfo=dt.timezone.utc)
                if enter_time.tzinfo is None:
                    enter_time = enter_time.replace(tzinfo=dt.timezone.utc)
                    
                dwell_ms = int((last_seen_aware - enter_time).total_seconds() * 1000)
                if dwell_ms > 0:
                    dwell_event = StoreEvent(
                        store_id=self.store_id,
                        camera_id=self.camera_id,
                        visitor_id=stale["visitor_id"],
                        event_type=EventType.ZONE_DWELL,
                        timestamp=timestamp,
                        zone_id=last_zone,
                        dwell_ms=dwell_ms,
                        is_staff=stale["is_staff"],
                        confidence=stale["confidence"],
                        metadata=EventMetadata(sku_zone=last_zone)
                    )
                    frame_events.append(dwell_event)
            
            # Emit EXIT event
            exit_event = StoreEvent(
                store_id=self.store_id,
                camera_id=self.camera_id,
                visitor_id=stale["visitor_id"],
                event_type=EventType.EXIT,
                timestamp=timestamp,
                zone_id=None,
                dwell_ms=0,
                is_staff=stale["is_staff"],
                confidence=stale["confidence"],
                metadata=EventMetadata(session_seq=99)
            )
            frame_events.append(exit_event)
            
        # Process active detections
        for detection in detections:
            bbox = detection["bbox"]
            confidence = detection["confidence"]
            
            # Simple spatial centroid mapping for persistent track IDs
            center_x = (bbox[0] + bbox[2]) / 2
            center_y = (bbox[1] + bbox[3]) / 2
            position = (center_x, center_y)
            
            # Assign closest track_id
            track_id = None
            min_dist = 80.0  # pixel centroid proximity threshold
            for tid, state in self.tracker.visitors.items():
                if self.tracker.trajectories[tid]:
                    last_pos = self.tracker.trajectories[tid][-1]
                    dist = np.linalg.norm(np.array(position) - np.array(last_pos))
                    if dist < min_dist:
                        min_dist = dist
                        track_id = tid
            
            if track_id is None:
                track_id = hash(tuple(bbox)) % 100000
                
            # Check for Re-Entry
            reentry_visitor_id = self.tracker.detect_reentry(track_id, position)
            
            # Associate track and fetch visitor ID
            visitor_id = self.tracker.get_or_create_visitor(track_id, position, visitor_id=reentry_visitor_id)
            
            # Classify staff
            bbox_crop = frame[max(0, bbox[1]):min(frame.shape[0], bbox[3]), max(0, bbox[0]):min(frame.shape[1], bbox[2])]
            is_staff = self.staff_classifier.is_staff(cv2.cvtColor(bbox_crop, cv2.COLOR_BGR2RGB)) if bbox_crop.size > 0 else False
            self.tracker.visitors[track_id]["is_staff"] = is_staff
            self.tracker.visitors[track_id]["confidence"] = confidence
            
            # Trigger Re-Entry event
            if reentry_visitor_id and not self.tracker.visitors[track_id].get("reentry_triggered", False):
                self.tracker.visitors[track_id]["reentry_triggered"] = True
                re_event = StoreEvent(
                    store_id=self.store_id,
                    camera_id=self.camera_id,
                    visitor_id=visitor_id,
                    event_type=EventType.REENTRY,
                    timestamp=timestamp,
                    zone_id=None,
                    dwell_ms=0,
                    is_staff=is_staff,
                    confidence=confidence,
                    metadata=EventMetadata(session_seq=1)
                )
                frame_events.append(re_event)
            
            # Detect Entry (Only once per session)
            if self.zone_classifier.is_entry_zone(bbox, self.camera_id):
                if not self.tracker.visitors[track_id]["entry_zone_confirmed"]:
                    self.tracker.visitors[track_id]["entry_zone_confirmed"] = True
                    
                    # Group entry detection logic
                    group_id = None
                    group_size = 1
                    
                    # Clean up entries older than 5 seconds from cache
                    self.recent_entries = [r for r in self.recent_entries if (frame_dt - r[0]).total_seconds() <= 5.0]
                    
                    # Check entries in last 2.0 seconds
                    group_entries = [r for r in self.recent_entries if (frame_dt - r[0]).total_seconds() <= 2.0]
                    if group_entries:
                        group_id = group_entries[0][2]
                        group_size = len([r for r in self.recent_entries if r[2] == group_id]) + 1
                    else:
                        group_id = f"GRP_{uuid.uuid4().hex[-4:].upper()}"
                        
                    self.recent_entries.append((frame_dt, visitor_id, group_id))
                    
                    event = StoreEvent(
                        store_id=self.store_id,
                        camera_id=self.camera_id,
                        visitor_id=visitor_id,
                        event_type=EventType.ENTRY,
                        timestamp=timestamp,
                        zone_id=None,
                        dwell_ms=0,
                        is_staff=is_staff,
                        confidence=confidence,
                        metadata=EventMetadata(
                            session_seq=1,
                            group_size=group_size,
                            group_id=group_id
                        )
                    )
                    frame_events.append(event)
            
            # Classify zone
            zone = self.zone_classifier.classify_zone(bbox, self.camera_id)
            prev_zone = self.tracker.visitors[track_id]["current_zone"]
            
            if zone and zone != prev_zone:
                self.tracker.visitors[track_id]["current_zone"] = zone
                
                # Exit previous zone
                if prev_zone:
                    ex_event = StoreEvent(
                        store_id=self.store_id,
                        camera_id=self.camera_id,
                        visitor_id=visitor_id,
                        event_type=EventType.ZONE_EXIT,
                        timestamp=timestamp,
                        zone_id=prev_zone,
                        dwell_ms=0,
                        is_staff=is_staff,
                        confidence=confidence,
                        metadata=EventMetadata(session_seq=2)
                    )
                    frame_events.append(ex_event)
                    
                    # Emit final ZONE_DWELL event
                    if prev_zone in self.tracker.visitors[track_id]["zone_enter_times"]:
                        enter_time = self.tracker.visitors[track_id]["zone_enter_times"][prev_zone]
                        dwell_ms = int((frame_dt - enter_time).total_seconds() * 1000)
                        if dwell_ms > 0:
                            dwell_event = StoreEvent(
                                store_id=self.store_id,
                                camera_id=self.camera_id,
                                visitor_id=visitor_id,
                                event_type=EventType.ZONE_DWELL,
                                timestamp=timestamp,
                                zone_id=prev_zone,
                                dwell_ms=dwell_ms,
                                is_staff=is_staff,
                                confidence=confidence,
                                metadata=EventMetadata(sku_zone=prev_zone)
                            )
                            frame_events.append(dwell_event)
                        del self.tracker.visitors[track_id]["zone_enter_times"][prev_zone]
                        if prev_zone in self.tracker.visitors[track_id]["last_dwell_emission_times"]:
                            del self.tracker.visitors[track_id]["last_dwell_emission_times"][prev_zone]
                
                # Enter new zone
                self.tracker.visitors[track_id]["zone_enter_times"][zone] = frame_dt
                self.tracker.visitors[track_id]["last_dwell_emission_times"][zone] = frame_dt
                
                # Emit BILLING_QUEUE_JOIN if joining billing queue when other visitors are in it
                if zone == "BILLING":
                    other_billing_visitors = len([
                        tid for tid, state in self.tracker.visitors.items()
                        if state.get("current_zone") == "BILLING" and state.get("visitor_id") != visitor_id
                    ])
                    if other_billing_visitors > 0:
                        join_event = StoreEvent(
                            store_id=self.store_id,
                            camera_id=self.camera_id,
                            visitor_id=visitor_id,
                            event_type=EventType.BILLING_QUEUE_JOIN,
                            timestamp=timestamp,
                            zone_id="BILLING",
                            dwell_ms=0,
                            is_staff=is_staff,
                            confidence=confidence,
                            metadata=EventMetadata(
                                queue_depth=other_billing_visitors,
                                sku_zone="BILLING"
                            )
                        )
                        frame_events.append(join_event)
                    else:
                        en_event = StoreEvent(
                            store_id=self.store_id,
                            camera_id=self.camera_id,
                            visitor_id=visitor_id,
                            event_type=EventType.ZONE_ENTER,
                            timestamp=timestamp,
                            zone_id=zone,
                            dwell_ms=0,
                            is_staff=is_staff,
                            confidence=confidence,
                            metadata=EventMetadata(sku_zone=zone)
                        )
                        frame_events.append(en_event)
                else:
                    en_event = StoreEvent(
                        store_id=self.store_id,
                        camera_id=self.camera_id,
                        visitor_id=visitor_id,
                        event_type=EventType.ZONE_ENTER,
                        timestamp=timestamp,
                        zone_id=zone,
                        dwell_ms=0,
                        is_staff=is_staff,
                        confidence=confidence,
                        metadata=EventMetadata(sku_zone=zone)
                    )
                    frame_events.append(en_event)

        # 3. Check for continued 30s ZONE_DWELL emissions for all active visitors in zones
        for tid, state in self.tracker.visitors.items():
            curr_zone = state["current_zone"]
            if curr_zone and curr_zone in state["zone_enter_times"]:
                enter_time = state["zone_enter_times"][curr_zone]
                last_dwell = state["last_dwell_emission_times"].get(curr_zone, enter_time)
                
                elapsed_since_last_dwell = (frame_dt - last_dwell).total_seconds()
                if elapsed_since_last_dwell >= 30.0:
                    state["last_dwell_emission_times"][curr_zone] = frame_dt
                    
                    dwell_ms = int((frame_dt - enter_time).total_seconds() * 1000)
                    dwell_event = StoreEvent(
                        store_id=self.store_id,
                        camera_id=self.camera_id,
                        visitor_id=state["visitor_id"],
                        event_type=EventType.ZONE_DWELL,
                        timestamp=timestamp,
                        zone_id=curr_zone,
                        dwell_ms=dwell_ms,
                        is_staff=state["is_staff"],
                        confidence=state["confidence"],
                        metadata=EventMetadata(sku_zone=curr_zone)
                    )
                    frame_events.append(dwell_event)
        
        self.events.extend(frame_events)
        return frame_events
    
    def process_stream(self, stream_url: Any, display: bool = False):
        """
        Process a video stream or camera feed frame-by-frame and yield events.
        """
        cap = cv2.VideoCapture(stream_url)
        if not cap.isOpened():
            logger.error(f"Cannot open stream: {stream_url}")
            return
            
        fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        frame_idx = 0
        start_time = datetime.now()
        
        try:
            while True:
                ret, frame = cap.read()
                if not ret:
                    break
                
                # Calculate timestamp
                frame_time = frame_idx / fps
                timestamp = (start_time.timestamp() + frame_time)
                timestamp_iso = datetime.fromtimestamp(timestamp).isoformat() + "Z"
                
                events = self.process_frame(frame, timestamp_iso)
                for event in events:
                    yield event
                
                if display:
                    try:
                        cv2.imshow(f"Camera {self.camera_id}", frame)
                        if cv2.waitKey(1) & 0xFF == ord('q'):
                            break
                    except Exception as e:
                        logger.warning(f"Could not render OpenCV GUI: {e}")
                        
                frame_idx += 1
        finally:
            cap.release()
            if display:
                try:
                    cv2.destroyAllWindows()
                except:
                    pass

    def process_video(self, video_path: str) -> List[StoreEvent]:
        """Process entire video file and return all events."""
        return list(self.process_stream(video_path, display=False))
