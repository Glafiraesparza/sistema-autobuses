from backend.database.mongodb import get_transacciones_collection
from typing import Optional
from datetime import datetime

class TransaccionService:
    
    @staticmethod
    async def obtener_transacciones_usuario(id_usuario: int, tipo: str = "pago_viaje") -> dict:
        """
        Obtener todas las transacciones de un usuario filtrando por tipo
        Por defecto busca solo transacciones de tipo 'pago_viaje'
        """
        try:
            collection = get_transacciones_collection()
            
            # Construir filtro - siempre filtrar por id_usuario y tipo
            filtro = {
                "id_usuario": id_usuario,
                "tipo": tipo  # Siempre filtrar por tipo pago_viaje
            }
            
            # Obtener transacciones ordenadas por fecha (más reciente primero)
            cursor = collection.find(filtro).sort("fecha_transaccion", -1)
            transacciones = await cursor.to_list(length=None)
            
            # Procesar transacciones para respuesta JSON
            transacciones_procesadas = []
            for transaccion in transacciones:
                # Convertir ObjectId a string
                transaccion["_id"] = str(transaccion["_id"])
                
                # Asegurar que las fechas estén en formato string para JSON
                if isinstance(transaccion["fecha_transaccion"], datetime):
                    transaccion["fecha_transaccion"] = transaccion["fecha_transaccion"].isoformat()
                
                transacciones_procesadas.append(transaccion)
            
            return {
                "success": True,
                "transacciones": transacciones_procesadas,
                "total": len(transacciones_procesadas)
            }
            
        except Exception as e:
            print(f"Error obteniendo transacciones del usuario {id_usuario}: {e}")
            return {
                "success": False,
                "detail": f"Error al obtener transacciones: {str(e)}"
            }