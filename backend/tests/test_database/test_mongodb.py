import pytest
from backend.database.mongodb import MongoDB, get_qr_pagos_collection
from datetime import datetime, timedelta

class TestMongoDB:
    @pytest.mark.asyncio
    async def test_conexion_mongodb(self):
        """Prueba que la conexión a MongoDB funciona"""
        # ARRANGE
        mongodb = MongoDB()
        
        # ACT
        await mongodb.connect()
        
        # ASSERT
        assert mongodb.client is not None
        assert mongodb.database is not None
        assert mongodb.database.name == "Urbano"
        
        await mongodb.disconnect()
    
    @pytest.mark.asyncio 
    async def test_obtener_coleccion_ruta(self):
        """Prueba que se puede obtener la colección ruta"""
        # ARRANGE
        mongodb = MongoDB()
        await mongodb.connect()
        
        # ACT
        collection = mongodb.get_rutas_collection()
        
        # ASSERT
        assert collection is not None
        assert collection.name == "ruta"
        
        await mongodb.disconnect()
    
    @pytest.mark.asyncio 
    async def test_obtener_coleccion_usuario(self):
        """Prueba que se puede obtener la colección ruta"""
        # ARRANGE
        mongodb = MongoDB()
        await mongodb.connect()
        
        # ACT
        collection = mongodb.get_usuarios_collection()
        
        # ASSERT
        assert collection is not None
        assert collection.name == "usuario"
        
        await mongodb.disconnect()
    
    @pytest.mark.asyncio 
    async def test_obtener_coleccion_qr_pagos(self):
        """Prueba que se puede obtener la colección qr_pagos"""
        # ARRANGE
        mongodb = MongoDB()
        await mongodb.connect()
        
        # ACT
        collection = mongodb.get_qr_pagos_collection()
        
        # ASSERT
        assert collection is not None
        assert collection.name == "qr_pagos"
        
        await mongodb.disconnect()

    @pytest.mark.asyncio 
    async def test_obtener_coleccion_transacciones(self):
        """Prueba que se puede obtener la colección ruta"""
        # ARRANGE
        mongodb = MongoDB()
        await mongodb.connect()
        
        # ACT
        collection = mongodb.get_transacciones_collection()
        
        # ASSERT
        assert collection is not None
        assert collection.name == "transacciones"
        
        await mongodb.disconnect()

@pytest.mark.asyncio
async def test_get_qr_pagos_collection():
    """Test para verificar la conexión a la colección qr_pagos usando función helper"""
    # ARRANGE - Conectar primero
    from backend.database.mongodb import mongodb
    await mongodb.connect()
    
    # ACT
    collection = get_qr_pagos_collection()
    
    # ASSERT
    assert collection is not None
    assert collection.name == "qr_pagos"
    
    await mongodb.disconnect()

    

@pytest.mark.asyncio
async def test_qr_pagos_collection_operations():
    """Test de operaciones básicas en la colección qr_pagos"""
    # ARRANGE - Conectar primero
    from backend.database.mongodb import mongodb, get_usuarios_collection
    await mongodb.connect()
    collection = get_qr_pagos_collection()
    
    # Crear un usuario temporal para la prueba
    usuarios_collection = get_usuarios_collection()
    usuario_temporal_id = 99999
    
    # Insertar usuario temporal
    await usuarios_collection.insert_one({
        "id_usuario": usuario_temporal_id,
        "nombre": "Usuario Temporal Test",
        "email": "temp@test.com",
        "saldo": 50,
        "tarifa_actual": 11
    })
    
    try:
        # Test de inserción
        test_qr = {
            "id_usuario": usuario_temporal_id,
            "nonce": "test_nonce_123",
            "timestamp_creacion": datetime.utcnow(),
            "timestamp_expiracion": datetime.utcnow() + timedelta(minutes=10),
            "estado": "generado",
            "intentos_fallidos": 0
        }
        
        result = await collection.insert_one(test_qr)
        assert result.inserted_id is not None
        
        # Test de búsqueda
        found_qr = await collection.find_one({"nonce": "test_nonce_123"})
        assert found_qr is not None
        assert found_qr["id_usuario"] == usuario_temporal_id
        assert found_qr["estado"] == "generado"
        
        # Test de actualización
        await collection.update_one(
            {"nonce": "test_nonce_123"},
            {"$set": {"estado": "usado"}}
        )
        
        updated_qr = await collection.find_one({"nonce": "test_nonce_123"})
        assert updated_qr["estado"] == "usado"
        
    finally:
        # Limpieza - IMPORTANTE: eliminar datos de prueba
        await collection.delete_one({"nonce": "test_nonce_123"})
        await usuarios_collection.delete_one({"id_usuario": usuario_temporal_id})
        await mongodb.disconnect()
    