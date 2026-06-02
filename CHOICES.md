# Store Intelligence Platform — Architectural Choices & Trade-offs

This document outlines the architectural trade-offs, technical reasoning, and design justifications for the engineering decisions made during the development of the Store Intelligence Platform.

---

## Decision 1: Detection Model Selection & Staff Filter
* **Options Considered**: YOLOv8 (Nano vs Medium) vs RT-DETR vs OSNet/DeepSORT for tracking.
* **What AI Suggested**:
  * For detection, the AI highlighted the RAM saturation and CPU throttling risks of deploying heavy architectural layers (e.g., RT-DETR) locally alongside database I/O, suggesting YOLOv8 Nano (`yolov8n.pt`) as the optimal baseline to maximize FPS.
  * For tracking, the AI recommended a deterministic spatial centroid proximity tracker combined with a temporal exited queue (`timeout_seconds = 30.0` stale cleanup buffer and a `300.0` seconds exit window) over deep models like DeepSORT to conserve edge memory.
  * For staff detection, instead of fine-tuning an expensive multi-class classifier model, a Vision-Language prompt during design recommended checking bounding box region HSV histograms for dominant colors, as retail uniforms typically share a dark, uniform color palette.
* **What We Chose and Why**:
  * We chose **YOLOv8 Nano (`yolov8n.pt`)** with a custom **deterministic centroid proximity tracker**. Centroid tracking achieves `>30 FPS` on basic edge CPU processors, and the temporal-spatial queues successfully handle short camera occlusions and visitor re-entries without CPU latency.
  * We chose the **HSV bounding box ratio** method (>40% dark color threshold) for staff classification. This eliminates complex neural network inference for uniform classification, allowing the pipeline to exclude store employees from consumer metrics instantly.

---

## Decision 2: Event Schema Design Rationale
* **Options Considered**: Flat unstructured JSON schemas vs nested document schemas, and manual JSON parsing vs Pydantic model validation.
* **What AI Suggested**:
  * The AI recommended a strictly typed nested Pydantic schema (`StoreEvent`) that groups dynamic properties like `queue_depth`, `sku_zone`, and `session_seq` under a nested `metadata` sub-object.
  * It also recommended using UUIDv4 for `event_id` to enforce ingestion idempotency, and ISO-8601 UTC timestamp format for temporal correlation.
* **What We Chose and Why**:
  * We chose a **Pydantic-based schema model** (`StoreEvent` and `EventMetadata`). Grouping dynamic metadata under a sub-object keeps the top-level schema clean and uniform, which aligns perfectly with the challenge's expected event catalogue.
  * Importing the same Pydantic classes in both the edge camera runner and the FastAPI validation layers ensures **dry-model sharing**. This completely eliminates serialization discrepancies, simplifies testing, and prevents malformed event payloads from contaminating the SQL analytics tables.

---

## Decision 3: API Architecture & Storage Engine
* **Options Considered**: Node.js/Express with MongoDB vs Python/FastAPI with Asynchronous SQLite (aiosqlite/SQLAlchemy).
* **What AI Suggested**:
  * For the API layer, the AI advised consolidating the entire pipeline onto asynchronous FastAPI/Pydantic to support high-throughput video events across Python computer vision logic into a relational format, avoiding marshalling Python events into a separated Node.js system.
  * For the database layer, the AI suggested MongoDB for flat telemetry logs but agreed that Asynchronous SQLite with SQLAlchemy provides a much cleaner, non-blocking local storage solution for edge deployments.
* **What We Chose and Why**:
  * We chose **FastAPI** with **aiosqlite/SQLAlchemy**. Retail analytics metrics (distinct counts of `visitor_id`, zone-dwell averages grouped by `zone_id`, and POS transaction timestamps correlation) are **fundamentally relational queries**. Aggregating these in MongoDB requires complex pipelines, whereas SQL provides declarative, highly optimized querying.
  * SQLite stores events locally in a single file, which fits perfectly on local edge nodes. Using SQLAlchemy abstracts the infrastructure entirely: migrating from a local SQLite database to a cloud-based PostgreSQL cluster requires changing just one connection string line (`sqlite+aiosqlite:///...` to `postgresql+asyncpg://...`) with zero code rewrite.

---

## Other System Trade-offs

### 1. Front-End Interface: Socket.IO over Standard WebSockets
* **Decision**: Implement ASGI python-socketio to broadcast live updates.
* **Justification**: Native WebSockets lack built-in support for heartbeat ping/pong, automatic reconnection, and namespace isolation out of the box, requiring custom framing protocols. The React frontend dashboard utilizes standard Socket.IO client namespaces. Keeping python-socketio on the backend allowed a complete 1:1 architectural migration, keeping the React interface fully operational without modification.

### 2. Orchestration: Headless CLI Flag over OpenCV GUI
* **Decision**: Decouple OpenCV frame render loops using a configurable `--display false` flag.
* **Justification**: Running video analysis pipelines inside Docker containers or virtual machines typically causes instant crashes with `Gtk-WARNING: cannot open display` because virtualized systems lack standard GUI monitors. Adding a CLI `--display` parameter that defaults to `false` allows seamless container startup during `docker compose up` while permitting engineers to inspect visual boxes locally during debugging.
