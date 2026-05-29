from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from backend.database.mongodb import mongodb
from backend.routes import asignacion_rutas, rutas, usuarios, qr_pagos, transacciones, password_routes, recarga_routes, tarifa_preferencial_routes, configuracion_routes, notificaciones, auth_routes, camiones_routes, usuarios_personal, admin_routes, choferes, unidades, parada_routes, metricas_admin, reportes, quejas_routes, chofer_progreso
import os
import socket
import platform

app = FastAPI(
    title="Sistema de Autobuses API",
    description="API para gestionar rutas y autobuses",
    version="1.0.0"
)

# CONFIGURACIÓN CORS MÁS PERMISIVA
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Permite todos los orígenes
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Obtener la ruta base del proyecto
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")

# Servir archivos estáticos del frontend
app.mount("/css", StaticFiles(directory=os.path.join(FRONTEND_DIR, "css")), name="css")
app.mount("/js", StaticFiles(directory=os.path.join(FRONTEND_DIR, "js")), name="js")

# Función para obtener la IP local
def get_local_ip():
    try:
        # Crear un socket para obtener la IP
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

# Servir páginas HTML del frontend
@app.get("/")
async def serve_home():
    """Servir página principal"""
    page_path = os.path.join(FRONTEND_DIR, "pasajero_inicio.html")
    if os.path.exists(page_path):
        return FileResponse(page_path)
    return {"error": "Frontend no encontrado"}

@app.get("/{page_name}")
async def serve_html_page(page_name: str):
    """Servir cualquier archivo HTML por su nombre"""
    # Lista de páginas conocidas
    known_pages = {
        "inicio": "pasajero_inicio.html",
        "qr": "pasajero_qr.html",
        "historial": "pasajero_historial.html",
        "login": "inicio_sesion.html",
        "escaner": "escaner_qr.html",
        "admin": "admin_dashboard.html",
        "chofer": "chofer_dashboard.html"
    }
    
    # Si es una página conocida con alias
    if page_name in known_pages:
        page_path = os.path.join(FRONTEND_DIR, known_pages[page_name])
        if os.path.exists(page_path):
            return FileResponse(page_path)
    
    # Si es directamente un archivo HTML
    elif page_name.endswith('.html'):
        page_path = os.path.join(FRONTEND_DIR, page_name)
        if os.path.exists(page_path):
            return FileResponse(page_path)
    
    raise HTTPException(status_code=404, detail="Página no encontrada")

@app.on_event("startup")
async def startup_event():
    await mongodb.connect()
    
    # Obtener IP local
    local_ip = get_local_ip()
    
    print("=" * 60)
    print("🚀 SISTEMA DE AUTOBUSES - INICIADO (HTTPS)")
    print("=" * 60)
    print(f"✅ MongoDB conectado: Urbano")
    print(f"🔒 Servidor seguro HTTPS activo")
    print(f"📍 Acceso LOCAL:")
    print(f"   • https://localhost:8000")
    print(f"   • https://127.0.0.1:8000")
    print(f"🌐 Acceso desde la MISMA RED:")
    print(f"   • https://{local_ip}:8000")
    print(f"📱 Páginas disponibles:")
    print(f"   • Principal: https://{local_ip}:8000/")
    print(f"   • Login: https://{local_ip}:8000/login")
    print(f"   • QR Pagos: https://{local_ip}:8000/qr")
    print(f"   • Historial: https://{local_ip}:8000/historial")
    print(f"   • Escáner: https://{local_ip}:8000/escaner")
    print(f"   • Documentación API: https://{local_ip}:8000/docs")
    print("=" * 60)
    print("⚠️  ADVERTENCIA: Certificado de desarrollo")
    print("   Puede aparecer como 'No seguro' en el navegador")
    print("   Ignorar advertencia para desarrollo")
    print("=" * 60)
    print("📋 Para que otros accedan:")
    print(f"   1. Deben estar en la MISMA red Wi-Fi/Ethernet")
    print(f"   2. Usar la URL: https://{local_ip}:8000")
    print(f"   3. Aceptar certificado si aparece advertencia")
    print("=" * 60)

@app.on_event("shutdown")
async def shutdown_event():
    await mongodb.disconnect()
    print("🔒 MongoDB desconectado - Aplicación cerrada")

# Incluir todos los routers
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

@app.get("/api")
async def root():
    return {
        "message": "Sistema de Autobuses API", 
        "status": "activo",
        "protocol": "https",
        "access": {
            "local": "https://localhost:8000",
            "network": f"https://{get_local_ip()}:8000"
        },
        "frontend": {
            "home": "/",
            "login": "/login",
            "qr": "/qr",
            "historial": "/historial",
            "escaner": "/escaner"
        },
        "api_docs": "/docs"
    }

if __name__ == "__main__":
    import uvicorn
    import os

    port = int(os.environ.get("PORT", 8000))

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=port,
        reload=True
    )
    
    local_ip = get_local_ip()
    
    # Rutas para los certificados
    CERT_PATH = os.path.join(BASE_DIR, "certificates")
    
    # Listar archivos en la carpeta de certificados para ver los nombres
    cert_files = os.listdir(CERT_PATH) if os.path.exists(CERT_PATH) else []
    print("📁 Archivos en carpeta certificates:", cert_files)
    
    # Buscar automáticamente los certificados
    cert_file = None
    key_file = None
    
    for file in cert_files:
        if file.endswith('.pem'):
            if '-key.pem' in file:
                key_file = file
            else:
                cert_file = file
    
    if cert_file and key_file:
        print(f"✅ Certificado encontrado: {cert_file}")
        print(f"✅ Clave encontrada: {key_file}")
        
        cert_path = os.path.join(CERT_PATH, cert_file)
        key_path = os.path.join(CERT_PATH, key_file)
        
        print("🚀 Iniciando servidor HTTPS...")
        print(f"📡 URLs de acceso:")
        print(f"   • https://localhost:8000")
        print(f"   • https://127.0.0.1:8000")
        print(f"   • https://{local_ip}:8000")
        print("\n⚠️  IMPORTANTE:")
        print("   El navegador mostrará advertencia de seguridad")
        print("   Haz clic en 'Avanzado' y luego en 'Continuar al sitio'")
        print("=" * 60)
        
        uvicorn.run(
            app, 
            host="0.0.0.0",
            port=8000, 
            reload=True,
            ssl_keyfile=key_path,
            ssl_certfile=cert_path
        )
    else:
        print("❌ No se encontraron certificados en la carpeta 'certificates'")
        print("\n📝 Genera los certificados con estos comandos:")
        print(f"   1. cd {BASE_DIR}")
        print("   2. mkdir certificates")
        print("   3. cd certificates")
        print(f"   4. mkcert localhost 127.0.0.1 {local_ip}")
        print("\n🔍 Archivos generados esperados:")
        print("   - localhost+2.pem (o similar)")
        print("   - localhost+2-key.pem (o similar)")
        print("\n💡 O ejecuta este comando completo:")
        print(f"   mkdir certificates && cd certificates && mkcert -install && mkcert localhost 127.0.0.1 {local_ip} && cd ..")
        print("\n🔄 Intenta ejecutar de nuevo después de generar los certificados")