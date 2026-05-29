from fastapi import APIRouter, HTTPException
from backend.models.ruta import RutaResponse
from backend.services.ruta_service import ruta_service

router = APIRouter(prefix="/api/rutas", tags=["rutas"])

@router.get("/", response_model=list[RutaResponse])
async def obtener_todas_rutas():
    """Obtener listado completo de rutas para los botones"""
    return await ruta_service.obtener_todas_rutas()

@router.get("/{nombre}", response_model=RutaResponse)
async def obtener_ruta_por_nombre(nombre: str):
    """Obtener una ruta específica por nombre"""
    return await ruta_service.obtener_ruta_por_nombre(nombre)