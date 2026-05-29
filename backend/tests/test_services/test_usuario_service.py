import pytest
import asyncio
from unittest.mock import AsyncMock, patch, MagicMock
from backend.services.usuario_service import UsuarioService
from backend.models.usuario import UsuarioCreate
from backend.database.mongodb import mongodb

class TestUsuarioService:
    @pytest.fixture
    def usuario_service(self):
        """Fixture para crear instancia del servicio - SIN async"""
        service = UsuarioService()
        # Mock de la colección
        service.collection = AsyncMock()
        return service

    @pytest.fixture
    def usuario_data_valido(self):
        """Datos de usuario válido para pruebas"""
        return {
            "nombre": "María García López",
            "email": "maria.garcia@universidad.edu",
            "password": "password123",
            "tipo": "estudiante",  # Será detectado automáticamente
            "saldo": 0.0,
            "tarifa_actual": 5.50
        }

    # REMOVER @pytest.mark.asyncio de los tests que NO son async
    def test_detectar_tipo_usuario_estudiante(self, usuario_service):
        """Test detección de tipo estudiante por email"""
        # Emails educativos
        assert usuario_service._detectar_tipo_usuario("alumno@itesm.edu") == "estudiante"
        assert usuario_service._detectar_tipo_usuario("profesor@universidad.edu.mx") == "estudiante"
        assert usuario_service._detectar_tipo_usuario("user@colegio.edu") == "estudiante"

    def test_detectar_tipo_usuario_normal(self, usuario_service):
        """Test detección de tipo normal por email"""
        # Emails no educativos
        assert usuario_service._detectar_tipo_usuario("usuario@gmail.com") == "normal"
        assert usuario_service._detectar_tipo_usuario("persona@empresa.com") == "normal"
        assert usuario_service._detectar_tipo_usuario("test@hotmail.com") == "normal"

    def test_calcular_tarifa(self, usuario_service):
        """Test cálculo de tarifas por tipo de usuario"""
        assert usuario_service._calcular_tarifa("estudiante") == 5.50
        assert usuario_service._calcular_tarifa("normal") == 11.00
        assert usuario_service._calcular_tarifa("adulto_mayor") == 5.00
        assert usuario_service._calcular_tarifa("discapacitado") == 5.50
        assert usuario_service._calcular_tarifa("tipo_desconocido") == 11.00  # Default

    def test_generar_clabe_unica(self, usuario_service):
        """Test generación de CLABE única"""
        clabe = usuario_service._generar_clabe_unica()
        
        # Verificar formato de CLABE (18 dígitos)
        assert len(clabe) == 18
        assert clabe.isdigit()
        assert clabe.startswith("012180")  # Banco y sucursal por defecto

    def test_hash_password(self, usuario_service):
        """Test hashing de contraseña"""
        password = "mi_contraseña_secreta"
        hash_result = usuario_service._hash_password(password)
        
        # Verificar que se generó un hash
        assert hash_result is not None
        assert len(hash_result) > 0
        assert hash_result != password  # No debe ser igual al texto plano

    def test_verificar_password_correcto(self, usuario_service):
        """Test verificación de contraseña correcta"""
        password = "contraseña_valida"
        hash_result = usuario_service._hash_password(password)
        
        # Debe verificar correctamente
        assert usuario_service._verificar_password(password, hash_result) == True

    def test_verificar_password_incorrecto(self, usuario_service):
        """Test verificación de contraseña incorrecta"""
        password = "contraseña_valida"
        hash_result = usuario_service._hash_password(password)
        
        # No debe verificar con contraseña incorrecta
        assert usuario_service._verificar_password("contraseña_incorrecta", hash_result) == False

    # SOLO los tests que interactúan con la BD necesitan ser async
    @pytest.mark.asyncio
    async def test_crear_usuario_exitoso(self, usuario_service, usuario_data_valido):
        """Test creación exitosa de usuario"""
        # Mock de la colección
        usuario_service.collection.find_one.return_value = None  # No existe usuario
        usuario_service.collection.insert_one = AsyncMock()
        
        # Crear usuario
        usuario_create = UsuarioCreate(**usuario_data_valido)
        resultado = await usuario_service.crear_usuario(usuario_create)
        
        # Verificaciones
        assert resultado.nombre == usuario_data_valido["nombre"]
        assert resultado.email == usuario_data_valido["email"]
        assert resultado.tipo == "estudiante"  # Detectado automáticamente
        assert resultado.saldo == 0.0
        assert resultado.tarifa_actual == 5.50
        assert resultado.clabe_recarga is not None
        assert len(resultado.clabe_recarga) == 18

    @pytest.mark.asyncio
    async def test_crear_usuario_email_existente(self, usuario_service, usuario_data_valido):
        """Test error cuando el email ya existe"""
        # Mock: usuario ya existe
        usuario_service.collection.find_one.return_value = {"email": usuario_data_valido["email"]}
        
        usuario_create = UsuarioCreate(**usuario_data_valido)
        
        # Debe lanzar excepción
        with pytest.raises(ValueError, match="El email ya está registrado"):
            await usuario_service.crear_usuario(usuario_create)

    @pytest.mark.asyncio
    async def test_obtener_usuario_por_email_existente(self, usuario_service):
        """Test obtener usuario por email cuando existe"""
        usuario_data = {
            "id_usuario": 123456,
            "nombre": "Test User",
            "email": "test@example.com",
            "tipo": "normal",
            "saldo": 0.0,
            "password_hash": "hash_placeholder",
            "tarifa_actual": 11.00
        }
        
        usuario_service.collection.find_one.return_value = usuario_data
        
        resultado = await usuario_service.obtener_usuario_por_email("test@example.com")
        
        assert resultado is not None
        assert resultado.email == "test@example.com"
        assert resultado.nombre == "Test User"

    @pytest.mark.asyncio
    async def test_obtener_usuario_por_email_no_existente(self, usuario_service):
        """Test obtener usuario por email cuando no existe"""
        usuario_service.collection.find_one.return_value = None
        
        resultado = await usuario_service.obtener_usuario_por_email("noexiste@example.com")
        
        assert resultado is None


    @pytest.mark.asyncio
    async def test_verificar_credenciales_correctas(self, usuario_service):
        """Test verificación de credenciales correctas"""
        password = "password123"
        # Usar el método real de hash para este test
        hash_result = usuario_service._hash_password(password)

        # Crear datos de usuario COMPLETOS para el modelo UsuarioInDB
        usuario_data = {
            "id_usuario": 123456789,
            "nombre": "Test User",
            "email": "test@example.com",
            "tipo": "normal",
            "saldo": 0.0,
            "clabe_recarga": "012180001234567890",
            "rutas_favoritas": [],
            "tarifa_actual": 11.0,
            "password_hash": hash_result,
            "salt": "",
            "fecha_creacion": "2024-01-20T10:30:00"
        }

        usuario_service.collection.find_one.return_value = usuario_data

        resultado = await usuario_service.verificar_credenciales("test@example.com", password)

        assert resultado == True

    @pytest.mark.asyncio
    async def test_verificar_credenciales_incorrectas(self, usuario_service):
        """Test verificación de credenciales incorrectas"""
        password = "password123"
        hash_result = usuario_service._hash_password(password)

        # Crear datos de usuario COMPLETOS para el modelo UsuarioInDB
        usuario_data = {
            "id_usuario": 123456789,
            "nombre": "Test User",
            "email": "test@example.com",
            "tipo": "normal",
            "saldo": 0.0,
            "clabe_recarga": "012180001234567890",
            "rutas_favoritas": [],
            "tarifa_actual": 11.0,
            "password_hash": hash_result,
            "salt": "",
            "fecha_creacion": "2024-01-20T10:30:00"
        }

        usuario_service.collection.find_one.return_value = usuario_data

        resultado = await usuario_service.verificar_credenciales("test@example.com", "password_incorrecta")

        assert resultado == False

    @pytest.mark.asyncio
    async def test_verificar_credenciales_usuario_no_existe(self, usuario_service):
        """Test verificación cuando usuario no existe"""
        usuario_service.collection.find_one.return_value = None

        resultado = await usuario_service.verificar_credenciales("noexiste@example.com", "password123")

        assert resultado == False
    
    