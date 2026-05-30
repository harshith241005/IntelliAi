# AI Store Intelligence System (MVP)

**Dual-Purpose Intelligence Platform** combining real-time CCTV analytics with comprehensive retail business intelligence.

## 🎯 Two Integrated Systems

### 1. **Real-Time Security & Operations (CCTV)**
YOLOv8 person detection → tracking → events → Node.js API → MongoDB → Socket.IO → React dashboard

### 2. **Retail Analytics & Business Intelligence (CSV Data)**
✨ **NOW WITH REAL BRIGADE BANGALORE STORE DATA!**

Real transaction data ingestion → Product analytics → Staff performance → Customer insights → MongoDB → REST API

---

## 📊 Real Data Integration

**Active Dataset:** Brigade Bangalore Store (April 10, 2026)
- 101 real retail transactions
- 47 unique products (Cosmetics, Skincare, Makeup)
- 90+ customers
- 15 sales staff members
- ₹55,000+ in verified sales data

### Available Analytics APIs
- `/api/orders` - Transaction listing & filtering
- `/api/orders/analytics/summary` - Sales totals, KPIs
- `/api/orders/analytics/by-date` - Daily trends
- `/api/orders/analytics/by-product` - Product performance
- `/api/orders/analytics/by-staff` - Sales team metrics
- `/api/stores/:storeId/analytics` - Store comprehensive analytics
- `/api/products` - Product catalog with sales data

📖 See [REAL_DATA_INTEGRATION.md](REAL_DATA_INTEGRATION.md) for complete documentation.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  DUAL INPUT SYSTEM                                      │
│  ├─ CCTV/Webcam (Real-time security)                   │
│  └─ CSV Data (Batch retail analytics)                  │
└──────────────────────┬──────────────────────────────────┘
                       ↓
        ┌──────────────────────────────┐
        │  Node.js Backend + Express   │
        │  Socket.IO for live updates  │
        └──────────────────┬───────────┘
                           ↓
        ┌──────────────────────────────┐
        │  MongoDB (Multi-collection)  │
        │  ├─ events (CCTV)           │
        │  ├─ orders (transactions)   │
        │  ├─ products (catalog)      │
        │  ├─ customers               │
        │  ├─ staff                   │
        │  └─ stores                  │
        └──────────────────┬───────────┘
                           ↓
        ┌──────────────────────────────┐
        │  React Dashboard (Tailwind)  │
        │  ├─ Live CCTV operations    │
        │  └─ Analytics & Reports     │
        └──────────────────────────────┘
```

## MVP features

**Security & Operations:**
- Person detection (YOLOv8, class `person` only)
- Tracking with persistent IDs (YOLO built-in tracker)
- Live occupancy + entry events
- Event types: `person_detected`, `person_entered`, `crowd_detected`, `zone_breach`, `high_occupancy`, `occupancy_update`
- Alert engine (crowd > 20, restricted polygon zone)
- Real-time dashboard with Socket.IO

**Business Intelligence:**
- Real Brigade Bangalore store data (CSV)
- Sales analytics & trends
- Product performance metrics
- Staff performance tracking
- Customer purchase analysis
- Inventory/stock insights
- Tax & financial reporting

MongoDB collections: `events`, `cameras`, `alerts`, `orders`, `products`, `customers`, `staff`, `stores`

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

**Data Note:** System now loads real Brigade Bangalore store data from CSV on startup.

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

### Security & Events (CCTV)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| GET/POST | `/api/events` | List / ingest CCTV events |
| GET | `/api/cameras` | List cameras |
| GET/PATCH | `/api/alerts` | Alerts CRUD |
| GET | `/api/dashboard/stats` | Live KPIs |
| GET | `/api/dashboard/heatmap` | Zone density |
| GET | `/api/dashboard/metrics` | System metrics |

### Business Intelligence (Retail Data)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/orders` | List transactions (paginated) |
| GET | `/api/orders/analytics/summary` | Sales KPI totals |
| GET | `/api/orders/analytics/by-date` | Daily sales trends |
| GET | `/api/orders/analytics/by-product` | Top products & performance |
| GET | `/api/orders/analytics/by-staff` | Salesperson metrics |
| GET | `/api/stores` | Store list & details |
| GET | `/api/stores/:storeId/analytics` | Comprehensive store analytics |
| GET | `/api/products` | Product catalog |
| GET | `/api/products/departments` | Departments list |

**Real-time:** Socket.IO events `event`, `alert`, `dashboard`.

## Tech stack

| Layer | Stack |
|-------|--------|
| Frontend | React, Tailwind CSS, Recharts, Socket.IO client |
| Backend | Node.js, Express, Socket.IO |
| Database | MongoDB |
| AI | Python, OpenCV, Ultralytics YOLOv8 |

## Docker

Full stack (MongoDB + API + dashboard with **real Brigade Bangalore store data**):

```bash
docker compose up --build
```

- Dashboard: http://localhost:3000  
- API: http://localhost:5000/api/health  
- Real data auto-loaded from CSV on startup

Optional AI service (requires webcam device mapping on Linux):

```bash
docker compose --profile ai up --build
```

**Note:** CCTV events and real retail data work together for complete store intelligence.

## Project layout

```
ai-service/          # YOLOv8 detection + event POST
backend/src/         # Express API + Socket.IO
frontend/src/        # React dashboard
docker-compose.yml   # MongoDB + API
start_platform.bat   # Windows launcher
```

Built for the Store Intelligence MVP challenge — no face recognition, no Kubernetes, no multi-store scaling.
