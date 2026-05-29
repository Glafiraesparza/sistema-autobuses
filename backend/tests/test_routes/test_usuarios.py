import pytest
import asyncio
from fastapi.testclient import TestClient
##Modifique 16/11/2025 Tomás Inicio
from unittest.mock import AsyncMock, patch,MagicMock
##Modifique 16/11/2025 Tomás Fin
from backend.models.usuario import UsuarioInDB, UsuarioResponse
from backend.main import app
from datetime import datetime

class TestUsuariosRoutes:
    @pytest.fixture
    def client(self):
        return TestClient(app)

    @pytest.fixture
    def usuario_data_valido(self):
        return {
            "nombre": "Carlos Rodríguez",
            "email": "carlos@universidad.edu", 
            "password": "mipassword123",
            "tipo": "estudiante"
        }

    @pytest.fixture
    def usuario_response_valido(self):
        return {
            "id_usuario": 123456789,
            "nombre": "Carlos Rodríguez",
            "email": "carlos@universidad.edu",
            "tipo": "estudiante", 
            "saldo": 0.0,
            "clabe_recarga": "012180001234567890",
            "tarifa_actual": 5.50,
            "rutas_favoritas": [],
            "fecha_creacion": "2024-01-20T10:30:00"
        }

    def test_registro_usuario_exitoso(self, client, usuario_data_valido, usuario_response_valido):
        """Test registro exitoso de usuario"""
        with patch('backend.routes.usuarios.usuario_service.crear_usuario') as mock_crear:
            mock_crear.return_value = usuario_response_valido
            
            response = client.post("/api/usuarios/registro", json=usuario_data_valido)
            
            assert response.status_code == 201
            data = response.json()
            assert data["nombre"] == usuario_data_valido["nombre"]
            assert data["email"] == usuario_data_valido["email"]
            assert data["tipo"] == "estudiante"
            assert data["tarifa_actual"] == 5.50

    def test_registro_usuario_email_existente(self, client, usuario_data_valido):
        """Test error al registrar usuario con email existente"""
        with patch('backend.routes.usuarios.usuario_service.crear_usuario') as mock_crear:
            mock_crear.side_effect = ValueError("El email ya está registrado")
            
            response = client.post("/api/usuarios/registro", json=usuario_data_valido)
            
            assert response.status_code == 400
            data = response.json()
            assert "El email ya está registrado" in data["detail"]

    def test_registro_usuario_datos_invalidos(self, client):
        """Test error con datos de usuario inválidos"""
        datos_invalidos = {
            "nombre": "A",  # Nombre muy corto
            "email": "email-invalido",  # Email inválido
            "password": "123"  # Password muy corto
        }
        
        response = client.post("/api/usuarios/registro", json=datos_invalidos)
        
        assert response.status_code == 422  # Unprocessable Entity

    def test_obtener_usuario_por_email_existente(self, client, usuario_response_valido):
        """Test obtener usuario por email exitoso"""
        with patch('backend.routes.usuarios.usuario_service.obtener_usuario_por_email') as mock_obtener:
            mock_obtener.return_value = usuario_response_valido
            
            response = client.get("/api/usuarios/email/carlos@universidad.edu")
            
            assert response.status_code == 200
            data = response.json()
            assert data["email"] == "carlos@universidad.edu"

    def test_obtener_usuario_por_email_no_existente(self, client):
        """Test error al obtener usuario por email no existente"""
        with patch('backend.routes.usuarios.usuario_service.obtener_usuario_por_email') as mock_obtener:
            mock_obtener.return_value = None
            
            response = client.get("/api/usuarios/email/noexiste@example.com")
            
            assert response.status_code == 404
            data = response.json()
            assert "Usuario no encontrado" in data["detail"]

    def test_obtener_usuario_por_id_existente(self, client, usuario_response_valido):
        """Test obtener usuario por ID exitoso"""
        with patch('backend.routes.usuarios.usuario_service.obtener_usuario_por_id') as mock_obtener:
            mock_obtener.return_value = usuario_response_valido
            
            response = client.get("/api/usuarios/123456789")
            
            assert response.status_code == 200
            data = response.json()
            assert data["id_usuario"] == 123456789

    def test_obtener_usuario_por_id_no_existente(self, client):
        """Test error al obtener usuario por ID no existente"""
        with patch('backend.routes.usuarios.usuario_service.obtener_usuario_por_id') as mock_obtener:
            mock_obtener.return_value = None
            
            response = client.get("/api/usuarios/999999999")
            
            assert response.status_code == 404
            data = response.json()
            assert "Usuario no encontrado" in data["detail"]
    
    @pytest.fixture
    def usuario_login_valido(self):
        return {
            "email": "usuario@ejemplo.com",
            "password": "password123"
        }

    
    @pytest.fixture
    def usuario_in_db_completo(self):
        """Fixture que retorna un objeto UsuarioInDB válido"""
        return UsuarioInDB(
            id_usuario=123456789,
            nombre="Juan Pérez",
            email="usuario@ejemplo.com",
            tipo="normal",
            saldo=50.0,
            clabe_recarga="012180001234567890",
            rutas_favoritas=[],
            tarifa_actual=11.0,
            password_hash="hashed_password",
            salt="",
            fecha_creacion=datetime(2024, 1, 20, 10, 30, 0)
        )

    @pytest.fixture
    def usuario_response_completo(self):
        """Fixture que retorna un objeto UsuarioResponse válido"""
        return UsuarioResponse(
            id_usuario=123456789,
            nombre="Juan Pérez",
            email="usuario@ejemplo.com",
            tipo="normal",
            saldo=50.0,
            clabe_recarga="012180001234567890",
            rutas_favoritas=[],
            tarifa_actual=11.0,
            fecha_creacion=datetime(2024, 1, 20, 10, 30, 0),
            fecha_ultimo_acceso=None
        )

    def test_login_exitoso(self, client, usuario_login_valido, usuario_in_db_completo, usuario_response_completo):
        """Test login exitoso con credenciales válidas"""
        with patch('backend.routes.usuarios.usuario_service.verificar_credenciales') as mock_verify:
            with patch('backend.routes.usuarios.usuario_service.obtener_usuario_por_email') as mock_obtener:
                with patch('backend.routes.usuarios.usuario_service.actualizar_ultimo_acceso') as mock_update:
                    
                    # Configurar mocks
                    mock_verify.return_value = True
                    mock_obtener.return_value = usuario_in_db_completo  # Usar UsuarioInDB
                    mock_update.return_value = None
                    
                    # Hacer request
                    response = client.post("/api/usuarios/login", json=usuario_login_valido)
                    
                    # Verificaciones
                    assert response.status_code == 200
                    data = response.json()
                    
                    # Verificar estructura de respuesta
                    assert "access_token" in data
                    assert "token_type" in data
                    assert "usuario" in data
                    
                    # Verificar valores específicos
                    assert data["token_type"] == "bearer"
                    assert data["usuario"]["email"] == usuario_login_valido["email"]
                    assert data["usuario"]["nombre"] == "Juan Pérez"
                    assert "fake_token_" in data["access_token"]  # Verificar formato del token
                    
                    # Verificar que se llamaron los métodos correctos
                    mock_verify.assert_called_once_with(
                        usuario_login_valido["email"], 
                        usuario_login_valido["password"]
                    )
                    mock_obtener.assert_called_once_with(usuario_login_valido["email"])
                    mock_update.assert_called_once_with(usuario_login_valido["email"])

