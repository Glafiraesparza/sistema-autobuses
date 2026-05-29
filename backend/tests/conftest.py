import pytest
import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from backend.main import app
from fastapi.testclient import TestClient

# Configuración para pruebas
os.environ["MONGODB_URL"] = "mongodb://localhost:27017/test_sistema_autobuses"

@pytest.fixture
def client():
    return TestClient(app)

@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.get_event_loop()
    yield loop
    loop.close()

@pytest.fixture
async def test_database():
    # Usar base de datos de prueba
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client.test_sistema_autobuses
    yield db
    # Limpiar después de las pruebas
    await client.drop_database("test_sistema_autobuses")
    client.close()