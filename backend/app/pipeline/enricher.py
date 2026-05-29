import uuid
import time
from typing import Dict, Any, List, Optional, Tuple
from app.db.models import Event
from app.schemas.events import CCTVEventResponse

# Store active track zone history to detect enters/exits
track_zones: Dict[str, str] = {}
track_enter_times: Dict[str, float] = {}

# Correlation memory structures:
# track_id -> (correlation_id, timestamp)
track_correlations: Dict[str, Tuple[uuid.UUID, float]] = {}

# camera_id:zone_id -> List[timestamp] critical alert timeline for crowd correlations
camera_critical_events: Dict[str, List[float]] = {}
camera_correlation_ids: Dict[str, uuid.UUID] = {}

def get_zone_id(x: float, y: float, camera_name: str) -> str:
    """Map coordinate space [0-100, 0-100] to structural store zones."""
    cam_lower = camera_name.lower()
    
    # Specific cameras mapping to restricted zones
    if "warehouse" in cam_lower or "loading" in cam_lower:
        return "zone_restricted_loading"
    if "safe" in cam_lower or "vault" in cam_lower:
        return "zone_restricted_safe"

    # Coordinates mapping defaults
    if x <= 30.0 and y <= 35.0:
        return "zone_entrance"
    if x >= 70.0 and y >= 70.0:
        return "zone_restricted_loading"
    if y >= 65.0:
        return "zone_checkout"
    return "zone_aisle_electronics"

def process_enrichment(
    store_id: uuid.UUID,
    camera_id: uuid.UUID,
    camera_name: str,
    track_id: str,
    label: str,
    x: float,
    y: float,
    velocity: float,
    is_stationary: bool,
    path: List[List[float]]
) -> Tuple[str, List[Dict[str, Any]], uuid.UUID]:
    """
    Enriches track states by:
    1. Mapping coordinates to zone IDs.
    2. Generating zone_enter / zone_exit transition triggers.
    3. Bundling correlation IDs for incident grouping.
    """
    now = time.time()
    zone_id = get_zone_id(x, y, camera_name)
    transition_events = []

    # 1. Evaluate Enters & Exits
    prev_zone = track_zones.get(track_id)
    if prev_zone != zone_id:
        track_zones[track_id] = zone_id
        
        if prev_zone:
            # Exited prev_zone
            enter_time = track_enter_times.get(track_id, now)
            dwell_ms = int((now - enter_time) * 1000)
            
            transition_events.append({
                "event_type": "zone_exit",
                "zone_id": prev_zone,
                "payload": {
                    "zone_name": prev_zone.replace("zone_", "").upper(),
                    "dwell_ms": dwell_ms,
                    "message": f"Track exited {prev_zone} after {round(dwell_ms/1000, 1)}s"
                }
            })

        # Entered new zone
        track_enter_times[track_id] = now
        transition_events.append({
            "event_type": "zone_enter",
            "zone_id": zone_id,
            "payload": {
                "zone_name": zone_id.replace("zone_", "").upper(),
                "dwell_ms": 0,
                "message": f"Track entered {zone_id}"
            }
        })

    # 2. Correlation ID Logic
    correlation_id = None

    # Track correlation window (5 minutes)
    if track_id in track_correlations:
        corr_id, timestamp = track_correlations[track_id]
        if now - timestamp < 300.0:
            correlation_id = corr_id
            track_correlations[track_id] = (corr_id, now) # refresh TTL
            
    if not correlation_id:
        # Check Zone crowd / event velocity triggers (3 critical alerts in 2 minutes)
        zone_key = f"{camera_id}:{zone_id}"
        crit_timestamps = camera_critical_events.get(zone_key, [])
        # filter window
        crit_timestamps = [t for t in crit_timestamps if now - t < 120.0]
        camera_critical_events[zone_key] = crit_timestamps

        if len(crit_timestamps) >= 2: # This will be the 3rd critical event
            if zone_key in camera_correlation_ids:
                correlation_id = camera_correlation_ids[zone_key]
            else:
                correlation_id = uuid.uuid4()
                camera_correlation_ids[zone_key] = correlation_id
        else:
            # Create a brand new unique session correlation
            correlation_id = uuid.uuid4()
            track_correlations[track_id] = (correlation_id, now)

    return zone_id, transition_events, correlation_id

def log_critical_event(camera_id: uuid.UUID, zone_id: str):
    """Callback to log timestamp of critical alert for zone-level correlation mapping."""
    now = time.time()
    zone_key = f"{camera_id}:{zone_id}"
    if zone_key not in camera_critical_events:
        camera_critical_events[zone_key] = []
    camera_critical_events[zone_key].append(now)
