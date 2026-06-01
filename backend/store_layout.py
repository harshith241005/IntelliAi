"""
Store layout configuration for Zone Classifier.
Defines coordinates for store zones based on camera view.
"""
import json
from pathlib import Path

DEFAULT_LAYOUT = {
    "store_id": "STORE_BLR_002",
    "name": "Brigade Road Store",
    "zones": [
        {
            "name": "SKINCARE",
            "camera": "CAM_ENTRY_01",
            "polygon": [
                [100, 100],
                [300, 100],
                [300, 400],
                [100, 400]
            ],
            "description": "Skincare product aisle"
        },
        {
            "name": "BILLING",
            "camera": "CAM_ENTRY_01",
            "polygon": [
                [500, 200],
                [800, 200],
                [800, 500],
                [500, 500]
            ],
            "description": "Checkout and billing queue"
        }
    ],
    "entry_threshold": {
        "CAM_ENTRY_01": {
            "polygon": [
                [0, 500],
                [1000, 500],
                [1000, 600],
                [0, 600]
            ],
            "direction": "up" # y decreasing
        }
    }
}

def generate_layout(path: str = "store_layout.json"):
    """Generate default store layout file."""
    with open(path, "w") as f:
        json.dump(DEFAULT_LAYOUT, f, indent=2)

if __name__ == "__main__":
    generate_layout()
