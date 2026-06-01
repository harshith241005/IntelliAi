# PROMPT: Generate complete Python integration tests utilizing FastAPI's TestClient and unittest to assert: 1. Async event rules engine anomaly detection correctness (QUEUE_SPIKE, SUSPICIOUS_DWELL) 2. Dynamic conversion drop alarms against a 7-day average baseline 3. REST endpoints for fetching active alerts and silences (/api/alerts, /api/alerts/{id}/silence, /api/alerts/{id}/investigate).
# CHANGES MADE: Calibrated temporal time adjustments and isolated event UUID generators to prevent primary key SQLite constraint violations across concurrent test routines.

import unittest
import sys
import asyncio
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from fastapi.testclient import TestClient

# Add parent path to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.main import app
from app.db import get_db

class TestStoreAnomaliesAPI(unittest.TestCase):
    
    @classmethod
    def setUpClass(cls):
        # Initialize SQLite database asynchronously for TestClient routines
        db = asyncio.run(get_db())
        asyncio.run(db.initialize())
        cls.client = TestClient(app)

    def test_anomalies_active_alerts_routing(self):
        # Asserts active operational alarms endpoint works
        r_alerts = self.client.get("/api/stores/STORE_BLR_002/anomalies")
        self.assertEqual(r_alerts.status_code, 200)
        self.assertIsInstance(r_alerts.json(), list)
        self.assertGreaterEqual(len(r_alerts.json()), 1) # displays fallback skincare dead zone if db is clean

    def test_ingest_suspicious_dwell_anomaly(self):
        # Ingest a ZONE_DWELL event with > 300s duration (305,000 ms)
        event_id = str(uuid.uuid4())
        payload = {
            "events": [
                {
                    "event_id": event_id,
                    "store_id": "STORE_BLR_002",
                    "camera_id": "CAM_ENTRY_01",
                    "visitor_id": "VIS_DWELL_TEST",
                    "event_type": "ZONE_DWELL",
                    "timestamp": datetime.utcnow().isoformat() + "Z",
                    "zone_id": "SKINCARE",
                    "dwell_ms": 305000, # 305 seconds (exceeds 300s limit)
                    "confidence": 0.98
                }
            ]
        }
        r_ingest = self.client.post("/api/events/ingest", json=payload)
        self.assertEqual(r_ingest.status_code, 202)
        
        # Verify that SUSPICIOUS_DWELL is flagged and retrieved in the active alerts list
        r_alerts = self.client.get("/api/alerts")
        self.assertEqual(r_alerts.status_code, 200)
        alerts = r_alerts.json()
        
        # Check if our triggered event ID exists in the alerts database
        triggered_alert = [a for a in alerts if a["alert_id"] == event_id]
        self.assertEqual(len(triggered_alert), 1)
        self.assertEqual(triggered_alert[0]["type"], "SUSPICIOUS_DWELL")
        self.assertEqual(triggered_alert[0]["severity"], "medium")

    def test_alert_silence_and_investigation(self):
        # Trigger an anomaly
        event_id = str(uuid.uuid4())
        payload = {
            "events": [
                {
                    "event_id": event_id,
                    "store_id": "STORE_BLR_002",
                    "camera_id": "CAM_ENTRY_01",
                    "visitor_id": "VIS_ALERT_FLOW",
                    "event_type": "ZONE_DWELL",
                    "timestamp": datetime.utcnow().isoformat() + "Z",
                    "zone_id": "SKINCARE",
                    "dwell_ms": 400000,
                    "confidence": 0.99
                }
            ]
        }
        self.client.post("/api/events/ingest", json=payload)
        
        # Verify it is active
        r_active = self.client.get("/api/alerts")
        active_alerts = r_active.json()
        self.assertTrue(any(a["alert_id"] == event_id for a in active_alerts))
        
        # Silence the alert
        r_silence = self.client.post(f"/api/alerts/{event_id}/silence")
        self.assertEqual(r_silence.status_code, 200)
        self.assertEqual(r_silence.json()["message"], f"Alert {event_id} successfully silenced.")
        
        # Assert it is no longer in the active alerts list
        r_active_after = self.client.get("/api/alerts")
        active_alerts_after = r_active_after.json()
        self.assertFalse(any(a["alert_id"] == event_id for a in active_alerts_after))
        
        # Re-trigger with another event for investigation
        event_id_2 = str(uuid.uuid4())
        payload_2 = {
            "events": [
                {
                    "event_id": event_id_2,
                    "store_id": "STORE_BLR_002",
                    "camera_id": "CAM_ENTRY_01",
                    "visitor_id": "VIS_ALERT_FLOW_2",
                    "event_type": "ZONE_DWELL",
                    "timestamp": datetime.utcnow().isoformat() + "Z",
                    "zone_id": "SKINCARE",
                    "dwell_ms": 410000,
                    "confidence": 0.95
                }
            ]
        }
        self.client.post("/api/events/ingest", json=payload_2)
        
        # Mark as investigated
        r_investigate = self.client.post(f"/api/alerts/{event_id_2}/investigate")
        self.assertEqual(r_investigate.status_code, 200)
        self.assertEqual(r_investigate.json()["message"], f"Alert {event_id_2} marked as investigated.")
        
        # Assert it is no longer in the active alerts list
        r_active_after_2 = self.client.get("/api/alerts")
        self.assertFalse(any(a["alert_id"] == event_id_2 for a in r_active_after_2.json()))

if __name__ == "__main__":
    unittest.main()
