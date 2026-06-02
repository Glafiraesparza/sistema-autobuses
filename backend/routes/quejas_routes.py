from fastapi import APIRouter, Body, HTTPException, Query, Request
from backend.database.mongodb import mongodb, get_notificaciones_collection
from backend.models.queja import QuejaCrear, QuejaUpdate
from backend.services.queja_service import (
    crear_reporte_queja, 
    obtener_todas_quejas,
    actualizar_seguimiento_queja,
    obtener_estadisticas_quejas
)
from typing import Optional
from bson import ObjectId
from datetime import datetime

router = APIRouter()

@router.post("/quejas", response_description="Crear un nuevo reporte o queja")
async def crear_queja(datos: QuejaCrear = Body(...)):
    try:
        response = await crear_reporte_queja(datos)
        return response
    except Exception as e:
        print(f"Error al crear queja: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/quejas/todas", response_description="Obtener todas las quejas (Admin)")
async def get_todas_quejas(
    estado: Optional[str] = Query(None, description="Filtrar por estado"),
    tipo: Optional[str] = Query(None, description="Filtrar por tipo (queja/incidente_trabajador)"),
    limit: int = Query(100, ge=1, le=500),
    skip: int = Query(0, ge=0)
):
    try:
        response = await obtener_todas_quejas(estado, tipo, limit, skip)
        return response
    except Exception as e:
        print(f"Error al obtener quejas: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/quejas/{id_queja}/seguimiento", response_description="Actualizar seguimiento de queja")
async def actualizar_seguimiento(
    id_queja: str,
    request: Request
):
    try:
        # Leer el body como JSON
        body = await request.json()
        print(f"📥 Body recibido: {body}")
        
        estado = body.get("estado")
        notas_admin = body.get("notas_admin", "")
        admin_id = body.get("admin_id", "admin_desconocido")
        
        # Validar que el estado no esté vacío
        if not estado:
            raise HTTPException(status_code=422, detail="El campo 'estado' es requerido")
        
        # Validar que el estado sea válido
        if estado not in ["Pendiente", "En Proceso", "Resuelto"]:
            raise HTTPException(status_code=422, detail=f"Estado inválido: {estado}. Debe ser Pendiente, En Proceso o Resuelto")
        
        print(f"✅ Procesando: id={id_queja}, estado={estado}, notas={notas_admin}, admin={admin_id}")
        
        response = await actualizar_seguimiento_queja(id_queja, estado, notas_admin, admin_id)
        return response
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error al actualizar seguimiento: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/quejas/estadisticas", response_description="Obtener estadísticas de quejas")
async def get_estadisticas():
    try:
        response = await obtener_estadisticas_quejas()
        return response
    except Exception as e:
        print(f"Error al obtener estadísticas: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/incidentes-notificaciones", response_description="Obtener incidentes de notificaciones (emergencias)")
async def obtener_incidentes_notificaciones(
    estado: Optional[str] = Query(None, description="Filtrar por estado"),
    limit: int = Query(100, ge=1, le=500),
    skip: int = Query(0, ge=0)
):
    """
    Obtener incidentes reportados por choferes desde la colección de notificaciones
    """
    try:
        collection = get_notificaciones_collection()
        usuarios_personal_collection = mongodb.database.usuarios_personal
        
        # Construir filtro
        filtro = {"tipo": "emergencia"}
        
        if estado:
            filtro["estado_seguimiento"] = estado
        
        total = await collection.count_documents(filtro)
        
        cursor = collection.find(filtro).sort("timestamp", -1).skip(skip).limit(limit)
        incidentes = await cursor.to_list(length=limit)
        
        # Formatear incidentes con datos del chofer
        incidentes_formateados = []
        for inc in incidentes:
            # Obtener ID del chofer (puede estar en diferentes campos)
            id_chofer = inc.get("id_chofer") or inc.get("id_personal") or inc.get("usuario_id") or "desconocido"
            
            # Buscar datos del chofer en la colección de personal
            nombre_chofer = f"Chofer ID: {id_chofer}"
            email_chofer = ""
            
            if id_chofer != "desconocido":
                try:
                    # Buscar por id_personal
                    query = None
                    if str(id_chofer).isdigit():
                        query = {"id_personal": int(id_chofer)}
                    else:
                        query = {"id_personal": id_chofer}
                    
                    chofer = await usuarios_personal_collection.find_one(query)
                    if chofer:
                        nombre_chofer = chofer.get("nombre", f"Chofer ID: {id_chofer}")
                        email_chofer = chofer.get("email", "")
                except Exception as e:
                    print(f"Error buscando chofer: {e}")
            
            incidentes_formateados.append({
                "_id": str(inc["_id"]),
                "id_usuario": str(id_chofer),
                "nombre_usuario": nombre_chofer,
                "email_usuario": email_chofer,
                "tipo_reporte": "incidente_trabajador",
                "origen": "notificacion",
                "ruta": inc.get("ruta_afectada", "N/A"),
                "numero_unidad": str(inc.get("id_camion", "N/A")),
                "descripcion": inc.get("mensaje", "Sin descripción"),
                "estado": inc.get("estado_seguimiento", "Pendiente"),
                "notas_admin": inc.get("notas_admin", ""),
                "fecha_reporte": inc.get("timestamp"),
                "historial_estados": inc.get("historial_estados", [])
            })
        
        return {
            "success": True,
            "total": total,
            "quejas": incidentes_formateados
        }
        
    except Exception as e:
        print(f"Error al obtener incidentes de notificaciones: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/incidentes-notificaciones/{id_incidente}/seguimiento")
async def actualizar_seguimiento_incidente_notificacion(
    id_incidente: str,
    request: Request
):
    """
    Actualizar seguimiento de incidente de notificación (emergencia)
    """
    try:
        # Leer body como JSON
        body = await request.json()
        
        estado = body.get("estado")
        notas_admin = body.get("notas_admin", "")
        admin_id = body.get("admin_id", "admin_desconocido")
        
        # Convertir admin_id a string si es número
        admin_id = str(admin_id)
        
        # Validaciones
        if not estado:
            raise HTTPException(status_code=422, detail="El campo 'estado' es requerido")
        
        if estado not in ["Pendiente", "En Proceso", "Resuelto"]:
            raise HTTPException(status_code=422, detail=f"Estado inválido: {estado}")
        
        collection = get_notificaciones_collection()
        
        # Buscar incidente
        incidente = await collection.find_one({"_id": ObjectId(id_incidente)})
        if not incidente:
            raise HTTPException(status_code=404, detail="Incidente no encontrado")
        
        # Preparar historial
        historial_actual = incidente.get("historial_estados", [])
        historial_actual.append({
            "estado": estado,
            "fecha": datetime.now(),
            "notas": notas_admin,
            "realizado_por": admin_id
        })
        
        # Actualizar
        result = await collection.update_one(
            {"_id": ObjectId(id_incidente)},
            {
                "$set": {
                    "estado_seguimiento": estado,
                    "notas_admin": notas_admin,
                    "ultima_actualizacion": datetime.now(),
                    "historial_estados": historial_actual
                }
            }
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=500, detail="No se pudo actualizar")
        
        return {"success": True, "mensaje": "Seguimiento actualizado"}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error actualizando incidente: {e}")
        raise HTTPException(status_code=500, detail=str(e))