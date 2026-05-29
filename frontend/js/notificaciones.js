// Array de paradas de la ruta
const routeStops = [
    "Estación Central Norte",
    "Parque Industrial", 
    "Cruce Av. Las Flores",
    "Mercado Principal",
    "Plaza Centro Histórico",
    "Hospital General",
    "Terminal Sur" // Fin de la ruta
];

// Estado inicial de la ruta
let currentStopIndex = 0;
const prevStopElement = document.getElementById('prev-stop-name');
const nextStopElement = document.getElementById('next-stop-name');
const confirmButton = document.getElementById('confirm-arrival-button');
const routeEndMessage = document.getElementById('route-end-message');

/**
 * Inicializa la interfaz con la parada actual.
 */
function initializeRouteDisplay() {
    // Inicialmente, la parada anterior es la salida (ficticia)
    prevStopElement.textContent = "Av. Principal y Calle 15";
    nextStopElement.textContent = routeStops[currentStopIndex];
    confirmButton.textContent = `Confirmar LLEGADA a ${routeStops[currentStopIndex]}`;
    routeEndMessage.classList.add('d-none');
    confirmButton.classList.remove('d-none');
}

/**
 * Actualiza el progreso de la ruta al confirmar la llegada a una parada.
 */
/*
function updateRouteProgress() {
    if (currentStopIndex >= routeStops.length) {
        // La ruta ha terminado
        routeEndMessage.classList.remove('d-none');
        confirmButton.classList.add('d-none');
        prevStopElement.textContent = routeStops[routeStops.length - 1];
        nextStopElement.textContent = "FIN DE RUTA";
        return;
    }

    const currentStopName = routeStops[currentStopIndex];
    
    // Mover la próxima parada a la parada anterior
    prevStopElement.textContent = currentStopName;
    
    // Avanzar al siguiente índice
    currentStopIndex++;
    
    if (currentStopIndex < routeStops.length) {
        // Si hay más paradas, actualizar la próxima parada
        const nextStopName = routeStops[currentStopIndex];
        nextStopElement.textContent = nextStopName;
        confirmButton.textContent = `Confirmar LLEGADA a ${nextStopName}`;
    } else {
        // Si la ruta ha finalizado después del avance
        updateRouteProgress(); // Llama de nuevo para mostrar el mensaje de fin de ruta
    }
}*/

// --- Event Listeners y Lógica Inicial ---
/*
document.addEventListener('DOMContentLoaded', initializeRouteDisplay);
confirmButton.addEventListener('click', updateRouteProgress);*/

// Lógica para el botón de estado Activo/Inactivo
document.addEventListener('DOMContentLoaded', () => {
    const statusButton = document.getElementById('status-button');
    
    statusButton.addEventListener('click', () => {
        if (statusButton.classList.contains('btn-status-active')) {
            statusButton.classList.remove('btn-status-active');
            statusButton.classList.add('btn-status-inactive');
            statusButton.innerHTML = '<i class="bi bi-geo-alt-fill me-1"></i> Inactivo';
            
            // Enviar notificación de estado inactivo
            enviarNotificacionEstado('inactivo');
        } else {
            statusButton.classList.add('btn-status-active');
            statusButton.classList.remove('btn-status-inactive');
            statusButton.innerHTML = '<i class="bi bi-geo-alt-fill me-1"></i> Activo';
            
            // Enviar notificación de estado activo
            enviarNotificacionEstado('activo');
        }
    });
    
    statusButton.classList.add('btn-status-active');
});

// =============================================
// SISTEMA DE NOTIFICACIONES PARA CHOFER - CORREGIDO
// =============================================

// Función para mostrar modal de confirmación
function mostrarConfirmacion(titulo, mensaje, tipo = 'success') {
    // Crear modal dinámicamente si no existe
    let modalElement = document.getElementById('confirmationModal');
    
    if (!modalElement) {
        const modalHTML = `
            <div class="modal fade" id="confirmationModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="confirmation-title"></h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <p id="confirmation-message"></p>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-primary" data-bs-dismiss="modal">Aceptar</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        modalElement = document.getElementById('confirmationModal');
    }

    const modalTitle = document.getElementById('confirmation-title');
    const modalMessage = document.getElementById('confirmation-message');
    const modalHeader = modalElement.querySelector('.modal-header');
    
    // Configurar según el tipo
    if (tipo === 'success') {
        modalHeader.className = 'modal-header bg-success text-white';
        modalTitle.className = 'text-white';
    } else {
        modalHeader.className = 'modal-header bg-danger text-white';
        modalTitle.className = 'text-white';
    }
    
    modalTitle.textContent = titulo;
    modalMessage.textContent = mensaje;
    
    // Mostrar modal
    const modal = new bootstrap.Modal(modalElement);
    modal.show();
}

// Función para enviar notificación de estado
async function enviarNotificacionEstado(estado) {
    try {
        const chofer = obtenerChoferLogueado();
        const response = await fetch(`https://${IP_API}:8000/api/notificaciones/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                tipo: 'sistema',
                titulo: `Chofer ${estado.toUpperCase()}`,
                mensaje: `El chofer ${chofer.nombre} está ahora ${estado}`,
                id_chofer: chofer.id
            })
        });
        
        if (response.ok) {
            console.log(`✅ Estado ${estado} notificado`);
        }
    } catch (error) {
        console.error('❌ Error enviando estado:', error);
    }
}

