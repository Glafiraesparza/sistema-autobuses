import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

class MongoDB:
    client: AsyncIOMotorClient = None
    database = None
    
    async def connect(self):
        """Conectar a MongoDB"""
        # Usar variable de entorno o valor por defecto
        MONGODB_URL = os.getenv("MONGODB_URL")
        self.client = AsyncIOMotorClient(MONGODB_URL)
        self.database = self.client["Urbano"]
        print(f"✅ Conectado a MongoDB: {MONGODB_URL} - Base de datos: Urbano")
    
    async def disconnect(self):
        """Desconectar de MongoDB"""
        if self.client:
            self.client.close()
            print("❌ Desconectado de MongoDB")
    
    def get_rutas_collection(self):
        """Obtener la colección Ruta - conexión diferida"""
        if self.database is None:
            raise Exception("❌ MongoDB no está conectado. Ejecuta await mongodb.connect() primero")
        return self.database.ruta
    # Agrega este método a la clase MongoDB:
    def get_usuarios_collection(self):
        """Obtener la colección Usuarios - conexión diferida"""
        if self.database is None:
            raise Exception("❌ MongoDB no está conectado. Ejecuta await mongodb.connect() primero")
        return self.database.usuario
    # AGREGAR ESTE MÉTODO DENTRO DE LA CLASE
    def get_qr_pagos_collection(self):
        """Obtener la colección QR Pagos - conexión diferida"""
        if self.database is None:
            raise Exception("❌ MongoDB no está conectado. Ejecuta await mongodb.connect() primero")
        return self.database.qr_pagos
    def get_transacciones_collection(self):
        """Obtener la colección Transacciones - conexión diferida"""
        if self.database is None:
            raise Exception("❌ MongoDB no está conectado. Ejecuta await mongodb.connect() primero")
        return self.database.transacciones
        # Agregar este método a la clase MongoDB:
    def get_notificaciones_collection(self):
        """Obtener la colección Notificaciones - conexión diferida"""
        if self.database is None:
            raise Exception("❌ MongoDB no está conectado. Ejecuta await mongodb.connect() primero")
        return self.database.notificaciones
    def get_usuarios_personal_collection(self):
        """Obtener la colección Usuarios Personal - conexión diferida"""
        if self.database is None:
            raise Exception("❌ MongoDB no está conectado. Ejecuta await mongodb.connect() primero")
        return self.database.usuarios_personal
    def get_unidades_collection(self):
        """Obtener la colección Usuarios Personal - conexión diferida"""
        if self.database is None:
            raise Exception("❌ MongoDB no está conectado. Ejecuta await mongodb.connect() primero")
        return self.database.unidades
    def get_ruta_asignada_collection(self):
        """Obtener la colección Usuarios Personal - conexión diferida"""
        if self.database is None:
            raise Exception("❌ MongoDB no está conectado. Ejecuta await mongodb.connect() primero")
        return self.database.ruta_asignada
    def get_paradas_collection(self):
        """Obtener la colección para configuración de paradas"""
        if self.database is None:
            raise Exception("❌ MongoDB no está conectado. Ejecuta await mongodb.connect() primero")
        return self.database.paradas_config
    # Agregue 27/11/2025 Alfredo.
    def get_quejas_collection(self):
        """Obtener la colección para configuración de paradas"""
        if self.database is None:
            raise Exception("❌ MongoDB no está conectado. Ejecuta await mongodb.connect() primero")
        return self.database.quejas

# Instancia global
mongodb = MongoDB()

# Función helper
def get_rutas_collection():
    return mongodb.get_rutas_collection()

# Y esta función helper:
def get_usuarios_collection():
    return mongodb.get_usuarios_collection()

# Y esta función helper:
def get_qr_pagos_collection():
    return mongodb.get_qr_pagos_collection()

def get_transacciones_collection():
    return mongodb.get_transacciones_collection()

# Y esta función helper:
def get_notificaciones_collection():
    return mongodb.get_notificaciones_collection()

# Y esta función helper:
def get_usuarios_personal_collection():
    return mongodb.get_usuarios_personal_collection()

# Y esta función helper:
def get_unidades_collection():
    return mongodb.get_unidades_collection()

# Y esta función helper:
def get_ruta_asignada_collection():
    return mongodb.get_ruta_asignada_collection()

# Y esta función helper:
def get_paradas_collection():
    return mongodb.get_paradas_collection()

# Y esta función helper:
def get_quejas_collection():
    return mongodb.get_quejas_collection()


