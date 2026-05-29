import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from datetime import datetime, timedelta, timezone
from backend.services.qr_service import QRService

@pytest.mark.asyncio
class TestQRScannerService:
    
    @patch('backend.services.qr_service.get_usuarios_collection')
    @patch('backend.services.qr_service.get_qr_pagos_collection') 
    @patch('backend.services.qr_service.get_transacciones_collection')
    async def test_validar_qr_exitoso(self, mock_trans_collection, mock_qr_collection, mock_user_collection):
        """Test para validar un QR exitosamente"""
        # Configurar mocks con AsyncMock para métodos asíncronos
        mock_user_instance = AsyncMock()
        mock_user_instance.find_one = AsyncMock(return_value={
            "id_usuario": 999888,
            "nombre": "Usuario Test Scanner",
            "saldo": 50,
            "tarifa_actual": 11
        })
        mock_user_instance.update_one = AsyncMock(return_value=MagicMock(modified_count=1))
        mock_user_collection.return_value = mock_user_instance
        
        mock_qr_instance = AsyncMock()
        mock_qr_instance.find_one = AsyncMock(return_value={
            "_id": "qr_id_123",  # AÑADIDO: campo _id faltante
            "id_usuario": 999888,
            "nonce": "test_scanner_valid",
            "timestamp_creacion": datetime.now(timezone.utc),
            "timestamp_expiracion": datetime.now(timezone.utc) + timedelta(minutes=10),
            "estado": "generado",
            "intentos_fallidos": 0
        })
        mock_qr_instance.update_one = AsyncMock()
        mock_qr_collection.return_value = mock_qr_instance
        
        mock_trans_instance = AsyncMock()
        mock_trans_instance.insert_one = AsyncMock()
        mock_trans_collection.return_value = mock_trans_instance
        
        # Ejecutar
        resultado = await QRService.validar_qr("test_scanner_valid")
        
        # Verificar
        assert resultado["valido"] == True
        assert "Pago procesado exitosamente" in resultado["mensaje"]
        assert resultado["monto"] == 11
    
    @patch('backend.services.qr_service.get_usuarios_collection')
    @patch('backend.services.qr_service.get_qr_pagos_collection')
    async def test_validar_qr_saldo_insuficiente(self, mock_qr_collection, mock_user_collection):
        """Test para validar QR con saldo insuficiente"""
        # Configurar mocks
        mock_user_instance = AsyncMock()
        mock_user_instance.find_one = AsyncMock(return_value={
            "id_usuario": 999777,
            "nombre": "Usuario Sin Saldo",
            "saldo": 5,  # Menos que la tarifa
            "tarifa_actual": 11
        })
        mock_user_collection.return_value = mock_user_instance
        
        mock_qr_instance = AsyncMock()
        mock_qr_instance.find_one = AsyncMock(return_value={
            "_id": "qr_id_456",
            "id_usuario": 999777,
            "nonce": "test_scanner_sin_saldo",
            "timestamp_creacion": datetime.now(timezone.utc),
            "timestamp_expiracion": datetime.now(timezone.utc) + timedelta(minutes=10),
            "estado": "generado",
            "intentos_fallidos": 0
        })
        mock_qr_instance.update_one = AsyncMock()  # Mock para evitar el await error
        mock_qr_collection.return_value = mock_qr_instance
        
        # Ejecutar
        resultado = await QRService.validar_qr("test_scanner_sin_saldo")
        
        # Verificar
        assert resultado["valido"] == False
        assert "Saldo insuficiente" in resultado["mensaje"]
    
    @patch('backend.services.qr_service.get_qr_pagos_collection')
    async def test_validar_qr_expirado(self, mock_qr_collection):
        """Test para validar un QR expirado"""
        # Configurar mock
        mock_qr_instance = AsyncMock()
        mock_qr_instance.find_one = AsyncMock(return_value={
            "_id": "qr_id_789",
            "id_usuario": 999666,
            "nonce": "test_scanner_expirado",
            "timestamp_creacion": datetime.now(timezone.utc) - timedelta(minutes=15),
            "timestamp_expiracion": datetime.now(timezone.utc) - timedelta(minutes=5),  # Ya expiró
            "estado": "generado",
            "intentos_fallidos": 0
        })
        mock_qr_instance.update_one = AsyncMock()  # Mock para evitar el await error
        mock_qr_collection.return_value = mock_qr_instance
        
        # Ejecutar
        resultado = await QRService.validar_qr("test_scanner_expirado")
        
        # Verificar
        assert resultado["valido"] == False
        assert "QR expirado" in resultado["mensaje"]
    
    @patch('backend.services.qr_service.get_transacciones_collection')
    async def test_registrar_transaccion_pago(self, mock_trans_collection):
        """Test para registrar transacción de pago"""
        # Configurar mock
        mock_trans_instance = AsyncMock()
        mock_trans_instance.insert_one = AsyncMock()
        mock_trans_collection.return_value = mock_trans_instance
        
        # Ejecutar
        await QRService.registrar_transaccion_pago(
            id_usuario=999555,
            monto=11,
            saldo_anterior=50,
            saldo_posterior=39,
            id_qr="test_qr_123",
            tarifa_aplicada=11
        )
        
        # Verificar que se llamó al método de inserción
        mock_trans_instance.insert_one.assert_called_once()

@pytest.mark.asyncio
@patch('backend.services.qr_service.get_qr_pagos_collection')
async def test_qr_no_encontrado(mock_qr_collection):
    """Test para QR no encontrado"""
    # Configurar mock para que no encuentre el QR
    mock_qr_instance = AsyncMock()
    mock_qr_instance.find_one = AsyncMock(return_value=None)
    mock_qr_collection.return_value = mock_qr_instance
    
    resultado = await QRService.validar_qr("nonce_inexistente")
    
    assert resultado["valido"] == False
    assert "QR no encontrado" in resultado["mensaje"]