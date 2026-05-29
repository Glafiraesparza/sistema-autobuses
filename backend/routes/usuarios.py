from fastapi import APIRouter, HTTPException, status
from backend.models.usuario import UsuarioCreate, UsuarioResponse,UsuarioLogin,LoginResponse,VerificacionRequest
from backend.services.usuario_service import usuario_service
##Agregue 16/11/2025 Tomás Inicio
from typing import List
from bson import ObjectId
import logging

logger = logging.getLogger(__name__)
##Agregue 16/11/2025 Tomás Fin

router = APIRouter(prefix="/api/usuarios", tags=["usuarios"])
#Modifique 19/11/2025 Tomás Inicio
@router.post("/registro", response_model=UsuarioResponse, status_code=status.HTTP_201_CREATED)
async def registrar_usuario(usuario: UsuarioCreate):
    """
    Registrar nuevo usuario en el sistema
    """
    try:
        usuario_creado = await usuario_service.crear_usuario(usuario)
        return usuario_creado
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error en registro: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error interno del servidor"
        )


#Modifique 19/11/2025 Tomás Fin
@router.get("/email/{email}", response_model=UsuarioResponse)
async def obtener_usuario_por_email(email: str):
    """
    Obtener información de usuario por email
    """
    usuario = await usuario_service.obtener_usuario_por_email(email)
    if not usuario:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado"
        )
    return usuario

@router.get("/{id_usuario}", response_model=UsuarioResponse)
async def obtener_usuario_por_id(id_usuario: int):
    """
    Obtener información de usuario por ID
    """
    usuario = await usuario_service.obtener_usuario_por_id(id_usuario)
    if not usuario:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado"
        )
    return usuario
#Agregue 19/11/2025 Tomás Inicio
@router.post("/verificar-codigo")
async def verificar_codigo(verificacion_data: VerificacionRequest):
    """
    Endpoint separado para verificar código (útil para el frontend)
    """
    try:
        logger.info(f"Verificando código para: {verificacion_data.email}")
        
        # Verificar credenciales básicas primero
        usuario = await usuario_service.obtener_usuario_por_email(verificacion_data.email)
        if not usuario:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Usuario no encontrado"
            )
        
        # Verificar código de verificación
        codigo_valido = await usuario_service.verificar_codigo_verificacion(
            verificacion_data.email, 
            verificacion_data.codigo_verificacion
        )
        
        logger.info(f"Código válido: {codigo_valido}")
        
        if not codigo_valido:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Código de verificación inválido o expirado"
            )
        
        # Marcar verificación como completada
        await usuario_service.marcar_verificacion_completada(verificacion_data.email)
        
        return {"message": "✅ Verificación exitosa. Ya puedes iniciar sesión."}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error en verificación: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error interno del servidor"
        )
