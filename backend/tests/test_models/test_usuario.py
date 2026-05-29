import pytest
from datetime import datetime
from backend.models.usuario import UsuarioCreate, UsuarioResponse, UsuarioInDB, RutaFavorita,LoginResponse,UsuarioLogin

class TestUsuarioModel:
    def test_usuario_create_valido(self):
        """Prueba creación de usuario válido"""
        usuario_data = {
            "nombre": "Juan Pérez",
            "email": "juan@example.com",
            "tipo": "estudiante",
            "password": "password123",
            "saldo": 0.0,
            "tarifa_actual": 7.50
        }
        
        usuario = UsuarioCreate(**usuario_data)
        
        assert usuario.nombre == "Juan Pérez"
        assert usuario.email == "juan@example.com"
        assert usuario.tipo == "estudiante"
        assert usuario.saldo == 0.0
        assert usuario.tarifa_actual == 7.50

    def test_usuario_response(self):
        """Prueba modelo de respuesta"""
        usuario_data = {
            "id_usuario": 123456,
            "nombre": "Juan Pérez",
            "email": "juan@example.com",
            "tipo": "estudiante",
            "saldo": 14.50,
            "clabe_recarga": "012180001234567890",
            "tarifa_actual": 7.50,
            "rutas_favoritas": [{"nombre": "40 Norte"}],
            "fecha_creacion": datetime.utcnow()
        }
        
        usuario = UsuarioResponse(**usuario_data)
        
        assert usuario.id_usuario == 123456
        assert usuario.saldo == 14.50
        assert usuario.clabe_recarga == "012180001234567890"
        assert len(usuario.rutas_favoritas) == 1
        assert usuario.rutas_favoritas[0].nombre == "40 Norte"

    def test_ruta_favorita(self):
        """Prueba modelo de ruta favorita"""
        ruta = RutaFavorita(nombre="40 Norte")
        assert ruta.nombre == "40 Norte"
    
    def test_usuario_login_valido(self):
        """Test modelo UsuarioLogin con datos válidos"""
        login_data = {
            "email": "usuario@ejemplo.com",
            "password": "password123"
        }
        
        usuario_login = UsuarioLogin(**login_data)
        
        assert usuario_login.email == "usuario@ejemplo.com"
        assert usuario_login.password == "password123"


    def test_login_response_valido(self):
        """Test modelo LoginResponse con datos válidos"""
        usuario_data = {
            "id_usuario": 123456789,
            "nombre": "Juan Pérez",
            "email": "juan@example.com",
            "tipo": "estudiante",
            "saldo": 0.0,
            "clabe_recarga": "012180001234567890",
            "rutas_favoritas": [],
            "tarifa_actual": 5.50,
            "fecha_creacion": datetime.utcnow()
        }
        
        usuario_response = UsuarioResponse(**usuario_data)
        
        login_response = LoginResponse(
            access_token="fake_token_123",
            token_type="bearer",
            usuario=usuario_response
        )
        
        assert login_response.access_token == "fake_token_123"
        assert login_response.token_type == "bearer"
        assert login_response.usuario.email == "juan@example.com"
        assert login_response.usuario.nombre == "Juan Pérez"

    def test_login_response_valores_por_defecto(self):
        """Test LoginResponse con valores por defecto"""
        usuario_data = {
            "id_usuario": 123456789,
            "nombre": "María García",
            "email": "maria@example.com", 
            "tipo": "normal",
            "saldo": 0.0,
            "clabe_recarga": "012180001234567890",
            "rutas_favoritas": [],
            "tarifa_actual": 11.00,
            "fecha_creacion": datetime.utcnow()
        }
        
        usuario_response = UsuarioResponse(**usuario_data)
        
        # Solo access_token es requerido, token_type tiene valor por defecto
        login_response = LoginResponse(
            access_token="token_abc123",
            usuario=usuario_response
        )
        
        assert login_response.access_token == "token_abc123"
        assert login_response.token_type == "bearer"  # Valor por defecto
        assert login_response.usuario.nombre == "María García"