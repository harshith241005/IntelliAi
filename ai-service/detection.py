"""
Store Intelligence AI Service — YOLOv8 person detection + tracking + event generation.
Sends events to Node.js backend (POST /api/events).
"""
import os
import time
import uuid
import requests
import cv2
import numpy as np
from ultralytics import YOLO

VIDEO_SOURCE = os.getenv("VIDEO_SOURCE", "0")  # webcam default; path for file
API_URL = os.getenv("API_URL", "http://localhost:5000/api/events")
CAMERA_ID = os.getenv("CAMERA_ID", "CAM_01")
CROWD_THRESHOLD = int(os.getenv("CROWD_THRESHOLD", "20"))
PROCESS_EVERY_N = int(os.getenv("PROCESS_EVERY_N", "2"))

RESTRICTED_ZONE = np.array([[200, 200], [500, 200], [500, 400], [200, 400]], np.int32)

print("Loading YOLOv8 (person class only)...")
model = YOLO("yolov8n.pt")

source = int(VIDEO_SOURCE) if VIDEO_SOURCE.isdigit() else VIDEO_SOURCE
cap = cv2.VideoCapture(source)
if not cap.isOpened() and source != 0:
    print(f"Could not open {VIDEO_SOURCE}, trying webcam...")
    cap = cv2.VideoCapture(0)

if not cap.isOpened():
    raise SystemExit("No video source available. Connect webcam or set VIDEO_SOURCE.")

print(f"AI pipeline running — camera={CAMERA_ID} → {API_URL}")

frame_count = 0
store_occupancy = 0
seen_tracks: set[int] = set()
alerted_zone: set[int] = set()
last_crowd_alert = 0.0
last_occupancy_post = 0.0
last_person_events: dict[int, float] = {}


def post_event(payload: dict) -> None:
    try:
        requests.post(API_URL, json=payload, timeout=1.0)
    except requests.RequestException:
        pass


def send_event(
    event_type: str,
    *,
    person_id: int | None = None,
    severity: str = "info",
    message: str | None = None,
    confidence: float | None = None,
    count: int | None = None,
    coordinates: tuple[int, int] | None = None,
    ai_ms: float | None = None,
) -> None:
    body = {
        "event_id": f"EVT_{uuid.uuid4().hex[:8].upper()}",
        "event_type": event_type,
        "camera_id": CAMERA_ID,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "severity": severity,
        "message": message,
        "person_id": person_id,
        "confidence": confidence,
        "count": count,
        "fps": cap.get(cv2.CAP_PROP_FPS) or 15,
        "ai_processing_ms": ai_ms,
    }
    if coordinates:
        body["coordinates"] = {"x": coordinates[0], "y": coordinates[1]}
    post_event(body)


while cap.isOpened():
    success, frame = cap.read()
    if not success:
        cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
        continue

    frame_count += 1
    if frame_count % PROCESS_EVERY_N != 0:
        if cv2.waitKey(1) & 0xFF == ord("q"):
            break
        continue

    t0 = time.perf_counter()
    results = model.track(frame, persist=True, classes=[0], verbose=False)
    ai_ms = (time.perf_counter() - t0) * 1000

    annotated = results[0].plot()
    cv2.polylines(annotated, [RESTRICTED_ZONE], True, (0, 0, 255), 2)

    boxes = results[0].boxes
    frame_people = 0
    now = time.time()

    if boxes is not None and boxes.id is not None:
        frame_people = len(boxes.id)

        for box, track_id, conf in zip(boxes.xyxy, boxes.id, boxes.conf):
            pid = int(track_id)
            x1, y1, x2, y2 = map(int, box)
            bottom = (int((x1 + x2) / 2), y2)
            confidence = float(conf) if conf is not None else 0.9

            cv2.circle(annotated, bottom, 4, (255, 0, 0), -1)

            if pid not in seen_tracks:
                seen_tracks.add(pid)
                store_occupancy += 1
                send_event(
                    "person_entered",
                    person_id=pid,
                    severity="medium",
                    message=f"Person #{pid} entered",
                    confidence=confidence,
                    coordinates=bottom,
                    ai_ms=ai_ms,
                )

            if now - last_person_events.get(pid, 0) > 3.0:
                last_person_events[pid] = now
                send_event(
                    "person_detected",
                    person_id=pid,
                    severity="info",
                    message=f"Person #{pid} tracked",
                    confidence=confidence,
                    coordinates=bottom,
                    ai_ms=ai_ms,
                )

            if cv2.pointPolygonTest(RESTRICTED_ZONE, bottom, False) >= 0 and pid not in alerted_zone:
                alerted_zone.add(pid)
                send_event(
                    "zone_breach",
                    person_id=pid,
                    severity="critical",
                    message=f"Unauthorized zone entry — Person #{pid}",
                    confidence=confidence,
                    coordinates=bottom,
                    ai_ms=ai_ms,
                )

    if frame_people > CROWD_THRESHOLD and now - last_crowd_alert > 15:
        last_crowd_alert = now
        send_event(
            "crowd_detected",
            severity="high",
            message=f"Crowd alert: {frame_people} people in frame",
            count=frame_people,
            ai_ms=ai_ms,
        )

    if frame_people > CROWD_THRESHOLD * 0.75 and now - last_crowd_alert > 30:
        send_event(
            "high_occupancy",
            severity="medium",
            message=f"High occupancy: {frame_people}",
            count=frame_people,
            ai_ms=ai_ms,
        )

    if now - last_occupancy_post >= 2.0:
        last_occupancy_post = now
        send_event(
            "occupancy_update",
            severity="info",
            message=f"Store occupancy: {store_occupancy} (frame: {frame_people})",
            count=store_occupancy,
            ai_ms=ai_ms,
        )

    cv2.putText(
        annotated,
        f"Occupancy: {store_occupancy} | Frame: {frame_people}",
        (20, 40),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.9,
        (0, 255, 0),
        2,
    )
    cv2.imshow("Store Intelligence — YOLOv8 MVP", annotated)

    if cv2.waitKey(1) & 0xFF == ord("q"):
        break

cap.release()
cv2.destroyAllWindows()
