from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class UnidadCreate(BaseModel):
    placas: str
    capacidad: int
    modelo: Optional[str] = None
    estado: str  # "activo" o "mantenimiento"

class Unidad(BaseModel):
    id_unidad: str
    placas: str
    capacidad: int
    modelo: Optional[str] = None
    estado: str
    fecha_creacion: datetime