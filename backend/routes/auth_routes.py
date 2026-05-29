from fastapi import APIRouter, HTTPException
from backend.models.auth import LoginRequest, LoginResponse
from backend.services.auth_service import auth_service

router = APIRouter(prefix="/api/auth", tags=["Autenticación"])

@router.post("/login", response_model=LoginResponse)
async def login(login_request: LoginRequest):
    """Endpoint para login de personal"""
    try:
        result = await auth_service.login(login_request)
        if not result.success:
            raise HTTPException(status_code=401, detail=result.mensaje)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error en login: {str(e)}")

@router.post("/inicializar-usuarios")
async def inicializar_usuarios():
    """Endpoint para crear usuarios iniciales (solo desarrollo)"""
    try:
        await auth_service.crear_usuario_inicial()
        return {"mensaje": "Usuarios iniciales creados exitosamente"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")