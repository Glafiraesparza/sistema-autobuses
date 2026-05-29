from backend.database.mongodb import get_usuarios_personal_collection
from backend.models.auth import UsuarioPersonal, LoginRequest, LoginResponse
from datetime import datetime
import hashlib

class AuthService:
    def __init__(self, collection=None):
        # Permitir inyectar la colección para tests
        self.collection = collection
    
    async def _get_collection(self):
        """Obtener la colección de forma diferida"""
        if self.collection is None:
            self.collection = get_usuarios_personal_collection()
        return self.collection
    
    async def crear_usuario_inicial(self):
        """Crear usuarios iniciales de prueba"""
        collection = await self._get_collection()
        usuarios_iniciales = [
            {
                "id_personal": 1,
                "nombre": "Admin Principal",
                "email": "admin@tucsa.com",
                "password_hash": self._hash_password("admin123"),
                "rol": "administrador",
                "activo": True,
                "turno":"vespertino",
                "fecha_creacion": datetime.utcnow()
            },
            {
                "id_personal": 2,
                "nombre": "Juan Pérez - Chofer Ruta 40 Norte",
                "email": "juan.perez@tucsa.com", 
                "password_hash": self._hash_password("chofer123"),
                "rol": "chofer",
                "activo": True,
                "fecha_creacion": datetime.utcnow(),
            },
            {
                "id_personal": 3, 
                "nombre": "Roberto Gomez - Chofer Ruta 40 Sur",
                "email": "roberto.gomez@tucsa.com",
                "password_hash": self._hash_password("chofer123"),
                "rol": "chofer", 
                "activo": True,
                "fecha_creacion": datetime.utcnow(),
            }
        ]
        
        for usuario in usuarios_iniciales:
            existe = await collection.find_one({"email": usuario["email"]})
            if not existe:
                await collection.insert_one(usuario)
                print(f"✅ Usuario creado: {usuario['email']}")
    
    def _hash_password(self, password: str) -> str:
        """Hash simple de contraseña (en producción usar bcrypt)"""
        return hashlib.sha256(password.encode()).hexdigest()
    
    def _convert_objectid_to_str(self, document):
        """Convertir ObjectId a string para serialización JSON"""
        if document and '_id' in document:
            document['_id'] = str(document['_id'])
        return document
    
    async def login(self, login_request: LoginRequest) -> LoginResponse:
        """Autenticar usuario"""
        collection = await self._get_collection()
        usuario = await collection.find_one({
            "email": login_request.email,
            "rol": login_request.rol,
            "activo": True
        })
        
        if not usuario:
            return LoginResponse(
                success=False,
                mensaje="Credenciales incorrectas o usuario inactivo"
            )
        
        password_hash = self._hash_password(login_request.password)
        if usuario["password_hash"] != password_hash:
            return LoginResponse(
                success=False, 
                mensaje="Credenciales incorrectas"
            )
        
        # Convertir ObjectId a string y remover password_hash
        usuario = self._convert_objectid_to_str(usuario)
        usuario_response = {k: v for k, v in usuario.items() if k != "password_hash"}
        
        return LoginResponse(
            success=True,
            mensaje="Login exitoso",
            token="token_simulado",  # En producción usar JWT
            usuario=usuario_response
        )
    

# Instancia global
auth_service = AuthService()