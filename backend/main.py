from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from backend.database.mongodb import mongodb
from backend.routes import (
    asignacion_rutas,
    rutas,
    usuarios,
    qr_pagos,
    transacciones,
    password_routes,
    recarga_routes,
    tarifa_preferencial_routes,
    configuracion_routes,
    notificaciones,
    auth_routes,
    camiones_routes,
    usuarios_personal,
    admin_routes,
    choferes,
    unidades,
    parada_routes,
    metricas_admin,
    reportes,
    quejas_routes,
    chofer_progreso,
    configuracion_tarifa_routes
)

import os

app = FastAPI(
    title="Sistema de Autobuses API",
    description="API para gestionar rutas y autobuses",
    version="1.0.0"
)

# CONFIGURACIÓN CORS PARA RENDER
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://sistema-autobuses.onrender.com"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Obtener la ruta base del proyecto
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")

# Servir archivos estáticos del frontend
app.mount(
    "/css",
    StaticFiles(directory=os.path.join(FRONTEND_DIR, "css")),
    name="css"
)

app.mount(
    "/js",
    StaticFiles(directory=os.path.join(FRONTEND_DIR, "js")),
    name="js"
)

# =========================
# FRONTEND
# =========================

@app.get("/")
async def serve_home():
    """Servir página principal"""
    page_path = os.path.join(FRONTEND_DIR, "pasajero_inicio.html")

    if os.path.exists(page_path):
        return FileResponse(page_path)

    return {"error": "Frontend no encontrado"}

@app.get("/{page_name}")
async def serve_html_page(page_name: str):
    """Servir archivos HTML"""

    known_pages = {
        "inicio": "pasajero_inicio.html",
        "qr": "pasajero_qr.html",
        "historial": "pasajero_historial.html",
        "login": "inicio_sesion.html",
        "escaner": "escaner_qr.html",
        "admin": "admin_dashboard.html",
        "chofer": "chofer_dashboard.html"
    }

    # Alias conocidos
    if page_name in known_pages:
        page_path = os.path.join(FRONTEND_DIR, known_pages[page_name])

        if os.path.exists(page_path):
            return FileResponse(page_path)

    # Archivo HTML directo
    elif page_name.endswith(".html"):
        page_path = os.path.join(FRONTEND_DIR, page_name)

        if os.path.exists(page_path):
            return FileResponse(page_path)

    raise HTTPException(
        status_code=404,
        detail="Página no encontrada"
    )

# =========================
# EVENTOS
# =========================

@app.on_event("startup")
async def startup_event():
    await mongodb.connect()

    print("=" * 60)
    print("🚀 SISTEMA DE AUTOBUSES INICIADO")
    print("=" * 60)
    print("✅ MongoDB conectado")
    print("🌐 Producción en Render")
    print("=" * 60)

@app.on_event("shutdown")
async def shutdown_event():
    await mongodb.disconnect()
    print("❌ MongoDB desconectado")

# =========================
# ROUTERS
# =========================

app.include_router(rutas.router)
app.include_router(usuarios.router)
app.include_router(qr_pagos.router)
app.include_router(transacciones.router)
app.include_router(password_routes.router)
app.include_router(recarga_routes.router)
app.include_router(tarifa_preferencial_routes.router)
app.include_router(configuracion_routes.router, prefix="/api")
app.include_router(notificaciones.router)
app.include_router(auth_routes.router)
app.include_router(camiones_routes.router)
app.include_router(usuarios_personal.router)
app.include_router(admin_routes.router)
app.include_router(unidades.router)
app.include_router(choferes.router)
app.include_router(asignacion_rutas.router)
app.include_router(parada_routes.router)
app.include_router(metricas_admin.router)
app.include_router(reportes.router)
app.include_router(quejas_routes.router, prefix="/api")
app.include_router(chofer_progreso.router)
app.include_router(configuracion_tarifa_routes.router)

# =========================
# ROOT API
# =========================

@app.get("/api")
async def root():
    return {
        "message": "Sistema de Autobuses API",
        "status": "activo",
        "frontend": {
            "home": "/",
            "login": "/login",
            "qr": "/qr",
            "historial": "/historial",
            "escaner": "/escaner"
        },
        "api_docs": "/docs"
    }

# =========================
# MAIN
# =========================

if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", 8000))

    uvicorn.run(
        "backend.main:app",
        host="0.0.0.0",
        port=port
    )