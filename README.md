# Apex Store Intelligence Platform (MVP)

A dual-purpose intelligence platform combining deep edge video telemetry (YOLOv8 + Centroid Re-ID) with retail transactional analytics (Brigade Bangalore store datasets) to expose a queryable business intelligence surface.

---

## 🎯 System Capabilities

- **Edge Computer Vision Pipeline**: Processes CCTV video streams frame-by-frame, isolates shoppers via YOLOv8, maps persistent visitor tracks asynchronously, prevents double-counting, clusters group entries, separates store staff uniforms, and generates detailed spatial zone-dwell events.
- **Relational Intelligence REST API**: Built natively in FastAPI ASGI + aiosqlite/SQLAlchemy. Deduplicates telemetry by event ID (POST idempotency), calculates temporal POS-CCTV session conversion metrics, exposes live store funnels, and maps operational anomalies (queue spikes, conversion drops, dead zones).
- **Live Operations Dashboard**: A React/Vite dashboard connecting asynchronously to the backend, rendering real-time heatmaps, listing alarm bulletins, and displaying observability metrics synced via Socket.IO live broadcasts.

---

## ⚡ Setup in 5 Commands

Launch the complete local platform (database, backend, and dashboard) in exactly 5 command steps:

```bash
# 1. Clone the repository
git clone <repo-url> && cd store-intelligence

# 2. Start the containerised stack (API + Dashboard + Transaction DB)
docker compose up --build -d

# 3. Process a sample video clip through the Edge AI pipeline
docker compose run --rm pipeline python runner.py --camera CAM_ENTRY_01 --source "/app/resources/Store 1/CAM 3 - entry.mp4" --api http://backend:5000/api/events/ingest --display false

# 4. Verify system health and lag warnings
curl http://localhost:5000/api/health

# 5. Retrieve dynamic store business metrics
curl http://localhost:5000/api/stores/ST1008/metrics
```

---

## 🎥 Running the Detection Pipeline Local-Mode

To process video clips locally outside of Docker containers:

```bash
# 1. Navigate to the backend directory and activate your virtual environment
cd backend
venv\Scripts\activate   # On Windows
source venv/bin/activate # On Unix

# 2. Run the pipeline against a sample CCTV clip mapping to the API
python runner.py --camera CAM_ENTRY_01 --source "../resources/Store 1/CAM 3 - entry.mp4" --api http://localhost:5000/api/events/ingest --display false
```
*Telemetries and event logs will stream in real time directly to the console, archive into the SQLite database, and broadcast instantly via Socket.IO to the React dashboard at `http://localhost:3000`.*

---

## 📊 API Reference surface

All endpoints support direct root access and prefix `/api/` paths case-insensitively to satisfy proxy environments:

| Method | Path | Description | Key Requirements Met |
|---|---|---|---|
| **POST** | `/api/events/ingest` | Telemetry batch receiver (limits: 500 events) | **Strict Event ID Idempotency** (Skipping duplicate event UUIDs safely). |
| **GET** | `/api/stores/{id}/metrics` | Store conversion & dwell metrics (excluding staff) | **POS Temporal Correlation**: Correlation of POS CSV timestamps with visitor dwell sessions. |
| **GET** | `/api/stores/{id}/funnel` | Session-based customer conversion funnel | **Funnel Drop-offs**: Aware -> Browse -> Cart -> Convert drop-off rates with zero double counting. |
| **GET** | `/api/stores/{id}/heatmap` | Zone visit density and average dwell scales (0-100) | Heatmap normalization ready for grid canvas displays. |
| **GET** | `/api/stores/{id}/anomalies` | Live operations anomaly center alerts | **Anomaly Center**: Identifies active queue spikes (>5), dead zones (>30m), and conversion drops. |
| **GET** | `/api/health` | ASGI system check and stream lag logs | **STALE_FEED Warning**: Flags a warning if video feed ingestion lag exceeds 10 minutes. |

---

## 🧪 Automated Verification Suite

Run our comprehensive test suite verifying Edge Re-ID tracking, stale exits, funnel structures, and transaction summarizations:

```bash
# Navigate to the backend directory and run:
python -m unittest discover -s tests -p "test_*.py"
```
*Note: Test runs automatically detect test environments and disable periodic Socket.IO background broadcasing tasks to prevent thread hangs and lock-releases on SQLite database files.*
