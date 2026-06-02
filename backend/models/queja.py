from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class HistorialEstado(BaseModel):
    estado: str
    fecha: datetime
    notas: str
    realizado_por: str

class QuejaCrear(BaseModel):
    id_usuario: str
    ruta: str
    numero_unidad: str
    fecha_hora: str 
    descripcion: str
    estado: Optional[str] = "Pendiente"
    notas_admin: Optional[str] = ""
    tipo_reporte: Optional[str] = "queja"  # "queja" o "incidente_trabajador"
    historial_estados: Optional[List[dict]] = []
    fecha_reporte: Optional[datetime] = None
    ultima_actualizacion: Optional[datetime] = None

    class Config:
        json_schema_extra = {
            "example": {
                "id_usuario": "64f8...",
                "ruta": "Ruta 18",
                "numero_unidad": "T-45",
                "fecha_hora": "2023-10-27T14:30",
                "descripcion": "El chofer no se detuvo.",
                "estado": "Pendiente",
                "tipo_reporte": "queja"
            }
        }

class QuejaUpdate(BaseModel):
    estado: Optional[str] = None
    notas_admin: Optional[str] = None