// Modal de Reporte de Retraso - CORREGIDO
document.addEventListener('DOMContentLoaded', function() {
    const reportForm = document.getElementById('reportForm');
    if (reportForm) {
        reportForm.addEventListener('submit', async function(event) {
            event.preventDefault();
            
            const delayReason = document.getElementById('delayReason').value;
            const delayEstimate = document.getElementById('delayEstimate').value;
            const chofer = obtenerChoferLogueado();
            const rutaActual = chofer.ruta;
            const idChofer = chofer.id;

            // Mapear valores a textos más descriptivos
            const motivoTextos = {
                "Trafico": "Tráfico pesado inesperado",
                "Desviacion": "Desviación de ruta temporal por obras",
                "Carga": "Demora en la carga de pasajeros", 
                "FallaMenor": "Falla menor en la unidad (pronto se reanuda)"
            };
            
            const tiempoTextos = {
                "5": "Menos de 5 minutos",
                "10": "5-10 minutos",
                "15": "Más de 10 minutos"
            };
            
            const motivo = motivoTextos[delayReason] || delayReason;
            const tiempoEstimado = tiempoTextos[delayEstimate] || `${delayEstimate} minutos`;

            try {
                console.log('📤 Enviando notificación de retraso...');

                const response = await fetch(`https://${IP_API}:8000/api/notificaciones/retraso`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        ruta: rutaActual,
                        tiempo_estimado: parseInt(delayEstimate),
                        motivo: motivo,
                        id_chofer: idChofer
                    })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    console.log('✅ Notificación de retraso enviada:', result.notificacion);
                    
                    // Cerrar modal de reporte
                    const reportModal = bootstrap.Modal.getInstance(document.getElementById('reportModal'));
                    if (reportModal) {
                        reportModal.hide();
                    }
                    
                    // Mostrar modal de confirmación
                    mostrarConfirmacion(
                        'Retraso Reportado', 
                        `Los pasajeros han sido notificados del retraso: ${tiempoEstimado}. Motivo: ${motivo}`
                    );
                    
                    // Limpiar formulario
                    document.getElementById('reportForm').reset();
                    
                } else {
                    throw new Error(result.detail || 'Error desconocido');
                }
            } catch (error) {
                console.error('❌ Error enviando notificación:', error);
                mostrarConfirmacion(
                    'Error', 
                    'No se pudo enviar la notificación. Intenta nuevamente.',
                    'error'
                );
            }
        });
    }
});

