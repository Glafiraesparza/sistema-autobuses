from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from backend.models.auth import UsuarioCreate, EstadoUsuarioUpdate, UsuarioUpdate
from backend.services.usuarios_service import UsuarioService

usuario_service = UsuarioService()
router = APIRouter(prefix="/api/usuarios_personal", tags=["usuarios_personal"])

@router.post("/", response_model=dict)
async def crear_usuario(usuario: UsuarioCreate):
    """Endpoint para crear un nuevo usuario"""
    result = await usuario_service.crear_usuario(usuario)
    
    if not result["success"]:
        raise HTTPException(
            status_code=400, 
            detail=result["mensaje"]
        )
    
    return result

@router.get("/", response_model=dict)
async def listar_usuarios(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100)
):
    """Endpoint para listar usuarios"""
    usuarios = await usuario_service.obtener_usuarios(skip, limit)
    
    return {
        "success": True,
        "total": len(usuarios),
        "usuarios": usuarios
    }

@router.get("/buscar/", response_model=dict)
async def buscar_usuarios(
    query: Optional[str] = Query(None, description="Texto para buscar en nombre, email o rol"),
    rol: Optional[str] = Query(None, description="Filtrar por rol específico"),
    activo: Optional[bool] = Query(None, description="Filtrar por estado activo/inactivo"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100)
):
    """Endpoint para buscar usuarios con filtros"""
    usuarios = await usuario_service.buscar_usuarios(
        query=query,
        rol=rol,
        activo=activo,
        skip=skip,
        limit=limit
    )
    
    return {
        "success": True,
        "total": len(usuarios),
        "usuarios": usuarios
    }

@router.put("/{usuario_id}/estado")
async def cambiar_estado_usuario(
    usuario_id: str, 
    estado_data: EstadoUsuarioUpdate
):
    """Endpoint para activar/desactivar usuario"""
    success = await usuario_service.actualizar_estado_usuario(usuario_id, estado_data.activo)
    
    if not success:
        raise HTTPException(
            status_code=404, 
            detail="Usuario no encontrado"
        )
    
    return {
        "success": True,
        "mensaje": f"Usuario {'activado' if estado_data.activo else 'desactivado'} correctamente"
    }

@router.put("/{usuario_id}/editar")
async def editar_usuario(usuario_id: str, usuario_update: UsuarioUpdate):
    """Endpoint para editar datos del usuario (nombre, contraseña, turno)"""
    result = await usuario_service.editar_usuario(usuario_id, usuario_update)
    
    if not result["success"]:
        raise HTTPException(
            status_code=400, 
            detail=result["mensaje"]
        )
    
    return result

@router.delete("/{usuario_id}")
async def eliminar_usuario(usuario_id: str):
    """Endpoint para eliminar usuario"""
    success = await usuario_service.eliminar_usuario(usuario_id)
    
    if not success:
        raise HTTPException(
            status_code=404, 
            detail="Usuario no encontrado"
        )
    
    return {
        "success": True,
        "mensaje": "Usuario eliminado correctamente"
    }

@router.get("/{usuario_id}")
async def obtener_usuario(usuario_id: str):
    """Endpoint para obtener un usuario específico"""
    usuario = await usuario_service.obtener_usuario_por_id(usuario_id)
    
    if not usuario:
        raise HTTPException(
            status_code=404, 
            detail="Usuario no encontrado"
        )
    
    return {
        "success": True,
        "usuario": usuario
    }