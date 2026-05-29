from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List
from enum import Enum

class TipoNotificacion(str, Enum):
    RETRASO = "retraso"
    EMERGENCIA = "emergencia"
    SISTEMA = "sistema"
    ASISTENCIA = "asistencia"

class Notificacion(BaseModel):
    id_notificacion: int
    tipo: TipoNotificacion
    titulo: str
    mensaje: str
    ruta_afectada: Optional[str] = None
    tiempo_estimado: Optional[int] = None
    timestamp: datetime
    leida: bool = False
    id_usuario: Optional[int] = None
    id_chofer: Optional[int] = None
    id_personal: Optional[int] = None
    # NUEVO: Lista de usuarios/personal que han eliminado esta notificación
    usuarios_eliminada: List[int] = []  # IDs de usuarios que la eliminaron
    personal_eliminada: List[int] = []  # IDs de personal que la eliminaron

class NotificacionCreate(BaseModel):
    tipo: TipoNotificacion
    titulo: str
    mensaje: str
    ruta_afectada: Optional[str] = None
    tiempo_estimado: Optional[int] = None
    id_chofer: Optional[int] = None
    id_personal: Optional[int] = None