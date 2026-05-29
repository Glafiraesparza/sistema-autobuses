from datetime import datetime
from backend.database.mongodb import mongodb
from backend.services.email_service import email_service
import logging
import asyncio

logger = logging.getLogger(__name__)

class RecargaService:
    def __init__(self):
        self.collection = None

    async def _get_collection(self):
        if self.collection is None:
            self.collection = mongodb.database.usuario
        return self.collection

    async def procesar_recarga_automatica(self, clabe: str, monto: float = 50.00) -> dict:
        """
        Procesar recarga automática cuando se copia la CLABE
        """
        try:
            collection = await self._get_collection()
            
            # Buscar usuario por CLABE
            usuario = await collection.find_one({"clabe_recarga": clabe})
            
            if not usuario:
                return {
                    "exito": False,
                    "mensaje": "CLABE no encontrada en el sistema",
                    "saldo_anterior": 0,
                    "saldo_nuevo": 0
                }

            # Calcular nuevo saldo
            saldo_anterior = usuario.get('saldo', 0)
            saldo_nuevo = saldo_anterior + monto

            # Actualizar saldo en la base de datos
            result = await collection.update_one(
                {"clabe_recarga": clabe},
                {"$set": {
                    "saldo": saldo_nuevo,
                    "fecha_ultima_recarga": datetime.utcnow()
                }}
            )

            if result.modified_count > 0:
                # Registrar transacción
                await self._registrar_transaccion(usuario, monto, saldo_anterior, saldo_nuevo)
                
                # Enviar correo de confirmación (en segundo plano)
                asyncio.create_task(
                    self._enviar_correo_recarga(
                        usuario['email'],
                        usuario['nombre'],
                        monto,
                        saldo_nuevo
                    )
                )

                logger.info(f"✅ Recarga exitosa: {usuario['email']} - ${monto} - Saldo: ${saldo_nuevo}")

                return {
                    "exito": True,
                    "mensaje": f"Recarga exitosa de ${monto:.2f} MXN",
                    "saldo_anterior": saldo_anterior,
                    "saldo_nuevo": saldo_nuevo,
                    "usuario": {
                        "id_usuario": usuario['id_usuario'],
                        "nombre": usuario['nombre'],
                        "email": usuario['email']
                    }
                }
            else:
                return {
                    "exito": False,
                    "mensaje": "Error al actualizar el saldo",
                    "saldo_anterior": saldo_anterior,
                    "saldo_nuevo": saldo_anterior
                }

        except Exception as e:
            logger.error(f"Error procesando recarga automática: {e}")
            return {
                "exito": False,
                "mensaje": "Error interno del servidor",
                "saldo_anterior": 0,
                "saldo_nuevo": 0
            }

    async def _registrar_transaccion(self, usuario: dict, monto: float, saldo_anterior: float, saldo_nuevo: float):
        """
        Registrar transacción en la base de datos
        """
        try:
            transaccion = {
                "id_usuario": usuario['id_usuario'],
                "tipo": "recarga",
                "monto": monto,
                "saldo_anterior": saldo_anterior,
                "saldo_nuevo": saldo_nuevo,
                "fecha": datetime.utcnow(),
                "descripcion": f"Recarga automática por copia de CLABE",
                "estado": "completada"
            }

            # Insertar en colección de transacciones
            transacciones_collection = mongodb.database.transacciones
            await transacciones_collection.insert_one(transaccion)

            logger.info(f"📝 Transacción registrada para usuario: {usuario['email']}")

        except Exception as e:
            logger.error(f"Error registrando transacción: {e}")

    async def _enviar_correo_recarga(self, email: str, nombre: str, monto: float, nuevo_saldo: float):
        """
        Enviar correo de confirmación de recarga
        """
        try:
            await email_service.enviar_correo_recarga(email, nombre, monto, nuevo_saldo)
        except Exception as e:
            logger.error(f"Error enviando correo de recarga: {e}")

# Instancia global del servicio
recarga_service = RecargaService()