from backend.database.mongodb import get_notificaciones_collection, get_usuarios_personal_collection
from backend.models.notificacion import NotificacionCreate, TipoNotificacion
from datetime import datetime
from typing import List, Optional

class NotificacionService:
    def __init__(self):
        self._collection = None
        self._personal_collection = None

    @property
    def collection(self):
        if self._collection is None:
            self._collection = get_notificaciones_collection()
        return self._collection

    @property
    def personal_collection(self):
        if self._personal_collection is None:
            self._personal_collection = get_usuarios_personal_collection()
        return self._personal_collection

    async def crear_notificacion(self, notificacion_data: NotificacionCreate) -> dict:
        """Crear una nueva notificación"""
        try:
            # Verificar si es chofer válido (si se proporciona id_chofer)
            if notificacion_data.id_chofer:
                try:
                    # Buscar directamente en la colección de personal
                    chofer = await self.personal_collection.find_one({
                        "id_personal": notificacion_data.id_chofer,
                        "rol": "chofer"
                    })
                    
                    if not chofer:
                        # Si no es chofer válido, usar id_personal en su lugar
                        notificacion_data.id_personal = notificacion_data.id_chofer
                        notificacion_data.id_chofer = None
                except Exception as e:
                    print(f"⚠️ Error verificando chofer: {e}")
                    # Continuar sin verificación en caso de error

            # Generar ID único
            ultima_notificacion = await self.collection.find_one(
                {}, sort=[("id_notificacion", -1)]
            )
            nuevo_id = ultima_notificacion["id_notificacion"] + 1 if ultima_notificacion else 1

            # Usar hora actual
            hora_actual = datetime.now()

            notificacion = {
                "id_notificacion": nuevo_id,
                "tipo": notificacion_data.tipo,
                "titulo": notificacion_data.titulo,
                "mensaje": notificacion_data.mensaje,
                "ruta_afectada": notificacion_data.ruta_afectada,
                "tiempo_estimado": notificacion_data.tiempo_estimado,
                "timestamp": hora_actual,
                "leida": False,
                "id_chofer": notificacion_data.id_chofer,
                "id_personal": getattr(notificacion_data, 'id_personal', None),
                # NUEVO: Inicializar listas vacías para eliminaciones
                "usuarios_eliminada": [],
                "personal_eliminada": []
            }

            # Remover campos None
            notificacion = {k: v for k, v in notificacion.items() if v is not None}

            result = await self.collection.insert_one(notificacion)
            
            # Convertir ObjectId a string para la respuesta
            notificacion_responder = notificacion.copy()
            notificacion_responder["_id"] = str(result.inserted_id)
            
            return notificacion_responder
            
        except Exception as e:
            print(f"❌ Error en crear_notificacion: {e}")
            raise e

    async def obtener_notificaciones_usuario(self, id_usuario: int = None) -> List[dict]:
        """Obtener notificaciones para un usuario, excluyendo las eliminadas"""
        try:
            # ✅ CORREGIDO: Query que SÍ excluye las notificaciones eliminadas
            query = {
                "$or": [
                    {"id_usuario": id_usuario},
                    {"id_usuario": None}  # Notificaciones generales
                ],
                "usuarios_eliminada": {"$ne": id_usuario}  # ✅ EXCLUIR LAS QUE EL USUARIO ELIMINÓ
            }

            print(f"🔍 Query para usuario {id_usuario}: {query}")
            
            notificaciones = await self.collection.find(query).sort("timestamp", -1).to_list(length=50)
            
            print(f"✅ Notificaciones encontradas para usuario {id_usuario}: {len(notificaciones)}")
            
            # Convertir ObjectId y formatear timestamp
            for notif in notificaciones:
                notif["_id"] = str(notif["_id"])
                if isinstance(notif["timestamp"], datetime):
                    notif["timestamp_formateado"] = notif["timestamp"].strftime("%H:%M")
                else:
                    try:
                        timestamp_dt = datetime.fromisoformat(notif["timestamp"].replace('Z', '+00:00'))
                        notif["timestamp_formateado"] = timestamp_dt.strftime("%H:%M")
                    except:
                        notif["timestamp_formateado"] = "Ahora"
            return notificaciones
        except Exception as e:
            print(f"❌ Error en obtener_notificaciones_usuario: {e}")
            return []

    
    async def obtener_notificaciones_generales(self) -> List[dict]:
        """Obtener notificaciones generales"""
        return await self.obtener_notificaciones_usuario(None)

    async def marcar_como_leida(self, id_notificacion: int) -> bool:
        """Marcar una notificación como leída"""
        try:
            result = await self.collection.update_one(
                {"id_notificacion": id_notificacion},
                {"$set": {"leida": True}}
            )
            return result.modified_count > 0
        except Exception as e:
            print(f"❌ Error en marcar_como_leida: {e}")
            return False

    # ✅ NUEVO: Método para eliminar notificación para usuario
    async def eliminar_notificacion_usuario(self, id_notificacion: int, id_usuario: int) -> bool:
        """Marcar notificación como eliminada para un usuario específico"""
        try:
            result = await self.collection.update_one(
                {"id_notificacion": id_notificacion},
                {"$addToSet": {"usuarios_eliminada": id_usuario}}
            )
            return result.modified_count > 0
        except Exception as e:
            print(f"❌ Error en eliminar_notificacion_usuario: {e}")
            return False

    # ✅ NUEVO: Método para eliminar notificación para personal
    async def eliminar_notificacion_personal(self, id_notificacion: int, id_personal: int) -> bool:
        """Marcar notificación como eliminada para un miembro del personal"""
        try:
            result = await self.collection.update_one(
                {"id_notificacion": id_notificacion},
                {"$addToSet": {"personal_eliminada": id_personal}}
            )
            return result.modified_count > 0
        except Exception as e:
            print(f"❌ Error en eliminar_notificacion_personal: {e}")
            return False

    async def obtener_notificaciones_administrador(self, id_personal: int = None) -> List[dict]:
        """Obtener todas las notificaciones para el panel administrativo"""
        try:
            # Si se proporciona id_personal, excluir las que eliminó
            if id_personal:
                query = {"personal_eliminada": {"$ne": id_personal}}
            else:
                query = {}
                
            notificaciones = await self.collection.find(query).sort("timestamp", -1).to_list(length=100)
            
            # Convertir ObjectId y formatear timestamp
            for notif in notificaciones:
                notif["_id"] = str(notif["_id"])
                if isinstance(notif["timestamp"], datetime):
                    notif["timestamp_formateado"] = notif["timestamp"].strftime("%H:%M")
                else:
                    try:
                        timestamp_dt = datetime.fromisoformat(notif["timestamp"].replace('Z', '+00:00'))
                        notif["timestamp_formateado"] = timestamp_dt.strftime("%H:%M")
                    except:
                        notif["timestamp_formateado"] = "Ahora"
            
            return notificaciones
        except Exception as e:
            print(f"❌ Error en obtener_notificaciones_administrador: {e}")
            return []

    async def crear_notificacion_retraso(self, ruta: str, tiempo_estimado: int, motivo: str, id_chofer: int = None):
        """Crear notificación de retraso"""
        try:
            hora_actual = datetime.now().strftime("%H:%M")

            return await self.crear_notificacion(NotificacionCreate(
                tipo=TipoNotificacion.RETRASO,
                titulo=f"Retraso en Ruta {ruta}",
                mensaje=f"⏰ {hora_actual} - La ruta {ruta} presenta retraso de {tiempo_estimado} minutos. Motivo: {motivo}",
                ruta_afectada=ruta,
                tiempo_estimado=tiempo_estimado,
                id_chofer=id_chofer
            ))
        except Exception as e:
            print(f"❌ Error en crear_notificacion_retraso: {e}")
            raise e

    async def crear_notificacion_emergencia(self, ruta: str, tipo_incidente: str, id_chofer: int = None, tipo: str = None):
        """Crear notificación de emergencia o asistencia"""
        try:
            # ✅ DETERMINAR TIPO: Usar el tipo del frontend o determinar por contenido
            if tipo:  # Si el frontend envió el tipo
                tipo_final = TipoNotificacion(tipo)  # Convertir a Enum
            elif "Falla Mecánica" in tipo_incidente:
                tipo_final = TipoNotificacion.ASISTENCIA
            else:
                tipo_final = TipoNotificacion.EMERGENCIA
            
            # Extraer solo la parte del incidente (antes del "-")
            incidente_limpio = tipo_incidente.split(' - ')[0] if ' - ' in tipo_incidente else tipo_incidente

            hora_actual = datetime.now().strftime("%H:%M")

            # Crear mensaje según el tipo
            if tipo_final == TipoNotificacion.ASISTENCIA:
                titulo = f"Asistencia en Ruta {ruta}"
                mensaje = f"🔧 {hora_actual} - La ruta {ruta} requiere asistencia técnica: {incidente_limpio}. Se ha solicitado soporte."
            else:
                titulo = f"Emergencia en Ruta {ruta}"
                mensaje = f"🚨 {hora_actual} - La ruta {ruta} presenta una emergencia: {incidente_limpio}. Se ha solicitado asistencia."

            return await self.crear_notificacion(NotificacionCreate(
                tipo=tipo_final,  # ✅ Esto será ASISTENCIA o EMERGENCIA
                titulo=titulo,
                mensaje=mensaje,
                ruta_afectada=ruta,
                id_chofer=id_chofer
            ))
        except Exception as e:
            print(f"❌ Error en crear_notificacion_emergencia: {e}")
            raise e

# Instancia global
notificacion_service = NotificacionService()