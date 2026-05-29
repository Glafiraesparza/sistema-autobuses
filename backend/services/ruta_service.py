from fastapi import HTTPException
from backend.database.mongodb import get_rutas_collection
from backend.models.ruta import RutaResponse

class RutaService:
    def __init__(self):
        self.collection = None

        self.asignaciones_fijas = {
            "40_norte": "1132",
            "40_sur": "1124"
        }
    async def _get_collection(self):
        if self.collection is None:
            self.collection = get_rutas_collection()
        return self.collection
    
    async def obtener_todas_rutas(self) -> list[RutaResponse]:
        collection = await self._get_collection()
        rutas = await collection.find().to_list(length=1000)
        
        rutas_convertidas = []
        for ruta in rutas:
            # ⭐ FORZAR a que siempre esté el campo paradas
            datos_ruta = {
                "nombre": ruta.get("nombre", "Sin nombre"),
                "coordenadas": ruta.get("coordenadas", []),
                "tiempo_estimado": ruta.get("tiempo_estimado", 0),
                "paradas": ruta.get("paradas", [])  # ⭐ Esto asegura que siempre esté
            }
            
            rutas_convertidas.append(RutaResponse(**datos_ruta))
        
        return rutas_convertidas
    
    async def obtener_ruta_por_nombre(self, nombre: str) -> RutaResponse:
        collection = await self._get_collection()
        ruta = await collection.find_one({"nombre": nombre})
        
        if not ruta:
            raise HTTPException(status_code=404, detail="Ruta no encontrada")
        
        datos_ruta = {
            "nombre": ruta.get("nombre"),
            "coordenadas": ruta.get("coordenadas", []),
            "tiempo_estimado": ruta.get("tiempo_estimado", 0),
            "paradas": ruta.get("paradas", [])
        }
        
        return RutaResponse(**datos_ruta)

# 🔥 NUEVOS MÉTODOS PARA ASIGNACIONES DE CAMIONES
    async def obtener_ruta_con_camion(self, nombre_ruta: str):
        """Obtener ruta con ID de camión asignado"""
        collection = await self._get_collection()
        ruta = await collection.find_one({"nombre": nombre_ruta})
        
        if ruta and nombre_ruta in self.asignaciones_fijas:
            ruta["id_camion_asignado"] = self.asignaciones_fijas[nombre_ruta]
        return ruta
    
    def obtener_camion_por_ruta(self, nombre_ruta: str) -> str:
        """Obtener ID de camión asignado a una ruta"""
        return self.asignaciones_fijas.get(nombre_ruta)
    
    def obtener_ruta_por_camion(self, id_camion: str) -> str:
        """Obtener ruta asignada a un camión"""
        for ruta, camion in self.asignaciones_fijas.items():
            if camion == id_camion:
                return ruta
        return None
    
    async def obtener_todas_rutas_con_camiones(self):
        """Obtener todas las rutas con sus camiones asignados"""
        rutas = await self.obtener_todas_rutas()
        
        rutas_con_camiones = []
        for ruta in rutas:
            ruta_dict = ruta.dict()
            ruta_dict["id_camion_asignado"] = self.asignaciones_fijas.get(ruta.nombre)
            rutas_con_camiones.append(ruta_dict)
        
        return rutas_con_camiones

ruta_service = RutaService()