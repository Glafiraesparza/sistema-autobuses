from fastapi import APIRouter, HTTPException
from backend.models.unidades import UnidadCreate
from backend.services.unidades_service import unidad_service

router = APIRouter(prefix="/api/unidades", tags=["unidades"])

@router.post("/", response_model=dict)
async def crear_unidad(unidad: UnidadCreate):
    """Endpoint para crear una nueva unidad"""
    result = await unidad_service.crear_unidad(unidad)
    
    if not result["success"]:
        raise HTTPException(
            status_code=400, 
            detail=result["mensaje"]
        )
    
    return result

@router.get("/", response_model=dict)
async def listar_unidades():
    """Endpoint para listar todas las unidades"""
    unidades = await unidad_service.obtener_unidades()
    
    return {
        "success": True,
        "total": len(unidades),
        "unidades": unidades
    }

@router.get("/activas", response_model=dict)
async def listar_unidades_activas():
    """Endpoint para listar unidades activas"""
    unidades = await unidad_service.obtener_unidades_activas()
    
    return {
        "success": True,
        "total": len(unidades),
        "unidades": unidades
    }

from bson import ObjectId
from ..models.unidades import UnidadCreate

@router.put("/{unidad_id}")
async def actualizar_unidad(unidad_id: str, datos_actualizacion: dict):
    """Endpoint para actualizar una unidad"""
    success = await unidad_service.actualizar_unidad(unidad_id, datos_actualizacion)
    
    if not success:
        raise HTTPException(
            status_code=404, 
            detail="Unidad no encontrada"
        )
    
    return {
        "success": True,
        "mensaje": "Unidad actualizada correctamente"
    }

@router.delete("/{unidad_id}")
async def eliminar_unidad(unidad_id: str):
    """Endpoint para eliminar una unidad"""
    success = await unidad_service.eliminar_unidad(unidad_id)
    
    if not success:
        raise HTTPException(
            status_code=404, 
            detail="Unidad no encontrada"
        )
    
    return {
        "success": True,
        "mensaje": "Unidad eliminada correctamente"
    }

@router.get("/{unidad_id}")
async def obtener_unidad(unidad_id: str):
    """Endpoint para obtener una unidad específica"""
    unidad = await unidad_service.obtener_unidad_por_id(unidad_id)
    
    if not unidad:
        raise HTTPException(
            status_code=404, 
            detail="Unidad no encontrada"
        )
    
    return {
        "success": True,
        "unidad": unidad
    }