import pytest
import uuid
import datetime
from httpx import AsyncClient
from app.main import app

@pytest.mark.asyncio
async def test_root_ping():
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.get("/")
    assert response.status_code == 200
    assert response.json()["status"] == "online"

@pytest.mark.asyncio
async def test_health_check():
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.get("/api/v1/health")
    assert response.status_code == 200
    assert "status" in response.json()
    assert "checks" in response.json()

@pytest.mark.asyncio
async def test_events_list():
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.get("/api/v1/events?limit=5")
    assert response.status_code == 200
    data = response.json()
    assert "data" in data
    assert "next_cursor" in data
