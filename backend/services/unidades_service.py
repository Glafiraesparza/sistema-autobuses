from datetime import datetime
from bson import ObjectId
import random
import string
from backend.database.mongodb import mongodb
from backend.models.unidades import UnidadCreate
import logging

logger = logging.getLogger(__name__)

class UnidadService:
    def __init__(self):
        self._collection = None
    
    @property
    def collection(self):
        """Accede a la colección de forma lazy"""
        if self._collection is None:
            if mongodb.database is None:
                raise RuntimeError("La base de datos no está conectada")
            self._collection = mongodb.database["unidades"]
        return self._collection

    async def generar_id_unidad(self, placas: str) -> str:
        """Genera un ID único de 6 caracteres para la unidad"""
        print(f"🔧 Generando ID para placas: {placas}")
        
        # Tomar primeras 3 letras de las placas (sin guiones) y 3 números aleatorios
        placas_clean = placas.replace('-', '').replace(' ', '')[:3].upper()
        print(f"🔧 Placas limpias: {placas_clean}")
        
        # Si las placas no tienen suficientes letras, completar con caracteres aleatorios
        if len(placas_clean) < 3:
            placas_clean += ''.join(random.choices(string.ascii_uppercase, k=3-len(placas_clean)))
            print(f"🔧 Placas completadas: {placas_clean}")
    
        # Generar 3 números aleatorios
        numeros = ''.join(random.choices(string.digits, k=3))
        id_unidad = f"{placas_clean}{numeros}"
        print(f"🔧 ID inicial generado: {id_unidad}")
    
        # Verificar que no exista (usando operación ASÍNCRONA)
        intentos = 0
        while await self.collection.find_one({"id_unidad": id_unidad}):
            intentos += 1
            print(f"🔧 ID {id_unidad} ya existe, generando nuevo... (intento {intentos})")
            numeros = ''.join(random.choices(string.digits, k=3))
            id_unidad = f"{placas_clean}{numeros}"
            if intentos > 10:  # Prevenir loop infinito
                print("🔧 Demasiados intentos, usando timestamp")
                id_unidad = f"{placas_clean}{int(datetime.now().timestamp()) % 1000:03d}"
                break
    
        print(f"🔧 ID final: {id_unidad}")
        return id_unidad

    async def crear_unidad(self, unidad_data: UnidadCreate) -> dict:
        """Crea una nueva unidad en el sistema"""
        try:
            print(f"1. Iniciando creación de unidad: {unidad_data}")
            
            # Verificar si las placas ya existen (ASÍNCRONO con AWAIT)
            print(f"2. Buscando placas: '{unidad_data.placas}'")
            existing_unidad = await self.collection.find_one({"placas": unidad_data.placas})
            print(f"3. Resultado de búsqueda: {existing_unidad}")
            print(f"4. Tipo del resultado: {type(existing_unidad)}")
            print(f"5. ¿Es None?: {existing_unidad is None}")
            
            if existing_unidad is not None:
                print(f"6. ❌ PLACAS EXISTENTES ENCONTRADAS: {existing_unidad}")
                return {
                    "success": False,
                    "mensaje": "Las placas ya están registradas",
                    "unidad": None
                }

            print("7. ✅ Las placas no existen, continuando...")
            
            # Generar ID único
            id_unidad = await self.generar_id_unidad(unidad_data.placas)
            print(f"8. ID generado: {id_unidad}")
            
            # Crear documento de la unidad
            unidad_doc = {
                "id_unidad": id_unidad,
                "placas": unidad_data.placas.upper(),
                "capacidad": unidad_data.capacidad,
                "modelo": unidad_data.modelo,
                "estado": unidad_data.estado,
                "fecha_creacion": datetime.now()
            }
            
            print(f"9. Documento creado: {unidad_doc}")
            
            # Insertar en la base de datos (ASÍNCRONO con AWAIT)
            print("10. Insertando en la base de datos...")
            result = await self.collection.insert_one(unidad_doc)
            print(f"11. Inserción completada. ID: {result.inserted_id}")
            
            if result.inserted_id:
                # Preparar respuesta
                unidad_response = unidad_doc.copy()
                unidad_response["_id"] = str(result.inserted_id)
                
                print(f"12. ✅ Unidad creada exitosamente")
                return {
                    "success": True,
                    "mensaje": "Unidad creada exitosamente",
                    "unidad": unidad_response
                }
            else:
                print("13. ❌ Error: No se pudo insertar la unidad")
                return {
                    "success": False,
                    "mensaje": "Error al crear la unidad",
                    "unidad": None
                }
                
        except Exception as e:
            print(f"❌ ERROR en crear_unidad: {str(e)}")
            import traceback
            print(f"🔍 Traceback completo: {traceback.format_exc()}")
            return {
                "success": False,
                "mensaje": f"Error interno del servidor: {str(e)}",
                "unidad": None
            }

    async def obtener_unidades(self) -> list:
        """Obtiene lista de todas las unidades (ASÍNCRONO)"""
        try:
            cursor = self.collection.find({}).sort("fecha_creacion", -1)
            
            unidades_list = []
            async for unidad in cursor:
                unidad["_id"] = str(unidad["_id"])
                unidades_list.append(unidad)
                
            return unidades_list
        except Exception as e:
            logger.error(f"Error al obtener unidades: {str(e)}")
            return []

    async def obtener_unidades_activas(self) -> list:
        """Obtiene lista de unidades activas (ASÍNCRONO)"""
        try:
            cursor = self.collection.find({"estado": "activo"}).sort("fecha_creacion", -1)
            
            unidades_list = []
            async for unidad in cursor:
                unidad["_id"] = str(unidad["_id"])
                unidades_list.append(unidad)
                
            return unidades_list
        except Exception as e:
            logger.error(f"Error al obtener unidades activas: {str(e)}")
            return []
        
    async def actualizar_unidad(self, unidad_id: str, datos_actualizacion: dict) -> bool:
        """Actualiza una unidad existente"""
        try:
            result = await self.collection.update_one(
                {"_id": ObjectId(unidad_id)},
                {"$set": datos_actualizacion}
            )
            return result.modified_count > 0
        except Exception as e:
            logger.error(f"Error al actualizar unidad: {str(e)}")
            return False
        
    async def actualizar_estado(self, unidad_id: str, datos_actualizacion: dict) -> bool:
        """Actualiza una unidad existente"""
        try:
            result = await self.collection.update_one(
                {"id_unidad":unidad_id},
                {"$set": datos_actualizacion}
            )
            return result.modified_count > 0
        except Exception as e:
            logger.error(f"Error al actualizar unidad: {str(e)}")
            return False

    async def eliminar_unidad(self, unidad_id: str) -> bool:
        """Elimina una unidad del sistema"""
        try:
            result = await self.collection.delete_one({"_id": ObjectId(unidad_id)})
            return result.deleted_count > 0
        except Exception as e:
            logger.error(f"Error al eliminar unidad: {str(e)}")
            return False

    async def obtener_unidad_por_id(self, unidad_id: str) -> dict:
        """Obtiene una unidad específica por ID"""
        try:
            unidad = await self.collection.find_one({"_id": ObjectId(unidad_id)})
            if unidad:
                unidad["_id"] = str(unidad["_id"])
                return unidad
            return None
        except Exception as e:
            logger.error(f"Error al obtener unidad por ID: {str(e)}")
            return None

# Crear instancia del servicio
unidad_service = UnidadService()