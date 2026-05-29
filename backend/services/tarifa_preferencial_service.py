from datetime import datetime, timedelta
from backend.database.mongodb import mongodb
from backend.models.usuario import SolicitudTarifaPreferencial, SolicitudResponse, TipoDiscapacidad, TipoDocumento
import logging
import secrets
import string

logger = logging.getLogger(__name__)

class TarifaPreferencialService:
    def __init__(self):
        self.collection_solicitudes = None
        self.collection_usuarios = None

    async def _get_collections(self):
        if self.collection_solicitudes is None:
            self.collection_solicitudes = mongodb.database.solicitudes_tarifa
        if self.collection_usuarios is None:
            self.collection_usuarios = mongodb.database.usuario
        return self.collection_solicitudes, self.collection_usuarios

    def _generar_id_solicitud(self) -> str:
        """Generar ID único para la solicitud"""
        caracteres = string.ascii_uppercase + string.digits
        return 'SOL-' + ''.join(secrets.choice(caracteres) for _ in range(8))

    def _calcular_edad(self, fecha_nacimiento: str) -> int:
        """Calcular edad a partir de la fecha de nacimiento"""
        try:
            fecha_nac = datetime.strptime(fecha_nacimiento, '%Y-%m-%d')
            hoy = datetime.utcnow()
            edad = hoy.year - fecha_nac.year - ((hoy.month, hoy.day) < (fecha_nac.month, fecha_nac.day))
            return edad
        except Exception as e:
            logger.error(f"Error calculando edad: {e}")
            return 0

    def _determinar_tipo_usuario(self, es_adulto_mayor: bool, tiene_discapacidad: bool) -> str:
        """Determinar el tipo de usuario basado en las condiciones"""
        if tiene_discapacidad:
            return "discapacitado"
        elif es_adulto_mayor:
            return "adulto_mayor"
        else:
            return "normal"

    def _calcular_tarifa_preferencial(self, tipo_usuario: str) -> float:
        """Calcular tarifa según tipo de usuario"""
        tarifas = {
            "discapacitado": 5.50,
            "adulto_mayor": 5.50,
            "normal": 11.00
        }
        return tarifas.get(tipo_usuario, 11.00)

    async def procesar_solicitud(self, solicitud: SolicitudTarifaPreferencial) -> SolicitudResponse:
        """
        Procesar solicitud de tarifa preferencial
        """
        try:
            collection_solicitudes, collection_usuarios = await self._get_collections()

            # Verificar si el usuario existe
            usuario = await collection_usuarios.find_one({"id_usuario": solicitud.id_usuario})
            if not usuario:
                return SolicitudResponse(
                    id_solicitud="",
                    mensaje="❌ Usuario no encontrado",
                    exito=False
                )

            # Validar edad para adulto mayor (mínimo 60 años)
            edad = self._calcular_edad(solicitud.fecha_nacimiento)
            if solicitud.es_adulto_mayor and edad < 60:
                return SolicitudResponse(
                    id_solicitud="",
                    mensaje="❌ Debes tener al menos 60 años para solicitar tarifa de adulto mayor",
                    exito=False
                )

            # Determinar tipo de usuario final
            tipo_usuario = self._determinar_tipo_usuario(
                solicitud.es_adulto_mayor, 
                solicitud.tiene_discapacidad
            )

            # Calcular nueva tarifa
            nueva_tarifa = self._calcular_tarifa_preferencial(tipo_usuario)

            # Generar ID de solicitud
            id_solicitud = self._generar_id_solicitud()

            # Crear documento de solicitud
            solicitud_dict = {
                "id_solicitud": id_solicitud,
                "id_usuario": solicitud.id_usuario,
                "nombre_completo": solicitud.nombre_completo,
                "email": solicitud.email,
                "fecha_nacimiento": solicitud.fecha_nacimiento,
                "edad": edad,
                "es_adulto_mayor": solicitud.es_adulto_mayor,
                "tiene_discapacidad": solicitud.tiene_discapacidad,
                "tipo_discapacidad": solicitud.tipo_discapacidad.value if solicitud.tipo_discapacidad else None,
                "requiere_silla_ruedas": solicitud.requiere_silla_ruedas,
                "tipo_documento": solicitud.tipo_documento.value,
                "documento_identificacion": solicitud.documento_identificacion,  # Base64
                "tipo_usuario_solicitado": tipo_usuario,
                "tarifa_solicitada": nueva_tarifa,
                "fecha_solicitud": datetime.utcnow(),
                "estado": "pendiente",
                "fecha_validacion": None,
                "validado_por": None,
                "observaciones": None
            }

            # Insertar solicitud en la base de datos
            await collection_solicitudes.insert_one(solicitud_dict)

            logger.info(f"📝 Solicitud creada: {id_solicitud} - Usuario: {solicitud.email} - Tipo: {tipo_usuario}")

            # Simular validación automática (en producción esto sería manual)
            await self._simular_validacion_automatica(id_solicitud, solicitud.id_usuario)

            return SolicitudResponse(
                id_solicitud=id_solicitud,
                mensaje="✅ Solicitud recibida correctamente. Será validada en breve.",
                exito=True,
                tipo_usuario_actualizado=tipo_usuario,
                tarifa_actualizada=nueva_tarifa
            )

        except Exception as e:
            logger.error(f"Error procesando solicitud: {e}")
            return SolicitudResponse(
                id_solicitud="",
                mensaje="❌ Error interno del servidor",
                exito=False
            )

    async def _simular_validacion_automatica(self, id_solicitud: str, id_usuario: int):
        """
        Simular validación automática (en producción sería manual por administrador)
        """
        try:
            collection_solicitudes, collection_usuarios = await self._get_collections()

            # Esperar 5 segundos (simulación de validación)
            import asyncio
            await asyncio.sleep(5)

            # Obtener solicitud
            solicitud = await collection_solicitudes.find_one({"id_solicitud": id_solicitud})
            if not solicitud:
                return

            # Aprobar automáticamente (en producción esto sería con revisión manual)
            await collection_solicitudes.update_one(
                {"id_solicitud": id_solicitud},
                {"$set": {
                    "estado": "aprobada",
                    "fecha_validacion": datetime.utcnow(),
                    "validado_por": "sistema_automatico",
                    "observaciones": "Validación automática exitosa"
                }}
            )

            # Actualizar usuario con nueva tarifa y tipo
            await collection_usuarios.update_one(
                {"id_usuario": id_usuario},
                {"$set": {
                    "tipo": solicitud["tipo_usuario_solicitado"],
                    "tarifa_actual": solicitud["tarifa_solicitada"]
                }}
            )

            logger.info(f"✅ Validación automática completada: {id_solicitud}")

        except Exception as e:
            logger.error(f"Error en validación automática: {e}")

    async def obtener_solicitudes_pendientes(self):
        """Obtener solicitudes pendientes (para panel admin)"""
        try:
            collection_solicitudes, _ = await self._get_collections()
            solicitudes = await collection_solicitudes.find({"estado": "pendiente"}).to_list(length=100)
            return solicitudes
        except Exception as e:
            logger.error(f"Error obteniendo solicitudes: {e}")
            return []

    async def obtener_solicitud_por_id(self, id_solicitud: str):
        """Obtener solicitud por ID"""
        try:
            collection_solicitudes, _ = await self._get_collections()
            return await collection_solicitudes.find_one({"id_solicitud": id_solicitud})
        except Exception as e:
            logger.error(f"Error obteniendo solicitud: {e}")
            return None

# Instancia global del servicio
tarifa_preferencial_service = TarifaPreferencialService()