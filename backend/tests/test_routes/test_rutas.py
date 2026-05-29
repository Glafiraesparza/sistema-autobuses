import pytest
import asyncio
from fastapi.testclient import TestClient
from backend.main import app
from backend.database.mongodb import mongodb

class TestRutasEndpoints:
    @pytest.fixture(autouse=True)
    def setup_database(self):
        """Conectar MongoDB antes de los tests (síncrono)"""
        # Ejecutar en el event loop existente
        if mongodb.client is None:
            try:
                loop = asyncio.get_event_loop()
            except RuntimeError:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
            
            if loop.is_running():
                # Si el loop está corriendo, usar task
                async def connect():
                    if mongodb.client is None:
                        await mongodb.connect()
                asyncio.create_task(connect())
            else:
                # Si no está corriendo, ejecutar directamente
                loop.run_until_complete(mongodb.connect())
    
    @pytest.fixture
    def client(self):
        return TestClient(app)
    
    def test_endpoint_rutas_funcional(self, client):
        """Prueba básica que verifica que el endpoint responde"""
        # ACT - Llamada al endpoint
        response = client.get("/api/rutas")
        
        # ASSERT - Verificaciones mínimas
        assert response.status_code == 200
        rutas = response.json()
        assert isinstance(rutas, list)
        print(f"✅ Endpoint funcional - Se obtuvieron {len(rutas)} rutas")