// Modal de Emergencia/Asistencia - CORREGIDO
document.addEventListener('DOMContentLoaded', function() {
    const panicForm = document.getElementById('panicForm');
    if (panicForm) {
        panicForm.addEventListener('submit', async function(event) {
            event.preventDefault();
            
            const incidentType = document.querySelector('input[name="incidentType"]:checked');
            const serviceType = document.querySelector('input[name="serviceType"]:checked');
            
            if (!incidentType || !serviceType) {
                mostrarConfirmacion(
                    'Error',
                    'Por favor completa todos los campos requeridos.',
                    'error'
                );
                return;
            }
            
            const chofer = obtenerChoferLogueado();
            const rutaActual = chofer.ruta;
            const idChofer = chofer.id;

            // Mapear tipos de incidente y servicio a textos descriptivos
            const incidenteTextos = {
                "Accidente": "Accidente/Colisión",
                "Falla Mecánica": "Falla Mecánica"
            };
            
            const servicioTextos = {
                "Abogado": "Asistencia Legal (Abogado)",
                "Mecánico/Grúa": "Asistencia Mecánica (Mecánico/Grúa)"
            };
            
            const tipoIncidente = incidenteTextos[incidentType.value] || incidentType.value;
            const tipoServicio = servicioTextos[serviceType.value] || serviceType.value;
            const descripcionCompleta = `${tipoIncidente} - ${tipoServicio}`;

            try {
                console.log('🚨 Enviando notificación de emergencia...');

                const response = await fetch(`https://${IP_API}:8000/api/notificaciones/emergencia`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        ruta: rutaActual,
                        tipo_incidente: descripcionCompleta,
                        id_chofer: idChofer
                    })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    console.log('✅ Notificación de emergencia enviada:', result.notificacion);
                    
                    // Cerrar modal de emergencia
                    const panicModal = bootstrap.Modal.getInstance(document.getElementById('panicModal'));
                    if (panicModal) {
                        panicModal.hide();
                    }
                    
                    // Mostrar modal de confirmación
                    mostrarConfirmacion(
                        'Emergencia Reportada', 
                        'El equipo de soporte ha sido notificado y los pasajeros han sido informados de la situación.'
                    );
                    
                    // Limpiar formulario
                    document.getElementById('panicForm').reset();
                    
                } else {
                    throw new Error(result.detail || 'Error desconocido');
                }
            } catch (error) {
                console.error('❌ Error enviando notificación de emergencia:', error);
                mostrarConfirmacion(
                    'Error',
                    'No se pudo enviar la emergencia. Intenta nuevamente o contacta por teléfono.',
                    'error'
                );
            }
        });
    }
});

// Función para obtener el chofer logueado (mejorada)
function obtenerChoferLogueado() {
    try {
        // Intentar obtener del localStorage
        const usuarioData = localStorage.getItem('tucsa_personal');
        if (usuarioData) {
            const usuario = JSON.parse(usuarioData);
            if (usuario.rol === 'chofer') {
                return {
                    id: usuario.id_personal,
                    nombre: usuario.nombre,
                    ruta: usuario.id_camion_asignado === '1124' ? '40 Sur' : '40 Norte',
                    camion: usuario.id_camion_asignado
                };
            }
        }
        
        // Fallback para desarrollo
        console.warn('⚠️ No se encontraron datos de chofer, usando datos de prueba');
        return {
            id: 2,
            nombre: "Juan Pérez - Chofer Ruta 40 Sur",
            ruta: "40 Sur",
            camion: "1124"
        };
    } catch (error) {
        console.error('Error obteniendo datos del chofer:', error);
        return {
            id: 2,
            nombre: "Chofer Demo",
            ruta: "40 Sur",
            camion: "1124"
        };
    }
}

// Inicializar datos del chofer
document.addEventListener('DOMContentLoaded', function() {
    const chofer = obtenerChoferLogueado();
    const nombreElement = document.getElementById('chofer-nombre');
    if (nombreElement) {
        nombreElement.textContent = chofer.nombre;
    }
    
    // Actualizar información de ruta en la UI
    const rutaElements = document.querySelectorAll('.ruta-info');
    rutaElements.forEach(element => {
        element.textContent = `Ruta: ${chofer.ruta} - Camión: ${chofer.camion}`;
    });
    
    console.log('👨‍💼 Chofer inicializado:', chofer);
});

// =============================================
// FUNCIONES DE TESTING (para desarrollo)
// =============================================

// Función para testear notificaciones desde la consola
window.testNotificacionRetraso = async function() {
    console.log('🧪 Probando notificación de retraso...');
    
    try {
        const chofer = obtenerChoferLogueado();
        const response = await fetch(`https://${IP_API}:8000/api/notificaciones/retraso`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                ruta: chofer.ruta,
                tiempo_estimado: 5,
                motivo: "Prueba de retraso desde consola",
                id_chofer: chofer.id
            })
        });
        
        const result = await response.json();
        console.log('✅ Resultado test retraso:', result);
        
        if (result.success) {
            mostrarConfirmacion('Test Exitoso', 'Notificación de retraso enviada correctamente');
        }
    } catch (error) {
        console.error('❌ Error test retraso:', error);
        mostrarConfirmacion('Test Fallido', 'Error enviando notificación de retraso', 'error');
    }
};

window.testNotificacionEmergencia = async function() {
    console.log('🧪 Probando notificación de emergencia...');
    
    try {
        const chofer = obtenerChoferLogueado();
        const response = await fetch(`https://${IP_API}:8000/api/notificaciones/emergencia`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                ruta: chofer.ruta, 
                tipo_incidente: "Prueba de emergencia - Asistencia Mecánica",
                id_chofer: chofer.id
            })
        });
        
        const result = await response.json();
        console.log('✅ Resultado test emergencia:', result);
        
        if (result.success) {
            mostrarConfirmacion('Test Exitoso', 'Notificación de emergencia enviada correctamente');
        }
    } catch (error) {
        console.error('❌ Error test emergencia:', error);
        mostrarConfirmacion('Test Fallido', 'Error enviando notificación de emergencia', 'error');
    }
};

