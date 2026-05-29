from fastapi import APIRouter, HTTPException
from backend.database.mongodb import get_usuarios_personal_collection, get_notificaciones_collection
from datetime import datetime

router = APIRouter(prefix="/api/admin", tags=["Administración"])

@router.get("/metricas")
async def obtener_metricas():
    """Obtener métricas para el dashboard administrativo"""
    try:
        # Obtener colecciones
        usuarios_collection = get_usuarios_personal_collection()
        notificaciones_collection = get_notificaciones_collection()
        
        # Contar usuarios activos
        total_usuarios = await usuarios_collection.count_documents({"activo": True})
        
        # Contar choferes activos
        total_choferes = await usuarios_collection.count_documents({
            "rol": "chofer", 
            "activo": True
        })
        
        # Obtener notificaciones de hoy
        hoy = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        notificaciones_hoy = await notificaciones_collection.count_documents({
            "timestamp": {"$gte": hoy}
        })
        
        # Contar incidentes (emergencias + retrasos)
        incidentes_hoy = await notificaciones_collection.count_documents({
            "timestamp": {"$gte": hoy},
            "tipo": {"$in": ["emergencia", "retraso"]}
        })
        
        return {
            "success": True,
            "metrics": {
                "Rutas Activas": 2,  # 40 Norte y 40 Sur
                "Usuarios Registrados": total_usuarios,
                "Recaudación (Hoy)": f"${(total_usuarios * 12.50):.2f}",
                "Viajes Hoy": total_choferes * 8,  # Estimado
                "Incidentes": incidentes_hoy,
                "Notificaciones Hoy": notificaciones_hoy
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error obteniendo métricas: {str(e)}")

@router.get("/choferes-activos")
async def obtener_choferes_activos():
    """Obtener lista de choferes activos"""
    try:
        usuarios_collection = get_usuarios_personal_collection()
        
        # Obtener choferes activos
        choferes = await usuarios_collection.find({
            "rol": "chofer",
            "activo": True
        }).to_list(length=50)
        
        # Formatear respuesta
        choferes_formateados = []
        for chofer in choferes:
            choferes_formateados.append({
                "id_personal": chofer.get("id_personal"),
                "nombre": chofer.get("nombre"),
                "email": chofer.get("email"),
                "estado": "activo",  # Estado por defecto,
                "turno": chofer.get("turno"),
                "ultima_actualizacion": datetime.now().strftime("%H:%M")
            })
        
        return {
            "success": True,
            "choferes": choferes_formateados
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error obteniendo choferes: {str(e)}")