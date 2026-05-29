from fastapi import APIRouter, HTTPException
from backend.services.ruta_service import ruta_service

router = APIRouter(prefix="/api/camiones", tags=["Camiones y Rutas"])

@router.get("/ruta/{nombre_ruta}")
async def obtener_camion_por_ruta(nombre_ruta: str):
    """Obtener el camión asignado a una ruta específica"""
    try:
        camion = ruta_service.obtener_camion_por_ruta(nombre_ruta)
        if not camion:
            raise HTTPException(status_code=404, detail=f"No hay camión asignado para la ruta {nombre_ruta}")
        
        return {
            "nombre_ruta": nombre_ruta,
            "id_camion_asignado": camion,
            "mensaje": f"Camión {camion} asignado a ruta {nombre_ruta}"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

@router.get("/camion/{id_camion}")
async def obtener_ruta_por_camion(id_camion: str):
    """Obtener la ruta asignada a un camión específico"""
    try:
        ruta = ruta_service.obtener_ruta_por_camion(id_camion)
        if not ruta:
            raise HTTPException(status_code=404, detail=f"No hay ruta asignada para el camión {id_camion}")
        
        return {
            "id_camion": id_camion,
            "nombre_ruta": ruta,
            "mensaje": f"Camión {id_camion} asignado a ruta {ruta}"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

@router.get("/asignaciones")
async def obtener_todas_asignaciones():
    """Obtener todas las asignaciones de camiones a rutas"""
    try:
        asignaciones = ruta_service.asignaciones_fijas
        return {
            "asignaciones": asignaciones,
            "total": len(asignaciones)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

@router.get("/rutas-con-camiones")
async def obtener_rutas_con_camiones():
    """Obtener todas las rutas con sus camiones asignados"""
    try:
        rutas = await ruta_service.obtener_todas_rutas_con_camiones()
        return {
            "rutas": rutas,
            "total": len(rutas)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")