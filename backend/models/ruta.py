from pydantic import BaseModel
from typing import List, Optional

class Coordenada(BaseModel):
    orden: int
    lat: float
    lng: float

class Parada(BaseModel):
    orden: int
    lat: float
    lng: float
    nombre: Optional[str] = None  # Agregar nombre opcional

class RutaResponse(BaseModel):
    nombre: str
    coordenadas: List[Coordenada]
    tiempo_estimado: int
    paradas: Optional[List[Parada]] = None  # ⭐ NUEVO: campo paradas
    # Configuración para excluir campos vacíos (esto podría ser el problema)
    class Config:
        # ⭐ ESTA CONFIGURACIÓN PUEDE ESTAR EXCLUYENDO 'paradas' CUANDO ESTÁ VACÍO
        exclude_unset = False  # Asegurar que se incluyan todos los campos
        exclude_none = False   # No excluir campos con valor None