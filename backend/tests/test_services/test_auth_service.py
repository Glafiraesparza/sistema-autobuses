import pytest
import hashlib
from backend.services.auth_service import AuthService
from backend.models.auth import LoginRequest

class TestAuthService:
    @pytest.mark.asyncio
    async def test_hash_password(self):
        """Test del método de hash de contraseñas"""
        auth_service = AuthService()
        password = "test123"
        hashed = auth_service._hash_password(password)
        
        # Verificar que el hash es correcto
        expected_hash = hashlib.sha256(password.encode()).hexdigest()
        assert hashed == expected_hash
        assert len(hashed) == 64  # SHA-256 produce 64 caracteres hex

    @pytest.mark.asyncio
    async def test_auth_service_initialization(self):
        """Test que la instancia de AuthService se crea correctamente"""
        auth_service = AuthService()
        # Ahora debería inicializarse sin problemas
        assert hasattr(auth_service, '_get_collection')

    @pytest.mark.asyncio
    async def test_login_usuario_no_encontrado(self, mock_auth_collection):
        """Test login cuando el usuario no existe"""
        auth_service = AuthService()
        mock_auth_collection.find_one.return_value = None  # Simular usuario no encontrado
        
        login_request = LoginRequest(
            email="noexiste@test.com",
            password="password",
            rol="administrador"
        )
        
        result = await auth_service.login(login_request)
        
        assert result.success == False
        assert "incorrectas" in result.mensaje.lower()
        mock_auth_collection.find_one.assert_called_once()

    @pytest.mark.asyncio 
    async def test_login_password_incorrecto(self, mock_auth_collection):
        """Test login con password incorrecto"""
        auth_service = AuthService()
        
        # Simular usuario existente
        mock_auth_collection.find_one.return_value = {
            "email": "admin@tucsa.com",
            "password_hash": hashlib.sha256("password_correcta".encode()).hexdigest(),
            "rol": "administrador",
            "activo": True
        }
        
        login_request = LoginRequest(
            email="admin@tucsa.com", 
            password="password_incorrecta",  # Password incorrecto
            rol="administrador"
        )
        
        result = await auth_service.login(login_request)
        
        assert result.success == False
        assert "incorrectas" in result.mensaje.lower()

    @pytest.mark.asyncio
    async def test_login_exitoso(self, mock_auth_collection):
        """Test login exitoso"""
        auth_service = AuthService()
        
        password_correcta = "admin123"
        password_hash = hashlib.sha256(password_correcta.encode()).hexdigest()
        
        # Simular usuario existente con password correcto
        mock_auth_collection.find_one.return_value = {
            "id_personal": 1,
            "nombre": "Admin Principal",
            "email": "admin@tucsa.com",
            "password_hash": password_hash,
            "rol": "administrador",
            "activo": True,
            "fecha_creacion": "2024-01-01T00:00:00"
        }
        
        login_request = LoginRequest(
            email="admin@tucsa.com", 
            password=password_correcta,  # Password correcto
            rol="administrador"
        )
        
        result = await auth_service.login(login_request)
        
        assert result.success == True
        assert result.mensaje == "Login exitoso"
        assert result.usuario is not None
        assert result.usuario["rol"] == "administrador"
        assert "password_hash" not in result.usuario  # No debe incluir el hash