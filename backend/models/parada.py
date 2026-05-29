from pydantic import BaseModel, Field
from typing import List, Optional
from bson import ObjectId

class Parada(BaseModel):
    id: Optional[str] = Field(alias="_id")
    nombre_parada: str
    ruta_nombre: str
    coordenadas: dict  # { "lat": float, "lng": float }
    orden: int

class ParadaDisplay(BaseModel):
    nombre_parada: str
    ruta_nombre: str
    tiempo_estimado: int
    camiones_cercanos: List[dict] = []

class TiempoUpdate(BaseModel):
    ruta_nombre: str
    minutos_extra: int
    motivo: Optional[str] = None