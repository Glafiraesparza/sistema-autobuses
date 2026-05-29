from fastapi import APIRouter, HTTPException, Depends
from backend.models.asignacion_ruta import AsignacionRuta, AsignacionRutaResponse
from backend.database.mongodb import get_ruta_asignada_collection, get_usuarios_personal_collection, get_unidades_collection
from bson import ObjectId
import uuid
from datetime import datetime
from typing import Union 

router = APIRouter(prefix="/api/asignacion-rutas", tags=["Asignación de Rutas"])

@router.post("/", response_model=AsignacionRutaResponse)
async def crear_asignacion_ruta(asignacion: AsignacionRuta):
    collection = get_ruta_asignada_collection()
    usuarios_collection = get_usuarios_personal_collection()
    unidades_collection = get_unidades_collection()
    
    print(f"🔍 Buscando personal con ID: {asignacion.id_personal}")
    print(f"🔍 Buscando unidad con ID: {asignacion.id_unidad}")
    
    # Validar que el personal/chofer existe y tiene el campo id_personal
    personal = await usuarios_collection.find_one({"id_personal": asignacion.id_personal})
    if not personal:
        raise HTTPException(status_code=404, detail=f"Personal con ID {asignacion.id_personal} no encontrado")
    
    # Validar que es un chofer
    if personal.get('rol') != 'chofer':
        raise HTTPException(status_code=400, detail=f"El personal con ID {asignacion.id_personal} no es un chofer")
    
    # Validar que está activo
    if not personal.get('activo', True):
        raise HTTPException(status_code=400, detail=f"El chofer {asignacion.id_personal} no está activo")
    
    # Validar que la unidad existe
    unidad = await unidades_collection.find_one({"id_unidad": asignacion.id_unidad})
    if not unidad:
        raise HTTPException(status_code=404, detail=f"Unidad con ID {asignacion.id_unidad} no encontrada")
    
    # Verificar que no exista una asignación activa para esta unidad
    asignacion_existente_unidad = await collection.find_one({
        "id_unidad": asignacion.id_unidad,
        "jornada_completada": None
    })
    if asignacion_existente_unidad:
        raise HTTPException(
            status_code=400, 
            detail=f"La unidad {asignacion.id_unidad} ya tiene una asignación activa"
        )
    
    # Verificar que no exista una asignación activa para este personal
    asignacion_existente_personal = await collection.find_one({
        "id_personal": asignacion.id_personal,
        "jornada_completada": None
    })
    if asignacion_existente_personal:
        raise HTTPException(
            status_code=400, 
            detail=f"El personal {asignacion.id_personal} ya tiene una asignación activa"
        )
    
    # Generar ID único para la asignación
    id_asignacion = str(uuid.uuid4())
    
    # Crear documento CON LOS CAMPOS PARA EL CONTADOR DE VUELTAS
    asignacion_data = asignacion.dict()
    asignacion_data["id_asignacion"] = id_asignacion
    asignacion_data["fecha_asignacion"] = datetime.now()
    asignacion_data["jornada_completada"] = None
    asignacion_data["vueltas_completadas"] = 0  # 👈 AGREGAR ESTO
    asignacion_data["tiempo_vuelta"] = []       # 👈 AGREGAR ESTO
    
    # Insertar en la base de datos
    result = await collection.insert_one(asignacion_data)
    
    if result.inserted_id:
        # ✅ ACTUALIZAR ESTADO DE LA UNIDAD a "asignada" o "en tránsito"
        await unidades_collection.update_one(
            {"id_unidad": asignacion.id_unidad},
            {"$set": {"estado": "En Ruta"}}
        )
        
        return {**asignacion_data, "id_asignacion": id_asignacion}
    else:
        raise HTTPException(status_code=500, detail="Error al crear la asignación")

@router.delete("/{id_asignacion}")
async def eliminar_asignacion(id_asignacion: str):
    collection = get_ruta_asignada_collection()
    unidades_collection = get_unidades_collection()
    
    # Buscar la asignación
    asignacion = await collection.find_one({"id_asignacion": id_asignacion})
    if not asignacion:
        raise HTTPException(status_code=404, detail="Asignación no encontrada")
    
    result = await collection.delete_one({"id_asignacion": id_asignacion})
    
    if result.deleted_count > 0:
        # ✅ LIBERAR UNIDAD - Cambiar estado a "activo"
        await unidades_collection.update_one(
            {"id_unidad": asignacion["id_unidad"]},
            {"$set": {"estado": "activo"}}
        )
        
        return {"message": "Asignación eliminada correctamente"}
    else:
        raise HTTPException(status_code=500, detail="Error al eliminar la asignación")

@router.put("/completar/{id_asignacion}")
async def completar_jornada(id_asignacion: str):
    collection = get_ruta_asignada_collection()
    unidades_collection = get_unidades_collection()
    
    # Buscar la asignación
    asignacion = await collection.find_one({"id_asignacion": id_asignacion})
    if not asignacion:
        raise HTTPException(status_code=404, detail="Asignación no encontrada")
    
    # Actualizar la asignación como completada
    result = await collection.update_one(
        {"id_asignacion": id_asignacion},
        {"$set": {
            "jornada_completada": True,
            "fecha_finalizacion": datetime.now()
        }}
    )
    
    if result.modified_count > 0:
        # ✅ COMPLETAR JORNADA - Cambiar estado de unidad a "activo"
        await unidades_collection.update_one(
            {"id_unidad": asignacion["id_unidad"]},
            {"$set": {"estado": "activo"}}
        )
        
        return {"message": "Jornada completada correctamente"}
    else:
        raise HTTPException(status_code=500, detail="Error al completar la jornada")

@router.get("/", response_model=list[AsignacionRutaResponse])
async def obtener_asignaciones():
    collection = get_ruta_asignada_collection()
    
    asignaciones = []
    async for asignacion in collection.find().sort("fecha_asignacion", -1):
        asignaciones.append(AsignacionRutaResponse(**asignacion))
    
    return asignaciones

@router.get("/ruta/{ruta}", response_model=list[AsignacionRutaResponse])
async def obtener_asignaciones_por_ruta(ruta: str):
    collection = get_ruta_asignada_collection()
    
    asignaciones = []
    async for asignacion in collection.find({"ruta": ruta}).sort("fecha_asignacion", -1):
        asignaciones.append(AsignacionRutaResponse(**asignacion))
    
    return asignaciones

@router.get("/activas", response_model=list[AsignacionRutaResponse])
async def obtener_asignaciones_activas():
    collection = get_ruta_asignada_collection()
    
    asignaciones = []
    async for asignacion in collection.find({"jornada_completada": None}).sort("fecha_asignacion", -1):
        asignaciones.append(AsignacionRutaResponse(**asignacion))
    
    return asignaciones

@router.get("/chofer/{id_personal}/activa")
async def obtener_asignacion_activa_chofer(id_personal: Union[str, int]):
    """Obtener la asignación activa de un chofer específico"""
    collection = get_ruta_asignada_collection()
    
    # Convertir a string si es número, para consistencia en la búsqueda
    if isinstance(id_personal, int):
        id_personal = str(id_personal)
    
    asignacion = await collection.find_one({
        "id_personal": id_personal,
        "jornada_completada": None
    })
    
    if not asignacion:
        raise HTTPException(status_code=404, detail="No hay asignación activa para este chofer")
    
    return AsignacionRutaResponse(**asignacion)