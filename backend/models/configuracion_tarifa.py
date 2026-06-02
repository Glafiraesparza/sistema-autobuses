from pydantic import BaseModel
from typing import Dict, Optional, List
from datetime import datetime

class TarifaConfig(BaseModel):
    """Configuración de tarifas por tipo de usuario"""
    normal: float = 11.00
    estudiante: float = 5.50
    adulto_mayor: float = 5.50
    discapacitado: float = 5.50
    
    class Config:
        json_schema_extra = {
            "example": {
                "normal": 11.00,
                "estudiante": 5.50,
                "adulto_mayor": 5.50,
                "discapacitado": 5.50
            }
        }


class ConfiguracionSistemaTarifas(BaseModel):
    """Configuración general del sistema de tarifas"""
    tarifas: TarifaConfig = TarifaConfig()
    descuentos_activos: bool = True
    ultima_actualizacion: datetime = datetime.now()
    actualizado_por: Optional[str] = None


class DescuentoTemporal(BaseModel):
    """Modelo para descuentos temporales"""
    porcentaje: float
    razon: str
    duracion_horas: int
    fecha_inicio: datetime
    fecha_fin: datetime
    tarifas_originales: Optional[Dict[str, float]] = None
    tarifas_aplicadas: Optional[Dict[str, float]] = None
    aplicado_por: Optional[str] = None
    activo: bool = True
    
    class Config:
        json_schema_extra = {
            "example": {
                "porcentaje": 20.0,
                "razon": "Promoción especial",
                "duracion_horas": 24,
                "fecha_inicio": "2024-01-01T00:00:00",
                "fecha_fin": "2024-01-02T00:00:00",
                "activo": True
            }
        }