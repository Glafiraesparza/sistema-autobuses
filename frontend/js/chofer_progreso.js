class ChoferProgreso {
    constructor() {
        this.asignacionActiva = null;
        this.vueltasCompletadas = 0;
        this.paradasCompletadas = 0;
        this.totalParadas = 7;
        this.observandoParadas = false;
        this.paradas = [  // ✅ MOVIDO al constructor para que sea accesible en todos los métodos
            "Estación Central Norte",
            "Av. Principal y Calle 15", 
            "Centro Comercial Plaza",
            "Universidad Nacional",
            "Hospital Regional",
            "Terminal de Buses",
            "Parque Central"
        ];
        this.initializeProgreso();
    }

    async initializeProgreso() {
        await this.loadAsignacionActiva();
        this.crearInterfazProgreso();
        this.initializeEventListeners();
        this.iniciarSistemaParadas();
        this.controlarVisibilidadBotones(); // Nueva función
    }

    async loadAsignacionActiva() {
        try {
            const usuarioData = localStorage.getItem('tucsa_chofer');
            if (!usuarioData) return;

            const usuario = JSON.parse(usuarioData);
            
            // Primero intentar con el endpoint específico
            const response = await fetch(`https://sistema-autobuses.onrender.com/api/asignacion-rutas/chofer/${usuario.id_personal}/activa`);
            
            if (response.ok) {
                this.asignacionActiva = await response.json();
                this.vueltasCompletadas = this.asignacionActiva.vueltas_completadas || 0;
                console.log('✅ Asignación activa encontrada:', this.asignacionActiva.ruta);
                return;
            }
            
            // Si falla, buscar en todas las asignaciones activas
            const responseActivas = await fetch(`https://sistema-autobuses.onrender.com/api/asignacion-rutas/activas`);
            if (responseActivas.ok) {
                const todasActivas = await responseActivas.json();
                const miAsignacion = todasActivas.find(a => a.id_personal == usuario.id_personal);
                
                if (miAsignacion) {
                    this.asignacionActiva = miAsignacion;
                    this.vueltasCompletadas = miAsignacion.vueltas_completadas || 0;
                    console.log('✅ Asignación activa encontrada (fallback):', this.asignacionActiva.ruta);
                } else {
                    console.log('ℹ️ No hay asignación activa para este chofer');
                }
            }
            
        } catch (error) {
            console.log('Error cargando asignación activa:', error);
        }
    }

    // NUEVO MÉTODO: Controlar visibilidad de botones según asignación
    controlarVisibilidadBotones() {
        const confirmButton = document.getElementById('confirm-arrival-button');
        const resetButton = document.getElementById('reset-route-button');
        
        if (this.asignacionActiva) {
            // HAY ASIGNACIÓN: Mostrar botón de paradas
            if (confirmButton) {
                confirmButton.style.display = 'block';
                confirmButton.disabled = false;
            }
            console.log('✅ Botón de paradas ACTIVADO - Hay asignación activa');
        } else {
            // NO HAY ASIGNACIÓN: Ocultar botón de paradas
            if (confirmButton) {
                confirmButton.style.display = 'none';
            }
            if (resetButton) {
                resetButton.style.display = 'none';
            }
            console.log('🚫 Botón de paradas OCULTADO - No hay asignación activa');
        }
    }

    crearInterfazProgreso() {
        const cardBody = document.querySelector('.current-task-card .card-body');
        if (!cardBody || document.getElementById('progreso-jornada-container')) return;

        if (this.asignacionActiva) {
            // Usar la ruta de la asignación activa para el título
            const nombreRuta = this.asignacionActiva.ruta === '40_Norte' ? '40 Norte' : '40 Sur';
            
            // ACTUALIZAR EL TÍTULO DE LA TARJETA
            const cardTitle = document.querySelector('.current-task-card .card-header h5');
            if (cardTitle) {
                cardTitle.innerHTML = `<i class="bi bi-pin-map-fill me-2"></i>Progreso de la Ruta ${nombreRuta}`;
            }

            const progresoHTML = `
                <div class="row mb-4" id="progreso-jornada-container">
                    <div class="col-12">
                        <div class="card bg-light border-primary">
                            <div class="card-body py-3">
                                <div class="row align-items-center">
                                    <div class="col-md-6">
                                        <h6 class="text-primary mb-2" id="info-ruta-actual">
                                            <i class="bi bi-geo-alt me-1"></i>
                                            Ruta ${nombreRuta} - Unidad ${this.asignacionActiva.id_unidad}
                                        </h6>
                                        <div class="d-flex align-items-center mb-2">
                                            <span class="me-3"><strong>Vueltas Completadas:</strong></span>
                                            <span id="contador-vueltas" class="badge bg-primary fs-6">${this.vueltasCompletadas}/10</span>
                                        </div>
                                        <div class="d-flex align-items-center">
                                            <span class="me-3"><strong>Paradas en esta vuelta:</strong></span>
                                            <span id="contador-paradas" class="badge bg-info fs-6">${this.paradasCompletadas}/${this.totalParadas}</span>
                                        </div>
                                    </div>
                                    <div class="col-md-6">
                                        <div class="progress mb-2" style="height: 20px;">
                                            <div id="barra-progreso-vueltas" class="progress-bar progress-bar-striped progress-bar-animated" 
                                                 role="progressbar" style="width: ${(this.vueltasCompletadas / 10) * 100}%" 
                                                 aria-valuenow="${this.vueltasCompletadas}" aria-valuemin="0" aria-valuemax="100">
                                                ${this.vueltasCompletadas}/10 vueltas
                                            </div>
                                        </div>
                                        <div class="progress mb-3" style="height: 15px;">
                                            <div id="barra-progreso-paradas" class="progress-bar progress-bar-striped bg-info" 
                                                 role="progressbar" style="width: ${(this.paradasCompletadas / this.totalParadas) * 100}%" 
                                                 aria-valuenow="${this.paradasCompletadas}" aria-valuemin="0" aria-valuemax="100">
                                                ${this.paradasCompletadas}/${this.totalParadas} paradas
                                            </div>
                                        </div>
                                        <div class="alert alert-info small mb-0">
                                            <i class="bi bi-arrow-repeat me-1"></i>
                                            Sistema automático: Cada 7 paradas = 1 vuelta (se reinicia automáticamente)
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            // Insertar después del primer hr
            const firstHr = cardBody.querySelector('hr');
            if (firstHr) {
                firstHr.insertAdjacentHTML('afterend', progresoHTML);
            } else {
                cardBody.insertAdjacentHTML('afterbegin', progresoHTML);
            }
            
            console.log('✅ Interfaz de progreso creada para ruta:', nombreRuta);
        } else {
            const sinAsignacionHTML = `
                <div class="row mb-4" id="progreso-jornada-container">
                    <div class="col-12">
                        <div class="alert alert-info">
                            <i class="bi bi-info-circle me-2"></i>
                            No tienes una ruta asignada actualmente.
                        </div>
                    </div>
                </div>
            `;

            const firstHr = cardBody.querySelector('hr');
            if (firstHr) {
                firstHr.insertAdjacentHTML('afterend', sinAsignacionHTML);
            } else {
                cardBody.insertAdjacentHTML('afterbegin', sinAsignacionHTML);
            }
            
            console.log('ℹ️ No hay asignación activa - mostrando mensaje informativo');
        }
    }

    initializeEventListeners() {
        // Solo mantener el listener de emergencia
        document.querySelector('.btn-panic')?.addEventListener('click', () => {
            this.prepararModalEmergencia();
        });

        document.querySelector('.btn-report')?.addEventListener('click', () => {
            this.prepararModalReporte();
        });

        // OCULTAR el botón de reiniciar para evitar el bug
        const resetButton = document.getElementById('reset-route-button');
        if (resetButton) {
            resetButton.style.display = 'none';
        }
    }

    prepararModalReporte() {
        const reportForm = document.getElementById('reportForm');
        if (reportForm && this.asignacionActiva) {
            
            reportForm.onsubmit = async (e) => {
                e.preventDefault();
                
                const delayReason = document.getElementById('delayReason').value;
                const delayEstimate = document.getElementById('delayEstimate').value;
                
                if (!delayReason || !delayEstimate) {
                    this.mostrarToastNotificacion('Error', 'Completa todos los campos', 'error');
                    return;
                }

                // Procesar el reporte de retraso
                await this.procesarReporteRetraso(delayReason, delayEstimate);
                
                // Cerrar modal
                const modal = bootstrap.Modal.getInstance(document.getElementById('reportModal'));
                if (modal) {
                    modal.hide();
                }
            };
        }
    }

    // MÉTODO: Procesar reporte de retraso
    async procesarReporteRetraso(delayReason, delayEstimate) {
        try {
            console.log('📤 Procesando reporte de retraso...');
            
            const motivoTexto = this.getReasonText(delayReason);
            const nombreRuta = this.asignacionActiva.ruta === '40_Norte' ? '40 Norte' : '40 Sur';

            // Mostrar notificación de envío
            this.mostrarToastNotificacion('Enviando Reporte', 'Notificando a los usuarios del retraso...', 'info');

            // Aquí iría la llamada al endpoint de retraso
            // await fetch(`https://sistema-autobuses.onrender.com/api/notificaciones/retraso`, {...});

            // Simular éxito después de un delay
            setTimeout(() => {
                this.mostrarToastNotificacion(
                    'Retraso Reportado', 
                    `Los usuarios han sido notificados. Motivo: ${motivoTexto}. Tiempo estimado: ${this.getTimeText(delayEstimate)}`, 
                    'success'
                );
                
                // Notificar al administrador
                this.notificarAdministrador(
                    'Retraso Reportado',
                    `El chofer reportó retraso en la ruta ${nombreRuta}. Motivo: ${motivoTexto}. Tiempo: ${this.getTimeText(delayEstimate)}`
                );
            }, 1000);

        } catch (error) {
            console.error('❌ Error procesando reporte de retraso:', error);
            this.mostrarToastNotificacion('Error', 'No se pudo enviar el reporte de retraso', 'error');
        }
    }

    // MÉTODO: Obtener texto del motivo
    getReasonText(reason) {
        const reasons = {
            'Trafico': 'Tráfico Pesado inesperado',
            'Desviacion': 'Desviación de ruta temporal por obras',
            'Carga': 'Demora en la carga de pasajeros',
            'FallaMenor': 'Falla menor en la unidad (pronto se reanuda)'
        };
        return reasons[reason] || reason;
    }

    // MÉTODO: Obtener texto del tiempo estimado
    getTimeText(estimate) {
        const times = {
            '5': 'Menos de 5 minutos',
            '10': '5-10 minutos', 
            '15': 'Más de 10 minutos'
        };
        return times[estimate] || `${estimate} minutos`;
    }

    iniciarSistemaParadas() {
        if (this.observandoParadas || !this.asignacionActiva) return;
        
        this.observandoParadas = true;
        console.log('🔍 Iniciando sistema automático de paradas...');
        
        // Observar el botón de confirmar llegada para contar paradas
        this.observarConfirmacionParadas();
        
        console.log(`✅ Sistema automático listo. Cada ${this.totalParadas} paradas = 1 vuelta`);
    }

    observarConfirmacionParadas() {
        const confirmButton = document.getElementById('confirm-arrival-button');
        
        if (confirmButton && this.asignacionActiva) {
            // Guardar el click handler original si existe
            const originalClickHandler = confirmButton.onclick;
            
            // Sobrescribir el comportamiento del botón
            confirmButton.onclick = async (e) => {
                console.log('📍 Parada confirmada');
                
                // Ejecutar el comportamiento original si existe
                if (originalClickHandler) {
                    await originalClickHandler.call(confirmButton, e);
                }
                
                // ✅ ACTUALIZAR INTERFAZ ANTES de registrar la parada
                this.mantenerBotonActivo();
                
                // Registrar la parada después de un breve delay
                setTimeout(() => {
                    this.registrarParadaCompletada();
                }, 500);
            };
            
            console.log('✅ Observador de paradas activado');
        }
    }


    mantenerBotonActivo() {
        // Solo mantener activo si hay asignación
        if (!this.asignacionActiva) return;
        
        const confirmButton = document.getElementById('confirm-arrival-button');
        if (confirmButton) {
            // FORZAR que el botón siempre esté visible y habilitado
            confirmButton.style.display = 'block';
            confirmButton.disabled = false;
            confirmButton.classList.remove('d-none');
            
            // ✅ ACTUALIZAR SIEMPRE el texto del botón con la parada actual
            const siguienteParada = this.obtenerSiguienteParada();
            confirmButton.innerHTML = `Confirmar LLEGADA a ${siguienteParada}`;
        }
        
        // Ocultar mensaje de ruta completada si está visible
        const routeEndMessage = document.getElementById('route-end-message');
        if (routeEndMessage) {
            routeEndMessage.classList.add('d-none');
        }
    }

    // ✅ NUEVO MÉTODO: Obtener la siguiente parada basada en el progreso actual
    obtenerSiguienteParada() {
        if (this.paradasCompletadas >= this.paradas.length) {
            return this.paradas[0]; // Volver al inicio si se completó el ciclo
        }
        return this.paradas[this.paradasCompletadas];
    }

    // ✅ NUEVO MÉTODO: Obtener la parada anterior
    obtenerParadaAnterior() {
        if (this.paradasCompletadas === 0) {
            return "Punto de partida"; // Texto para la primera parada
        }
        return this.paradas[this.paradasCompletadas - 1];
    }

    registrarParadaCompletada() {
        if (!this.asignacionActiva || this.vueltasCompletadas >= 10) {
            return;
        }

        // Asegurar que el botón esté activo antes de registrar
        this.mantenerBotonActivo();

        // Incrementar contador de paradas
        this.paradasCompletadas++;
        console.log(`📍 Parada ${this.paradasCompletadas}/${this.totalParadas} completada`);
        
        // ✅ ACTUALIZAR INTERFAZ INMEDIATAMENTE después de cada parada
        this.actualizarInterfazParadasCompleta();
        
        // Verificar si se completó una vuelta (7 paradas)
        if (this.paradasCompletadas >= this.totalParadas) {
            console.log('🎯 Vuelta completada (7 paradas) - Registrando automáticamente');
            this.registrarVueltaCompleta();
        } else {
            // Mostrar progreso de parada
            this.mostrarToastNotificacion(
                'Parada Registrada', 
                `Parada ${this.paradasCompletadas}/${this.totalParadas} completada`, 
                'info',
                2000
            );
        }
    }

    // ✅ MÉTODO MEJORADO: Actualizar toda la interfaz de paradas
    actualizarInterfazParadasCompleta() {
        this.actualizarNombresParadas();
        this.actualizarInterfazParadas();
        this.actualizarBotonConfirmacion();
    }

    // ✅ MÉTODO MEJORADO: Actualizar nombres de paradas
    actualizarNombresParadas() {
        const nextStopElement = document.getElementById('next-stop-name');
        const prevStopElement = document.getElementById('prev-stop-name');
        
        if (nextStopElement && prevStopElement) {
            const siguienteParada = this.obtenerSiguienteParada();
            const paradaAnterior = this.obtenerParadaAnterior();
            
            nextStopElement.textContent = siguienteParada;
            prevStopElement.textContent = paradaAnterior;
            
            console.log(`🔄 Paradas actualizadas: Anterior=${paradaAnterior}, Siguiente=${siguienteParada}`);
        }
    }

    actualizarBotonConfirmacion() {
        const confirmButton = document.getElementById('confirm-arrival-button');
        if (confirmButton && this.asignacionActiva) {
            const siguienteParada = this.obtenerSiguienteParada();
            confirmButton.innerHTML = `Confirmar LLEGADA a ${siguienteParada}`;
        }
    }

    async registrarVueltaCompleta() {
        try {
            console.log('🔄 Registrando vuelta completa...');
            
            // Mostrar notificación de vuelta en progreso
            this.mostrarToastNotificacion('Procesando Vuelta', 'Registrando vuelta completa...', 'info');

            // Registrar vuelta en el backend
            const response = await fetch(`https://sistema-autobuses.onrender.com/api/chofer-progreso/registrar-vuelta`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    id_asignacion: this.asignacionActiva.id_asignacion
                })
            });

            if (response.ok) {
                const result = await response.json();
                this.vueltasCompletadas = result.vueltas_completadas;
                
                // Mostrar mensaje de éxito
                this.mostrarToastNotificacion(
                    '¡Vuelta Completada!', 
                    `Vuelta ${this.vueltasCompletadas}/10 registrada. Tiempo: ${result.mensaje.split(': ')[1]}`, 
                    'success'
                );
                
                // ✅ SOLO UNA VERSIÓN - REINICIO MEJORADO después de vuelta completa
                this.reiniciarParaNuevaVuelta();
                
                // Actualizar interfaz
                this.actualizarInterfazParadas();
                this.updateVueltaCounter();
                
                // Si completó 10 vueltas, terminar jornada
                if (result.jornada_completada) {
                    this.terminarJornada();
                }
            } else {
                throw new Error('Error al registrar vuelta automáticamente');
            }
        } catch (error) {
            console.error('Error registrando vuelta completa:', error);
            this.mostrarToastNotificacion('Error', 'No se pudo registrar la vuelta automáticamente', 'error');
        }
    }

    reiniciarParaNuevaVuelta() {
        console.log('🔄 Reiniciando automáticamente para nueva vuelta...');
        
        // ✅ SOLO UNA VERSIÓN - REINICIAR contador de paradas a CERO
        this.paradasCompletadas = 0;
        
        // ✅ ACTUALIZAR INTERFAZ COMPLETA después del reinicio
        this.actualizarInterfazParadasCompleta();
        
        // Asegurar que el botón esté activo
        this.mantenerBotonActivo();
        
        console.log('✅ Sistema reiniciado para nueva vuelta - Paradas: 0/' + this.totalParadas);
    }
    
    actualizarInterfazParadas() {
        const paradasCount = document.getElementById('contador-paradas');
        const paradasProgress = document.getElementById('barra-progreso-paradas');
        
        if (paradasCount && paradasProgress) {
            paradasCount.textContent = `${this.paradasCompletadas}/${this.totalParadas}`;
            
            // Calcular progreso
            const progreso = (this.paradasCompletadas / this.totalParadas) * 100;
            paradasProgress.style.width = `${progreso}%`;
            paradasProgress.textContent = `${this.paradasCompletadas}/${this.totalParadas} paradas`;
            
            // Cambiar color según el progreso
            if (this.paradasCompletadas >= this.totalParadas) {
                paradasProgress.className = 'progress-bar progress-bar-striped bg-success';
            } else if (this.paradasCompletadas >= this.totalParadas - 2) {
                paradasProgress.className = 'progress-bar progress-bar-striped bg-warning';
            } else {
                paradasProgress.className = 'progress-bar progress-bar-striped bg-info';
            }
        }
    }

    updateVueltaCounter() {
        const vueltasCount = document.getElementById('contador-vueltas');
        const vueltaProgress = document.getElementById('barra-progreso-vueltas');
        
        if (vueltasCount && vueltaProgress) {
            vueltasCount.textContent = `${this.vueltasCompletadas}/10`;
            
            // Calcular progreso
            const progreso = (this.vueltasCompletadas / 10) * 100;
            vueltaProgress.style.width = `${progreso}%`;
            vueltaProgress.textContent = `${this.vueltasCompletadas}/10 vueltas`;
            
            // Cambiar color según el progreso
            if (this.vueltasCompletadas >= 10) {
                vueltaProgress.className = 'progress-bar progress-bar-striped bg-success';
                vueltasCount.className = 'badge bg-success fs-6';
            } else if (this.vueltasCompletadas >= 7) {
                vueltaProgress.className = 'progress-bar progress-bar-striped bg-warning';
                vueltasCount.className = 'badge bg-warning fs-6';
            } else {
                vueltaProgress.className = 'progress-bar progress-bar-striped bg-info';
                vueltasCount.className = 'badge bg-primary fs-6';
            }
        }
    }

    terminarJornada() {
        console.log('🎉 Jornada completada - 10 vueltas registradas');
        
        // Actualizar interfaces
        this.updateVueltaCounter();
        this.actualizarInterfazParadas();
        
        // Mostrar notificación de jornada completada
        this.mostrarToastNotificacion(
            '¡Jornada Completa!', 
            'Has completado las 10 vueltas de tu jornada. ¡Buen trabajo!', 
            'success'
        );

        // Notificar al administrador
        this.notificarAdministrador(
            'Jornada Completada',
            `El chofer ha completado su jornada de 10 vueltas en la ruta ${this.asignacionActiva.ruta}.`
        );
        
        // Desactivar observación
        this.observandoParadas = false;
        
        // SOLO deshabilitar el botón cuando realmente termine la jornada
        const confirmButton = document.getElementById('confirm-arrival-button');
        if (confirmButton && this.vueltasCompletadas >= 10) {
            confirmButton.disabled = true;
            confirmButton.innerHTML = '<i class="bi bi-flag-fill me-2"></i>JORNADA COMPLETADA';
        }
    }

    prepararModalEmergencia() {
        const panicForm = document.getElementById('panicForm');
        if (panicForm && this.asignacionActiva) {
            
            panicForm.onsubmit = async (e) => {
                e.preventDefault();
                
                const incidentType = document.querySelector('input[name="incidentType"]:checked');
                const serviceType = document.querySelector('input[name="serviceType"]:checked');
                
                if (!incidentType || !serviceType) {
                    this.mostrarToastNotificacion('Error', 'Completa todos los campos', 'error');
                    return;
                }

                const tipoIncidente = `${incidentType.value} - ${serviceType.value}`;
                
                await this.reportarIncidente(tipoIncidente, `Servicio requerido: ${serviceType.value}`);
                
                const modal = bootstrap.Modal.getInstance(document.getElementById('panicModal'));
                if (modal) {
                    modal.hide();
                }
            };
        }
    }

    async reportarIncidente(tipoIncidente, descripcion = '') {
        if (!this.asignacionActiva) {
            this.mostrarToastNotificacion('Error', 'No tienes una ruta asignada', 'error');
            return;
        }

        try {
            const response = await fetch(`https://sistema-autobuses.onrender.com/api/chofer-progreso/reportar-incidente`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    id_asignacion: this.asignacionActiva.id_asignacion,
                    tipo_incidente: tipoIncidente,
                    descripcion: descripcion
                })
            });

            const result = await response.json();

            if (result.success) {
                this.mostrarToastNotificacion(
                    'Emergencia Reportada', 
                    'Se ha solicitado asistencia de emergencia. La jornada ha sido terminada.', 
                    'info'
                );
                
                // Resetear todo
                this.asignacionActiva = null;
                this.vueltasCompletadas = 0;
                this.paradasCompletadas = 0;
                this.observandoParadas = false;
                this.actualizarInterfazParadas();
                this.updateVueltaCounter();
                this.crearInterfazProgreso();
                this.controlarVisibilidadBotones(); // Actualizar visibilidad
            } else {
                throw new Error(result.detail);
            }
        } catch (error) {
            console.error('❌ Error reportando incidente:', error);
            this.mostrarToastNotificacion('Error', 'No se pudo reportar el incidente', 'error');
        }
    }

    async notificarAdministrador(titulo, mensaje) {
        try {
            const usuarioData = localStorage.getItem('tucsa_chofer');
            const usuario = JSON.parse(usuarioData);
            
            await fetch(`https://sistema-autobuses.onrender.com/api/notificaciones/`, {
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
                    ruta_afectada: this.asignacionActiva?.ruta
                })
            });
        } catch (error) {
            console.error('Error enviando notificación:', error);
        }
    }

    mostrarToastNotificacion(titulo, mensaje, tipo = 'success', delay = 5000) {
        const toastContainer = document.getElementById('toast-container') || this.crearToastContainer();
        
        const toastId = 'toast-' + Date.now();
        const toastHTML = `
            <div id="${toastId}" class="toast align-items-center text-bg-${tipo === 'success' ? 'success' : tipo === 'error' ? 'danger' : 'warning'} border-0" role="alert">
                <div class="d-flex">
                    <div class="toast-body">
                        <strong>${titulo}</strong><br>${mensaje}
                    </div>
                    <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
                </div>
            </div>
        `;
        
        toastContainer.insertAdjacentHTML('beforeend', toastHTML);
        
        const toastElement = document.getElementById(toastId);
        const toast = new bootstrap.Toast(toastElement, {
            autohide: true,
            delay: delay
        });
        
        toast.show();
        
        toastElement.addEventListener('hidden.bs.toast', () => {
            toastElement.remove();
        });
    }

    crearToastContainer() {
        const containerHTML = `
            <div id="toast-container" class="toast-container position-fixed top-0 end-0 p-3" style="z-index: 9999"></div>
        `;
        document.body.insertAdjacentHTML('beforeend', containerHTML);
        return document.getElementById('toast-container');
    }
}