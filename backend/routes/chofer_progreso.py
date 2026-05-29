from fastapi import APIRouter, HTTPException
from backend.models.asignacion_ruta import VueltaRequest, IncidenteRequest
from backend.database.mongodb import get_ruta_asignada_collection
from backend.services.unidades_service import unidad_service
from datetime import datetime
import random

router = APIRouter(prefix="/api/chofer-progreso", tags=["Progreso de Chofer"])

@router.post("/registrar-vuelta")
async def registrar_vuelta(vuelta: VueltaRequest):
    collection = get_ruta_asignada_collection()
    
    # Buscar la asignación activa
    asignacion = await collection.find_one({
        "id_asignacion": vuelta.id_asignacion
    })
    
    if not asignacion:
        raise HTTPException(status_code=404, detail="Asignación no encontrada")
    
    # VERIFICAR SI LA JORNADA YA ESTÁ COMPLETADA
    if asignacion.get("jornada_completada", False):
        raise HTTPException(status_code=400, detail="Jornada ya completada")
    
    # Generar tiempo aleatorio entre 30-60 minutos
    tiempo_aleatorio = random.randint(30, 60)
    
    # Obtener vueltas actuales
    vueltas_actuales = asignacion.get("vueltas_completadas", 0) or 0
    nuevas_vueltas = vueltas_actuales + 1
    
    # Preparar update data
    update_data = {
        "$push": {"tiempo_vuelta": tiempo_aleatorio},
        "$set": {"vueltas_completadas": nuevas_vueltas}
    }
    
    # Verificar si completó 10 vueltas
    jornada_completada = nuevas_vueltas >= 10
    if jornada_completada:
        update_data["$set"].update({
            "jornada_completada": True,
            "fecha_finalizacion": datetime.now()
        })
    
    result = await collection.update_one(
        {"id_asignacion": vuelta.id_asignacion},
        update_data
    )
    
    if result.modified_count > 0:
        # SI SE COMPLETARON 10 VUELTAS, ACTUALIZAR EL ESTADO DE LA UNIDAD
        if jornada_completada:
            try:
                # Obtener el ID de la unidad de la asignación
                id_unidad = asignacion.get("id_unidad")
                if id_unidad:
                    # Actualizar el estado de la unidad a "activo"
                    datos_actualizacion = {"estado": "activo"}
                    actualizacion_exitosa = await unidad_service.actualizar_estado(id_unidad, datos_actualizacion)
                    
                    if actualizacion_exitosa:
                        print(f"✅ Estado de unidad {id_unidad} actualizado a 'activo'")
                    else:
                        print(f"⚠️ No se pudo actualizar el estado de la unidad {id_unidad}")
                else:
                    print("⚠️ No se encontró id_unidad en la asignación")
            except Exception as e:
                print(f"❌ Error al actualizar estado de unidad: {str(e)}")
        
        return {
            "success": True,
            "mensaje": f"Vuelta registrada. Tiempo: {tiempo_aleatorio} minutos",
            "vueltas_completadas": nuevas_vueltas,
            "jornada_completada": jornada_completada
        }
    else:
        raise HTTPException(status_code=500, detail="Error al registrar vuelta")

@router.post("/reportar-incidente")
async def reportar_incidente(incidente: IncidenteRequest):
    collection = get_ruta_asignada_collection()
    
    # Buscar la asignación activa
    asignacion = await collection.find_one({
        "id_asignacion": incidente.id_asignacion,
        "jornada_completada": None
    })
    
    if not asignacion:
        raise HTTPException(status_code=404, detail="Asignación activa no encontrada")
    
    # Terminar la jornada por incidente
    result = await collection.update_one(
        {"id_asignacion": incidente.id_asignacion},
        {
            "$set": {
                "jornada_completada": True,
                "fecha_finalizacion": datetime.now(),
                "incidente_reportado": {
                    "tipo": incidente.tipo_incidente,
                    "descripcion": incidente.descripcion,
                    "fecha": datetime.now()
                }
            }
        }
    )
    
    if result.modified_count > 0:
        return {
            "success": True,
            "mensaje": "Incidente reportado y jornada terminada"
        }
    else:
        raise HTTPException(status_code=500, detail="Error al reportar incidente")

@router.get("/estado/{id_asignacion}")
async def obtener_estado_jornada(id_asignacion: str):
    collection = get_ruta_asignada_collection()
    
    asignacion = await collection.find_one({"id_asignacion": id_asignacion})
    
    if not asignacion:
        raise HTTPException(status_code=404, detail="Asignación no encontrada")
    
    return {
        "vueltas_completadas": asignacion.get("vueltas_completadas", 0),
        "jornada_completada": asignacion.get("jornada_completada", False),
        "ruta": asignacion.get("ruta"),
        "tiempo_vuelta": asignacion.get("tiempo_vuelta", [])
    }