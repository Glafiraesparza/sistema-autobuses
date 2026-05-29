from pydantic import BaseModel, Field
from typing import Optional, Union, List
from datetime import datetime
from bson import ObjectId

class AsignacionRuta(BaseModel):
    id_personal: Union[str, int] = Field(..., description="ID del personal/chofer")
    id_unidad: Union[str, int] = Field(..., description="ID de la unidad")
    ruta: str = Field(..., description="Nombre de la ruta: '40_Norte' o '40_Sur'")
    fecha_asignacion: Optional[datetime] = None
    jornada_completada: Optional[bool] = None
    tiempo_vuelta: Optional[List[int]] = None  # Lista de tiempos de vueltas
    vueltas_completadas: Optional[int] = 0     # Contador de vueltas
    fecha_finalizacion: Optional[datetime] = None

    class Config:
        json_encoders = {
            ObjectId: str,
            datetime: lambda dt: dt.isoformat()
        }

class AsignacionRutaResponse(AsignacionRuta):
    id_asignacion: str

# Agregar al final del archivo
class VueltaRequest(BaseModel):
    id_asignacion: str

class IncidenteRequest(BaseModel):
    id_asignacion: str
    tipo_incidente: str
    descripcion: Optional[str] = None