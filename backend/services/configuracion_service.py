from fastapi import HTTPException
from backend.database.mongodb import mongodb
from backend.models.usuario import UsuarioConfiguracion

async def actualizar_configuracion_usuario(id_usuario: str, datos: UsuarioConfiguracion):
    # 1. Obtener la colección
    collection = mongodb.get_usuarios_collection()

    # 2. Buscar al usuario (String o Entero)
    usuario = await collection.find_one({"id_usuario": id_usuario})
    
    if not usuario:
        try:
            usuario = await collection.find_one({"id_usuario": int(id_usuario)})
        except ValueError:
            pass

    if not usuario:
        raise HTTPException(status_code=404, detail=f"Usuario con id {id_usuario} no encontrado")

    # 3. Actualizar SOLO el nombre
    await collection.update_one(
        {"_id": usuario["_id"]},
        {"$set": {"nombre": datos.nombre}}
    )

    # 4. Retornar los datos actualizados
    usuario_actualizado = await collection.find_one({"_id": usuario["_id"]})
    
    return {
        "id_usuario": usuario_actualizado.get("id_usuario"),
        "nombre": usuario_actualizado.get("nombre"),
        "email": usuario_actualizado.get("email"),
        "mensaje": "Nombre actualizado correctamente"
    }