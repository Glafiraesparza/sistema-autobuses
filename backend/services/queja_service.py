from fastapi import HTTPException
from backend.database.mongodb import mongodb
from backend.models.queja import QuejaCrear
from datetime import datetime
from bson import ObjectId

async def crear_reporte_queja(datos: QuejaCrear):
    collection = mongodb.get_quejas_collection()
    
    # Agregar fechas automáticas
    nuevo_reporte = datos.dict()
    nuevo_reporte["fecha_reporte"] = datetime.now()
    nuevo_reporte["ultima_actualizacion"] = datetime.now()
    nuevo_reporte["historial_estados"] = [{
        "estado": datos.estado,
        "fecha": datetime.now(),
        "notas": "Reporte creado",
        "realizado_por": datos.id_usuario
    }]
    
    resultado = await collection.insert_one(nuevo_reporte)
    
    if not resultado.inserted_id:
        raise HTTPException(status_code=500, detail="No se pudo guardar el reporte")
    
    return {
        "mensaje": "Reporte enviado exitosamente",
        "id_reporte": str(resultado.inserted_id)
    }

async def obtener_todas_quejas(estado: str = None, tipo: str = None, limit: int = 100, skip: int = 0):
    collection = mongodb.get_quejas_collection()
    usuarios_collection = mongodb.get_usuarios_collection()
    
    # Construir filtro
    filtro = {}
    if estado:
        filtro["estado"] = estado
    if tipo:
        filtro["tipo_reporte"] = tipo
    
    total = await collection.count_documents(filtro)
    
    cursor = collection.find(filtro).sort("fecha_reporte", -1).skip(skip).limit(limit)
    quejas = await cursor.to_list(length=limit)
    
    # Enriquecer con datos del usuario
    quejas_enriquecidas = []
    for queja in quejas:
        queja["_id"] = str(queja["_id"])
        # Obtener info del usuario
        usuario = await usuarios_collection.find_one({"id_usuario": queja["id_usuario"]})
        if usuario:
            queja["nombre_usuario"] = usuario.get("nombre", "Usuario")
            queja["email_usuario"] = usuario.get("email", "")
        quejas_enriquecidas.append(queja)
    
    return {
        "success": True,
        "total": total,
        "quejas": quejas_enriquecidas
    }

async def actualizar_seguimiento_queja(id_queja: str, estado: str, notas_admin: str, admin_id: str):
    collection = mongodb.get_quejas_collection()
    
    # Buscar queja existente
    queja = await collection.find_one({"_id": ObjectId(id_queja)})
    if not queja:
        raise HTTPException(status_code=404, detail="Queja no encontrada")
    
    # Preparar historial
    historial_actual = queja.get("historial_estados", [])
    historial_actual.append({
        "estado": estado,
        "fecha": datetime.now(),
        "notas": notas_admin,
        "realizado_por": admin_id
    })
    
    # Actualizar
    result = await collection.update_one(
        {"_id": ObjectId(id_queja)},
        {
            "$set": {
                "estado": estado,
                "notas_admin": notas_admin,
                "ultima_actualizacion": datetime.now(),
                "historial_estados": historial_actual
            }
        }
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=500, detail="No se pudo actualizar")
    
    return {"success": True, "mensaje": "Seguimiento actualizado"}

async def obtener_estadisticas_quejas():
    collection = mongodb.get_quejas_collection()
    
    total = await collection.count_documents({})
    pendientes = await collection.count_documents({"estado": "Pendiente"})
    en_proceso = await collection.count_documents({"estado": "En Proceso"})
    resueltos = await collection.count_documents({"estado": "Resuelto"})
    incidentes = await collection.count_documents({"tipo_reporte": "incidente_trabajador"})
    quejas_usuario = await collection.count_documents({"tipo_reporte": "queja"})
    
    return {
        "success": True,
        "estadisticas": {
            "total": total,
            "pendientes": pendientes,
            "en_proceso": en_proceso,
            "resueltos": resueltos,
            "incidentes": incidentes,
            "quejas_usuario": quejas_usuario
        }
    }