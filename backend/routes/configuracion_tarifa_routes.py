from fastapi import APIRouter, HTTPException, Body
from backend.models.configuracion_tarifa import TarifaConfig, DescuentoTemporal
from backend.services.configuracion_tarifa_service import configuracion_tarifa_service
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/configuracion-tarifas", tags=["Configuración de Tarifas"])


@router.get("/tarifas")
async def obtener_tarifas():
    """
    Obtener la configuración actual de tarifas
    """
    try:
        config = await configuracion_tarifa_service.obtener_configuracion()
        return {
            "success": True,
            "tarifas": config.tarifas.dict(),
            "ultima_actualizacion": config.ultima_actualizacion,
            "actualizado_por": config.actualizado_por
        }
    except Exception as e:
        logger.error(f"Error obteniendo tarifas: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/tarifas")
async def actualizar_tarifas(
    tarifas: TarifaConfig = Body(...),
    admin_id: str = Body(...)
):
    """
    Actualizar las tarifas del sistema
    """
    try:
        # Validar que las tarifas sean positivas
        for tipo, tarifa in tarifas.dict().items():
            if tarifa < 0:
                raise HTTPException(
                    status_code=422, 
                    detail=f"La tarifa para {tipo} no puede ser negativa"
                )
        
        success = await configuracion_tarifa_service.actualizar_tarifas(tarifas, admin_id)
        
        if success:
            return {
                "success": True,
                "mensaje": "Tarifas actualizadas correctamente",
                "tarifas": tarifas.dict()
            }
        else:
            raise HTTPException(status_code=500, detail="Error al actualizar tarifas")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error actualizando tarifas: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/descuento-temporal")
async def aplicar_descuento_temporal(
    porcentaje: float = Body(...),
    razon: str = Body(...),
    duracion_horas: int = Body(...),
    admin_id: str = Body(...)
):
    """
    Aplicar un descuento temporal a todas las tarifas
    """
    try:
        # Validaciones
        if porcentaje <= 0 or porcentaje > 100:
            raise HTTPException(status_code=422, detail="El porcentaje debe estar entre 1 y 100")
        
        if duracion_horas <= 0 or duracion_horas > 168:
            raise HTTPException(status_code=422, detail="La duración debe estar entre 1 y 168 horas")
        
        if not razon or len(razon.strip()) < 3:
            raise HTTPException(status_code=422, detail="Debes proporcionar una razón válida")
        
        # Obtener configuración actual
        config = await configuracion_tarifa_service.obtener_configuracion()
        tarifas_originales = config.tarifas.dict()
        
        # Calcular nuevas tarifas con descuento
        tarifas_con_descuento = {}
        for tipo, tarifa in tarifas_originales.items():
            nueva_tarifa = tarifa * (1 - porcentaje / 100)
            tarifas_con_descuento[tipo] = round(nueva_tarifa, 2)
        
        # Crear objeto de descuento temporal
        ahora = datetime.now()
        descuento = {
            "porcentaje": porcentaje,
            "razon": razon,
            "duracion_horas": duracion_horas,
            "fecha_inicio": ahora,
            "fecha_fin": ahora + timedelta(hours=duracion_horas),
            "tarifas_originales": tarifas_originales,
            "tarifas_aplicadas": tarifas_con_descuento,
            "aplicado_por": admin_id,
            "activo": True
        }
        
        # Guardar descuento en colección separada
        descuentos_collection = configuracion_tarifa_service._get_descuentos_collection()
        await (await descuentos_collection).insert_one(descuento)
        
        # Aplicar nuevas tarifas
        from backend.models.configuracion_tarifa import TarifaConfig
        nuevas_tarifas = TarifaConfig(**tarifas_con_descuento)
        success = await configuracion_tarifa_service.actualizar_tarifas(nuevas_tarifas, admin_id)
        
        if success:
            return {
                "success": True,
                "mensaje": f"Descuento del {porcentaje}% aplicado por {duracion_horas} horas",
                "tarifas_anteriores": tarifas_originales,
                "tarifas_nuevas": tarifas_con_descuento,
                "valido_hasta": (ahora + timedelta(hours=duracion_horas)).isoformat()
            }
        else:
            raise HTTPException(status_code=500, detail="Error al aplicar descuento")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error aplicando descuento temporal: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tipos-usuario")
async def obtener_tipos_usuario():
    """
    Obtener los tipos de usuario disponibles
    """
    return {
        "success": True,
        "tipos": [
            {"id": "normal", "nombre": "Normal", "descripcion": "Tarifa estándar", "icono": "bi-person"},
            {"id": "estudiante", "nombre": "Estudiante", "descripcion": "Tarifa preferencial para estudiantes", "icono": "bi-book"},
            {"id": "adulto_mayor", "nombre": "Adulto Mayor", "descripcion": "Tarifa preferencial para adultos mayores", "icono": "bi-people"},
            {"id": "discapacitado", "nombre": "Discapacitado", "descripcion": "Tarifa preferencial para personas con discapacidad", "icono": "bi-heart"}
        ]
    }


@router.get("/descuentos-activos")
async def obtener_descuentos_activos():
    """
    Obtener descuentos temporales activos
    """
    try:
        descuentos_collection = configuracion_tarifa_service._get_descuentos_collection()
        ahora = datetime.now()
        
        descuentos = await (await descuentos_collection).find({
            "activo": True,
            "fecha_inicio": {"$lte": ahora},
            "fecha_fin": {"$gte": ahora}
        }).to_list(length=10)
        
        # Convertir ObjectId a string para cada descuento
        for descuento in descuentos:
            if "_id" in descuento:
                descuento["_id"] = str(descuento["_id"])
        
        return {
            "success": True,
            "descuentos": descuentos
        }
    except Exception as e:
        logger.error(f"Error obteniendo descuentos activos: {e}")
        return {"success": True, "descuentos": []}


@router.post("/restablecer-tarifas")
async def restablecer_tarifas_predeterminadas(admin_id: str = Body(...)):
    """
    Restablecer tarifas a los valores predeterminados
    """
    try:
        from backend.models.configuracion_tarifa import TarifaConfig
        
        tarifas_default = TarifaConfig(
            normal=11.00,
            estudiante=5.50,
            adulto_mayor=5.50,
            discapacitado=5.50
        )
        
        success = await configuracion_tarifa_service.actualizar_tarifas(tarifas_default, admin_id)
        
        if success:
            return {
                "success": True,
                "mensaje": "Tarifas restablecidas a valores predeterminados",
                "tarifas": tarifas_default.dict()
            }
        else:
            raise HTTPException(status_code=500, detail="Error al restablecer tarifas")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error restableciendo tarifas: {e}")
        raise HTTPException(status_code=500, detail=str(e))