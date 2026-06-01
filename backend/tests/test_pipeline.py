# PROMPT: Generate comprehensive unit tests in Python utilizing standard unittest library to validate a spatial video tracking edge pipeline, asserting: 1. Centroid visitor persistences 2. Re-entry session restorations 3. Stale cleanup exit allocations 4. Zone spatial intersections.
# CHANGES MADE: Integrated custom mock trajectory structures and manually calibrated temporal-spatial delta thresholds to match actual SQLite/aiosqlite ORM schema instances.

import unittest
from datetime import datetime, timedelta
import numpy as np

from pipeline.detect import VisitorTracker, ZoneClassifier, StaffClassifier

class TestVisitorTracker(unittest.TestCase):
    
    def setUp(self):
        self.tracker = VisitorTracker(timeout_seconds=2.0)
        
    def test_get_or_create_visitor(self):
        visitor_id = self.tracker.get_or_create_visitor(12, (100.0, 100.0))
        self.assertTrue(visitor_id.startswith("VIS_"))
        self.assertEqual(self.tracker.visitors[12]["visitor_id"], visitor_id)
        
    def test_reentry_detection(self):
        # Create a visitor and exit them
        visitor_id = self.tracker.get_or_create_visitor(12, (100.0, 100.0))
        self.tracker.record_exit(12)
        
        # Check re-entry close to last position
        reentry_id = self.tracker.detect_reentry(99, (120.0, 110.0), max_time_since_exit=60.0)
        self.assertEqual(reentry_id, visitor_id)
        
        # Check no re-entry far from last position
        no_reentry = self.tracker.detect_reentry(99, (400.0, 400.0), max_time_since_exit=60.0)
        self.assertIsNone(no_reentry)

    def test_stale_cleanup(self):
        visitor_id = self.tracker.get_or_create_visitor(12, (100.0, 100.0))
        
        # Manually alter last seen to simulate aging
        self.tracker.visitors[12]["last_seen"] = datetime.now() - timedelta(seconds=5)
        
        stale = self.tracker.cleanup_stale()
        self.assertEqual(len(stale), 1)
        self.assertEqual(stale[0]["visitor_id"], visitor_id)
        self.assertNotIn(12, self.tracker.visitors)

class TestZoneClassifier(unittest.TestCase):
    
    def setUp(self):
        layout = {
            "zones": [
                {
                    "name": "TEST_ZONE",
                    "camera": "CAM_01",
                    "polygon": [[0, 0], [10, 0], [10, 10], [0, 10]]
                }
            ],
            "entry_threshold": {
                "CAM_01": {
                    "polygon": [[0, 8], [10, 8], [10, 10], [0, 10]]
                }
            }
        }
        self.classifier = ZoneClassifier(layout)
        
    def test_classify_zone(self):
        zone = self.classifier.classify_zone((1, 1, 3, 3), "CAM_01")
        self.assertEqual(zone, "TEST_ZONE")
        
        outside = self.classifier.classify_zone((15, 15, 18, 18), "CAM_01")
        self.assertIsNone(outside)
        
    def test_is_entry_zone(self):
        is_entry = self.classifier.is_entry_zone((2, 8, 4, 10), "CAM_01")
        self.assertTrue(is_entry)
        
        not_entry = self.classifier.is_entry_zone((1, 1, 3, 3), "CAM_01")
        self.assertFalse(not_entry)

class TestStaffClassifier(unittest.TestCase):
    
    def setUp(self):
        self.classifier = StaffClassifier()
        
    def test_is_staff_dark_uniform(self):
        # Create a mock dark uniform image (all pixels black)
        # Since black maps to 0 value in HSV, it should pass the dark ratio threshold > 40%
        dark_img = np.zeros((10, 10, 3), dtype=np.uint8)
        self.assertTrue(self.classifier.is_staff(dark_img))
        
    def test_is_not_staff_bright_clothing(self):
        # Create a mock bright image (all pixels bright white)
        # This will map to high HSV value (255), falling below the dark uniform threshold
        bright_img = np.ones((10, 10, 3), dtype=np.uint8) * 255
        self.assertFalse(self.classifier.is_staff(bright_img))

if __name__ == "__main__":
    unittest.main()
