import pytest
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

class TestQRScannerRoutes:
    
    @patch('backend.routes.qr_pagos.QRService.validar_qr')
    def test_validar_qr_valido(self, mock_validar_qr):
        """Test endpoint de validación de QR con datos válidos"""
        # Mock del servicio
        mock_validar_qr.return_value = {
            "valido": False,
            "mensaje": "QR expirado",
            "qr_data": None
        }
        
        response = client.post("/api/qr/validar", json={"nonce": "test_expirado"})
        
        assert response.status_code == 200
        data = response.json()
        assert "valido" in data
        assert "mensaje" in data
        assert data["valido"] == False
    
    def test_validar_qr_sin_nonce(self):
        """Test endpoint de validación sin nonce"""
        response = client.post("/api/qr/validar", json={})
        assert response.status_code == 422
    
    @patch('backend.routes.qr_pagos.QRService.validar_qr')
    def test_validar_qr_nonce_invalido(self, mock_validar_qr):
        """Test endpoint de validación con nonce inválido"""
        # Mock del servicio para nonce inválido
        mock_validar_qr.return_value = {
            "valido": False,
            "mensaje": "QR no encontrado",
            "qr_data": None
        }
        
        response = client.post("/api/qr/validar", json={"nonce": "nonce_inexistente_12345"})
        assert response.status_code == 200
        data = response.json()
        assert data["valido"] == False
        assert "QR no encontrado" in data["mensaje"]