import pytest
from datetime import datetime, timedelta, timezone
from pydantic import ValidationError
from bson import ObjectId
from backend.models.qr_pago import QRPago, QRGenerarRequest, QRValidarRequest


class TestQRPagoModel:
    """Pruebas exhaustivas para el modelo QRPago"""
    
    def test_creacion_basica_con_campos_requeridos(self):
        """Prueba la creación básica de QRPago con solo campos obligatorios"""
        qr = QRPago(
            id_usuario=1763341374,
            nonce="a1b2c3d4e5f678901234567890123456"
        )
        
        assert qr.id_usuario == 1763341374
        assert qr.nonce == "a1b2c3d4e5f678901234567890123456"
        assert qr.estado == "generado"
        assert qr.intentos_fallidos == 0

    def test_valores_por_defecto_automaticos(self):
        """Verifica que los valores por defecto se asignan correctamente"""
        before_creation = datetime.now(timezone.utc)
        qr = QRPago(id_usuario=123, nonce="test_nonce_123")
        after_creation = datetime.now(timezone.utc)
        
        # Verificar valores por defecto
        assert qr.estado == "generado"
        assert qr.intentos_fallidos == 0
        
        # Verificar timestamps automáticos
        assert before_creation <= qr.timestamp_creacion <= after_creation
        assert before_creation <= qr.timestamp_expiracion <= after_creation + timedelta(minutes=10)

    def test_calculo_expiracion_10_minutos(self):
        """Verifica que la expiración se calcula exactamente a 10 minutos"""
        qr = QRPago(id_usuario=123, nonce="test_nonce")
        
        diferencia = qr.timestamp_expiracion - qr.timestamp_creacion
        diferencia_minutos = diferencia.total_seconds() / 60
        
        # Debe ser exactamente 10 minutos
        assert diferencia_minutos == 10.0


    def test_incremento_intentos_fallidos_personalizado(self):
        """Prueba establecer un número específico de intentos fallidos"""
        qr = QRPago(
            id_usuario=123,
            nonce="test_intentos",
            intentos_fallidos=3
        )
        
        assert qr.intentos_fallidos == 3

    def test_validacion_id_usuario_obligatorio(self):
        """Prueba que el ID de usuario es obligatorio"""
        with pytest.raises(ValidationError) as exc_info:
            QRPago(nonce="test_nonce")  # Falta id_usuario
        
        errors = exc_info.value.errors()
        assert any(error["loc"][0] == "id_usuario" for error in errors)

    def test_validacion_nonce_obligatorio(self):
        """Prueba que el nonce es un campo obligatorio"""
        with pytest.raises(ValidationError) as exc_info:
            QRPago(id_usuario=123)  # Falta nonce
        
        errors = exc_info.value.errors()
        assert any(error["loc"][0] == "nonce" for error in errors)

class TestQRValidarRequestModel:
    """Pruebas específicas para el modelo QRValidarRequest"""
    
    def test_estructura_minima_validar_request(self):
        """Prueba la creación válida con estructura mínima"""
        request = QRValidarRequest(nonce="a1b2c3d4e5f678901234567890123456")
        
        assert request.nonce == "a1b2c3d4e5f678901234567890123456"
        assert hasattr(request, 'nonce')

    def test_nonce_longitud_minima(self):
        """Prueba que nonce acepta strings de longitud mínima"""
        # Nonce de 1 carácter debería ser válido en Pydantic v2
        request = QRValidarRequest(nonce="a")
        assert request.nonce == "a"
