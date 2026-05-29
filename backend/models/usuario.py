from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional, List
from datetime import datetime
import re

class RutaFavorita(BaseModel):
    nombre: str

class UsuarioBase(BaseModel):
    nombre: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    tipo: str = Field(default="normal")
    saldo: float = Field(default=0.0)
    clabe_recarga: Optional[str] = None
    rutas_favoritas: List[RutaFavorita] = Field(default_factory=list)
    tarifa_actual: float = Field(default=11.0)

    @field_validator('tipo')
    @classmethod
    def validar_tipo_usuario(cls, v):
        tipos_permitidos = ["estudiante", "normal", "adulto_mayor", "discapacitado"]
        if v not in tipos_permitidos:
            raise ValueError(f"Tipo de usuario debe ser uno de: {', '.join(tipos_permitidos)}")
        return v

class UsuarioCreate(UsuarioBase):
    password: str = Field(..., min_length=8)

    @field_validator('password')
    @classmethod
    def validar_password(cls, v):
        if len(v) < 8:
            raise ValueError("La contraseña debe tener al menos 8 caracteres")
        return v

class UsuarioResponse(UsuarioBase):
    id_usuario: int
    fecha_creacion: datetime
    fecha_ultimo_acceso: Optional[datetime] = None

    class Config:
        from_attributes = True
#Modifique 19/11/2025 Inicio
class UsuarioInDB(UsuarioBase):
    id_usuario: int
    password_hash: str
    salt: str = ""
    fecha_creacion: datetime = Field(default_factory=datetime.utcnow)
    fecha_ultimo_acceso: Optional[datetime] = None
    primer_inicio: bool = Field(default=True)  # ← Nuevo campo
    codigo_verificacion: Optional[str] = None  # ← Nuevo campo
    codigo_verificacion_expiracion: Optional[datetime] = None  # ← Nuevo cam
#Modifique 19/11/2025 Fin
class UsuarioLogin(BaseModel):
    email: str
    password: str
    codigo_verificacion: Optional[str] = None
#Modifique 19/11/2025 Inicio
class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    usuario: UsuarioResponse
    requiere_verificacion: bool = False  # ← Nuevo campo
#Modifique 19/11/2025 Fin
#Agregue 19/11/2025 Tomás Inicio
class VerificacionRequest(BaseModel):
    email: str
    codigo_verificacion: str
#Agregue 19/11/2025 Tomás Fin
# Agregue 19/11/2025 Tomás Inicio - Modelos para recuperación de contraseña
class RecuperacionSolicitud(BaseModel):
    email: EmailStr

class RecuperacionVerificacion(BaseModel):
    email: EmailStr
    codigo_recuperacion: str
    nueva_password: str = Field(..., min_length=8)

class RecuperacionResponse(BaseModel):
    mensaje: str
    exito: bool
    error_code: Optional[str] = None  # Código específico del erro
# Agregue 19/11/2025 Tomás Fin - Modelos para recuperación de contraseña

# Agregue 20/11/2025 Tomás Inicio - Modelos para tarifa preferencial
from enum import Enum

class TipoDiscapacidad(str, Enum):
    VISUAL = "visual"
    AUDITIVA = "auditiva" 
    MOTRIZ = "motriz"
    INTELECTUAL = "intelectual"
    MULTIPLE = "multiple"
    NINGUNA = "ninguna"

class TipoDocumento(str, Enum):
    INAPAM = "inapam"
    DIF = "dif"

class SolicitudTarifaPreferencial(BaseModel):
    id_usuario: int
    nombre_completo: str
    email: EmailStr
    fecha_nacimiento: str  # Formato YYYY-MM-DD
    es_adulto_mayor: bool
    tiene_discapacidad: bool
    tipo_discapacidad: Optional[TipoDiscapacidad] = None
    requiere_silla_ruedas: bool = False
    documento_identificacion: str  # Base64 de la imagen
    tipo_documento: TipoDocumento
    fecha_solicitud: datetime = Field(default_factory=datetime.utcnow)

class SolicitudResponse(BaseModel):
    id_solicitud: str
    mensaje: str
    exito: bool
    tipo_usuario_actualizado: Optional[str] = None
    tarifa_actualizada: Optional[float] = None

class ValidacionSolicitud(BaseModel):
    aprobada: bool
    observaciones: Optional[str] = None
# Agregue 20/11/2025 Tomás Fin - Modelos para tarifa preferencial


# Agregue 20/11/2025 Alfredo - Configuración cuenta
class UsuarioConfiguracion(BaseModel):
    nombre: str