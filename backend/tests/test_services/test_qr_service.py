import pytest
import asyncio
from datetime import datetime, timedelta, timezone
from backend.services.qr_service import QRService
from backend.database.mongodb import mongodb, get_qr_pagos_collection, get_usuarios_collection

# ID del usuario real que existe en tu base de datos - CORREGIDO
USUARIO_REAL_ID = 1763286007

@pytest.mark.asyncio
async def test_generar_qr():
    """Test para generar un nuevo QR"""
    # Conectar a MongoDB
    await mongodb.connect()
    
    try:
        qr_data = await QRService.generar_qr(USUARIO_REAL_ID)
        
        print(f"QR Data: {qr_data}")
        
        # Verificar estructura de respuesta
        assert "success" in qr_data
        assert qr_data["success"] == True
        assert "qr_data" in qr_data
        
        qr_info = qr_data["qr_data"]
        assert qr_info["nonce"] is not None
        assert qr_info["id_usuario"] == USUARIO_REAL_ID
        assert "timestamp_creacion" in qr_info
        assert "timestamp_expiracion" in qr_info
        
        # Verificar que se guardó en la base de datos
        collection = get_qr_pagos_collection()
        saved_qr = await collection.find_one({"nonce": qr_info["nonce"]})
        assert saved_qr is not None
        assert saved_qr["estado"] == "generado"
        assert saved_qr["id_usuario"] == USUARIO_REAL_ID
        
        # Limpiar después del test
        await collection.delete_one({"nonce": qr_info["nonce"]})
    finally:
        await mongodb.disconnect()

@pytest.mark.asyncio
async def test_validar_qr_valido():
    """Test para validar un QR válido"""
    # Conectar a MongoDB
    await mongodb.connect()
    
    try:
        # Asegurarnos de que el usuario tenga saldo suficiente
        usuarios_collection = get_usuarios_collection()
        await usuarios_collection.update_one(
            {"id_usuario": USUARIO_REAL_ID},
            {"$set": {"saldo": 50}}
        )
        
        # Generar QR
        qr_data = await QRService.generar_qr(USUARIO_REAL_ID)
        qr_info = qr_data["qr_data"]
        
        # Validar QR
        resultado = await QRService.validar_qr(qr_info["nonce"])
        
        assert resultado["valido"] == True
        assert resultado["monto"] == 5.5  # Tarifa del usuario real
        assert resultado["nuevo_saldo"] == 44.5  # 50 - 11 = 39
        
        # Limpiar después del test
        qr_collection = get_qr_pagos_collection()
        await qr_collection.delete_one({"nonce": qr_info["nonce"]})
        
        # Restaurar saldo original
        await usuarios_collection.update_one(
            {"id_usuario": USUARIO_REAL_ID},
            {"$set": {"saldo": 0}}
        )
    finally:
        await mongodb.disconnect()

@pytest.mark.asyncio
async def test_validar_qr_expirado():
    """Test para validar un QR expirado"""
    # Conectar a MongoDB
    await mongodb.connect()
    
    try:
        collection = get_qr_pagos_collection()
        
        # Crear QR expirado manualmente - CORREGIDO timezone
        qr_expirado = {
            "id_usuario": USUARIO_REAL_ID,
            "nonce": "test_expirado",
            "timestamp_creacion": datetime.now(timezone.utc) - timedelta(minutes=15),
            "timestamp_expiracion": datetime.now(timezone.utc) - timedelta(minutes=5),
            "estado": "generado",
            "intentos_fallidos": 0
        }
        
        await collection.insert_one(qr_expirado)
        
        resultado = await QRService.validar_qr("test_expirado")
        
        assert resultado["valido"] == False
        assert "expirado" in resultado["mensaje"].lower()
        
        # Limpiar después del test
        await collection.delete_one({"nonce": "test_expirado"})
    finally:
        await mongodb.disconnect()

@pytest.mark.asyncio
async def test_validar_qr_inexistente():
    """Test para validar un QR que no existe"""
    # Conectar a MongoDB
    await mongodb.connect()
    
    try:
        resultado = await QRService.validar_qr("nonce_inexistente")
        
        assert resultado["valido"] == False
        assert "no encontrado" in resultado["mensaje"].lower()
    finally:
        await mongodb.disconnect()