import pytest
from backend.services.ruta_service import ruta_service

def test_obtener_camion_por_ruta_existente():
    """Test obtener camión para rutas existentes"""
    assert ruta_service.obtener_camion_por_ruta("40_norte") == "1132"
    assert ruta_service.obtener_camion_por_ruta("40_sur") == "1124"

def test_obtener_camion_por_ruta_inexistente():
    """Test obtener camión para ruta que no existe"""
    assert ruta_service.obtener_camion_por_ruta("ruta_inexistente") is None

def test_obtener_ruta_por_camion_existente():
    """Test obtener ruta para camiones existentes"""
    assert ruta_service.obtener_ruta_por_camion("1132") == "40_norte"
    assert ruta_service.obtener_ruta_por_camion("1124") == "40_sur"

def test_obtener_ruta_por_camion_inexistente():
    """Test obtener ruta para camión que no existe"""
    assert ruta_service.obtener_ruta_por_camion("9999") is None

def test_asignaciones_fijas():
    """Test que verifica las asignaciones fijas"""
    assert ruta_service.asignaciones_fijas == {
        "40_norte": "1132",
        "40_sur": "1124"
    }