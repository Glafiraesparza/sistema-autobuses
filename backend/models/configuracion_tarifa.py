from pydantic import BaseModel
from typing import Dict, Optional
from datetime import datetime

class TarifaConfig(BaseModel):
    """Configuración de tarifas por tipo de usuario"""
    normal: float = 11.00
    estudiante: float = 5.50
    adulto_mayor: float = 5.50
    discapacitado: float = 5.50
    
class DescuentoConfig(BaseModel):
    """Configuración de descuentos especiales"""
    nombre: str
    porcentaje: float
    activo: bool = True
    fecha_inicio: Optional[datetime] = None
    fecha_fin: Optional[datetime] = None

class ConfiguracionSistema(BaseModel):
    """Configuración general del sistema"""
    tarifas: TarifaConfig = TarifaConfig()
    descuentos_activos: bool = True
    ultima_actualizacion: datetime = datetime.now()
    actualizado_por: Optional[str] = None