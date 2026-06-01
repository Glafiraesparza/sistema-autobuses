import os
from dotenv import load_dotenv
import logging
from datetime import datetime
import requests

load_dotenv()

class EmailService:
    def __init__(self):
        self.api_key = os.getenv("BREVO_API_KEY")
        self.sender_email = os.getenv("SENDER_EMAIL")
        self.enabled = bool(self.api_key and self.sender_email)

    async def enviar_correo_registro(self, destinatario: str, nombre: str, tipo_usuario: str, tarifa: float, clabe: str, codigo_verificacion: str) -> bool:
        """
        Enviar correo de confirmación de registro con código de verificación
        """
        if not self.enabled:
            logging.warning("Servicio de email no configurado. Configura BREVO_API_KEY y SENDER_EMAIL")
            return False

        try:
            subject = "¡Bienvenido al Sistema de Autobuses! - Verifica tu cuenta"
            
            # Cuerpo del email en HTML actualizado
            body = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                    .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                    .header {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }}
                    .content {{ background: #f9f9f9; padding: 20px; border-radius: 0 0 10px 10px; }}
                    .info-box {{ background: white; border-left: 4px solid #667eea; padding: 15px; margin: 10px 0; border-radius: 5px; }}
                    .verification-box {{ background: #e8f4fd; border: 2px solid #2196F3; padding: 20px; margin: 20px 0; text-align: center; border-radius: 10px; }}
                    .verification-code {{ font-size: 32px; font-weight: bold; color: #2196F3; letter-spacing: 5px; margin: 15px 0; }}
                    .warning {{ background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 10px 0; border-radius: 5px; }}
                    .footer {{ text-align: center; margin-top: 20px; font-size: 12px; color: #666; }}
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🚌 ¡Bienvenido al Sistema!</h1>
                    </div>
                    <div class="content">
                        <p>Hola <strong>{nombre}</strong>,</p>
                        <p>Tu cuenta ha sido creada exitosamente en nuestro sistema de autobuses.</p>
                        
                        <div class="info-box">
                            <h3>📋 Información de tu cuenta:</h3>
                            <p><strong>Tipo de usuario:</strong> {tipo_usuario.capitalize()}</p>
                            <p><strong>Tarifa actual:</strong> ${tarifa:.2f} MXN</p>
                            <p><strong>CLABE para recargas:</strong> {clabe}</p>
                            <p><strong>Saldo inicial:</strong> $0.00 MXN</p>
                        </div>
                        
                        <div class="verification-box">
                            <h3>🔐 Código de Verificación</h3>
                            <p>Para tu primer inicio de sesión, necesitas este código:</p>
                            <div class="verification-code">{codigo_verificacion}</div>
                            <p><strong>⚠️ Este código es válido por 24 horas</strong></p>
                            <p>Después de tu primer inicio de sesión, no necesitarás este código nuevamente.</p>
                        </div>
                        
                        <div class="warning">
                            <h3>💡 Importante:</h3>
                            <p><strong>Guarda tu CLABE</strong> para realizar recargas a tu cuenta.</p>
                            <p>Puedes recargar desde cualquier app bancaria usando esta CLABE.</p>
                        </div>
                        
                        <p>¡Gracias por unirte a nosotros!</p>
                    </div>
                    <div class="footer">
                        <p>Sistema de Autobuses Urbanos</p>
                        <p>Este es un mensaje automático, por favor no respondas a este correo.</p>
                    </div>
                </div>
            </body>
            </html>
            """

            # Versión texto plano
            text_body = f"""
            ¡Bienvenido al Sistema de Autobuses!

            Hola {nombre},

            Tu cuenta ha sido creada exitosamente.

            Información de tu cuenta:
            - Tipo de usuario: {tipo_usuario}
            - Tarifa actual: ${tarifa:.2f} MXN
            - CLABE para recargas: {clabe}
            - Saldo inicial: $0.00 MXN

            🔐 CÓDIGO DE VERIFICACIÓN: {codigo_verificacion}

            Para tu primer inicio de sesión, necesitas este código.
            ⚠️ Este código es válido por 24 horas.

            Después de tu primer inicio de sesión, no necesitarás este código nuevamente.

            IMPORTANTE: Guarda tu CLABE para realizar recargas a tu cuenta.
            Puedes recargar desde cualquier app bancaria usando esta CLABE.

            ¡Gracias por unirte a nosotros!

            Sistema de Autobuses Urbanos
            """

            return await self._enviar_correo(destinatario, subject, body, text_body)
            
        except Exception as e:
            logging.error(f"Error al enviar correo de registro: {str(e)}")
            return False

    async def _enviar_correo(self, destinatario: str, asunto: str, cuerpo_html: str, cuerpo_texto: str) -> bool:
        if not self.enabled:
            print("❌ BREVO no configurado")
            return False

        try:
            headers = {
                "accept": "application/json",
                "api-key": self.api_key,
                "content-type": "application/json"
            }

            payload = {
                "sender": {
                    "name": "Sistema de Autobuses",
                    "email": self.sender_email
                },
                "to": [
                    {
                        "email": destinatario
                    }
                ],
                "subject": asunto,
                "htmlContent": cuerpo_html,
                "textContent": cuerpo_texto
            }

            response = requests.post(
                "https://api.brevo.com/v3/smtp/email",
                json=payload,
                headers=headers,
                timeout=30
            )

            print("BREVO STATUS:", response.status_code)
            print("BREVO RESPONSE:", response.text)

            return response.status_code in [200, 201]

        except Exception as e:
            print(f"❌ ERROR BREVO: {e}")
            return False
        
    # Método para recuperación de contraseña
    async def enviar_correo_recuperacion(self, destinatario: str, nombre: str, codigo_recuperacion: str) -> bool:
        """
        Enviar correo de recuperación de contraseña
        """
        if not self.enabled:
            logging.warning("Servicio de email no configurado. Configura BREVO_API_KEY y SENDER_EMAIL")
            return False

        try:
            subject = "🔐 Recuperación de Contraseña - Sistema de Autobuses"
            
            # Cuerpo del email en HTML
            body = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                    .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                    .header {{ background: linear-gradient(135deg, #dc3545 0%, #c82333 100%); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }}
                    .content {{ background: #f9f9f9; padding: 20px; border-radius: 0 0 10px 10px; }}
                    .code-box {{ background: #e8f4fd; border: 2px solid #2196F3; padding: 20px; margin: 20px 0; text-align: center; border-radius: 10px; }}
                    .recovery-code {{ font-size: 28px; font-weight: bold; color: #2196F3; letter-spacing: 3px; margin: 15px 0; }}
                    .warning {{ background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 10px 0; border-radius: 5px; }}
                    .footer {{ text-align: center; margin-top: 20px; font-size: 12px; color: #666; }}
                    .steps {{ background: white; padding: 15px; border-radius: 5px; margin: 15px 0; }}
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🔐 Recuperación de Contraseña</h1>
                    </div>
                    <div class="content">
                        <p>Hola <strong>{nombre}</strong>,</p>
                        <p>Hemos recibido una solicitud para restablecer la contraseña de tu cuenta.</p>
                        
                        <div class="code-box">
                            <h3>Tu Código de Recuperación</h3>
                            <div class="recovery-code">{codigo_recuperacion}</div>
                            <p><strong>⚠️ Este código es válido por 1 hora</strong></p>
                        </div>
                        
                        <div class="steps">
                            <h4>📋 Pasos para recuperar tu contraseña:</h4>
                            <ol>
                                <li>Ve a la página de restablecimiento de contraseña</li>
                                <li>Ingresa tu correo electrónico</li>
                                <li>Ingresa el código de recuperación que aparece arriba</li>
                                <li>Crea tu nueva contraseña</li>
                            </ol>
                        </div>
                        
                        <div class="warning">
                            <h4>💡 Importante:</h4>
                            <p>Si no solicitaste este cambio, puedes ignorar este correo.</p>
                            <p>Tu contraseña actual seguirá siendo válida.</p>
                        </div>
                        
                        <p>¿Necesitas ayuda? Contáctanos en nuestro sistema de soporte.</p>
                    </div>
                    <div class="footer">
                        <p>Sistema de Autobuses Urbanos</p>
                        <p>Este es un mensaje automático, por favor no respondas a este correo.</p>
                    </div>
                </div>
            </body>
            </html>
            """

            # Versión texto plano
            text_body = f"""
            Recuperación de Contraseña - Sistema de Autobuses

            Hola {nombre},

            Hemos recibido una solicitud para restablecer la contraseña de tu cuenta.

            Tu Código de Recuperación: {codigo_recuperacion}

            ⚠️ Este código es válido por 1 hora.

            Pasos para recuperar tu contraseña:
            1. Ve a la página de restablecimiento de contraseña
            2. Ingresa tu correo electrónico
            3. Ingresa el código de recuperación que aparece arriba
            4. Crea tu nueva contraseña

            Si no solicitaste este cambio, puedes ignorar este correo.
            Tu contraseña actual seguirá siendo válida.

            Sistema de Autobuses Urbanos
            """

            return await self._enviar_correo(destinatario, subject, body, text_body)
            
        except Exception as e:
            logging.error(f"Error al enviar correo de recuperación: {str(e)}")
            return False
        
    # Método para correo de recarga
    async def enviar_correo_recarga(self, destinatario: str, nombre: str, monto: float, nuevo_saldo: float) -> bool:
        """
        Enviar correo de confirmación de recarga
        """
        if not self.enabled:
            logging.warning("Servicio de email no configurado. Configura BREVO_API_KEY y SENDER_EMAIL")
            return False

        try:
            subject = "💰 Recarga Exitosa - Sistema de Autobuses"
            
            # Cuerpo del email en HTML
            body = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                    .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                    .header {{ background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }}
                    .content {{ background: #f9f9f9; padding: 20px; border-radius: 0 0 10px 10px; }}
                    .success-box {{ background: #d4edda; border: 2px solid #28a745; padding: 20px; margin: 20px 0; text-align: center; border-radius: 10px; }}
                    .amount {{ font-size: 32px; font-weight: bold; color: #28a745; margin: 15px 0; }}
                    .info-box {{ background: white; border-left: 4px solid #007bff; padding: 15px; margin: 10px 0; border-radius: 5px; }}
                    .footer {{ text-align: center; margin-top: 20px; font-size: 12px; color: #666; }}
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>💰 Recarga Exitosa</h1>
                    </div>
                    <div class="content">
                        <p>Hola <strong>{nombre}</strong>,</p>
                        <p>Tu recarga ha sido procesada exitosamente.</p>
                        
                        <div class="success-box">
                            <h3>✅ Recarga Completada</h3>
                            <div class="amount">+${monto:.2f} MXN</div>
                            <p><strong>Nuevo saldo: ${nuevo_saldo:.2f} MXN</strong></p>
                        </div>
                        
                        <div class="info-box">
                            <h4>📋 Detalles de la transacción:</h4>
                            <p><strong>Monto recargado:</strong> ${monto:.2f} MXN</p>
                            <p><strong>Saldo anterior:</strong> ${nuevo_saldo - monto:.2f} MXN</p>
                            <p><strong>Nuevo saldo:</strong> ${nuevo_saldo:.2f} MXN</p>
                            <p><strong>Fecha:</strong> {datetime.now().strftime('%d/%m/%Y %H:%M')}</p>
                            <p><strong>Método:</strong> Transferencia CLABE</p>
                        </div>
                        
                        <p>¡Ya puedes seguir viajando con nosotros!</p>
                        <p>Si no reconoces esta transacción, por favor contacta a soporte inmediatamente.</p>
                    </div>
                    <div class="footer">
                        <p>Sistema de Autobuses Urbanos</p>
                        <p>Este es un mensaje automático, por favor no respondas a este correo.</p>
                    </div>
                </div>
            </body>
            </html>
            """

            # Versión texto plano
            text_body = f"""
            Recarga Exitosa - Sistema de Autobuses

            Hola {nombre},

            Tu recarga ha sido procesada exitosamente.

            ✅ Recarga Completada: +${monto:.2f} MXN
            Nuevo saldo: ${nuevo_saldo:.2f} MXN

            Detalles de la transacción:
            - Monto recargado: ${monto:.2f} MXN
            - Saldo anterior: ${nuevo_saldo - monto:.2f} MXN  
            - Nuevo saldo: ${nuevo_saldo:.2f} MXN
            - Fecha: {datetime.now().strftime('%d/%m/%Y %H:%M')}
            - Método: Transferencia CLABE

            ¡Ya puedes seguir viajando con nosotros!

            Si no reconoces esta transacción, por favor contacta a soporte.

            Sistema de Autobuses Urbanos
            """

            return await self._enviar_correo(destinatario, subject, body, text_body)
            
        except Exception as e:
            logging.error(f"Error al enviar correo de recarga: {str(e)}")
            return False
        
    # Método para reenvío de código de verificación
    async def enviar_correo_reenvio_verificacion(self, destinatario: str, nombre: str, codigo_verificacion: str) -> bool:
        """
        Enviar correo de reenvío de código de verificación
        """
        if not self.enabled:
            logging.warning("Servicio de email no configurado. Configura BREVO_API_KEY y SENDER_EMAIL")
            return False

        try:
            subject = "🔐 Código de Verificación - Sistema de Autobuses"
            
            # Cuerpo del email en HTML específico para reenvío
            body = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                    .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                    .header {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }}
                    .content {{ background: #f9f9f9; padding: 20px; border-radius: 0 0 10px 10px; }}
                    .verification-box {{ background: #e8f4fd; border: 2px solid #2196F3; padding: 20px; margin: 20px 0; text-align: center; border-radius: 10px; }}
                    .verification-code {{ font-size: 32px; font-weight: bold; color: #2196F3; letter-spacing: 5px; margin: 15px 0; }}
                    .warning {{ background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 10px 0; border-radius: 5px; }}
                    .footer {{ text-align: center; margin-top: 20px; font-size: 12px; color: #666; }}
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🔐 Código de Verificación</h1>
                    </div>
                    <div class="content">
                        <p>Hola <strong>{nombre}</strong>,</p>
                        <p>Has solicitado un nuevo código de verificación para tu primer inicio de sesión.</p>
                        
                        <div class="verification-box">
                            <h3>Tu Nuevo Código de Verificación</h3>
                            <div class="verification-code">{codigo_verificacion}</div>
                            <p><strong>⚠️ Este código es válido por 24 horas</strong></p>
                            <p>Usa este código para completar tu primer inicio de sesión.</p>
                        </div>
                        
                        <div class="warning">
                            <h4>💡 Importante:</h4>
                            <p>Si no solicitaste este código, puedes ignorar este correo.</p>
                            <p>Tu cuenta permanecerá segura.</p>
                        </div>
                        
                        <p>¿Necesitas ayuda? Contáctanos en nuestro sistema de soporte.</p>
                    </div>
                    <div class="footer">
                        <p>Sistema de Autobuses Urbanos</p>
                        <p>Este es un mensaje automático, por favor no respondas a este correo.</p>
                    </div>
                </div>
            </body>
            </html>
            """

            # Versión texto plano
            text_body = f"""
            Código de Verificación - Sistema de Autobuses

            Hola {nombre},

            Has solicitado un nuevo código de verificación para tu primer inicio de sesión.

            Tu Código de Verificación: {codigo_verificacion}

            ⚠️ Este código es válido por 24 horas.

            Usa este código para completar tu primer inicio de sesión.

            Si no solicitaste este código, puedes ignorar este correo.
            Tu cuenta permanecerá segura.

            Sistema de Autobuses Urbanos
            """

            return await self._enviar_correo(destinatario, subject, body, text_body)
            
        except Exception as e:
            logging.error(f"Error al enviar correo de reenvío de verificación: {str(e)}")
            return False

# Instancia global del servicio
email_service = EmailService()
