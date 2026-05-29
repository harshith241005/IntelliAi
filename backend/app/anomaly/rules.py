import datetime
from typing import Dict, Any, Optional, Tuple
from app.config import settings

class AnomalyRulesEvaluator:
    @staticmethod
    def check_loitering(dwell_ms: float, zone_id: str) -> Tuple[bool, float, str]:
        # Rule: dwell_ms > 300,000 ms (5 mins)
        # For realistic live dashboards, we trigger a warning at 15s in restricted areas or 5 minutes in standard lanes
        is_restricted = "restricted" in zone_id
        limit = 30000.0 if is_restricted else 300000.0 # 30s for restricted loitering warning, 5 mins for standard
        
        if dwell_ms > limit:
            score = min(0.99, 0.70 + (dwell_ms - limit) / 100000.0)
            return True, score, f"Loitering detected: Object stationary in {zone_id.replace('zone_', '')} for >{round(limit/1000)}s."
        
        return False, 0.0, ""

    @staticmethod
    def check_restricted_zone(zone_id: str) -> Tuple[bool, float, str]:
        # Rule: zone_id in RESTRICTED_ZONES
        if zone_id in settings.restricted_zone_set:
            score = 0.96
            return True, score, f"Restricted zone breach: Unauthorized entry detected in {zone_id.replace('zone_restricted_', '')}."
        
        return False, 0.0, ""

    @staticmethod
    def check_crowd_surge(zone_count: int, zone_id: str) -> Tuple[bool, float, str]:
        # Rule: density count > 8
        if zone_count >= 8:
            score = min(0.99, 0.65 + (zone_count - 8) * 0.04)
            return True, score, f"Crowd density warning: Crowd surge detected in {zone_id.replace('zone_', '')} with {zone_count} tracks."
        
        return False, 0.0, ""

    @staticmethod
    def check_unattended_object(label: str, is_stationary: bool, dwell_ms: float, zone_id: str) -> Tuple[bool, float, str]:
        # Rule: class object (backpack), stationary > 10 min (600,000 ms)
        # For demonstration feedback loops, warning triggers at 120,000 ms (2 minutes)
        if label in ["backpack", "unattended_box"] and is_stationary:
            limit = 120000.0 # 2 minutes demo limit
            if dwell_ms > limit:
                score = min(0.99, 0.80 + (dwell_ms - limit) / 200000.0)
                return True, score, f"Unattended item: stationary {label} abandoned in {zone_id.replace('zone_', '')} zone."
        
        return False, 0.0, ""

    @staticmethod
    def check_after_hours_motion(timezone_str: str) -> Tuple[bool, float, str]:
        # Rule: motion outside operating hours (e.g. 08:00 - 22:00)
        # Resolves dynamic hour thresholds
        now = datetime.datetime.utcnow() # timezone conversions fallback
        hour = now.hour
        
        if hour < 6 or hour > 23: # After hours security window [23:00 to 06:00]
            return True, 0.98, f"After hours security breach: motion detected inside store perimeter during closed window ({hour:02d}:00)."
        
        return False, 0.0, ""
