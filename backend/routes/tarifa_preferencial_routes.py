from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from backend.models.usuario import SolicitudTarifaPreferencial, SolicitudResponse, ValidacionSolicitud
from backend.services.tarifa_preferencial_service import tarifa_preferencial_service
import logging
import base64

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/tarifa-preferencial", tags=["tarifa-preferencial"])

@router.post("/solicitar", response_model=SolicitudResponse)
async def solicitar_tarifa_preferencial(
    id_usuario: int = Form(...),
    nombre_completo: str = Form(...),
    email: str = Form(...),
    fecha_nacimiento: str = Form(...),
    es_adulto_mayor: bool = Form(...),
    tiene_discapacidad: bool = Form(...),
    tipo_discapacidad: str = Form(None),
    requiere_silla_ruedas: bool = Form(False),
    tipo_documento: str = Form(...),
    documento: UploadFile = File(...)
):
    """
    Solicitar tarifa preferencial (adulto mayor o discapacitado)
    """
    try:
        logger.info(f"Recibiendo solicitud de tarifa preferencial para usuario: {id_usuario}")

        # Validar archivo
        if not documento.content_type.startswith('image/'):
            raise HTTPException(status_code=400, detail="El archivo debe ser una imagen")

        # Leer y codificar imagen en base64
        contenido = await documento.read()
        documento_base64 = base64.b64encode(contenido).decode('utf-8')

        # Crear objeto de solicitud
        solicitud = SolicitudTarifaPreferencial(
            id_usuario=id_usuario,
            nombre_completo=nombre_completo,
            email=email,
            fecha_nacimiento=fecha_nacimiento,
            es_adulto_mayor=es_adulto_mayor,
            tiene_discapacidad=tiene_discapacidad,
            tipo_discapacidad=tipo_discapacidad,
            requiere_silla_ruedas=requiere_silla_ruedas,
            tipo_documento=tipo_documento,
            documento_identificacion=documento_base64
        )

        # Procesar solicitud
        resultado = await tarifa_preferencial_service.procesar_solicitud(solicitud)

        return resultado

    except Exception as e:
        logger.error(f"Error en solicitud de tarifa preferencial: {e}")
        raise HTTPException(status_code=500, detail="Error interno del servidor")

@router.get("/solicitudes-pendientes")
async def obtener_solicitudes_pendientes():
    """
    Obtener solicitudes pendientes (para panel administrativo)
    """
    try:
        solicitudes = await tarifa_preferencial_service.obtener_solicitudes_pendientes()
        return {"solicitudes": solicitudes}
    except Exception as e:
        logger.error(f"Error obteniendo solicitudes: {e}")
        raise HTTPException(status_code=500, detail="Error interno del servidor")

@router.get("/solicitud/{id_solicitud}")
async def obtener_solicitud(id_solicitud: str):
    """
    Obtener solicitud por ID
    """
    try:
        solicitud = await tarifa_preferencial_service.obtener_solicitud_por_id(id_solicitud)
        if not solicitud:
            raise HTTPException(status_code=404, detail="Solicitud no encontrada")
        return solicitud
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error obteniendo solicitud: {e}")
        raise HTTPException(status_code=500, detail="Error interno del servidor")