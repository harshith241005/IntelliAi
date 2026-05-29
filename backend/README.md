# Store Intelligence System Platform Backend

A production-grade, event-driven retail Store Intelligence System backend built in **Python 3.11** using **FastAPI**, **PostgreSQL**, **Redis Streams & Pub/Sub**, and **SQLAlchemy 2.0**.

It ingests raw CCTV footage metadata, runs stateful object tracking, triggers a rules-based real-time anomaly detection engine, and broadcasts canonical events to active live-ops dashboard consumers via low-latency WebSockets and Server-Sent Events (SSE) fallbacks.

---

## 🏗️ System Architecture

```
[CCTV Frame Metadata] 
      ↓
[Ingestion API] ──────→ (Deduplication / Unique Constraints Check)
      ↓
[Detection Stage] ────→ Mock YOLOv8 bbox coordinate coordinates
      ↓
[Stateful Tracker] ───→ Stateful IoU proximity track association
      ↓
[Enrichment Stage] ──→ Zone mapping & Enters/Exits transitions
      ↓
[Anomaly Engine] ─────→ Runs rule evaluation checks (Loitering, crowd surges, restricted breaches)
      ↓
[Event Publisher] ────→ PostgreSQL (Durable SQL) + Redis Stream (XADD store-events) + WS/SSE fanout
```

---

## 🛠️ Configuration & Environment Variables

Create a local `.env` file in the `backend/` directory:

```env
DATABASE_URL=postgresql+asyncpg://postgres:postgres@db:5432/store_intelligence
REDIS_URL=redis://redis:6379/0
API_HOST=0.0.0.0
API_PORT=8000
AUTH_DISABLED=true          # Bypasses X-API-Key auth during development
API_KEYS=key1,key2
MOCK_PIPELINE=true          # Drives CCTV frame updates simulation tick
MOCK_EVENT_INTERVAL_MS=2000
RESTRICTED_ZONES=zone_restricted_loading,zone_restricted_safe
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
LOG_LEVEL=INFO
```

---

## 🚀 Local Startup Playbook

### Running Concurrently via Docker Compose (Recommended)
Boot the entire multi-container node cluster (PostgreSQL database, Redis Streams, and FastAPI API) instantly:
```bash
docker-compose up --build
```
*The database tables are automatically initialized, migrated, and seeded with 3 stores, 12 cameras, 500 historical events, and 20 incidents alerts in <30 seconds!*

### Running Standalone Locally
If you want to run the python uvicorn worker directly on your system, it automatically falls back to an SQLite database file:
```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Run API server (SQLite tables are created and seeded on startup!)
python -m app.main
```

- **Interactive OpenAPI Documentation**: `http://localhost:8000/docs`
- **Health Observability Check**: `http://localhost:8000/api/v1/health`

---

## 🧠 AI-Assisted Engineering Decisions & Trade-Offs

We recorded and enforced the following architectural decisions inside the Store Intelligence platform:

### 1. Mock Simulator vs. Real CV Model in v1
- **Trade-Off**: A real ML inference pipeline requires intense GPU memory (OOM risks) and RTSP stream decoder latency over local connections.
- **Decision**: We designed a swappable `BaseDetector` interface and implemented a high-fidelity `MockDetector`. In production, a real YOLOv8/OpenCV class can swap the detect stage cleanly with zero code modifications to the downstream tracking, enrichment, or publishing logic.

### 2. PostgreSQL `jsonb` vs. Separate Payload Tables
- **Trade-Off**: Telemetry payloads differ wildly (detections have bboxes, transitions have dwell times, alerts have SLA deadlines). Mapping a separate schema table for every single event category causes excessive database lockups and complex join overhead.
- **Decision**: We stored event-specific details inside a single Postgres `jsonb` payload column. This grants absolute schema versioning flexibility, while we maintain robust database index performance by indexing the canonical fields (`timestamp`, `store_id`, `track_id`, `correlation_id`).

### 3. Redis Streams vs. Kafka
- **Trade-Off**: Kafka is the gold standard for fleet scale streaming, but introduces massive local setup overhead (ZooKeeper/KRaft, Java runtimes, storage volume scaling).
- **Decision**: We utilized Redis Streams (`XADD`) and Redis Pub/Sub. Redis is incredibly lightweight, runs sub-millisecond latencies, and fits perfectly into memory-constrained local compose environments, while providing standard Consumer Group (`enrichment-workers`) scaling paths.

### 4. Cursor-Based Pagination vs. Offset Pagination
- **Trade-Off**: In active CCTV event feeds with 1000+ logs/minute, offset-based queries (`LIMIT 50 OFFSET 10000`) cause major performance degradation (database must scan all offset rows) and duplicate row skips when new events are continuously inserted at the top.
- **Decision**: We built cursor-based pagination sorting DESC on `(timestamp, id)`. This ensures consistent sub-100ms response times at any depth (constant SQL indexing key jumps) and absolute scroll stability under rapid live updates.

### 5. WebSocket vs. Server-Sent Events (SSE)
- **Trade-Off**: WebSockets are bi-directional and low-overhead, but get blocked by highly restrictive enterprise corporate proxy firewalls. SSE is lightweight and utilizes standard HTTP connections but is uni-directional.
- **Decision**: We exposed both. WebSockets is the primary operations channel, with an SSE `/events/stream/sse` route as a robust, automatic fallback option for restrictive networks.

### 6. Modular Monolith vs. Microservices
- **Trade-Off**: Decoupling ingestion, tracking, rules, and APIs into individual microservices introduces severe network latency overhead (~10-20ms per hop) and dependency deployment bloat.
- **Decision**: We constructed a modular monolith with strict service boundaries (`ingest/`, `pipeline/`, `anomaly/`, `api/`). This preserves single-unit deployment simplicity and low latency for v1, while ensuring that packages can be extracted into individual serverless microservices easily when scaling out.
