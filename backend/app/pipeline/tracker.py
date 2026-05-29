import uuid
import math
import time
from typing import Dict, Any, List, Optional

class StatefulTrack:
    def __init__(self, track_id: str, label: str, x: float, y: float, w: float, h: float):
        self.track_id = track_id
        self.label = label
        self.x = x
        self.y = y
        self.w = w
        self.h = h
        self.path: List[List[float]] = [[x, y, time.time()]]
        self.velocity = 0.0
        self.last_seen = time.time()
        self.is_stationary = False
        self.stationary_since: Optional[float] = None
        self.frames_unseen = 0

    def update(self, x: float, y: float, w: float, h: float):
        now = time.time()
        dx = x - self.x
        dy = y - self.y
        dt = now - self.last_seen
        
        # Calculate velocity pixels/sec
        if dt > 0:
            speed = math.sqrt(dx*dx + dy*dy) / dt
            self.velocity = round(speed, 2)
            
            # Stationary heuristics
            if speed < 1.5:
                if not self.is_stationary:
                    self.is_stationary = True
                    self.stationary_since = now
            else:
                self.is_stationary = False
                self.stationary_since = None
        
        self.x = x
        self.y = y
        self.w = w
        self.h = h
        self.last_seen = now
        self.frames_unseen = 0
        self.path.append([round(x, 1), round(y, 1), round(now, 1)])
        
        if len(self.path) > 20:
            self.path.pop(0)

class ObjectTracker:
    def __init__(self):
        self.active_tracks: Dict[str, StatefulTrack] = {}
        self.track_counter = 0

    def process_detections(self, camera_id: uuid.UUID, detections: List[Dict[str, Any]]) -> List[StatefulTrack]:
        now = time.time()
        matched_tracks = []
        unmatched_detections = []

        # 1. Stateful IoU association
        for det in detections:
            bbox = det["bbox"]
            x, y, w, h = bbox
            label = det["class"]

            best_track: Optional[StatefulTrack] = None
            best_dist = 25.0 # Max coordinates distance threshold for tracking association

            for track in self.active_tracks.values():
                if track.label != label:
                    continue
                # 2D Euclidean distance
                dist = math.sqrt((track.x - x)**2 + (track.y - y)**2)
                if dist < best_dist:
                    best_dist = dist
                    best_track = track

            if best_track:
                best_track.update(x, y, w, h)
                matched_tracks.append(best_track)
            else:
                unmatched_detections.append(det)

        # 2. Spawn new tracks for unmatched objects
        for det in unmatched_detections:
            self.track_counter += 1
            track_id = f"track_{self.track_counter:04d}"
            bbox = det["bbox"]
            x, y, w, h = bbox
            label = det["class"]

            new_track = StatefulTrack(track_id, label, x, y, w, h)
            self.active_tracks[track_id] = new_track
            matched_tracks.append(new_track)

        # 3. Clean up cold tracks (not seen for 5 frames or 10 seconds)
        for t_id in list(self.active_tracks.keys()):
            track = self.active_tracks[t_id]
            if track not in matched_tracks:
                track.frames_unseen += 1
                if track.frames_unseen > 5 or (now - track.last_seen) > 10.0:
                    del self.active_tracks[t_id]

        return matched_tracks

# Instantiate static tracker dictionaries grouped by camera
camera_trackers: Dict[uuid.UUID, ObjectTracker] = {}

def get_tracker(camera_id: uuid.UUID) -> ObjectTracker:
    if camera_id not in camera_trackers:
        camera_trackers[camera_id] = ObjectTracker()
    return camera_trackers[camera_id]
