FROM python:3.9-slim

WORKDIR /app

# Instalar dependencias del sistema (agrega netcat)
RUN apt-get update && apt-get install -y \
    gcc \
    libssl-dev \
    netcat-openbsd \
    && rm -rf /var/lib/apt/lists/*

# Copiar requirements e instalar dependencias
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar el proyecto
COPY . .

# Script de permisos
RUN chmod +x /app/entrypoint.sh

# Variables de entorno por defecto
ENV PYTHONPATH=/app
ENV MONGODB_URL=mongodb://mongodb:27017
ENV DOCKER_ENV=true

# Puerto expuesto
EXPOSE 8000

# Punto de entrada
ENTRYPOINT ["/app/entrypoint.sh"]