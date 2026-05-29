from backend.database.mongodb import get_rutas_collection
from backend.models.parada import ParadaDisplay
import math
from datetime import datetime

class ParadaService:
    
    @staticmethod
    async def obtener_informacion_parada(ruta_nombre: str, nombre_parada: str):
        """Obtener información completa de la ruta y parada desde MongoDB"""
        try:
            rutas_collection = get_rutas_collection()
            
            # Buscar la ruta en MongoDB
            ruta = await rutas_collection.find_one({"nombre": ruta_nombre})
            
            if not ruta:
                return None
            
            # Buscar la parada específica
            parada_encontrada = None
            for parada in ruta.get("paradas", []):
                # Intentar buscar por nombre_parada o por orden
                if (parada.get("nombre_parada") == nombre_parada or 
                    str(parada.get("orden")) == str(nombre_parada)):
                    parada_encontrada = parada
                    break
            
            if not parada_encontrada:
                return None
            
            return {
                "ruta": {
                    "nombre": ruta["nombre"],
                    "coordenadas": ruta["coordenadas"],
                    "paradas": ruta["paradas"],
                    "tiempo_estimado": ruta.get("tiempo_estimado", 60),
                    "retraso_actual": ruta.get("retraso_actual", 0),
                    "motivo_retraso": ruta.get("motivo_retraso", "")
                },
                "parada": parada_encontrada
            }
            
        except Exception as e:
            print(f"Error en obtener_informacion_parada: {e}")
            return None
    
    @staticmethod
    async def obtener_tiempos_parada(ruta_nombre: str, nombre_parada: str):
        """Obtener tiempos estimados usando simulación similar al frontend"""
        try:
            informacion = await ParadaService.obtener_informacion_parada(ruta_nombre, nombre_parada)
            
            if not informacion:
                return None
            
            ruta = informacion["ruta"]
            parada = informacion["parada"]
            
            # Simular camiones cercanos (misma lógica que frontend)
            camiones_cercanos = await ParadaService.simular_camiones_cercanos(ruta, parada)
            
            # Calcular tiempo del camión más cercano
            tiempo_estimado = await ParadaService.calcular_tiempo_estimado(camiones_cercanos)
            
            return ParadaDisplay(
                nombre_parada=nombre_parada,
                ruta_nombre=ruta_nombre,
                tiempo_estimado=tiempo_estimado,
                camiones_cercanos=camiones_cercanos
            )
            
        except Exception as e:
            print(f"Error en obtener_tiempos_parada: {e}")
            return None
    
    @staticmethod
    async def simular_camiones_cercanos(ruta, parada_objetivo):
        """Simular camiones cercanos usando la misma lógica que pasajero_inicio.js"""
        camiones = []
        coordenadas = ruta.get("coordenadas", [])
        total_puntos = len(coordenadas)
        
        if total_puntos == 0:
            return []
        
        # Crear 10 camiones distribuidos (igual que en frontend)
        for i in range(10):
            progreso = i / 10
            posicion_inicial = int(progreso * (total_puntos - 1))
            
            # Encontrar posición de la parada en la ruta
            posicion_parada = await ParadaService.encontrar_posicion_parada(ruta, parada_objetivo)
            
            if posicion_parada is not None:
                # Calcular distancia entre camión y parada
                distancia_puntos = abs(posicion_parada - posicion_inicial)
                distancia_normalizada = min(distancia_puntos, total_puntos - distancia_puntos) / total_puntos
                
                # Solo considerar camiones que se acercan
                if posicion_inicial <= posicion_parada or distancia_normalizada < 0.2:
                    # Calcular tiempo base (similar a frontend)
                    tiempo_base = int(distancia_normalizada * ruta.get("tiempo_estimado", 60) * 8)
                    
                    # Aplicar retraso si existe
                    tiempo_final = max(1, tiempo_base + ruta.get("retraso_actual", 0))
                    
                    # Solo incluir camiones que no han pasado (tiempo > 0)
                    if tiempo_final <= 30:  # Máximo 30 minutos
                        camiones.append({
                            "id": i + 1,
                            "tiempo_estimado": tiempo_final,
                            "distancia": distancia_normalizada,
                            "progreso": progreso
                        })
        
        # Ordenar por tiempo más corto y limitar a 3 camiones
        camiones.sort(key=lambda x: x["tiempo_estimado"])
        return camiones[:3]
    
    @staticmethod
    async def encontrar_posicion_parada(ruta, parada_objetivo):
        """Encontrar la posición aproximada de una parada en las coordenadas de la ruta"""
        try:
            coordenadas = ruta.get("coordenadas", [])
            parada_lat = parada_objetivo.get("lat")
            parada_lng = parada_objetivo.get("lng")
            
            if not parada_lat or not parada_lng:
                return None
            
            # Encontrar la coordenada más cercana
            mejor_indice = 0
            mejor_distancia = float('inf')
            
            for i, coord in enumerate(coordenadas):
                distancia = math.sqrt(
                    (coord.get("lat", 0) - parada_lat)**2 +
                    (coord.get("lng", 0) - parada_lng)**2
                )
                if distancia < mejor_distancia:
                    mejor_distancia = distancia
                    mejor_indice = i
            
            return mejor_indice
            
        except Exception as e:
            print(f"Error en encontrar_posicion_parada: {e}")
            return None
    
    @staticmethod
    async def calcular_tiempo_estimado(camiones_cercanos):
        """Calcular tiempo estimado basado en el camión más cercano"""
        if not camiones_cercanos:
            return 0
        return min(camion["tiempo_estimado"] for camion in camiones_cercanos)
    
    @staticmethod
    async def actualizar_retraso_ruta(ruta_nombre: str, minutos_extra: int, motivo: str = ""):
        """Actualizar retraso para una ruta específica"""
        try:
            rutas_collection = get_rutas_collection()
            
            await rutas_collection.update_one(
                {"nombre": ruta_nombre},
                {"$set": {
                    "retraso_actual": minutos_extra,
                    "motivo_retraso": motivo,
                    "ultima_actualizacion_retraso": datetime.utcnow()
                }}
            )
            
            return True
        except Exception as e:
            print(f"Error actualizando retraso: {e}")
            return False

parada_service = ParadaService()