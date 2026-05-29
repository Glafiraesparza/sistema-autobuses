from fastapi import HTTPException
from backend.database.mongodb import mongodb
from backend.models.queja import QuejaCrear

async def crear_reporte_queja(datos: QuejaCrear):
    # 1. Obtener la colección
    collection = mongodb.get_quejas_collection()

    # 2. Preparar el documento
    nuevo_reporte = datos.dict()
    
    # 3. Insertar en MongoDB
    resultado = await collection.insert_one(nuevo_reporte)

    if not resultado.inserted_id:
        raise HTTPException(status_code=500, detail="No se pudo guardar el reporte")

    return {
        "mensaje": "Reporte enviado exitosamente",
        "id_reporte": str(resultado.inserted_id)
    }