import uuid
from datetime import datetime, timedelta
from backend.database.mongodb import get_qr_pagos_collection, get_usuarios_collection, get_transacciones_collection
from backend.models.qr_pago import QRPago, Transaccion

class QRService:
    @staticmethod
    async def generar_qr(id_usuario: int) -> dict:
        """Genera un nuevo QR con nonce único y 10 minutos de expiración"""
        collection = get_qr_pagos_collection()
        
        # Verificar que el usuario existe
        usuarios_collection = get_usuarios_collection()
        usuario = await usuarios_collection.find_one({"id_usuario": id_usuario})
        
        if not usuario:
            raise ValueError(f"Usuario con ID {id_usuario} no encontrado")
        
        # Generar nonce único
        nonce = str(uuid.uuid4().hex)
        
        # ✅ CORREGIDO: Usar hora local de México (Aguascalientes)
        timestamp_creacion = datetime.now()
        timestamp_expiracion = timestamp_creacion + timedelta(minutes=10)
        
        print(f"🔍 BACKEND DEBUG - Timestamp creación LOCAL: {timestamp_creacion}")
        print(f"🔍 BACKEND DEBUG - Timestamp expiración LOCAL: {timestamp_expiracion}")
        
        # Crear datos del QR usando model_dump() para Pydantic v2
        qr_data = QRPago(
            id_usuario=id_usuario,
            nonce=nonce,
            timestamp_creacion=timestamp_creacion,
            timestamp_expiracion=timestamp_expiracion
        )
        
        # Insertar en MongoDB - usar model_dump() en lugar de dict()
        result = await collection.insert_one(qr_data.model_dump())
        
        return {
            "success": True,
            "qr_data": {
                "id_usuario": id_usuario,
                "nonce": nonce,
                "timestamp_creacion": timestamp_creacion.isoformat(),
                "timestamp_expiracion": timestamp_expiracion.isoformat(),
                "id_qr": str(result.inserted_id)
            }
        }
    
    @staticmethod
    async def validar_qr(nonce: str) -> dict:
        """Valida un QR escaneado y procesa el pago"""
        collection = get_qr_pagos_collection()
        
        print(f"🎯 BUSCANDO QR CON NONCE: '{nonce}'")
        print(f"🔢 LONGITUD DEL NONCE: {len(nonce)}")
        
        # Buscar el QR
        qr = await collection.find_one({"nonce": nonce})
        
        if not qr:
            print(f"❌ QR no encontrado para nonce: {nonce}")
            return {"valido": False, "mensaje": "QR no encontrado"}
        
        print(f"✅ QR encontrado: usuario {qr['id_usuario']}, estado: {qr.get('estado')}")
        
        # Verificar expiración
        ahora = datetime.now()
        
        # Asegurarnos de que el timestamp de la BD sea datetime
        timestamp_expiracion = qr["timestamp_expiracion"]
        if isinstance(timestamp_expiracion, str):
            timestamp_expiracion = datetime.fromisoformat(timestamp_expiracion.replace('Z', '+00:00'))
        
        print(f"⏰ Ahora: {ahora}, Expira: {timestamp_expiracion}")
        
        if ahora > timestamp_expiracion:
            print(f"❌ QR expirado: {timestamp_expiracion}")
            # ✅ CORREGIDO: Actualizar estado a expirado
            await collection.update_one(
                {"nonce": nonce}, 
                {"$set": {"estado": "expirado"}}
            )
            return {"valido": False, "mensaje": "QR expirado"}
        
        # Verificar si ya fue usado
        if qr.get("estado") == "usado":
            print(f"❌ QR ya fue usado: {nonce}")
            return {"valido": False, "mensaje": "QR ya fue utilizado"}
        
        # Verificar si está expirado (por si acaso)
        if qr.get("estado") == "expirado":
            print(f"❌ QR expirado: {nonce}")
            return {"valido": False, "mensaje": "QR expirado"}
        
        # Obtener información del usuario
        usuarios_collection = get_usuarios_collection()
        usuario = await usuarios_collection.find_one({"id_usuario": qr["id_usuario"]})
        
        if not usuario:
            print(f"❌ Usuario no encontrado: {qr['id_usuario']}")
            return {"valido": False, "mensaje": "Usuario no encontrado"}
        
        tarifa_actual = usuario.get("tarifa_actual", 11)
        print(f"💰 Tarifa actual: {tarifa_actual}, Saldo usuario: {usuario['saldo']}")
        
        # Verificar saldo suficiente
        if usuario["saldo"] < tarifa_actual:
            print(f"❌ Saldo insuficiente: {usuario['saldo']} < {tarifa_actual}")
            await collection.update_one(
                {"nonce": nonce},
                {"$inc": {"intentos_fallidos": 1}}
            )
            return {"valido": False, "mensaje": "Saldo insuficiente"}
        
        # Procesar pago (TRANSACCIÓN)
        saldo_anterior = usuario["saldo"]
        nuevo_saldo = saldo_anterior - tarifa_actual
        
        print(f"💳 Procesando pago: {saldo_anterior} - {tarifa_actual} = {nuevo_saldo}")
        
        # ✅ CORREGIDO: Actualizar saldo del usuario
        update_result = await usuarios_collection.update_one(
            {"id_usuario": qr["id_usuario"]},
            {"$set": {"saldo": nuevo_saldo}}
        )
        
        print(f"📝 Resultado de actualización de saldo: {update_result.modified_count} documentos modificados")
        
        # Verificar que realmente se actualizó el saldo
        if update_result.modified_count == 0:
            print(f"⚠️  ADVERTENCIA: No se pudo actualizar el saldo del usuario {qr['id_usuario']}")
            return {"valido": False, "mensaje": "Error al actualizar saldo"}
        
        # ✅ CORREGIDO: Verificar el saldo actualizado
        usuario_actualizado = await usuarios_collection.find_one({"id_usuario": qr["id_usuario"]})
        print(f"✅ Saldo actualizado verificado: {usuario_actualizado['saldo']}")
        
        # Marcar QR como usado
        await collection.update_one(
            {"nonce": nonce},
            {"$set": {"estado": "usado"}}
        )
        
        # Obtener información del usuario para el tipo
        tipo_usuario = usuario.get("tipo", "normal")
        
        print(f"✅ QR marcado como USADO para usuario {tipo_usuario}")
        
        # Registrar transacción
        await QRService.registrar_transaccion_pago(
            id_usuario=qr["id_usuario"],
            monto=tarifa_actual,
            saldo_anterior=saldo_anterior,
            saldo_posterior=nuevo_saldo,
            id_qr=str(qr["_id"]),
            nombre_ruta="40_norte",
            id_camion="1132",
            tarifa_aplicada=tarifa_actual
        )
        
        print(f"✅ Pago procesado exitosamente para usuario {usuario['nombre']} (tipo: {tipo_usuario})")
        
        return {
            "valido": True,
            "mensaje": "Pago procesado exitosamente",
            "monto": tarifa_actual,
            "nuevo_saldo": nuevo_saldo,
            "nombre_usuario": usuario["nombre"],
            "tipo_usuario": tipo_usuario,
            "nonce": nonce
        }
    
    @staticmethod
    async def validar_qr_sur(nonce: str) -> dict:
        """Valida un QR escaneado y procesa el pago"""
        collection = get_qr_pagos_collection()
        
        print(f"🎯 BUSCANDO QR CON NONCE: '{nonce}'")
        print(f"🔢 LONGITUD DEL NONCE: {len(nonce)}")
        
        # Buscar el QR
        qr = await collection.find_one({"nonce": nonce})
        
        if not qr:
            print(f"❌ QR no encontrado para nonce: {nonce}")
            return {"valido": False, "mensaje": "QR no encontrado"}
        
        print(f"✅ QR encontrado: usuario {qr['id_usuario']}, estado: {qr.get('estado')}")
        
        # Verificar expiración
        ahora = datetime.now()
        
        # Asegurarnos de que el timestamp de la BD sea datetime
        timestamp_expiracion = qr["timestamp_expiracion"]
        if isinstance(timestamp_expiracion, str):
            timestamp_expiracion = datetime.fromisoformat(timestamp_expiracion.replace('Z', '+00:00'))
        
        print(f"⏰ Ahora: {ahora}, Expira: {timestamp_expiracion}")
        
        if ahora > timestamp_expiracion:
            print(f"❌ QR expirado: {timestamp_expiracion}")
            # ✅ CORREGIDO: Actualizar estado a expirado
            await collection.update_one(
                {"nonce": nonce}, 
                {"$set": {"estado": "expirado"}}
            )
            return {"valido": False, "mensaje": "QR expirado"}
        
        # Verificar si ya fue usado
        if qr.get("estado") == "usado":
            print(f"❌ QR ya fue usado: {nonce}")
            return {"valido": False, "mensaje": "QR ya fue utilizado"}
        
        # Verificar si está expirado (por si acaso)
        if qr.get("estado") == "expirado":
            print(f"❌ QR expirado: {nonce}")
            return {"valido": False, "mensaje": "QR expirado"}
        
        # Obtener información del usuario
        usuarios_collection = get_usuarios_collection()
        usuario = await usuarios_collection.find_one({"id_usuario": qr["id_usuario"]})
        
        if not usuario:
            print(f"❌ Usuario no encontrado: {qr['id_usuario']}")
            return {"valido": False, "mensaje": "Usuario no encontrado"}
        
        tarifa_actual = usuario.get("tarifa_actual", 11)
        print(f"💰 Tarifa actual: {tarifa_actual}, Saldo usuario: {usuario['saldo']}")
        
        # Verificar saldo suficiente
        if usuario["saldo"] < tarifa_actual:
            print(f"❌ Saldo insuficiente: {usuario['saldo']} < {tarifa_actual}")
            await collection.update_one(
                {"nonce": nonce},
                {"$inc": {"intentos_fallidos": 1}}
            )
            return {"valido": False, "mensaje": "Saldo insuficiente"}
        
        # Procesar pago (TRANSACCIÓN)
        saldo_anterior = usuario["saldo"]
        nuevo_saldo = saldo_anterior - tarifa_actual
        
        print(f"💳 Procesando pago: {saldo_anterior} - {tarifa_actual} = {nuevo_saldo}")
        
        # ✅ CORREGIDO: Actualizar saldo del usuario
        update_result = await usuarios_collection.update_one(
            {"id_usuario": qr["id_usuario"]},
            {"$set": {"saldo": nuevo_saldo}}
        )
        
        print(f"📝 Resultado de actualización de saldo: {update_result.modified_count} documentos modificados")
        
        # Verificar que realmente se actualizó el saldo
        if update_result.modified_count == 0:
            print(f"⚠️  ADVERTENCIA: No se pudo actualizar el saldo del usuario {qr['id_usuario']}")
            return {"valido": False, "mensaje": "Error al actualizar saldo"}
        
        # ✅ CORREGIDO: Verificar el saldo actualizado
        usuario_actualizado = await usuarios_collection.find_one({"id_usuario": qr["id_usuario"]})
        print(f"✅ Saldo actualizado verificado: {usuario_actualizado['saldo']}")
        
        # Marcar QR como usado
        await collection.update_one(
            {"nonce": nonce},
            {"$set": {"estado": "usado"}}
        )
        
        # Obtener información del usuario para el tipo
        tipo_usuario = usuario.get("tipo", "normal")
        
        print(f"✅ QR marcado como USADO para usuario {tipo_usuario}")
        
        # Registrar transacción
        await QRService.registrar_transaccion_pago(
            id_usuario=qr["id_usuario"],
            monto=tarifa_actual,
            saldo_anterior=saldo_anterior,
            saldo_posterior=nuevo_saldo,
            id_qr=str(qr["_id"]),
            nombre_ruta="40_sur",
            id_camion="1124",
            tarifa_aplicada=tarifa_actual
        )
        
        print(f"✅ Pago procesado exitosamente para usuario {usuario['nombre']} (tipo: {tipo_usuario})")
        
        return {
            "valido": True,
            "mensaje": "Pago procesado exitosamente",
            "monto": tarifa_actual,
            "nuevo_saldo": nuevo_saldo,
            "nombre_usuario": usuario["nombre"],
            "tipo_usuario": tipo_usuario,
            "nonce": nonce
        }

    # ✅ NUEVO: Método para verificar cooldown
    @staticmethod
    async def verificar_cooldown(id_usuario: int) -> dict:
        """Verifica si el usuario tiene cooldown activo"""
        usuarios_collection = get_usuarios_collection()
        usuario = await usuarios_collection.find_one({"id_usuario": id_usuario})
        
        if not usuario:
            return {"cooldown": False, "mensaje": "Usuario no encontrado"}
        
        tipo_usuario = usuario.get("tipo", "normal")
        
        # ✅ CORREGIDO: Solo usuarios no normales tienen cooldown
        if tipo_usuario == "normal":
            return {"cooldown": False, "mensaje": "Usuario normal, sin cooldown"}
        
        # Verificar último QR generado
        collection = get_qr_pagos_collection()
        ultimo_qr = await collection.find_one(
            {"id_usuario": id_usuario, "estado": "usado"},
            sort=[("timestamp_creacion", -1)]
        )
        
        if not ultimo_qr:
            return {"cooldown": False, "mensaje": "Primer uso, sin cooldown"}
        
        # Verificar si ha pasado el cooldown de 3 minutos
        ahora = datetime.now()
        timestamp_ultimo_qr = ultimo_qr["timestamp_creacion"]
        if isinstance(timestamp_ultimo_qr, str):
            timestamp_ultimo_qr = datetime.fromisoformat(timestamp_ultimo_qr.replace('Z', '+00:00'))
        
        tiempo_transcurrido = (ahora - timestamp_ultimo_qr).total_seconds()
        cooldown_segundos = 180  # 3 minutos
        
        if tiempo_transcurrido < cooldown_segundos:
            tiempo_restante = cooldown_segundos - tiempo_transcurrido
            minutos_restantes = int(tiempo_restante // 60)
            segundos_restantes = int(tiempo_restante % 60)
            
            return {
                "cooldown": True,
                "mensaje": f"Cooldown activo. Espera {minutos_restantes}:{segundos_restantes:02d} minutos",
                "tiempo_restante": tiempo_restante
            }
        
        return {"cooldown": False, "mensaje": "Cooldown completado"}
    
    # ✅ NUEVO: Método para obtener estado del QR
    @staticmethod
    async def obtener_estado_qr(nonce: str) -> dict:
        """Obtiene el estado actual de un QR"""
        collection = get_qr_pagos_collection()
        
        qr = await collection.find_one({"nonce": nonce})
        
        if not qr:
            return {"error": "QR no encontrado"}
        
        # Verificar expiración si está en estado 'generado'
        if qr.get("estado") == "generado":
            ahora = datetime.now()
            timestamp_expiracion = qr["timestamp_expiracion"]
            if isinstance(timestamp_expiracion, str):
                timestamp_expiracion = datetime.fromisoformat(timestamp_expiracion.replace('Z', '+00:00'))
            
            if ahora > timestamp_expiracion:
                # Actualizar estado a expirado
                await collection.update_one(
                    {"nonce": nonce}, 
                    {"$set": {"estado": "expirado"}}
                )
                qr["estado"] = "expirado"
        
        return {
            "nonce": nonce,
            "estado": qr.get("estado"),
            "id_usuario": qr.get("id_usuario"),
            "timestamp_creacion": qr.get("timestamp_creacion"),
            "timestamp_expiracion": qr.get("timestamp_expiracion")
        }
    
    # ✅ CORREGIDO: Método para registrar transacciones
    @staticmethod
    async def registrar_transaccion_pago(
        id_usuario: int,
        monto: float,
        saldo_anterior: float,
        saldo_posterior: float,
        id_qr: str = None,
        nombre_ruta: str = None,
        id_camion: int = None,
        tarifa_aplicada: float = None
    ) -> None:
        """Registra una transacción de pago de viaje"""
        collection = get_transacciones_collection()
        
        # Generar ID único de transacción
        id_transaccion = f"txn_{uuid.uuid4().hex[:8]}"
        
        # ✅ CORREGIDO: Crear transacción con hora local
        transaccion_data = {
            "id_transaccion": id_transaccion,
            "id_usuario": id_usuario,
            "tipo": "pago_viaje",
            "monto": monto,
            "saldo_anterior": saldo_anterior,
            "saldo_posterior": saldo_posterior,
            "fecha_transaccion": datetime.now(),  # Hora local
            "estado": "completada",
            "id_qr": id_qr,
            "nombre_ruta": nombre_ruta,
            "id_camion": id_camion,
            "tarifa_aplicada": tarifa_aplicada
        }
        
        result = await collection.insert_one(transaccion_data)
        print(f"✅ Transacción registrada: {id_transaccion} para usuario {id_usuario}")

    @staticmethod
    async def actualizar_qrs_expirados():
        """Actualiza automáticamente el estado de QRs expirados"""
        collection = get_qr_pagos_collection()
        
        ahora = datetime.now()
        print(f"🔍 Buscando QRs expirados - Hora actual: {ahora}")
        
        # Buscar QRs en estado 'generado' que hayan expirado
        qrs_expirados = await collection.find({
            "estado": "generado",
            "timestamp_expiracion": {"$lt": ahora}
        }).to_list(length=100)
        
        if qrs_expirados:
            print(f"🕐 Encontrados {len(qrs_expirados)} QRs expirados")
            
            # Actualizar estado a 'expirado'
            result = await collection.update_many(
                {
                    "estado": "generado",
                    "timestamp_expiracion": {"$lt": ahora}
                },
                {
                    "$set": {"estado": "expirado"}
                }
            )
            
            print(f"✅ Actualizados {result.modified_count} QRs a estado 'expirado'")
            return result.modified_count
        else:
            print("✅ No hay QRs expirados pendientes")
            return 0