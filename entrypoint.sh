#!/bin/bash

echo "🔧 Configurando para entorno LOCAL (localhost)..."

# Configurar según el entorno
if [ "$DOCKER_ENV" = "local" ]; then
    echo "🔧 Configurando para entorno LOCAL (localhost)..."
    
    # Reemplazar IP por localhost en mongodb.py
    # IMPORTANTE: Necesitamos modificar la línea específica
    if [ -f "/app/backend/database/mongodb.py" ]; then
        echo "🔄 Actualizando mongodb.py para conexión local..."
        # Usamos un approach más robusto
        sed -i "s|MONGODB_URL = \".*\"|MONGODB_URL = \"mongodb://mongodb:27017\"|g" /app/backend/database/mongodb.py
        
        # También podemos usar variable de entorno
        echo "✅ mongodb.py actualizado"
    fi
    
    # Reemplazar en config_global.js si existe
    if [ -f "/app/frontend/js/config_global.js" ]; then
        echo "🔄 Actualizando config_global.js..."
        # Busca y reemplaza la IP
        sed -i "s|const serverIp = \".*\"|const serverIp = \"localhost\"|g" /app/frontend/js/config_global.js
        sed -i "s|192\.168\.1\.132|localhost|g" /app/frontend/js/config_global.js
        echo "✅ config_global.js actualizado"
    fi
else
    echo "🌐 Configurando para entorno RED..."
    
    if [ -n "$SERVER_IP" ]; then
        if [ -f "/app/backend/database/mongodb.py" ]; then
            echo "🔄 Actualizando mongodb.py para IP: $SERVER_IP..."
            sed -i "s|MONGODB_URL = \".*\"|MONGODB_URL = \"mongodb://$SERVER_IP:27017\"|g" /app/backend/database/mongodb.py
        fi
        
        if [ -f "/app/frontend/js/config_global.js" ]; then
            echo "🔄 Actualizando config_global.js para IP: $SERVER_IP..."
            sed -i "s|const serverIp = \".*\"|const serverIp = \"$SERVER_IP\"|g" /app/frontend/js/config_global.js
        fi
    fi
fi

# Esperar a que MongoDB esté listo (mejor método)
echo "⏳ Esperando a MongoDB..."
counter=0
max_attempts=30

while true; do
    # Intenta conectar a MongoDB
    if python -c "
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import sys

async def test_connection():
    try:
        client = AsyncIOMotorClient('mongodb://mongodb:27017', serverSelectionTimeoutMS=2000)
        await client.admin.command('ping')
        return True
    except Exception as e:
        return False
    finally:
        if 'client' in locals():
            client.close()

loop = asyncio.new_event_loop()
asyncio.set_event_loop(loop)
result = loop.run_until_complete(test_connection())
loop.close()
sys.exit(0 if result else 1)
" &> /dev/null; then
        echo "✅ MongoDB está listo"
        break
    fi
    
    counter=$((counter + 1))
    if [ $counter -ge $max_attempts ]; then
        echo "❌ Timeout esperando MongoDB"
        exit 1
    fi
    
    echo "⏳ Intento $counter/$max_attempts - MongoDB no está listo, esperando..."
    sleep 2
done

# Iniciar la aplicación
echo "🚀 Iniciando aplicación FastAPI..."
echo "📂 Certificados disponibles:"
ls -la /app/certificates/ || echo "No hay certificados"

exec uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload \
     --ssl-keyfile certificates/localhost+3-key.pem \
     --ssl-certfile certificates/localhost+3.pem