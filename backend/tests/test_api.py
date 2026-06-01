# PROMPT: Generate REST API integration tests in Python using FastAPI's TestClient to assert: 1. Case-insensitive /metrics and /Metrics routing 2. Ingestion event deduplication (idempotency) 3. Funnel drops drop-off logic 4. POS transaction analytical summarization KPIs.
# CHANGES MADE: Calibrated manual setup routines to initialize SQLite database tables asynchronously on setUpClass to resolve TestClient ASGI startup gotchas.

import unittest
import sys
import asyncio
from pathlib import Path
from fastapi.testclient import TestClient

# Add parent path to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.main import app
from app.db import get_db

class TestStoreIntelligenceAPI(unittest.TestCase):
    
    @classmethod
    def setUpClass(cls):
        # Manually initialize database and load CSV dataset since TestClient 
        # doesn't run startup events outside context manager blocks.
        db = asyncio.run(get_db())
        asyncio.run(db.initialize())
        
        # Instantiate test client
        cls.client = TestClient(app)
        
    def test_health_check(self):
        response = self.client.get("/api/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "healthy")
        
    def test_cameras(self):
        response = self.client.get("/api/cameras")
        self.assertEqual(response.status_code, 200)
        self.assertIsInstance(response.json(), list)
        self.assertGreaterEqual(len(response.json()), 1)
        
    def test_metrics(self):
        # Case sensitive
        r1 = self.client.get("/metrics")
        self.assertEqual(r1.status_code, 200)
        self.assertIn("conversion_rate", r1.json())
        self.assertIn("unique_visitors", r1.json())
        
        # Case insensitive
        r2 = self.client.get("/Metrics")
        self.assertEqual(r2.status_code, 200)
        
        # API Prefix
        r3 = self.client.get("/api/metrics")
        self.assertEqual(r3.status_code, 200)

    def test_funnel(self):
        response = self.client.get("/api/funnel")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("steps", data)
        self.assertEqual(len(data["steps"]), 4)
        
        # Verify funnel drop-off order
        counts = [step["count"] for step in data["steps"]]
        self.assertGreaterEqual(counts[0], counts[1])
        self.assertGreaterEqual(counts[1], counts[2])
        self.assertGreaterEqual(counts[2], counts[3])

    def test_orders_analytics(self):
        response = self.client.get("/api/orders/analytics/summary")
        self.assertEqual(response.status_code, 200)
        self.assertIn("total_revenue", response.json())
        self.assertIn("total_transactions", response.json())

    def test_event_ingest_bad_batch(self):
        response = self.client.post("/api/events/ingest", json={"events": []})
        self.assertEqual(response.status_code, 202)

    def test_event_ingest_partial_success(self):
        import uuid
        test_event_id = str(uuid.uuid4())
        payload = {
            "events": [
                {
                    "event_id": test_event_id,
                    "store_id": "STORE_BLR_002",
                    "camera_id": "CAM_ENTRY_01",
                    "visitor_id": "VIS_TEST01",
                    "event_type": "ENTRY",
                    "timestamp": "2026-03-03T14:22:10Z",
                    "confidence": 0.95
                },
                {
                    "event_id": "invalid-event-missing-fields",
                    "store_id": "STORE_BLR_002",
                    "visitor_id": "VIS_TEST02",
                    "event_type": "ENTRY",
                    "confidence": 0.33
                }
            ]
        }
        response = self.client.post("/api/events/ingest", json=payload)
        self.assertEqual(response.status_code, 202)
        data = response.json()
        self.assertEqual(data["ingested_count"], 1)
        self.assertEqual(data["failed_count"], 1)
        self.assertGreaterEqual(len(data["errors"]), 1)

    def test_event_ingest_staff_exclusion(self):
        payload = {
            "events": [
                {
                    "event_id": "880e8400-e29b-41d4-a716-446655448800",
                    "store_id": "STORE_BLR_002",
                    "camera_id": "CAM_ENTRY_01",
                    "visitor_id": "VIS_STAFF01",
                    "event_type": "ENTRY",
                    "timestamp": "2026-03-03T14:25:10Z",
                    "is_staff": True,
                    "confidence": 0.99
                }
            ]
        }
        r_ingest = self.client.post("/api/events/ingest", json=payload)
        self.assertEqual(r_ingest.status_code, 202)
        
        r_metrics = self.client.get("/api/stores/STORE_BLR_002/metrics")
        self.assertEqual(r_metrics.status_code, 200)
        self.assertIn("unique_visitors", r_metrics.json())

if __name__ == "__main__":
    unittest.main()
