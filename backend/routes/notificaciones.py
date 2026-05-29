from fastapi import APIRouter, HTTPException, Query
from backend.services.notificacion_service import NotificacionService
from backend.models.notificacion import NotificacionCreate
from pydantic import BaseModel
from typing import List

router = APIRouter(prefix="/api/notificaciones", tags=["notificaciones"])

# Crear instancia del servicio
notificacion_service = NotificacionService()

# Modelos existentes
class RetrasoRequest(BaseModel):
    ruta: str
    tiempo_estimado: int
    motivo: str
    id_chofer: int = None

class EmergenciaRequest(BaseModel):
    ruta: str
    tipo_incidente: str
    id_chofer: int = None
    tipo: str = None

# Endpoints existentes
@router.post("/")
async def crear_notificacion(notificacion_data: NotificacionCreate):
    """Crear una nueva notificación"""
    try:
        notificacion = await notificacion_service.crear_notificacion(notificacion_data)
        return {"success": True, "notificacion": notificacion}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creando notificación: {str(e)}")

@router.get("/usuario/{id_usuario}")
async def obtener_notificaciones_usuario(id_usuario: int):
    """Obtener notificaciones para un usuario específico"""
    try:
        notificaciones = await notificacion_service.obtener_notificaciones_usuario(id_usuario)
        return {"success": True, "notificaciones": notificaciones}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error obteniendo notificaciones: {str(e)}")

@router.get("/generales")
async def obtener_notificaciones_generales():
    """Obtener notificaciones generales (para todos los usuarios)"""
    try:
        notificaciones = await notificacion_service.obtener_notificaciones_generales()
        return {"success": True, "notificaciones": notificaciones}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error obteniendo notificaciones: {str(e)}")

@router.put("/{id_notificacion}/leida")
async def marcar_notificacion_leida(id_notificacion: int):
    """Marcar una notificación como leída"""
    try:
        success = await notificacion_service.marcar_como_leida(id_notificacion)
        return {"success": success}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error marcando notificación: {str(e)}")

# ✅ NUEVO: Endpoint para eliminar notificación para usuario
@router.delete("/usuario/{id_notificacion}")
async def eliminar_notificacion_usuario(
    id_notificacion: int, 
    id_usuario: int = Query(..., description="ID del usuario que elimina la notificación")
):
    """Eliminar notificación para un usuario específico"""
    try:
        success = await notificacion_service.eliminar_notificacion_usuario(id_notificacion, id_usuario)
        return {"success": success}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error eliminando notificación: {str(e)}")

# ✅ NUEVO: Endpoint para eliminar notificación para personal
@router.delete("/personal/{id_notificacion}")
async def eliminar_notificacion_personal(
    id_notificacion: int, 
    id_personal: int = Query(..., description="ID del personal que elimina la notificación")
):
    """Eliminar notificación para un miembro del personal"""
    try:
        success = await notificacion_service.eliminar_notificacion_personal(id_notificacion, id_personal)
        return {"success": success}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error eliminando notificación: {str(e)}")

# CORREGIR: Endpoint de emergencia
@router.post("/emergencia")
async def crear_notificacion_emergencia(request: EmergenciaRequest):
    """Endpoint específico para crear notificación de emergencia o asistencia"""
    try:
        notificacion = await notificacion_service.crear_notificacion_emergencia(
            ruta=request.ruta, 
            tipo_incidente=request.tipo_incidente, 
            id_chofer=request.id_chofer,
            tipo=request.tipo  # ✅ Usando argumentos con nombre
        )
        return {"success": True, "notificacion": notificacion}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creando notificación: {str(e)}")

# CORREGIR: Endpoint de retraso
@router.post("/retraso")
async def crear_notificacion_retraso(request: RetrasoRequest):
    """Endpoint específico para crear notificación de retraso"""
    try:
        notificacion = await notificacion_service.crear_notificacion_retraso(
            ruta=request.ruta, 
            tiempo_estimado=request.tiempo_estimado, 
            motivo=request.motivo, 
            id_chofer=request.id_chofer
        )
        return {"success": True, "notificacion": notificacion}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creando notificación de retraso: {str(e)}")

# NUEVO: Endpoint para administrador (actualizado)
@router.get("/admin")
async def obtener_notificaciones_administrador(id_personal: int = Query(None, description="ID del personal administrador")):
    """Obtener todas las notificaciones para el panel administrativo"""
    try:
        notificaciones = await notificacion_service.obtener_notificaciones_administrador(id_personal)
        return {"success": True, "notificaciones": notificaciones}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error obteniendo notificaciones: {str(e)}")