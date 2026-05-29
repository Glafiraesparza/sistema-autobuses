from datetime import datetime
from bson import ObjectId
from backend.database.mongodb import mongodb
from backend.models.auth import UsuarioPersonal, UsuarioCreate, UsuarioUpdate, hash_password
import logging
import unicodedata

logger = logging.getLogger(__name__)

class UsuarioService:
    def __init__(self):
        self._collection = None
    
    @property
    def collection(self):
        """Accede a la colección de forma lazy"""
        if self._collection is None:
            if mongodb.database is None:
                raise RuntimeError("La base de datos no está conectada")
            self._collection = mongodb.database["usuarios_personal"]
        return self._collection

    async def generar_id_personal(self, rol: str) -> int:
        """Genera un ID único basado en el rol"""
        prefix_map = {
            "administrador": "ADM",
            "chofer": "CHF"
        }
        prefix = prefix_map.get(rol, "USR")
        
        # Buscar el último ID para este rol
        last_user = await self.collection.find_one(
            {"rol": rol}, 
            sort=[("id_personal", -1)]
        )
        
        if last_user:
            last_id = last_user["id_personal"]
            new_id = last_id + 1
        else:
            # Primer usuario de este rol
            base_id = {
                "administrador": 1000,
                "chofer": 2000
            }
            new_id = base_id.get(rol, 3000)
        
        return new_id

    def limpiar_nombre_email(self, nombre: str) -> str:
        """Limpia el nombre para usar en email (quita acentos y caracteres especiales)"""
        # Normalizar y quitar acentos
        nombre = unicodedata.normalize('NFKD', nombre).encode('ASCII', 'ignore').decode('ASCII')
        # Quitar caracteres no alfanuméricos excepto espacios
        nombre = ''.join(c for c in nombre if c.isalnum() or c == ' ')
        return nombre.lower().strip()

    async def generar_email_compacto(self, nombre: str, id_personal: int) -> str:
        """Genera un email compacto basado en el nombre y ID"""
        nombre_limpio = self.limpiar_nombre_email(nombre)
        partes_nombre = nombre_limpio.split()
        
        if len(partes_nombre) >= 2:
            # Usar primera letra del primer nombre + apellido completo
            email_base = f"{partes_nombre[0][0]}{partes_nombre[-1]}"
        else:
            # Si solo tiene un nombre, usar las primeras 8 letras
            email_base = partes_nombre[0][:8]
        
        # Agregar ID personal para hacerlo único
        email_final = f"{email_base}{id_personal}@tucsa.com"
        
        # Verificar si ya existe y hacer ajustes si es necesario
        counter = 1
        base_email = email_final
        while await self.collection.find_one({"email": email_final}):
            email_final = f"{email_base}{id_personal}_{counter}@tucsa.com"
            counter += 1
        
        return email_final

    async def crear_usuario(self, usuario_data: UsuarioCreate) -> dict:
        """Crea un nuevo usuario en el sistema"""
        try:
            # Generar ID personal único
            id_personal = await self.generar_id_personal(usuario_data.rol)
            
            # Si no se proporciona email, generar uno automático
            if not usuario_data.email:
                usuario_data.email = await self.generar_email_compacto(usuario_data.nombre, id_personal)
            else:
                # Verificar si el email ya existe
                existing_user = await self.collection.find_one({"email": usuario_data.email})
                if existing_user:
                    return {
                        "success": False,
                        "mensaje": "El email ya está registrado",
                        "usuario": None
                    }

            # Hashear la contraseña
            password_hash = hash_password(usuario_data.password)
            
            # Crear documento del usuario
            usuario_doc = {
                "id_personal": id_personal,
                "nombre": usuario_data.nombre,
                "email": usuario_data.email,
                "password_hash": password_hash,
                "rol": usuario_data.rol,
                "activo": True,
                "turno": usuario_data.turno,
                "fecha_creacion": datetime.now(),
            }
            
            # Insertar en la base de datos
            result = await self.collection.insert_one(usuario_doc)
            
            if result.inserted_id:
                # Preparar respuesta sin password_hash
                usuario_response = usuario_doc.copy()
                usuario_response.pop("password_hash", None)
                usuario_response["_id"] = str(result.inserted_id)
                
                return {
                    "success": True,
                    "mensaje": "Usuario creado exitosamente",
                    "usuario": usuario_response
                }
            else:
                return {
                    "success": False,
                    "mensaje": "Error al crear el usuario",
                    "usuario": None
                }
                
        except Exception as e:
            logger.error(f"Error al crear usuario: {str(e)}")
            return {
                "success": False,
                "mensaje": f"Error interno del servidor: {str(e)}",
                "usuario": None
            }

    async def obtener_usuarios(self, skip: int = 0, limit: int = 50) -> list:
        """Obtiene lista de usuarios (sin password_hash)"""
        try:
            cursor = self.collection.find(
                {}, 
                {"password_hash": 0}
            ).skip(skip).limit(limit).sort("fecha_creacion", -1)
            
            usuarios_list = []
            async for usuario in cursor:
                usuario["_id"] = str(usuario["_id"])
                usuarios_list.append(usuario)
                
            return usuarios_list
        except Exception as e:
            logger.error(f"Error al obtener usuarios: {str(e)}")
            return []

    async def buscar_usuarios(
        self, 
        query: str = None, 
        rol: str = None, 
        activo: bool = None,
        skip: int = 0, 
        limit: int = 50
    ) -> list:
        """Busca usuarios con filtros opcionales"""
        try:
            # Construir query de búsqueda
            search_query = {}
            
            if query:
                search_query["$or"] = [
                    {"nombre": {"$regex": query, "$options": "i"}},
                    {"email": {"$regex": query, "$options": "i"}},
                    {"rol": {"$regex": query, "$options": "i"}}
                ]
            
            if rol:
                search_query["rol"] = rol
                
            if activo is not None:
                search_query["activo"] = activo

            cursor = self.collection.find(
                search_query, 
                {"password_hash": 0}
            ).skip(skip).limit(limit).sort("fecha_creacion", -1)
            
            usuarios_list = []
            async for usuario in cursor:
                usuario["_id"] = str(usuario["_id"])
                usuarios_list.append(usuario)
                
            return usuarios_list
        except Exception as e:
            logger.error(f"Error al buscar usuarios: {str(e)}")
            return []

    async def actualizar_estado_usuario(self, usuario_id: str, activo: bool) -> bool:
        """Activa o desactiva un usuario"""
        try:
            result = await self.collection.update_one(
                {"_id": ObjectId(usuario_id)},
                {"$set": {"activo": activo}}
            )
            return result.modified_count > 0
        except Exception as e:
            logger.error(f"Error al actualizar estado: {str(e)}")
            return False

    async def editar_usuario(self, usuario_id: str, usuario_update: UsuarioUpdate) -> dict:
        """Edita los datos de un usuario (nombre, contraseña, turno)"""
        try:
            update_data = {}
            
            if usuario_update.nombre is not None:
                update_data["nombre"] = usuario_update.nombre
                
            if usuario_update.turno is not None:
                update_data["turno"] = usuario_update.turno
                
            if usuario_update.password is not None:
                if len(usuario_update.password) < 6:
                    return {
                        "success": False,
                        "mensaje": "La contraseña debe tener al menos 6 caracteres"
                    }
                update_data["password_hash"] = hash_password(usuario_update.password)
            
            if not update_data:
                return {
                    "success": False,
                    "mensaje": "No se proporcionaron datos para actualizar"
                }
            
            result = await self.collection.update_one(
                {"_id": ObjectId(usuario_id)},
                {"$set": update_data}
            )
            
            if result.modified_count > 0:
                return {
                    "success": True,
                    "mensaje": "Usuario actualizado correctamente"
                }
            else:
                return {
                    "success": False,
                    "mensaje": "No se encontró el usuario o no hubo cambios"
                }
                
        except Exception as e:
            logger.error(f"Error al editar usuario: {str(e)}")
            return {
                "success": False,
                "mensaje": f"Error interno del servidor: {str(e)}"
            }

    async def eliminar_usuario(self, usuario_id: str) -> bool:
        """Elimina un usuario del sistema"""
        try:
            result = await self.collection.delete_one({"_id": ObjectId(usuario_id)})
            return result.deleted_count > 0
        except Exception as e:
            logger.error(f"Error al eliminar usuario: {str(e)}")
            return False

    async def obtener_usuario_por_id(self, usuario_id: str) -> dict:
        """Obtiene un usuario específico por ID"""
        try:
            usuario = await self.collection.find_one(
                {"_id": ObjectId(usuario_id)}, 
                {"password_hash": 0}
            )
            if usuario:
                usuario["_id"] = str(usuario["_id"])
                return usuario
            return None
        except Exception as e:
            logger.error(f"Error al obtener usuario por ID: {str(e)}")
            return None
        
    async def obtener_choferes_activos(self) -> list:
        """Obtiene lista de choferes activos"""
        try:
            cursor = self.collection.find({
                "rol": "chofer", 
                "activo": True
            }).sort("nombre", 1)
            
            choferes_list = []
            async for chofer in cursor:
                chofer["_id"] = str(chofer["_id"])
                choferes_list.append(chofer)
                
            return choferes_list
        except Exception as e:
            logger.error(f"Error al obtener choferes activos: {str(e)}")
            return []
        
    async def obtener_choferes_por_turno(self, turno: str) -> list:
        """Obtiene choferes activos por turno"""
        try:
            cursor = self.collection.find({
                "rol": "chofer", 
                "activo": True,
                "turno": turno
            }).sort("nombre", 1)
            
            choferes_list = []
            async for chofer in cursor:
                # Asegurarnos de incluir todos los campos necesarios
                chofer_data = {
                    "_id": str(chofer["_id"]),
                    "id_personal": chofer.get("id_personal"),  # Este campo es crucial
                    "nombre": chofer.get("nombre"),
                    "email": chofer.get("email"),
                    "rol": chofer.get("rol"),
                    "activo": chofer.get("activo"),
                    "turno": chofer.get("turno"),
                    "fecha_creacion": chofer.get("fecha_creacion")
                }
                choferes_list.append(chofer_data)
                
            return choferes_list
        except Exception as e:
            logger.error(f"Error al obtener choferes por turno: {str(e)}")
            return []

# Crear instancia del servicio
usuario_service = UsuarioService()