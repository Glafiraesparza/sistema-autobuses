### PASAJEROS
from passlib.context import CryptContext
from datetime import datetime,timedelta
import random
import re
from backend.database.mongodb import mongodb
from backend.services.email_service import email_service
#Agregue 19/11/2025 Inicio
from backend.models.usuario import UsuarioCreate, UsuarioResponse, UsuarioInDB, RutaFavorita
import asyncio
import logging

logger = logging.getLogger(__name__)
#Agregue 19/11/2025 Fin

# Configurar el contexto de hashing con pbkdf2_sha256 (sin dependencias externas)
pwd_context = CryptContext(
    schemes=["pbkdf2_sha256"],
    default="pbkdf2_sha256",
    pbkdf2_sha256__default_rounds=30000
)

class UsuarioService:
    def __init__(self):
        self.collection = None

    async def _get_collection(self):
        if self.collection is None:
            self.collection = mongodb.database.usuario
        return self.collection

    def _generar_id_usuario(self) -> int:
        """Generar ID único secuencial para usuario"""
        return int(datetime.utcnow().timestamp())

    def _detectar_tipo_usuario(self, email: str) -> str:
        """Detectar tipo de usuario basado en el email"""
        if re.search(r'@.*\.edu', email) or re.search(r'@.*educativo', email) or re.search(r'@edu.uaa', email):
            return "estudiante"
        return "normal"

    def _calcular_tarifa(self, tipo_usuario: str) -> float:
        """Calcular tarifa según tipo de usuario"""
        tarifas = {
            "estudiante": 5.50,
            "normal": 11.00,
            "adulto_mayor": 5.50,
            "discapacitado": 5.50
        }
        return tarifas.get(tipo_usuario, 11.00)

    def _generar_clabe_unica(self) -> str:
        """Generar CLABE interbancaria única de 18 dígitos"""
        while True:
            # Formato: 012 (banco) + 180 (sucursal) + 11 dígitos aleatorios + dígito verificador
            base_clabe = "012180" + ''.join([str(random.randint(0, 9)) for _ in range(11)])
            
            # Calcular dígito verificador (algoritmo simple para ejemplo)
            digitos = [int(d) for d in base_clabe]
            ponderaciones = [3, 7, 1] * 6  # Repetir [3,7,1] para 18 dígitos
            suma = sum(d * p for d, p in zip(digitos, ponderaciones))
            digito_verificador = (10 - (suma % 10)) % 10
            
            clabe_completa = base_clabe + str(digito_verificador)
            return clabe_completa
        
    ##Agregue 19/11/2025 Tomás Inicio
    def _generar_codigo_verificacion(self) -> str:
        """Generar código de verificación único de 6 dígitos"""
        return ''.join([str(random.randint(0, 9)) for _ in range(6)])
    ##Agregue 19/11/2025 Tomás Fin
    async def _verificar_clabe_unica(self, clabe: str) -> bool:
        """Verificar si la CLABE ya existe en la base de datos"""
        collection = await self._get_collection()
        usuario_existente = await collection.find_one({"clabe_recarga": clabe})
        return usuario_existente is None

    def _hash_password(self, password: str) -> str:
        """Hashear contraseña usando passlib con pbkdf2_sha256"""
        return pwd_context.hash(password)

    def _verificar_password(self, password: str, password_hash: str) -> bool:
        """Verificar contraseña usando passlib"""
        return pwd_context.verify(password, password_hash)
#Agregue 19/11/2025 Inicio
    async def crear_usuario(self, usuario_data: UsuarioCreate) -> UsuarioResponse:
        """Crear nuevo usuario en la base de datos"""
        collection = await self._get_collection()

        # Verificar si el email ya existe
        usuario_existente = await collection.find_one({"email": usuario_data.email})
        if usuario_existente:
            raise ValueError("El email ya está registrado")

        # Detectar tipo de usuario basado en email
        tipo_usuario = self._detectar_tipo_usuario(usuario_data.email)
        
        # Calcular tarifa según tipo de usuario
        tarifa_actual = self._calcular_tarifa(tipo_usuario)

        # Generar CLABE única
        clabe_recarga = self._generar_clabe_unica()
        
        # Verificar que la CLABE sea única
        intentos = 0
        while not await self._verificar_clabe_unica(clabe_recarga) and intentos < 5:
            clabe_recarga = self._generar_clabe_unica()
            intentos += 1

        if intentos == 5:
            raise ValueError("Error generando CLABE única. Intente nuevamente.")

        # Generar código de verificación
        codigo_verificacion = self._generar_codigo_verificacion()
        codigo_expiracion = datetime.utcnow() + timedelta(hours=24)  # Válido por 24 horas

        # Hashear contraseña
        password_hash = self._hash_password(usuario_data.password)

        # Generar ID único
        id_usuario = self._generar_id_usuario()

        # Crear documento de usuario
        usuario_dict = UsuarioInDB(
            id_usuario=id_usuario,
            nombre=usuario_data.nombre,
            email=usuario_data.email,
            tipo=tipo_usuario,
            saldo=0.0,
            clabe_recarga=clabe_recarga,
            password_hash=password_hash,
            tarifa_actual=tarifa_actual,
            rutas_favoritas=[],
            fecha_creacion=datetime.utcnow(),
            primer_inicio=True,
            codigo_verificacion=codigo_verificacion,
            codigo_verificacion_expiracion=codigo_expiracion
        ).model_dump()

        # Insertar en MongoDB
        result = await collection.insert_one(usuario_dict)

        print(f"✅ Usuario creado: {usuario_data.email} - Tipo: {tipo_usuario} - Tarifa: ${tarifa_actual} - CLABE: {clabe_recarga}")
        print(f"📧 Código de verificación generado: {codigo_verificacion}")

        # ✅ ENVIAR CORREO DE BIENVENIDA CON CÓDIGO DE VERIFICACIÓN
        asyncio.create_task(
            self._enviar_correo_bienvenida(
                usuario_data.email,
                usuario_data.nombre,
                tipo_usuario,
                tarifa_actual,
                clabe_recarga,
                codigo_verificacion
            )
        )

        # Retornar respuesta (sin datos sensibles)
        return UsuarioResponse(**{k: v for k, v in usuario_dict.items() if k not in ['password_hash', 'codigo_verificacion', 'codigo_verificacion_expiracion']})
