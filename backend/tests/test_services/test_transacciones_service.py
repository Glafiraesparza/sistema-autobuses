import pytest
import asyncio
from unittest.mock import AsyncMock, patch
from datetime import datetime, timezone, timedelta
from backend.services.transacciones_service import TransaccionService

# ID de usuario de prueba
USUARIO_PRUEBA_ID = 99999

@pytest.fixture
def mock_transacciones():
    """Fixture con datos de transacciones mock"""
    return [
        {
            "_id": "507f1f77bcf86cd799439011",
            "id_transaccion": "test_transaccion_1",
            "id_usuario": USUARIO_PRUEBA_ID,
            "tipo": "pago_viaje",
            "monto": 11.00,
            "saldo_anterior": 50.00,
            "saldo_posterior": 39.00,
            "fecha_transaccion": datetime.now(timezone.utc) - timedelta(days=2),
            "estado": "completada",
            "nombre_ruta": "Ruta 18",
            "tarifa_aplicada": 11.00,
            "id_camion": "camion_123"
        },
        {
            "_id": "507f1f77bcf86cd799439012",
            "id_transaccion": "test_transaccion_2", 
            "id_usuario": USUARIO_PRUEBA_ID,
            "tipo": "pago_viaje",
            "monto": 11.00,
            "saldo_anterior": 39.00,
            "saldo_posterior": 28.00,
            "fecha_transaccion": datetime.now(timezone.utc) - timedelta(days=1),
            "estado": "completada",
            "nombre_ruta": "Ruta 25",
            "tarifa_aplicada": 11.00,
            "id_camion": "camion_456"
        }
    ]

@pytest.mark.asyncio
@patch('backend.services.transacciones_service.get_transacciones_collection')
async def test_obtener_transacciones_usuario_exitoso(mock_get_collection, mock_transacciones):
    """Test para obtener transacciones de un usuario exitosamente usando mock"""
    
    # Configurar el mock
    mock_collection = AsyncMock()
    mock_cursor = AsyncMock()
    
    mock_cursor.to_list.return_value = mock_transacciones
    mock_collection.find.return_value.sort.return_value = mock_cursor
    mock_get_collection.return_value = mock_collection
    
    # Ejecutar el servicio
    resultado = await TransaccionService.obtener_transacciones_usuario(USUARIO_PRUEBA_ID)
    
    # Verificar resultados
    assert resultado["success"] == True
    assert resultado["total"] == 2
    assert len(resultado["transacciones"]) == 2
    
    # Verificar que se llamó a la base de datos con los parámetros correctos
    mock_collection.find.assert_called_once_with({
        "id_usuario": USUARIO_PRUEBA_ID,
        "tipo": "pago_viaje"
    })
    mock_collection.find.return_value.sort.assert_called_once_with("fecha_transaccion", -1)

@pytest.mark.asyncio
@patch('backend.services.transacciones_service.get_transacciones_collection')
async def test_obtener_transacciones_usuario_sin_transacciones(mock_get_collection):
    """Test para usuario sin transacciones usando mock"""
    
    # Configurar el mock para retornar lista vacía
    mock_collection = AsyncMock()
    mock_cursor = AsyncMock()
    
    mock_cursor.to_list.return_value = []  # Sin transacciones
    mock_collection.find.return_value.sort.return_value = mock_cursor
    mock_get_collection.return_value = mock_collection
    
    # Ejecutar el servicio
    resultado = await TransaccionService.obtener_transacciones_usuario(USUARIO_PRUEBA_ID)
    
    # Verificar resultados
    assert resultado["success"] == True
    assert resultado["total"] == 0
    assert resultado["transacciones"] == []

@pytest.mark.asyncio
@patch('backend.services.transacciones_service.get_transacciones_collection')
async def test_obtener_transacciones_con_error(mock_get_collection):
    """Test para manejo de errores en el servicio"""
    
    # Configurar el mock para lanzar una excepción
    mock_collection = AsyncMock()
    mock_collection.find.side_effect = Exception("Error de conexión a la base de datos")
    mock_get_collection.return_value = mock_collection
    
    # Ejecutar el servicio
    resultado = await TransaccionService.obtener_transacciones_usuario(USUARIO_PRUEBA_ID)
    
    # Verificar que se maneja el error correctamente
    assert resultado["success"] == False
    assert "detail" in resultado
    assert "Error al obtener transacciones" in resultado["detail"]