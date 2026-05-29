from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from backend.services.recarga_service import recarga_service
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/recargas", tags=["recargas"])

class RecargaRequest(BaseModel):
    clabe: str
    monto: float = 50.00

class RecargaResponse(BaseModel):
    exito: bool
    mensaje: str
    saldo_anterior: float
    saldo_nuevo: float
    usuario: dict = None

@router.post("/procesar-recarga-automatica", response_model=RecargaResponse)
async def procesar_recarga_automatica(recarga: RecargaRequest):
    """
    Procesar recarga automática cuando se copia la CLABE
    """
    try:
        logger.info(f"Procesando recarga automática para CLABE: {recarga.clabe}")
        
        resultado = await recarga_service.procesar_recarga_automatica(
            recarga.clabe, 
            recarga.monto
        )
        
        return RecargaResponse(**resultado)
        
    except Exception as e:
        logger.error(f"Error en recarga automática: {e}")
        raise HTTPException(
            status_code=500,
            detail="Error interno del servidor"
        )