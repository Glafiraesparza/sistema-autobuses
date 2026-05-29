import pytest
import asyncio
from backend.services.ruta_service import RutaService
from backend.database.mongodb import mongodb
from bson import ObjectId

class TestRutaService:
    @pytest.mark.asyncio
    async def test_obtener_todas_rutas(self):
        """Prueba REAL que el servicio obtiene todas las rutas de MongoDB"""
        # ARRANGE - Conectar MongoDB y preparar datos
        if mongodb.client is None:
            await mongodb.connect()
        
        collection = mongodb.get_rutas_collection()
        await collection.insert_many([
            {
                "nombre": "Ruta Test 1",
                "coordenadas": [
                    {"orden": 1, "lat": 21.91616, "lng": -102.31644},
                    {"orden": 2, "lat": 21.91618, "lng": -102.31611}
                ],
                "tiempo_estimado": 30,
                "paradas": [
                    {"orden": 1, "lat": 21.91616, "lng": -102.31644},
                    {"orden": 2, "lat": 21.91618, "lng": -102.31611}
                ]
            },
            {
                "nombre": "Ruta Test 2", 
                "coordenadas": [
                    {"orden": 1, "lat": 21.91700, "lng": -102.31700},
                    {"orden": 2, "lat": 21.91800, "lng": -102.31800}
                ],
                "tiempo_estimado": 45,
                "paradas": []
            }
        ])
        
        service = RutaService()
        
        # ACT - Conexión REAL a MongoDB
        resultado = await service.obtener_todas_rutas()
        
        # ASSERT
        assert len(resultado) >= 2
        
        # Limpiar después del test
        await collection.delete_many({"nombre": {"$regex": "^Ruta Test"}})
