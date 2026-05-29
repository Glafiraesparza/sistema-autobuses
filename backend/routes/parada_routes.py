from fastapi import APIRouter, HTTPException
from backend.services.parada_service import parada_service
from backend.models.parada import TiempoUpdate

router = APIRouter(prefix="/api/paradas", tags=["Pantalla Paradas"])

@router.get("/informacion/{ruta_nombre}/{nombre_parada}")
async def obtener_informacion_parada(ruta_nombre: str, nombre_parada: str):
    """Obtener información completa de ruta y parada"""
    try:
        resultado = await parada_service.obtener_informacion_parada(ruta_nombre, nombre_parada)
        
        if not resultado:
            raise HTTPException(status_code=404, detail="Parada o ruta no encontrada")
        
        return {
            "success": True,
            "data": resultado
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")

@router.get("/tiempos/{ruta_nombre}/{nombre_parada}")
async def obtener_tiempos_parada(ruta_nombre: str, nombre_parada: str):
    """Obtener tiempos estimados para una parada específica"""
    try:
        resultado = await parada_service.obtener_tiempos_parada(ruta_nombre, nombre_parada)
        
        if not resultado:
            raise HTTPException(status_code=404, detail="Parada o ruta no encontrada")
        
        return {
            "success": True,
            "data": resultado.dict(),
            "camiones_cercanos": resultado.camiones_cercanos
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")

@router.post("/actualizar-retraso")
async def actualizar_retraso_ruta(update: TiempoUpdate):
    """Actualizar retraso para una ruta (usado por choferes)"""
    try:
        success = await parada_service.actualizar_retraso_ruta(
            update.ruta_nombre, 
            update.minutos_extra, 
            update.motivo
        )
        
        if success:
            return {
                "success": True,
                "message": f"Retraso de {update.minutos_extra} minutos actualizado para {update.ruta_nombre}",
                "motivo": update.motivo
            }
        else:
            raise HTTPException(status_code=500, detail="Error actualizando retraso")
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")

@router.get("/rutas-disponibles")
async def obtener_rutas_disponibles():
    """Obtener lista de rutas disponibles desde MongoDB"""
    try:
        from backend.database.mongodb import get_rutas_collection
        rutas_collection = get_rutas_collection()
        
        # Obtener todas las rutas con sus paradas
        rutas_cursor = rutas_collection.find({}, {
            "nombre": 1, 
            "paradas": 1,
            "tiempo_estimado": 1
        })
        
        rutas = await rutas_cursor.to_list(length=50)
        
        rutas_simplificadas = []
        for ruta in rutas:
            paradas_info = []
            for parada in ruta.get("paradas", []):
                paradas_info.append({
                    "nombre": parada.get("nombre_parada", f"Parada {parada.get('orden', '')}"),
                    "orden": parada.get("orden"),
                    "lat": parada.get("lat"),
                    "lng": parada.get("lng")
                })
            
            rutas_simplificadas.append({
                "nombre": ruta["nombre"],
                "tiempo_estimado": ruta.get("tiempo_estimado", 60),
                "paradas": paradas_info
            })
        
        return {
            "success": True,
            "rutas": rutas_simplificadas
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")