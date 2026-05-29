from fastapi import APIRouter, HTTPException, status
from backend.models.usuario import RecuperacionSolicitud, RecuperacionVerificacion, RecuperacionResponse
from backend.services.password_service import password_service
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/password", tags=["recuperacion-password"])

@router.post("/solicitar-recuperacion", response_model=RecuperacionResponse)
async def solicitar_recuperacion(solicitud: RecuperacionSolicitud):
    """
    Solicitar recuperación de contraseña
    """
    try:
        logger.info(f"Solicitud de recuperación para: {solicitud.email}")
        
        exito = await password_service.solicitar_recuperacion(solicitud.email)
        
        if exito:
            return RecuperacionResponse(
                mensaje="✅ Se ha enviado un código de recuperación a tu correo electrónico",
                exito=True
            )
        else:
            return RecuperacionResponse(
                mensaje="❌ El correo electrónico no está registrado en el sistema",
                exito=False
            )
            
    except Exception as e:
        logger.error(f"Error en solicitud de recuperación: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error interno del servidor"
        )

@router.post("/verificar-codigo", response_model=RecuperacionResponse)
async def verificar_codigo_recuperacion(verificacion: RecuperacionVerificacion):
    """
    Verificar código de recuperación y restablecer contraseña
    """
    try:
        logger.info(f"Verificando código para: {verificacion.email}")
        
        # Verificar y restablecer contraseña
        exito = await password_service.restablecer_password(
            verificacion.email,
            verificacion.codigo_recuperacion,
            verificacion.nueva_password
        )
        
        if exito:
            return RecuperacionResponse(
                mensaje="✅ Contraseña restablecida exitosamente. Ya puedes iniciar sesión con tu nueva contraseña",
                exito=True
            )
        else:
            # ✅ AGREGUE 19/11/2025 Tomás - Verificar si el error es por contraseña igual
            # Para esto necesitamos una forma de detectar este error específico
            # Podemos hacer una verificación adicional aquí
            from backend.services.usuario_service import usuario_service
            
            usuario = await usuario_service.obtener_usuario_por_email(verificacion.email)
            if usuario and usuario.password_hash:
                from backend.services.usuario_service import pwd_context
                if pwd_context.verify(verificacion.nueva_password, usuario.password_hash):
                    return RecuperacionResponse(
                        mensaje="❌ La nueva contraseña no puede ser igual a la contraseña actual",
                        exito=False
                    )
            
            return RecuperacionResponse(
                mensaje="❌ Código de recuperación inválido o expirado",
                exito=False
            )
            
    except Exception as e:
        logger.error(f"Error en verificación de código: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error interno del servidor"
        )

