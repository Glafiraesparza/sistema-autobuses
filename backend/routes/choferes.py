from fastapi import APIRouter
from backend.services.usuarios_service import usuario_service

router = APIRouter(prefix="/api/choferes", tags=["choferes"])

@router.get("/", response_model=dict)
async def listar_choferes_activos():
    """Endpoint para listar choferes activos"""
    choferes = await usuario_service.obtener_choferes_activos()
    
    return {
        "success": True,
        "total": len(choferes),
        "choferes": choferes
    }

@router.get("/turno/{turno}", response_model=dict)
async def listar_choferes_por_turno(turno: str):
    """Endpoint para listar choferes por turno"""
    if turno not in ["matutino", "vespertino"]:
        return {
            "success": False,
            "mensaje": "Turno no válido. Use: matutino o vespertino",
            "choferes": []
        }
    
    choferes = await usuario_service.obtener_choferes_por_turno(turno)
    
    return {
        "success": True,
        "total": len(choferes),
        "choferes": choferes
    }