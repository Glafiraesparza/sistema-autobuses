from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, timedelta, timezone
from bson import ObjectId

class QRPago(BaseModel):
    id_usuario: int
    nonce: str = Field(..., description="Identificador único del QR")
    timestamp_creacion: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    timestamp_expiracion: datetime = Field(default_factory=lambda: datetime.now(timezone.utc) + timedelta(minutes=10))
    estado: str = Field(default="generado", description="generado | usado | expirado")
    intentos_fallidos: int = Field(default=0)
    
    class Config:
        json_encoders = {
            ObjectId: str,
            datetime: lambda dt: dt.isoformat()
        }

class QRGenerarRequest(BaseModel):
    id_usuario: int

class QRValidarRequest(BaseModel):
    nonce: str

# ✅ CORREGIDO: Modelo para transacciones - hacer campos más específicos por tipo
class Transaccion(BaseModel):
    id_transaccion: str = Field(..., description="ID único de la transacción")
    id_usuario: int
    tipo: str = Field(..., description="pago_viaje | recarga_saldo")
    monto: float
    saldo_anterior: float
    saldo_posterior: float
    fecha_transaccion: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    estado: str = Field(default="completada")
    
    # Campos específicos para pago_viaje
    id_qr: Optional[str] = None
    id_camion: Optional[int] = None
    nombre_ruta: Optional[str] = None
    tarifa_aplicada: Optional[float] = None
    
    # Campos específicos para recarga_saldo
    metodo_recarga: Optional[str] = None
    clabe_origen: Optional[str] = None
    referencia_banco: Optional[str] = None
    comision: Optional[float] = None
    
    class Config:
        json_encoders = {
            ObjectId: str,
            datetime: lambda dt: dt.isoformat()
        }