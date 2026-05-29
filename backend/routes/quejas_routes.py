from fastapi import APIRouter, Body, HTTPException
from backend.models.queja import QuejaCrear
from backend.services.queja_service import crear_reporte_queja

router = APIRouter()

@router.post("/quejas", response_description="Crear un nuevo reporte o queja")
async def crear_queja(datos: QuejaCrear = Body(...)):
    try:
        response = await crear_reporte_queja(datos)
        return response
    except Exception as e:
        print(f"Error al crear queja: {e}")
        raise HTTPException(status_code=500, detail=str(e))