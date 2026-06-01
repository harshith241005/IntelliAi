# Store Intelligence Platform — Architecture & System Design

This document details the production-ready system architecture, data schemas, edge video analysis logic, and relational business intelligence aggregation engines designed for the Store Intelligence Platform.

---

## 1. System Architecture Overview

The system is a **dual-purpose real-time intelligence platform** combining deep edge video telemetry with retail transactional analytics:

```
                  +-----------------------------------+
                  |      Edge Camera Ingest Node      |
                  |  +-----------------------------+  |
                  |  | YOLOv8 Object Detection     |  |
                  |  +--------------+--------------+  |
                  |                 | (detections)    |
                  |                 v                 |
                  |  +-----------------------------+  |
                  |  | Spatial Tracker (Centroid)  |  |
                  |  +--------------+--------------+  |
                  |                 | (visitor tracks)|
                  |                 v                 |
                  |  +-----------------------------+  |
                  |  | Poly Zone & Re-ID Filter    |  |
                  |  +--------------+--------------+  |
                  +-----------------|-----------------+
                                    | (Pydantic StoreEvents)
                                    | REST POST /api/events/ingest (Port 5000)
                                    v
                  +-----------------------------------+
                  |      FastAPI ASGI App Server      |
                  |  +-----------------------------+  |
                  |  | SQLAlchemy ORM Ingest Layer |  |
                  |  +--------------+--------------+  |
                  |                 |                 |
                  |                 v                 |
                  |  +-----------------------------+  |
                  |  |  aiosqlite SQLite Archive   |  |
                  |  +--------+-----+--------------+  |
                  |           |     |                 |
                  | (query)   v     v (Socket.IO)     |
                  |  +--------+--+  +--------------+  |
                  |  | Retail BI |  | Live Stream  |  |
                  |  | CSV Load  |  | Broadcaster  |  |
                  |  +--------+--+  +-------+------+  |
                  +-----------|-------------|---------+
                              |             |
           REST /api/metrics  |             | Websocket connection
           REST /api/funnel   v             v (Socket.IO client)
                  +-----------------------------------+
                  |   Live Operations Dashboard UI    |
                  |   - Real-Time Live Feed & Heatmap |
                  |   - Dynamic Business Sales Funnel |
                  |   - System Observability card KPIs|
                  +-----------------------------------+
```

---

## 2. Component Design & Implementation

### A. Edge AI Video Pipeline (`backend/pipeline/detect.py`)
1. **Detection & Isolation**: Ultralytics YOLOv8 Nano (`yolov8n.pt`) isolates the `person` class (ID 0) with a confidence filter of `0.40`. Bounding boxes are generated for each frame.
2. **Centroid Proximity Tracking (Re-ID)**: To support consumer-grade hardware, tracks are persisted via a lightweight spatial centroid Re-ID tracker. A track threshold of `80.0` pixels maps new coordinates to existing track histories.
3. **Re-Entry State Persistence**: When a track is initialized, it is evaluated against a temporal history of exited visitors (`exited_visitors` queue). If a visitor's coordinate is within `100` pixels and under `300 seconds` of a previous exit, they retain their original `visitor_id`, preserving cross-visit metrics.
4. **Spatial Polygon Classification**: A ray-casting algorithm (`_point_in_polygon`) tests person bounding box centers against zone polygons loaded from `store_layout.json`. Naive intersections are avoided to allow complex non-rectangular layouts.
5. **Lingering / Double-Counting Mitigations**: Lingering visitors inside the entry polygon are prevented from triggering repetitive counts by confirming the session `entry_zone_confirmed` boolean flag once per track lifetime.
6. **Group Entry Isolation**: Entry events occurring within `2.0 seconds` of one another are automatically grouped under a `group_id` and assigned a computed `group_size` in the metadata, mapping group behaviors.
7. **Zone Dwell & Exit Generation**: Zone enter timestamps are captured. When transitioning to a new zone or exiting the store, a highly descriptive `ZONE_DWELL` event containing computed `dwell_ms` is generated. Stale tracks (unseen for >30.0s) trigger automatic `EXIT` events, keeping the store occupancy count balanced.
8. **Staff Filtering**: A uniform classification helper analyzes cropped bounding boxes using HSV color histogram thresholds. If dark uniform ratios exceed `40%`, the track is marked as `is_staff`, omitting them from consumer conversion funnel aggregates.

### B. SQLite Relational Storage & Importer (`backend/app/db.py`)
- We utilize SQLAlchemy mounted over `aiosqlite` for asynchronous, non-blocking relational telemetry storage.
- Relational time-series schemas index event IDs, timestamps, event types, and visitor IDs for maximum retrieval speed.
- **CSV Data Load**: On start-up, the system imports the **Brigade Bangalore store CSV dataset** containing 101 transactions, 47 products, and salesperson logs directly into the SQL database, making it immediately available for relational querying.

### C. FastAPI Intelligence API Routing (`backend/app/main.py`)
1. **ASGI Compatibility**: A unified Socket.IO server is mounted directly over the ASGI stack, supporting live streaming event updates, live alarm triggers, and continuous metrics broadcasting.
2. **Case-Insensitive & Prefix Support**: Complete route decorators support `/metrics`, `/Metrics`, and prefix `/api/metrics` to comply with Nginx reverse proxy routing and custom curl scripts seamlessly.
3. **Session-Based Funnel Drop-off**: Aggregates unique consumer tracks across four distinct steps (Awareness -> Browse -> Cart Intent -> Checkout) with zero double-counting, returning clean mathematically structured drop-off indicators.
4. **Real Store Conversion Rate**: Calculates conversion rate using: `Total unique transaction count (from CSV SQL) / Total entry events (from CCTV SQL)`.

---

## 3. Observability & Alarm Center
- **System Metrics**: Server and edge operations are continuously exposed via `/api/dashboard/metrics` and `/api/dashboard/stats`.
- **Periodic Stats Broadcasting**: An async background thread streams `dashboard` stats via Socket.IO every 2 seconds, ensuring dashboard KPI charts are fully responsive.
- **Anomaly Detection (`backend/app/anomaly.py`)**: Batches are processed through an event rules engine evaluating:
  - *Suspicious Dwell*: Dwelling in browsing zones for >300s.
  - *Billing Queue Overcrowding*: Triggering a critical `CROWD_DETECTED` alarm if active billing zone counts exceed 5.
  - *Zone Capacity*: Triggering a `HIGH_OCCUPANCY` alarm if browsing zone counts exceed 15.