##Agregue 16/11/2025 Tomás Inicio
    def test_actualizar_rutas_favoritas(self, client, usuario_response_completo):
        """Test actualización de rutas favoritas"""
        with patch('backend.routes.usuarios.usuario_service._get_collection') as mock_get_collection:
            # Crear un mock más completo para la colección
            mock_collection = AsyncMock()
            mock_get_collection.return_value = mock_collection
            
            # Configurar los mocks para las operaciones asíncronas
            mock_collection.update_one.return_value = MagicMock(modified_count=1)
            mock_collection.find_one.return_value = {
                "id_usuario": 123456789,
                "nombre": "Juan Pérez",
                "email": "usuario@ejemplo.com",
                "tipo": "normal",
                "saldo": 50.0,
                "clabe_recarga": "012180001234567890",
                "rutas_favoritas": [{"nombre": "Ruta 40 Norte"}],
                "tarifa_actual": 11.0,
                "fecha_creacion": "2024-01-20T10:30:00",
                "fecha_ultimo_acceso": None
            }
            
            rutas_favoritas = ["Ruta 40 Norte", "Ruta Centro"]
            
            response = client.put(
                "/api/usuarios/123456789/rutas-favoritas",
                json=rutas_favoritas
            )
            
            print(f"Status: {response.status_code}")
            print(f"Response: {response.text}")
            
            assert response.status_code == 200
            data = response.json()
            assert "rutas_favoritas" in data


    def test_obtener_rutas_favoritas(self, client):
        """Test obtención de rutas favoritas"""
        with patch('backend.routes.usuarios.usuario_service._get_collection') as mock_collection:
            mock_db = AsyncMock()
            mock_collection.return_value = mock_db
            
            usuario_con_rutas = {
                "id_usuario": 123456789,
                "nombre": "Test User",
                "rutas_favoritas": [
                    {"nombre": "Ruta 40 Norte"},
                    {"nombre": "Ruta Centro"}
                ]
            }
            
            mock_db.find_one.return_value = usuario_con_rutas
            
            response = client.get("/api/usuarios/123456789/rutas-favoritas")
            
            assert response.status_code == 200
            data = response.json()
            assert data == ["Ruta 40 Norte", "Ruta Centro"]
##Agregue 16/11/2025 Tomás Inicio