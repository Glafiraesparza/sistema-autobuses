from backend.database.mongodb import mongodb
from backend.models.configuracion_tarifa import ConfiguracionSistemaTarifas, TarifaConfig
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

class ConfiguracionTarifaService:
    def __init__(self):
        self.collection_name = "configuracion_tarifas"
    
    async def _get_collection(self):
        """Obtener la colección de configuración de tarifas"""
        return mongodb.database[self.collection_name]
    
    async def _get_descuentos_collection(self):
        """Obtener la colección de descuentos temporales"""
        return mongodb.database.descuentos_temporales
    
    async def _get_usuarios_collection(self):
        """Obtener la colección de usuarios"""
        return mongodb.database.usuario
    
    async def obtener_configuracion(self) -> ConfiguracionSistemaTarifas:
        """
        Obtener la configuración actual del sistema de tarifas
        """
        try:
            collection = await self._get_collection()
            
            # Buscar configuración existente
            config = await collection.find_one({"_id": "tarifas_config"})
            
            if not config:
                # Crear configuración por defecto
                logger.info("📝 No se encontró configuración, creando valores por defecto")
                config_default = ConfiguracionSistemaTarifas()
                await self._guardar_configuracion(config_default, "sistema")
                return config_default
            
            # Convertir a modelo
            return ConfiguracionSistemaTarifas(
                tarifas=TarifaConfig(**config.get("tarifas", {})),
                descuentos_activos=config.get("descuentos_activos", True),
                ultima_actualizacion=config.get("ultima_actualizacion", datetime.now()),
                actualizado_por=config.get("actualizado_por", "sistema")
            )
        except Exception as e:
            logger.error(f"❌ Error obteniendo configuración: {e}")
            # Retornar configuración por defecto en caso de error
            return ConfiguracionSistemaTarifas()
    
    async def _guardar_configuracion(self, config: ConfiguracionSistemaTarifas, admin_id: str) -> bool:
        """
        Guardar configuración en la base de datos
        """
        try:
            collection = await self._get_collection()
            
            config.ultima_actualizacion = datetime.now()
            config.actualizado_por = admin_id
            
            result = await collection.update_one(
                {"_id": "tarifas_config"},
                {"$set": config.dict()},
                upsert=True
            )
            
            logger.info(f"✅ Configuración guardada por {admin_id}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Error guardando configuración: {e}")
            return False
    
    async def actualizar_tarifas(self, tarifas: TarifaConfig, admin_id: str) -> bool:
        """
        Actualizar las tarifas del sistema y aplicarlas a todos los usuarios
        """
        try:
            # Obtener configuración actual
            config_actual = await self.obtener_configuracion()
            
            # Actualizar tarifas
            config_actual.tarifas = tarifas
            
            # Guardar configuración
            success = await self._guardar_configuracion(config_actual, admin_id)
            
            if not success:
                return False
            
            # Actualizar tarifas en todos los usuarios afectados
            await self._actualizar_tarifas_usuarios(tarifas)
            
            logger.info(f"✅ Tarifas actualizadas por {admin_id}: {tarifas.dict()}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Error actualizando tarifas: {e}")
            return False
    
    async def _actualizar_tarifas_usuarios(self, tarifas: TarifaConfig):
        """
        Actualizar la tarifa_actual de todos los usuarios según su tipo
        """
        try:
            usuarios_collection = await self._get_usuarios_collection()
            
            # Mapeo de tipos de usuario a tarifas
            tarifas_por_tipo = {
                "normal": tarifas.normal,
                "estudiante": tarifas.estudiante,
                "adulto_mayor": tarifas.adulto_mayor,
                "discapacitado": tarifas.discapacitado
            }
            
            total_actualizados = 0
            
            # Actualizar cada tipo de usuario
            for tipo, tarifa in tarifas_por_tipo.items():
                result = await usuarios_collection.update_many(
                    {"tipo": tipo},
                    {"$set": {"tarifa_actual": tarifa}}
                )
                total_actualizados += result.modified_count
                logger.info(f"📝 Actualizados {result.modified_count} usuarios tipo {tipo} a tarifa ${tarifa}")
            
            logger.info(f"✅ Total de usuarios actualizados: {total_actualizados}")
            
        except Exception as e:
            logger.error(f"❌ Error actualizando tarifas de usuarios: {e}")
    
    async def obtener_tarifa_por_tipo(self, tipo_usuario: str) -> float:
        """
        Obtener la tarifa actual para un tipo de usuario específico
        """
        try:
            config = await self.obtener_configuracion()
            tarifas = config.tarifas.dict()
            return tarifas.get(tipo_usuario, 11.00)
        except Exception as e:
            logger.error(f"❌ Error obteniendo tarifa para {tipo_usuario}: {e}")
            return 11.00
    
    async def aplicar_descuento_temporal(self, porcentaje: float, razon: str, duracion_horas: int, admin_id: str) -> dict:
        """
        Aplicar un descuento temporal a todas las tarifas
        """
        try:
            # Obtener configuración actual
            config = await self.obtener_configuracion()
            tarifas_originales = config.tarifas.dict()
            
            # Calcular nuevas tarifas con descuento
            tarifas_con_descuento = {}
            for tipo, tarifa in tarifas_originales.items():
                nueva_tarifa = tarifa * (1 - porcentaje / 100)
                tarifas_con_descuento[tipo] = round(nueva_tarifa, 2)
            
            # Crear objeto de descuento temporal
            ahora = datetime.now()
            descuento = {
                "porcentaje": porcentaje,
                "razon": razon,
                "duracion_horas": duracion_horas,
                "fecha_inicio": ahora,
                "fecha_fin": ahora + timedelta(hours=duracion_horas),
                "tarifas_originales": tarifas_originales,
                "tarifas_aplicadas": tarifas_con_descuento,
                "aplicado_por": admin_id,
                "activo": True
            }
            
            # Guardar descuento en colección separada
            descuentos_collection = await self._get_descuentos_collection()
            await descuentos_collection.insert_one(descuento)
            
            # Aplicar nuevas tarifas
            nuevas_tarifas = TarifaConfig(**tarifas_con_descuento)
            success = await self.actualizar_tarifas(nuevas_tarifas, admin_id)
            
            if success:
                logger.info(f"✅ Descuento del {porcentaje}% aplicado por {duracion_horas} horas por {admin_id}")
                return {
                    "success": True,
                    "mensaje": f"Descuento del {porcentaje}% aplicado por {duracion_horas} horas",
                    "tarifas_anteriores": tarifas_originales,
                    "tarifas_nuevas": tarifas_con_descuento,
                    "valido_hasta": (ahora + timedelta(hours=duracion_horas)).isoformat()
                }
            else:
                return {
                    "success": False,
                    "mensaje": "Error al aplicar el descuento"
                }
                
        except Exception as e:
            logger.error(f"❌ Error aplicando descuento temporal: {e}")
            return {
                "success": False,
                "mensaje": f"Error: {str(e)}"
            }
    
    async def obtener_descuentos_activos(self) -> list:
        """
        Obtener descuentos temporales activos
        """
        try:
            descuentos_collection = await self._get_descuentos_collection()
            ahora = datetime.now()
            
            descuentos = await descuentos_collection.find({
                "activo": True,
                "fecha_inicio": {"$lte": ahora},
                "fecha_fin": {"$gte": ahora}
            }).to_list(length=10)
            
            # Convertir ObjectId a string para cada descuento
            for descuento in descuentos:
                if "_id" in descuento:
                    descuento["_id"] = str(descuento["_id"])
            
            return descuentos
            
        except Exception as e:
            logger.error(f"❌ Error obteniendo descuentos activos: {e}")
            return []
    
    async def restablecer_tarifas_predeterminadas(self, admin_id: str) -> bool:
        """
        Restablecer tarifas a los valores predeterminados
        """
        try:
            tarifas_default = TarifaConfig(
                normal=11.00,
                estudiante=5.50,
                adulto_mayor=5.50,
                discapacitado=5.50
            )
            
            success = await self.actualizar_tarifas(tarifas_default, admin_id)
            
            if success:
                logger.info(f"✅ Tarifas restablecidas a valores predeterminados por {admin_id}")
            
            return success
            
        except Exception as e:
            logger.error(f"❌ Error restableciendo tarifas: {e}")
            return False
    
    async def verificar_y_aplicar_descuentos_vencidos(self):
        """
        Verificar descuentos vencidos y restaurar tarifas originales
        (Para ejecutar periódicamente con un scheduler)
        """
        try:
            descuentos_collection = await self._get_descuentos_collection()
            ahora = datetime.now()
            
            # Buscar descuentos activos que hayan vencido
            descuentos_vencidos = await descuentos_collection.find({
                "activo": True,
                "fecha_fin": {"$lt": ahora}
            }).to_list(length=100)
            
            for descuento in descuentos_vencidos:
                # Restaurar tarifas originales
                tarifas_originales = TarifaConfig(**descuento["tarifas_originales"])
                await self.actualizar_tarifas(tarifas_originales, "sistema_automatico")
                
                # Marcar descuento como inactivo
                await descuentos_collection.update_one(
                    {"_id": descuento["_id"]},
                    {"$set": {"activo": False}}
                )
                
                logger.info(f"✅ Descuento vencido restaurado: {descuento['razon']}")
            
            return len(descuentos_vencidos)
            
        except Exception as e:
            logger.error(f"❌ Error verificando descuentos vencidos: {e}")
            return 0


# Importar timedelta para usar en el servicio
from datetime import timedelta

# Instancia global del servicio
configuracion_tarifa_service = ConfiguracionTarifaService()