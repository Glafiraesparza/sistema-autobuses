from fastapi import APIRouter, HTTPException
from datetime import datetime
from backend.models.qr_pago import QRGenerarRequest, QRValidarRequest
from backend.services.qr_service import QRService

router = APIRouter(prefix="/api/qr", tags=["QR Pagos"])

@router.post("/generar")
async def generar_qr(request: QRGenerarRequest):
    """Genera un nuevo QR para pago"""
    try:
        # ✅ NUEVO: Verificar cooldown para usuarios no normales
        cooldown_check = await QRService.verificar_cooldown(request.id_usuario)
        if cooldown_check["cooldown"]:
            raise HTTPException(status_code=429, detail=cooldown_check["mensaje"])
        
        qr_data = await QRService.generar_qr(request.id_usuario)
        return qr_data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al generar QR: {str(e)}")

@router.post("/validar")
async def validar_qr(request: QRValidarRequest):
    """Valida y procesa un QR escaneado"""
    try:
        print(f"🎯 RECIBIDA PETICIÓN PARA VALIDAR QR")
        print(f"🔍 Nonce recibido: '{request.nonce}'")
        
        resultado = await QRService.validar_qr(request.nonce)
        
        print(f"✅ Resultado de validación: {resultado}")
        return resultado
        
    except Exception as e:
        print(f"❌ ERROR en validar_qr: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error al validar QR: {str(e)}")
    
@router.post("/validar_sur")
async def validar_qr_sur(request: QRValidarRequest):
    """Valida y procesa un QR escaneado"""
    try:
        print(f"🎯 RECIBIDA PETICIÓN PARA VALIDAR QR")
        print(f"🔍 Nonce recibido: '{request.nonce}'")
        
        resultado = await QRService.validar_qr_sur(request.nonce)
        
        print(f"✅ Resultado de validación: {resultado}")
        return resultado
        
    except Exception as e:
        print(f"❌ ERROR en validar_qr: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error al validar QR: {str(e)}")

@router.get("/cooldown/{id_usuario}")
async def verificar_cooldown_usuario(id_usuario: int):
    """Verifica el estado de cooldown de un usuario"""
    try:
        resultado = await QRService.verificar_cooldown(id_usuario)
        return resultado
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al verificar cooldown: {str(e)}")

# ✅ NUEVO: Endpoint para verificar estado del QR
@router.get("/status/{nonce}")
async def obtener_estado_qr(nonce: str):
    """Obtiene el estado actual de un QR"""
    try:
        resultado = await QRService.obtener_estado_qr(nonce)
        
        if "error" in resultado:
            raise HTTPException(status_code=404, detail=resultado["error"])
            
        return resultado
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al obtener estado del QR: {str(e)}")
    
    
@router.post("/actualizar-expirados")
async def actualizar_qrs_expirados():
    """Endpoint para actualizar QRs expirados manualmente"""
    try:
        cantidad = await QRService.actualizar_qrs_expirados()
        return {
            "mensaje": f"Se actualizaron {cantidad} QRs a estado expirado",
            "qrs_actualizados": cantidad
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al actualizar QRs expirados: {str(e)}")