from fastapi import APIRouter, HTTPException
from datetime import datetime, date
from backend.database.mongodb import (
    get_usuarios_collection, 
    get_ruta_asignada_collection, 
    get_transacciones_collection,
    get_quejas_collection
)

router = APIRouter(prefix="/api/metricas", tags=["Métricas Administrativas"])


@router.get("/usuarios-registrados")
async def obtener_usuarios_registrados():
    """Cuenta la cantidad de registros en la colección usuarios"""
    try:
        count = await contar_usuarios_registrados()
        return {
            "success": True,
            "total_usuarios": count,
            "metric_name": "Usuarios Registrados"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al contar usuarios: {str(e)}")

@router.get("/unidades-transito")
async def obtener_unidades_en_transito():
    """Cuenta las unidades con jornada_completada null en ruta_asignada"""
    try:
        count = await contar_unidades_en_transito()
        return {
            "success": True,
            "unidades_transito": count,
            "metric_name": "Unidades en Transito"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al contar unidades en tránsito: {str(e)}")

@router.get("/recaudacion-hoy")
async def obtener_recaudacion_hoy():
    """Suma el monto de transacciones de pago_viaje del día actual"""
    try:
        total = await calcular_recaudacion_hoy()
        return {
            "success": True,
            "recaudacion_hoy": total,
            "recaudacion_formateada": f"${total:,.2f}",
            "metric_name": "Recaudación (Hoy)"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al calcular recaudación: {str(e)}")

@router.get("/viajes-hoy")
async def obtener_viajes_hoy():
    """Cuenta los viajes (transacciones pago_viaje) del día actual"""
    try:
        count = await contar_viajes_hoy()
        return {
            "success": True,
            "viajes_hoy": count,
            "metric_name": "Viajes Hoy"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al contar viajes: {str(e)}")

@router.get("/soporte")
async def obtener_soporte_registrados():
    """Cuenta la cantidad de registros en la colección quejas"""
    try:
        count = await contar_soporte_registrados()
        return {
            "success": True,
            "total_peticiones": count,
            "metric_name": "Soporte"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al contar quejas: {str(e)}")

@router.get("/soporte/detalle")
async def obtener_soporte_detalle():
    """Obtiene todos los registros de soporte/quejas"""
    try:
        collection = get_quejas_collection()
        quejas = await collection.find({}).sort("fecha_queja", -1).to_list(length=100)
        
        quejas_formateadas = []
        for queja in quejas:
            queja_formateada = {
                "id_queja": queja.get("id_queja", ""),
                "id_usuario": queja.get("id_usuario", ""),
                "tipo_queja": queja.get("tipo_queja", ""),
                "descripcion": queja.get("descripcion", ""),
                "fecha_queja": queja.get("fecha_queja", ""),
                "estado": queja.get("estado", "pendiente")
            }
            quejas_formateadas.append(queja_formateada)
        
        return {
            "success": True,
            "quejas": quejas_formateadas,
            "total": len(quejas_formateadas)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al obtener quejas: {str(e)}")
# Funciones auxiliares
async def contar_soporte_registrados():
    """Cuenta todos los documentos en la colección quejas"""
    collection = get_quejas_collection()
    return await collection.count_documents({})

async def contar_usuarios_registrados():
    """Cuenta todos los documentos en la colección usuarios"""
    collection = get_usuarios_collection()
    return await collection.count_documents({})

async def contar_unidades_en_transito():
    """Cuenta documentos con jornada_completada null en ruta_asignada"""
    collection = get_ruta_asignada_collection()
    return await collection.count_documents({"jornada_completada": None})

async def calcular_recaudacion_hoy():
    """Suma el monto de transacciones pago_viaje del día actual"""
    collection = get_transacciones_collection()
    
    # Obtener fecha actual en formato YYYY-MM-DD
    hoy = datetime.now().date()
    
    # Crear rango de fechas para el día completo
    inicio_dia = datetime.combine(hoy, datetime.min.time())
    fin_dia = datetime.combine(hoy, datetime.max.time())
    
    pipeline = [
        {
            "$match": {
                "tipo": "pago_viaje",
                "fecha_transaccion": {
                    "$gte": inicio_dia,
                    "$lte": fin_dia
                }
            }
        },
        {
            "$group": {
                "_id": None,
                "total_recaudado": {"$sum": "$monto"}
            }
        }
    ]
    
    cursor = collection.aggregate(pipeline)
    result = await cursor.to_list(length=1)
    
    return result[0]["total_recaudado"] if result else 0

async def contar_viajes_hoy():
    """Cuenta transacciones pago_viaje del día actual"""
    collection = get_transacciones_collection()
    
    # Obtener fecha actual en formato YYYY-MM-DD
    hoy = datetime.now().date()
    
    # Crear rango de fechas para el día completo
    inicio_dia = datetime.combine(hoy, datetime.min.time())
    fin_dia = datetime.combine(hoy, datetime.max.time())
    
    return await collection.count_documents({
        "tipo": "pago_viaje",
        "fecha_transaccion": {
            "$gte": inicio_dia,
            "$lte": fin_dia
        }
    })

