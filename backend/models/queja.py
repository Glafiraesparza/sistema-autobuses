from pydantic import BaseModel
from typing import Optional
# Borra o comenta la importación de datetime si da problemas, aunque no estorba.

class QuejaCrear(BaseModel):
    id_usuario: str
    ruta: str
    numero_unidad: str
    fecha_hora: str 
    descripcion: str
    estado: Optional[str] = "Pendiente"

    class Config:
        json_schema_extra = {
            "example": {
                "id_usuario": "64f8...",
                "ruta": "Ruta 18",
                "numero_unidad": "T-45",
                "fecha_hora": "2023-10-27T14:30", # Ahora es un string simple
                "descripcion": "El chofer no se detuvo."
            }
        }