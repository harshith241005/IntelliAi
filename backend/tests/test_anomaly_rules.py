import pytest
from app.anomaly.rules import AnomalyRulesEvaluator

def test_check_restricted_zone():
    # 1. Matches configured restricted loading zone
    triggered, score, message = AnomalyRulesEvaluator.check_restricted_zone("zone_restricted_loading")
    assert triggered is True
    assert score == 0.96
    assert "breach" in message.lower()

    # 2. Bypasses standard open areas
    triggered, score, message = AnomalyRulesEvaluator.check_restricted_zone("zone_entrance")
    assert triggered is False
    assert score == 0.0

def test_check_loitering():
    # 1. Restricted zone triggers warning at 30s
    triggered, score, message = AnomalyRulesEvaluator.check_loitering(45000.0, "zone_restricted_loading")
    assert triggered is True
    assert score >= 0.70
    assert "loitering" in message.lower()

    # 2. Open zone default limit is 5 mins (300,000 ms)
    triggered, score, message = AnomalyRulesEvaluator.check_loitering(45000.0, "zone_checkout")
    assert triggered is False

    triggered, score, message = AnomalyRulesEvaluator.check_loitering(350000.0, "zone_checkout")
    assert triggered is True
    assert score >= 0.70

def test_check_crowd_surge():
    # 1. Normal occupancy density
    triggered, score, message = AnomalyRulesEvaluator.check_crowd_surge(4, "zone_checkout")
    assert triggered is False

    # 2. Surge warning triggers at count >= 8
    triggered, score, message = AnomalyRulesEvaluator.check_crowd_surge(9, "zone_checkout")
    assert triggered is True
    assert score >= 0.65
    assert "crowd" in message.lower()

def test_check_unattended_object():
    # 1. Normal active backpack moving
    triggered, score, message = AnomalyRulesEvaluator.check_unattended_object("backpack", False, 1000.0, "zone_checkout")
    assert triggered is False

    # 2. Stationary backpack triggers warning at 2 minutes (120,000 ms)
    triggered, score, message = AnomalyRulesEvaluator.check_unattended_object("backpack", True, 150000.0, "zone_checkout")
    assert triggered is True
    assert score >= 0.80
    assert "unattended" in message.lower()