#Agregue 19/11/2025 Fin
#Modifique 19/11/2025 Inicio
    async def _enviar_correo_bienvenida(self, email: str, nombre: str, tipo: str, tarifa: float, clabe: str, codigo_verificacion: str):
        """Enviar correo de bienvenida con código de verificación"""
        try:
            await email_service.enviar_correo_registro(email, nombre, tipo, tarifa, clabe, codigo_verificacion)
        except Exception as e:
            print(f"⚠️ Error enviando correo de bienvenida: {e}")

#Modifique 19/11/2025 Inicio
    async def obtener_usuario_por_email(self, email: str) -> UsuarioInDB:
        """Obtener usuario por email (para login)"""
        collection = await self._get_collection()
        usuario = await collection.find_one({"email": email})
        if usuario:
            return UsuarioInDB(**usuario)
        return None

    async def obtener_usuario_por_id(self, id_usuario: int) -> UsuarioResponse:
        """Obtener usuario por ID (para respuesta)"""
        collection = await self._get_collection()
        usuario = await collection.find_one({"id_usuario": id_usuario})
        if usuario:
            return UsuarioResponse(**usuario)
        return None

    async def verificar_credenciales(self, email: str, password: str) -> bool:
        """Verificar email y contraseña"""
        usuario = await self.obtener_usuario_por_email(email)
        if usuario and usuario.password_hash:
            return self._verificar_password(password, usuario.password_hash)
        return False
    ## Agregue 19/11/2025 Tomás Inicio
    async def verificar_codigo_verificacion(self, email: str, codigo: str) -> bool:
        """Verificar código de verificación"""
        usuario = await self.obtener_usuario_por_email(email)
        if not usuario:
            return False
        
        # Verificar si el código existe y no ha expirado
        if (not usuario.codigo_verificacion or 
            not usuario.codigo_verificacion_expiracion or
            datetime.utcnow() > usuario.codigo_verificacion_expiracion):
            return False
        
        return usuario.codigo_verificacion == codigo

    async def marcar_verificacion_completada(self, email: str):
        """Marcar verificación como completada y eliminar código"""
        collection = await self._get_collection()
        await collection.update_one(
            {"email": email},
            {"$set": {
                "primer_inicio": False,
                "fecha_ultimo_acceso": datetime.utcnow()
            }, "$unset": {
                "codigo_verificacion": "",
                "codigo_verificacion_expiracion": ""
            }}
        )
        ## Agregue 19/11/2025 Tomás Fin
    async def actualizar_ultimo_acceso(self, email: str):
        """Actualizar fecha de último acceso"""
        collection = await self._get_collection()
        await collection.update_one(
            {"email": email},
            {"$set": {"fecha_ultimo_acceso": datetime.utcnow()}}
        )

        # Agregue 19/11/2025 Tomás Inicio - Método para reenviar código de verificación
    async def reenviar_codigo_verificacion(self, email: str) -> bool:
        """
        Reenviar código de verificación para primer inicio de sesión
        """
        try:
            collection = await self._get_collection()
            
            # Buscar usuario por email
            usuario = await collection.find_one({"email": email})
            if not usuario:
                return False

            # Verificar si es primer inicio y si tiene código pendiente
            if not usuario.get('primer_inicio', True) or not usuario.get('codigo_verificacion'):
                return False

            # Verificar si el código anterior ha expirado
            codigo_expiracion = usuario.get('codigo_verificacion_expiracion')
            if codigo_expiracion and datetime.utcnow() > codigo_expiracion:
                # Generar nuevo código si el anterior expiró
                nuevo_codigo = self._generar_codigo_verificacion()
                nueva_expiracion = datetime.utcnow() + timedelta(hours=24)
                
                await collection.update_one(
                    {"email": email},
                    {"$set": {
                        "codigo_verificacion": nuevo_codigo,
                        "codigo_verificacion_expiracion": nueva_expiracion
                    }}
                )
                codigo_a_enviar = nuevo_codigo
            else:
                # Reenviar el mismo código si aún es válido
                codigo_a_enviar = usuario.get('codigo_verificacion')

            # Enviar correo con el código
            await self._enviar_correo_verificacion(
                email,
                usuario.get('nombre'),
                codigo_a_enviar
            )

            logger.info(f"📧 Código de verificación reenviado a: {email}")
            return True

        except Exception as e:
            logger.error(f"Error reenviando código de verificación: {e}")
            return False

    async def _enviar_correo_verificacion(self, email: str, nombre: str, codigo_verificacion: str):
        """
        Enviar correo con código de verificación
        """
        try:
            from backend.services.email_service import email_service
            
            # Usar el método específico para reenvío
            await email_service.enviar_correo_reenvio_verificacion(
                email, 
                nombre, 
                codigo_verificacion
            )
        except Exception as e:
            logger.error(f"Error enviando correo de verificación: {e}")
    # Agregue 19/11/2025 Tomás Fin - Método para reenviar código de verificación

# Instancia global del servicio
usuario_service = UsuarioService()