from fastapi import APIRouter, Body, HTTPException
from backend.models.usuario import UsuarioConfiguracion
from backend.services.configuracion_service import actualizar_configuracion_usuario

router = APIRouter()

@router.put("/usuarios/{id_usuario}/configuracion", response_description="Actualizar nombre de usuario")
async def actualizar_datos(id_usuario: str, datos: UsuarioConfiguracion = Body(...)):
    """
    Actualiza únicamente el nombre del usuario.
    """
    try:
        response = await actualizar_configuracion_usuario(id_usuario, datos)
        return response
    except Exception as e:
        # Si es un error HTTP conocido (como 404), lo dejamos pasar
        if isinstance(e, HTTPException):
            raise e
        # Si es otro error, lanzamos 500
        print(f"Error en actualización: {e}")
        raise HTTPException(status_code=500, detail="Error interno del servidor al actualizar datos")