// Función para probar el endpoint de notificaciones general
window.testNotificacionGeneral = async function() {
    console.log('🧪 Probando notificación general...');
    
    try {
        const chofer = obtenerChoferLogueado();
        const response = await fetch(`https://${IP_API}:8000/api/notificaciones/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                tipo: 'sistema',
                titulo: 'Notificación de Prueba',
                mensaje: 'Esta es una notificación de prueba desde la consola',
                id_chofer: chofer.id
            })
        });
        
        const result = await response.json();
        console.log('✅ Resultado test general:', result);
        
        if (result.success) {
            mostrarConfirmacion('Test Exitoso', 'Notificación general enviada correctamente');
        }
    } catch (error) {
        console.error('❌ Error test general:', error);
        mostrarConfirmacion('Test Fallido', 'Error enviando notificación general', 'error');
    }
};

/**
 * Reinicia el progreso de la ruta al inicio
 */
function reiniciarRuta() {
    currentStopIndex = 0;
    initializeRouteDisplay();

    // Mostrar confirmación
    mostrarConfirmacion(
        'Ruta Reiniciada', 
        'El progreso de la Ruta 40 Sur ha sido reiniciado al inicio.'
    );

    console.log('🔄 Ruta 40 Sur reiniciada');
}

// Agregar event listener para el botón de reinicio
document.addEventListener('DOMContentLoaded', function() {
    const resetButton = document.getElementById('reset-route-button');
    if (resetButton) {
        resetButton.addEventListener('click', reiniciarRuta);
    }
});

// =============================================
// SISTEMA DE ACTUALIZACIÓN AUTOMÁTICA
// =============================================

// Función para actualizar el estado del chofer en el servidor
async function actualizarEstadoServidor(estado) {
    try {
        const chofer = obtenerChoferLogueado();
        const response = await fetch(`https://${IP_API}:8000/api/chofer/estado`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                id_chofer: chofer.id,
                estado: estado,
                id_camion: chofer.camion
            })
        });
        
        if (response.ok) {
            console.log(`✅ Estado ${estado} actualizado en servidor`);
        }
    } catch (error) {
        console.error('❌ Error actualizando estado en servidor:', error);
    }
}

// Función para confirmar llegada en el servidor
async function confirmarLlegadaServidor() {
    try {
        const chofer = obtenerChoferLogueado();
        const response = await fetch(`https://${IP_API}:8000/api/chofer/confirmar-llegada`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                id_chofer: chofer.id,
                id_camion: chofer.camion,
                ruta: chofer.ruta,
                timestamp: new Date().toISOString()
            })
        });
        
        if (response.ok) {
            console.log('✅ Llegada confirmada en servidor');
            
            // Enviar notificación al administrador
            await fetch(`https://${IP_API}:8000/api/notificaciones/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    tipo: 'sistema',
                    titulo: 'Llegada Confirmada',
                    mensaje: `El chofer ${chofer.nombre} ha confirmado llegada en la ruta ${chofer.ruta}`,
                    id_chofer: chofer.id
                })
            });
        }
    } catch (error) {
        console.error('❌ Error confirmando llegada en servidor:', error);
    }
}

// Modificar la función updateRouteProgress para incluir confirmación en servidor
/*const originalUpdateRouteProgress = updateRouteProgress;*/
updateRouteProgress = function() {
    originalUpdateRouteProgress();
    
    // Confirmar llegada en servidor si no es el fin de ruta
    if (currentStopIndex <= routeStops.length) {
        confirmarLlegadaServidor();
    }
};

// Modificar el event listener del botón de estado
document.addEventListener('DOMContentLoaded', () => {
    const statusButton = document.getElementById('status-button');
    if (statusButton) {
        statusButton.addEventListener('click', () => {
            const nuevoEstado = statusButton.classList.contains('btn-status-active') ? 'inactivo' : 'activo';
            actualizarEstadoServidor(nuevoEstado);
        });
    }
});

console.log('🚌 Sistema de chofer cargado - Notificaciones listas');

// Exportar funciones para uso global
window.mostrarConfirmacion = mostrarConfirmacion;
window.reiniciarRuta = reiniciarRuta;
window.obtenerChoferLogueado = obtenerChoferLogueado;

