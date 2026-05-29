# AI Store Intelligence System (MVP)

Real-time CCTV analytics: **YOLOv8 person detection** → **tracking** → **events** → **Node.js API** → **MongoDB** → **Socket.IO** → **React dashboard**.

## Architecture

```
CCTV / Webcam / Video
        ↓
AI Service (Python + OpenCV + YOLOv8)
        ↓
POST /api/events
        ↓
Backend (Node.js + Express)
        ↓
MongoDB (events, cameras, alerts)
        ↓
Socket.IO
        ↓
React Dashboard (Tailwind)
```

## MVP features

- Person detection (YOLOv8, class `person` only)
- Tracking with persistent IDs (YOLO built-in tracker)
- Live occupancy + entry events
- Event types: `person_detected`, `person_entered`, `crowd_detected`, `zone_breach`, `high_occupancy`, `occupancy_update`
- Alert engine (crowd > 20, restricted polygon zone)
- Real-time dashboard with Socket.IO
- MongoDB collections: `events`, `cameras`, `alerts`

## Quick start

### Prerequisites

- Node.js 18+
- MongoDB 7 (local or Docker)
- Python 3.10+ (for AI service only)

### 1. MongoDB

```bash
docker compose up -d mongodb
```

Or install MongoDB locally on `mongodb://127.0.0.1:27017`.

### 2. Backend

```bash
cd backend
npm install
npm run dev
```

API: http://localhost:5000/api/health

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Dashboard: http://localhost:3000

### 4. AI service (webcam)

```bash
cd ai-service
pip install -r requirements.txt
python detection.py
```

Environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `VIDEO_SOURCE` | `0` | Webcam index or video file path |
| `API_URL` | `http://localhost:5000/api/events` | Event ingest URL |
| `CAMERA_ID` | `CAM_01` | Camera identifier |
| `CROWD_THRESHOLD` | `20` | Crowd alert threshold |

### Windows one-click

```bat
start_platform.bat
```

## Dashboard modules

| Module | Description |
|--------|-------------|
| Live Operations | KPI cards, alert panel, live feed, cameras |
| Event Explorer | Filterable event table |
| Anomaly Center | Active alerts (silence / investigate) |
| Analytics Insights | Zone heatmap chart |
| Camera Registry | Camera list and status |
| System Observability | FPS, AI latency, queue, API metrics |

## Event schema

```json
{
  "event_id": "EVT_A1B2C3D4",
  "event_type": "person_detected",
  "camera_id": "CAM_01",
  "person_id": 12,
  "timestamp": "2026-05-30T12:30:00Z",
  "confidence": 0.94,
  "severity": "info"
}
```

## API overview

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| GET/POST | `/api/events` | List / ingest events |
| GET | `/api/cameras` | List cameras |
| GET/PATCH | `/api/alerts` | Alerts CRUD |
| GET | `/api/dashboard/stats` | Live KPIs |
| GET | `/api/dashboard/heatmap` | Zone density |
| GET | `/api/dashboard/metrics` | System metrics |

**Real-time:** Socket.IO events `event`, `alert`, `dashboard`.

## Tech stack

| Layer | Stack |
|-------|--------|
| Frontend | React, Tailwind CSS, Recharts, Socket.IO client |
| Backend | Node.js, Express, Socket.IO |
| Database | MongoDB |
| AI | Python, OpenCV, Ultralytics YOLOv8 |

## Docker

Full stack (MongoDB + API + dashboard with mock events):

```bash
docker compose up --build
```

- Dashboard: http://localhost:3000  
- API: http://localhost:5000/api/health  

Optional AI service (requires webcam device mapping on Linux):

```bash
docker compose --profile ai up --build
```

Environment: set `MOCK_EVENTS=false` in `docker-compose.yml` or `.env` when using real AI ingest.

## Project layout

```
ai-service/          # YOLOv8 detection + event POST
backend/src/         # Express API + Socket.IO
frontend/src/        # React dashboard
docker-compose.yml   # MongoDB + API
start_platform.bat   # Windows launcher
```

Built for the Store Intelligence MVP challenge — no face recognition, no Kubernetes, no multi-store scaling.
