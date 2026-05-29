from fastapi import APIRouter, HTTPException
from backend.services.transacciones_service import TransaccionService

router = APIRouter(prefix="/api/transacciones", tags=["Transacciones"])

@router.get("/usuario/{id_usuario}")
async def obtener_transacciones_usuario(id_usuario: int):
    """
    Obtener todas las transacciones de tipo 'pago_viaje' de un usuario específico
    Para el historial de viajes del frontend
    """
    try:
        # Siempre filtrar por tipo "pago_viaje" para el historial de viajes
        resultado = await TransaccionService.obtener_transacciones_usuario(id_usuario, "pago_viaje")
        
        if not resultado["success"]:
            raise HTTPException(status_code=400, detail=resultado["detail"])
        
        return resultado
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error interno del servidor: {str(e)}")