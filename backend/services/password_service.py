import secrets
import string
from datetime import datetime, timedelta
from backend.database.mongodb import mongodb
from backend.services.email_service import email_service
import logging
import asyncio

logger = logging.getLogger(__name__)

class PasswordService:
    def __init__(self):
        self.collection = None

    async def _get_collection(self):
        if self.collection is None:
            self.collection = mongodb.database.usuario
        return self.collection

    def _generar_codigo_recuperacion(self) -> str:
        """Generar código de recuperación de 8 caracteres alfanuméricos"""
        caracteres = string.ascii_uppercase + string.digits
        return ''.join(secrets.choice(caracteres) for _ in range(8))

    async def solicitar_recuperacion(self, email: str) -> bool:
        """
        Solicitar recuperación de contraseña para un email
        """
        try:
            collection = await self._get_collection()
            
            # Verificar si el email existe
            usuario = await collection.find_one({"email": email})
            if not usuario:
                logger.warning(f"Intento de recuperación para email no registrado: {email}")
                return False

            # Generar código de recuperación
            codigo_recuperacion = self._generar_codigo_recuperacion()
            expiracion = datetime.utcnow() + timedelta(hours=1)  # Válido por 1 hora

            # Guardar código en la base de datos
            await collection.update_one(
                {"email": email},
                {"$set": {
                    "codigo_recuperacion": codigo_recuperacion,
                    "codigo_recuperacion_expiracion": expiracion
                }}
            )

            # Obtener nombre del usuario para el correo personalizado
            nombre_usuario = usuario.get('nombre', 'Usuario')

            # Enviar correo con el código de recuperación
            asyncio.create_task(
                self._enviar_correo_recuperacion(email, nombre_usuario, codigo_recuperacion)
            )

            logger.info(f"Código de recuperación generado para: {email}")
            return True

        except Exception as e:
            logger.error(f"Error en solicitud de recuperación: {e}")
            return False

    async def _enviar_correo_recuperacion(self, email: str, nombre: str, codigo: str):
        """
        Enviar correo de recuperación de contraseña
        """
        try:
            await email_service.enviar_correo_recuperacion(email, nombre, codigo)
        except Exception as e:
            logger.error(f"Error enviando correo de recuperación: {e}")

    async def verificar_codigo_recuperacion(self, email: str, codigo: str) -> bool:
        """
        Verificar código de recuperación
        """
        try:
            collection = await self._get_collection()
            usuario = await collection.find_one({"email": email})
            
            if not usuario:
                return False

            codigo_actual = usuario.get('codigo_recuperacion')
            expiracion = usuario.get('codigo_recuperacion_expiracion')
            
            if not codigo_actual or not expiracion:
                return False

            if datetime.utcnow() > expiracion:
                return False

            return codigo_actual == codigo

        except Exception as e:
            logger.error(f"Error verificando código de recuperación: {e}")
            return False

    async def restablecer_password(self, email: str, codigo: str, nueva_password: str) -> bool:
        """
        Restablecer contraseña con código de verificación
        """
        try:
            from backend.services.usuario_service import pwd_context
            
            collection = await self._get_collection()
            
            # Verificar código primero
            if not await self.verificar_codigo_recuperacion(email, codigo):
                return False

            # Obtener usuario para verificar contraseña actual
            usuario = await collection.find_one({"email": email})
            if not usuario:
                return False

            # ✅ AGREGUE 19/11/2025 Tomás - Verificar que la nueva contraseña no sea igual a la actual
            password_actual_hash = usuario.get('password_hash')
            if password_actual_hash and pwd_context.verify(nueva_password, password_actual_hash):
                logger.warning(f"Intento de usar misma contraseña para: {email}")
                return False

            # Hashear nueva contraseña
            password_hash = pwd_context.hash(nueva_password)

            # Actualizar contraseña y limpiar código de recuperación
            result = await collection.update_one(
                {"email": email},
                {"$set": {
                    "password_hash": password_hash
                }, "$unset": {
                    "codigo_recuperacion": "",
                    "codigo_recuperacion_expiracion": ""
                }}
            )

            return result.modified_count > 0

        except Exception as e:
            logger.error(f"Error restableciendo password: {e}")
            return False
# Instancia global del servicio
password_service = PasswordService()