#Agregue 19/11/2025 Tomás Fin
#Modifique 19/11/2025 Tomás Inicio
@router.post("/login", response_model=LoginResponse)
async def login_usuario(login_data: UsuarioLogin):
    """
    Iniciar sesión de usuario con verificación en dos pasos para primer inicio
    """
    try:
        logger.info(f"🔐 Intento de login para: {login_data.email}")
        
        # Verificar credenciales básicas
        credenciales_validas = await usuario_service.verificar_credenciales(
            login_data.email, 
            login_data.password
        )
        
        logger.info(f"Credenciales válidas: {credenciales_validas}")
        
        if not credenciales_validas:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Email o contraseña incorrectos"
            )
        
        # Obtener información del usuario
        usuario = await usuario_service.obtener_usuario_por_email(login_data.email)
        
        if not usuario:
            logger.error(f"Usuario no encontrado después de verificar credenciales: {login_data.email}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Usuario no encontrado"
            )
        
        logger.info(f"Usuario encontrado: {usuario.email}, primer_inicio: {getattr(usuario, 'primer_inicio', 'NO DEFINIDO')}")
        
        # Verificar si es primer inicio de sesión
        if getattr(usuario, 'primer_inicio', True):
            logger.info("Es primer inicio de sesión, verificando código...")
            
            # Si es primer inicio, verificar el código - usar getattr para seguridad
            codigo_proporcionado = getattr(login_data, 'codigo_verificacion', None)
            if not codigo_proporcionado:
                logger.warning("Código de verificación no proporcionado para primer inicio")
                # Retornar que requiere verificación en lugar de error
                return LoginResponse(
                    access_token="",
                    token_type="bearer",
                    usuario=UsuarioResponse(
                        id_usuario=usuario.id_usuario,
                        nombre=usuario.nombre,
                        email=usuario.email,
                        tipo=usuario.tipo,
                        saldo=usuario.saldo,
                        clabe_recarga=usuario.clabe_recarga,
                        tarifa_actual=usuario.tarifa_actual,
                        rutas_favoritas=usuario.rutas_favoritas,
                        fecha_creacion=usuario.fecha_creacion,
                        fecha_ultimo_acceso=usuario.fecha_ultimo_acceso,
                        primer_inicio=getattr(usuario, 'primer_inicio', True)
                    ),
                    requiere_verificacion=True
                )
            
            # Verificar código de verificación
            codigo_valido = await usuario_service.verificar_codigo_verificacion(
                login_data.email, 
                codigo_proporcionado
            )
            
            logger.info(f"Código de verificación válido: {codigo_valido}")
            
            if not codigo_valido:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Código de verificación inválido o expirado"
                )
            
            # Marcar verificación como completada
            await usuario_service.marcar_verificacion_completada(login_data.email)
            logger.info("Verificación completada exitosamente")
            
        else:
            logger.info("No es primer inicio, actualizando último acceso")
            # No es primer inicio, actualizar último acceso normalmente
            await usuario_service.actualizar_ultimo_acceso(login_data.email)
        
        # Por ahora retornamos un token simple (en producción usar JWT)
        fake_token = f"fake_token_{usuario.id_usuario}_{login_data.email}"
        
        # Crear respuesta de usuario sin datos sensibles
        usuario_response = UsuarioResponse(
            id_usuario=usuario.id_usuario,
            nombre=usuario.nombre,
            email=usuario.email,
            tipo=usuario.tipo,
            saldo=usuario.saldo,
            clabe_recarga=usuario.clabe_recarga,
            tarifa_actual=usuario.tarifa_actual,
            rutas_favoritas=usuario.rutas_favoritas,
            fecha_creacion=usuario.fecha_creacion,
            fecha_ultimo_acceso=usuario.fecha_ultimo_acceso,
            primer_inicio=getattr(usuario, 'primer_inicio', False)
        )
        
        return LoginResponse(
            access_token=fake_token,
            token_type="bearer",
            usuario=usuario_response,
            requiere_verificacion=False
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error interno en login: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error interno del servidor: {str(e)}"
        )
#Modifique 19/11/2025 Tomás Fin
##Agregue 16/11/2025 Tomás Inicio
@router.put("/{id_usuario}/rutas-favoritas", response_model=UsuarioResponse)
async def actualizar_rutas_favoritas(id_usuario: int, rutas_favoritas: List[str]):
    """
    Actualizar la lista de rutas favoritas de un usuario
    """
    try:
        collection = await usuario_service._get_collection()
        
        # Actualizar las rutas favoritas del usuario
        result = await collection.update_one(
            {"id_usuario": id_usuario},
            {"$set": {"rutas_favoritas": [{"nombre": ruta} for ruta in rutas_favoritas]}}
        )
        
        if result.modified_count == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Usuario no encontrado"
            )
        
        # Obtener el usuario actualizado
        usuario_actualizado = await collection.find_one({"id_usuario": id_usuario})
        return UsuarioResponse(**usuario_actualizado)
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error interno del servidor"
        )

@router.get("/{id_usuario}/rutas-favoritas", response_model=List[str])
async def obtener_rutas_favoritas(id_usuario: int):
    """
    Obtener la lista de nombres de rutas favoritas de un usuario
    """
    try:
        collection = await usuario_service._get_collection()
        usuario = await collection.find_one({"id_usuario": id_usuario})
        
        if not usuario:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Usuario no encontrado"
            )
        
        # Extraer solo los nombres de las rutas favoritas
        rutas_favoritas = [ruta["nombre"] for ruta in usuario.get("rutas_favoritas", [])]
        return rutas_favoritas
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error interno del servidor"
        )
##Agregue 16/11/2025 Tomás Fin

# Agregue 19/11/2025 Tomás Inicio - Endpoint para reenviar código de verificación
@router.post("/reenviar-codigo-verificacion")
async def reenviar_codigo_verificacion(email_data: dict):
    """
    Reenviar código de verificación para primer inicio de sesión
    """
    try:
        email = email_data.get('email')
        if not email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email es requerido"
            )

        logger.info(f"Solicitando reenvío de código para: {email}")
        
        # Reenviar código
        exito = await usuario_service.reenviar_codigo_verificacion(email)
        
        if exito:
            return {
                "mensaje": "✅ Se ha enviado un nuevo código de verificación a tu correo electrónico",
                "exito": True
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No se pudo reenviar el código. Verifica que el email sea correcto y que aún no hayas completado tu primer inicio de sesión."
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error reenviando código de verificación: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error interno del servidor"
        )
# Agregue 19/11/2025 Tomás Fin - Endpoint para reenviar código de verificación