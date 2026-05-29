import random
from abc import ABC, abstractmethod
from typing import Dict, Any, List
import uuid

class BaseDetector(ABC):
    @abstractmethod
    def detect_frame(self, camera_id: uuid.UUID, frame_id: str) -> List[Dict[str, Any]]:
        """Run object detection on the frame coordinate space [0-100, 0-100]."""
        pass

class MockDetector(BaseDetector):
    def detect_frame(self, camera_id: uuid.UUID, frame_id: str) -> List[Dict[str, Any]]:
        detections = []
        
        # Decide occupancy density randomly (1-4 objects active)
        num_objects = random.randint(1, 3)
        
        for idx in range(num_objects):
            label = "person"
            if random.random() > 0.85:
                label = "shopping_cart"
            elif random.random() > 0.75:
                label = "backpack"

            bbox = [
                random.uniform(10.0, 90.0), # X
                random.uniform(10.0, 90.0), # Y
                24.0, # Width
                48.0  # Height
            ]
            confidence = random.uniform(0.65, 0.98)
            
            detections.append({
                "class": label,
                "bbox": bbox,
                "confidence": confidence,
                "frame_id": frame_id
            })

        return detections

detector = MockDetector()
