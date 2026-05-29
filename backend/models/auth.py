from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime
import hashlib

class LoginRequest(BaseModel):
    email: str
    password: str
    rol: str  # "chofer" o "administrador"

class UsuarioPersonal(BaseModel):
    id_personal: int
    nombre: str
    email: str
    password_hash: str
    rol: str  # "chofer" o "administrador"
    activo: bool = True
    turno: str
    fecha_creacion: datetime = None

class LoginResponse(BaseModel):
    success: bool
    mensaje: str
    token: Optional[str] = None
    usuario: Optional[dict] = None

class UsuarioCreate(BaseModel):
    nombre: str
    email: Optional[str] = None  # Hacer email opcional para generación automática
    password: str
    rol: str  # "chofer" o "administrador"
    turno: str  # "matutino" o "vespertino"

class UsuarioUpdate(BaseModel):
    nombre: Optional[str] = None
    password: Optional[str] = None
    turno: Optional[str] = None

class EstadoUsuarioUpdate(BaseModel):
    activo: bool

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()