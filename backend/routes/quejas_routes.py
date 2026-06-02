from fastapi import APIRouter, Body, HTTPException, Query, Request
from backend.database.mongodb import mongodb
from backend.models.queja import QuejaCrear, QuejaUpdate
from backend.services.queja_service import (
    crear_reporte_queja, 
    obtener_todas_quejas,
    actualizar_seguimiento_queja,
    obtener_estadisticas_quejas
)
from typing import Optional
from bson import ObjectId
from datetime import datetime

router = APIRouter()

@router.post("/quejas", response_description="Crear un nuevo reporte o queja")
async def crear_queja(datos: QuejaCrear = Body(...)):
    try:
        response = await crear_reporte_queja(datos)
        return response
    except Exception as e:
        print(f"Error al crear queja: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/quejas/todas", response_description="Obtener todas las quejas (Admin)")
async def get_todas_quejas(
    estado: Optional[str] = Query(None, description="Filtrar por estado"),
    tipo: Optional[str] = Query(None, description="Filtrar por tipo (queja/incidente_trabajador)"),
    limit: int = Query(100, ge=1, le=500),
    skip: int = Query(0, ge=0)
):
    try:
        response = await obtener_todas_quejas(estado, tipo, limit, skip)
        return response
    except Exception as e:
        print(f"Error al obtener quejas: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/quejas/{id_queja}/seguimiento", response_description="Actualizar seguimiento de queja")
async def actualizar_seguimiento(
    id_queja: str,
    request: Request
):
    try:
        # Leer el body como JSON
        body = await request.json()
        print(f"📥 Body recibido: {body}")
        
        estado = body.get("estado")
        notas_admin = body.get("notas_admin", "")
        admin_id = body.get("admin_id", "admin_desconocido")
        
        # Validar que el estado no esté vacío
        if not estado:
            raise HTTPException(status_code=422, detail="El campo 'estado' es requerido")
        
        # Validar que el estado sea válido
        if estado not in ["Pendiente", "En Proceso", "Resuelto"]:
            raise HTTPException(status_code=422, detail=f"Estado inválido: {estado}. Debe ser Pendiente, En Proceso o Resuelto")
        
        print(f"✅ Procesando: id={id_queja}, estado={estado}, notas={notas_admin}, admin={admin_id}")
        
        response = await actualizar_seguimiento_queja(id_queja, estado, notas_admin, admin_id)
        return response
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error al actualizar seguimiento: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/quejas/estadisticas", response_description="Obtener estadísticas de quejas")
async def get_estadisticas():
    try:
        response = await obtener_estadisticas_quejas()
        return response
    except Exception as e:
        print(f"Error al obtener estadísticas: {e}")
        raise HTTPException(status_code=500, detail=str(e))