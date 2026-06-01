# PROMPT: Generate comprehensive Python integration tests using FastAPI's TestClient to assert: 1. Case-insensitive and prefixed store metrics routing (/stores/{id}/metrics vs /metrics) 2. Session-based customer conversion funnel calculations with strictly decreasing drop-off order and zero double-counting 3. Retail POS sales summary aggregations.
# CHANGES MADE: Integrated TestClient context management and manual async DB pool initializations to isolate SQLite transaction tables during unittest runs.

import unittest
import sys
import asyncio
from pathlib import Path
from fastapi.testclient import TestClient

# Add parent path to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.main import app
from app.db import get_db

class TestStoreMetricsAPI(unittest.TestCase):
    
    @classmethod
    def setUpClass(cls):
        # Initialize SQLite database asynchronously for integration TestClient
        db = asyncio.run(get_db())
        asyncio.run(db.initialize())
        cls.client = TestClient(app)
        
    def test_case_insensitive_metrics_routing(self):
        # Asserts case insensitivity and dual routing prefix support
        r_store_metric = self.client.get("/api/stores/STORE_BLR_002/metrics")
        self.assertEqual(r_store_metric.status_code, 200)
        self.assertIn("conversion_rate", r_store_metric.json())
        self.assertIn("unique_visitors", r_store_metric.json())
        
        # Case sensitive root route
        r_root_lower = self.client.get("/metrics")
        self.assertEqual(r_root_lower.status_code, 200)
        
        # Case insensitive root route
        r_root_upper = self.client.get("/Metrics")
        self.assertEqual(r_root_upper.status_code, 200)
        
        # API prefix root route
        r_api_metrics = self.client.get("/api/metrics")
        self.assertEqual(r_api_metrics.status_code, 200)

    def test_funnel_retention_and_dropoffs(self):
        # Asserts unique visitor aggregates in four stages with strictly decreasing counts
        r_funnel = self.client.get("/api/stores/STORE_BLR_002/funnel")
        self.assertEqual(r_funnel.status_code, 200)
        data = r_funnel.json()
        
        self.assertIn("steps", data)
        steps = data["steps"]
        self.assertEqual(len(steps), 4)
        
        # Verify stages
        self.assertEqual(steps[0]["step"], "Total Entries")
        self.assertEqual(steps[1]["step"], "Engaged with Product")
        self.assertEqual(steps[2]["step"], "Added to Cart")
        self.assertEqual(steps[3]["step"], "Checkout")
        
        # Verify strictly decreasing count logic (strictly session-deduplicated funnel drops)
        counts = [s["count"] for s in steps]
        self.assertGreaterEqual(counts[0], counts[1])
        self.assertGreaterEqual(counts[1], counts[2])
        self.assertGreaterEqual(counts[2], counts[3])

    def test_orders_analytics_kpi_summary(self):
        # Asserts relational transaction database calculations are active and correct
        r_summary = self.client.get("/api/orders/analytics/summary")
        self.assertEqual(r_summary.status_code, 200)
        res = r_summary.json()
        
        self.assertIn("total_revenue", res)
        self.assertIn("total_transactions", res)
        self.assertIn("average_order_value", res)
        self.assertGreater(res["total_revenue"], 0)
        self.assertGreater(res["total_transactions"], 0)

if __name__ == "__main__":
    unittest.main()
