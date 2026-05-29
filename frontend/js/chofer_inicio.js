class ChoferInicio {
    constructor() {
        this.usuario = null;
        this.rutaAsignada = null;
        this.camionAsignado = null;
        this.progreso = null; // Instancia del sistema de progreso
        this.initializeApp();
    }

    async initializeApp() {
        await this.verifySession();
        await this.loadChoferData();
        this.initializeEventListeners();
        this.updateUI();
        
        // Inicializar sistema de progreso
        this.progreso = new ChoferProgreso();
    }

    async verifySession() {
        const usuarioData = localStorage.getItem('tucsa_chofer');
        if (!usuarioData) {
            window.location.href = 'inicio_sesion_personal_TUCSA.html';
            return;
        }

        this.usuario = JSON.parse(usuarioData);
        if (this.usuario.rol !== 'chofer') {
            window.location.href = 'inicio_sesion_personal_TUCSA.html';
            return;
        }
    }

    async loadChoferData() {
        try {
            // Mostrar información del usuario
            document.getElementById('chofer-nombre').textContent = this.usuario.nombre;
            
            // Obtener ruta asignada basada en el camión
            if (this.usuario.id_camion_asignado) {
                this.camionAsignado = this.usuario.id_camion_asignado;
                console.log('🚌 Camión asignado:', this.camionAsignado);
                
                // Usar el nuevo endpoint de camiones
                const response = await fetch(`https://sistema-autobuses.onrender.com/api/camiones/camion/${this.camionAsignado}`);
                if (response.ok) {
                    const data = await response.json();
                    this.rutaAsignada = data.nombre_ruta;
                    console.log('📍 Ruta desde API:', this.rutaAsignada);
                    this.updateRutaInfo();
                } else {
                    // Fallback: determinar ruta basado en camión conocido
                    console.log('🔄 Usando fallback para determinar ruta');
                    this.determinarRutaPorCamion();
                }
            } else {
                console.warn('❌ No hay camión asignado al usuario');
                this.rutaAsignada = '40_Norte'; // Fallback
                this.updateRutaInfo();
            }
        } catch (error) {
            console.error('Error cargando datos del chofer:', error);
            // Fallback en caso de error
            this.determinarRutaPorCamion();
        }
    }

    determinarRutaPorCamion() {
        // Asignación fija basada en el ID del camión
        const asignaciones = {
            '1132': '40_Norte',
            '1124': '40_Sur'
        };
        
        if (this.camionAsignado && asignaciones[this.camionAsignado]) {
            this.rutaAsignada = asignaciones[this.camionAsignado];
            console.log('📍 Ruta determinada por camión:', this.rutaAsignada);
            this.updateRutaInfo();
        } else {
            console.warn('No se pudo determinar la ruta para el camión:', this.camionAsignado);
            // Fallback a una ruta por defecto
            this.rutaAsignada = '40_Norte';
            this.updateRutaInfo();
        }
    }

    updateRutaInfo() {
        // NO actualizar el título aquí - dejar que chofer_progreso.js lo haga
        // Solo actualizar información básica
        
        if (this.rutaAsignada && this.camionAsignado) {
            const nombreRuta = this.rutaAsignada === '40_Norte' ? '40 Norte' : '40 Sur';
            
            // Actualizar información en el modal de emergencia
            const unidadInfo = document.querySelector('#panicModal .text-panic');
            if (unidadInfo) {
                unidadInfo.textContent = `Unidad: ${this.camionAsignado} | Ruta: ${nombreRuta}`;
            }
            
            console.log('📍 Ruta actualizada en UI:', nombreRuta);
        }
    }

    updateUI() {
        // Actualizar nombre del chofer en múltiples lugares si es necesario
        document.getElementById('chofer-nombre').textContent = this.usuario.nombre;
    }

    initializeEventListeners() {
        // Botón de cerrar sesión en el dropdown
        const logoutLink = document.querySelector('.dropdown-item[href="inicio_sesion_personal_TUCSA.html"]');
        if (logoutLink) {
            logoutLink.addEventListener('click', (e) => {
                e.preventDefault();
                this.logout();
            });
        }

        // Botón de estado (activo/inactivo)
        document.getElementById('status-button')?.addEventListener('click', () => {
            this.toggleStatus();
        });

        // Botón de confirmar llegada (paradas)
        document.getElementById('confirm-arrival-button')?.addEventListener('click', () => {
            this.confirmArrival();
        });

        // Botón de reiniciar ruta (paradas)
        document.getElementById('reset-route-button')?.addEventListener('click', () => {
            this.reiniciarRuta();
        });

        // Formulario de reporte de retraso
        /*
        document.getElementById('reportForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleDelayReport();
        });*/
    }

    toggleStatus() {
        const statusBtn = document.getElementById('status-button');
        const isActive = statusBtn.textContent.includes('Activo');
        
        if (isActive) {
            statusBtn.innerHTML = '<i class="bi bi-geo-alt-fill me-1"></i> Inactivo';
            statusBtn.className = 'btn btn-status-inactive me-3';
            this.sendStatusUpdate('inactivo');
        } else {
            statusBtn.innerHTML = '<i class="bi bi-geo-alt-fill me-1"></i> Activo';
            statusBtn.className = 'btn btn-status-active me-3';
            this.sendStatusUpdate('activo');
        }
    }

    async sendStatusUpdate(status) {
        try {
            await fetch('http://${IP_API}:8000/api/chofer/estado', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    id_chofer: this.usuario.id_personal,
                    estado: status,
                    id_camion: this.camionAsignado
                })
            });
            
            // Enviar notificación al administrador
            if (status === 'inactivo') {
                await this.notificarAdministrador('Chofer inactivo', 
                    `El chofer ${this.usuario.nombre} (Camión ${this.camionAsignado}) está ahora inactivo.`);
            }
        } catch (error) {
            console.error('Error actualizando estado:', error);
        }
    }

    async confirmArrival() {
        try {
            const response = await fetch('http://${IP_API}:8000/api/chofer/confirmar-llegada', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    id_chofer: this.usuario.id_personal,
                    id_camion: this.camionAsignado,
                    ruta: this.rutaAsignada,
                    timestamp: new Date().toISOString()
                })
            });

            if (response.ok) {
                document.getElementById('route-end-message').classList.remove('d-none');
                document.getElementById('confirm-arrival-button').disabled = true;
                
                await this.notificarAdministrador('Llegada confirmada',
                    `El chofer ${this.usuario.nombre} ha confirmado llegada en la ruta ${this.rutaAsignada}.`);
            }
        } catch (error) {
            console.error('Error confirmando llegada:', error);
        }
    }

    async handleDelayReport() {
        try {
            const delayReason = document.getElementById('delayReason').value;
            const delayEstimate = document.getElementById('delayEstimate').value;
            
            // Cerrar modal
            const reportModal = bootstrap.Modal.getInstance(document.getElementById('reportModal'));
            if (reportModal) {
                reportModal.hide();
            }

            // Enviar notificación a usuarios y administrador
            await this.enviarNotificacionRetraso(delayReason, delayEstimate);
            
            this.mostrarConfirmacion('Alerta Enviada', 
                `Los usuarios han sido notificados del retraso. Motivo: ${this.getReasonText(delayReason)}. Tiempo estimado: ${delayEstimate} minutos.`, 'success');

        } catch (error) {
            console.error('Error reportando retraso:', error);
            this.mostrarConfirmacion('Error', 'No se pudo enviar la alerta. Intenta nuevamente.', 'error');
        }
    }

    getReasonText(reason) {
        const reasons = {
            'Trafico': 'Tráfico Pesado inesperado',
            'Desviacion': 'Desviación de ruta temporal por obras',
            'Carga': 'Demora en la carga de pasajeros',
            'FallaMenor': 'Falla menor en la unidad (pronto se reanuda)'
        };
        return reasons[reason] || reason;
    }

    async enviarNotificacionRetraso(motivo, tiempoEstimado) {
        try {
            const usuarioData = localStorage.getItem('tucsa_chofer');
            const usuario = JSON.parse(usuarioData);
            
        // USAR LA RUTA DE LA ASIGNACIÓN ACTIVA SI EXISTE, SINO LA DEL CAMIÓN
        let ruta = '40_Norte'; // Valor por defecto
        
        if (this.progreso && this.progreso.asignacionActiva) {
            // Prioridad 1: Ruta de la asignación activa
            ruta = this.progreso.asignacionActiva.ruta;
            console.log('📍 Usando ruta de asignación activa:', ruta);
        } else if (this.rutaAsignada) {
            // Prioridad 2: Ruta determinada por camión
            ruta = this.rutaAsignada;
            console.log('📍 Usando ruta por camión:', ruta);
        } else if (usuario.id_camion_asignado) {
            // Prioridad 3: Ruta por camión del usuario
            const asignaciones = {
                '1132': '40_Norte',
                '1124': '40_Sur'
            };
            ruta = asignaciones[usuario.id_camion_asignado] || '40_Norte';
            console.log('📍 Usando ruta por camión de usuario:', ruta);
        }
        
        const motivoTexto = this.getReasonText(motivo);
        const nombreRuta = ruta === '40_Norte' ? '40 Norte' : '40 Sur';

        // Notificar a los usuarios usando el endpoint específico de retraso (con reloj)
        /*await fetch('http://${IP_API}:8000/api/notificaciones/retraso', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                ruta: ruta,
                tiempo_estimado: parseInt(tiempoEstimado),
                motivo: motivoTexto,
                id_chofer: usuario.id_personal
            })
        });
         esto muestra la ruta asignada corrctamente */
        console.log('✅ Notificación de retraso enviada para ruta:', nombreRuta);
        
    } catch (error) {
        console.error('Error enviando notificaciones:', error);
    }
    }

    reiniciarRuta() {
        // Reiniciar la interfaz de paradas
        if (window.reiniciarRuta) {
            window.reiniciarRuta();
        }
        
        // Habilitar botón de confirmar llegada
        document.getElementById('confirm-arrival-button').disabled = false;
        document.getElementById('route-end-message').classList.add('d-none');
        
        this.mostrarConfirmacion(
            'Ruta Reiniciada', 
            'El progreso de la ruta ha sido reiniciado al inicio.',
            'success'
        );
    }

    async notificarAdministrador(titulo, mensaje) {
        try {
            const usuarioData = localStorage.getItem('tucsa_chofer');
            const usuario = JSON.parse(usuarioData);
            
            let ruta = this.rutaAsignada;
            if (!ruta && usuario.id_camion_asignado) {
                const asignaciones = {
                    '1132': '40_Norte',
                    '1124': '40_Sur'
                };
                ruta = asignaciones[usuario.id_camion_asignado] || '40_Norte';
            }

            await fetch('http://${IP_API}:8000/api/notificaciones/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    tipo: 'sistema',
                    titulo: titulo,
                    mensaje: mensaje,
                    id_chofer: usuario.id_personal,
                    id_camion: usuario.id_camion_asignado,
                    ruta_afectada: ruta
                })
            });
        } catch (error) {
            console.error('Error enviando notificación:', error);
        }
    }

    mostrarConfirmacion(titulo, mensaje, tipo = 'success') {
        if (window.mostrarConfirmacion) {
            window.mostrarConfirmacion(titulo, mensaje, tipo);
        } else {
            // Fallback simple
            alert(`${titulo}: ${mensaje}`);
        }
    }

    logout() {
        localStorage.removeItem('tucsa_chofer');
        localStorage.removeItem('tucsa_token_chofer');
        localStorage.removeItem('tucsa_last_login');
        window.location.href = 'inicio_sesion_personal_TUCSA.html';
    }
}

// Inicializar la aplicación
document.addEventListener('DOMContentLoaded', () => {
    new ChoferInicio();
});