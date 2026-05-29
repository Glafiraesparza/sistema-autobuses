let currentUser = null;
const API_BASE = `https://sistema-autobuses.onrender.com/api`; 
let usuarioActual = null;

// --- 1. Inicialización y Carga de Datos ---
document.addEventListener('DOMContentLoaded', () => {

    PassengerNotificationManager.initialize((notifications) => {
        console.log('🔔 Notificaciones de retraso actualizadas:', notifications);
        // Actualizar la UI cuando cambien las notificaciones
        PassengerNotificationManager.updateNotificationsDropdown();
        PassengerNotificationManager.updateNotificationBadge();
    });
    const userData = localStorage.getItem('user_data');
    
    if (!userData) {
        window.location.href = 'inicio_sesion.html';
        return;
    }

    usuarioActual = JSON.parse(userData);
    actualizarMenuLateral(usuarioActual);

    // Establecer fecha por defecto
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    const fechaInput = document.getElementById('fechaHora');
    if(fechaInput) {
        fechaInput.value = now.toISOString().slice(0, 16);
    }

    // --- Event Listeners (Con validación de existencia) ---
    const form = document.getElementById('formQueja');
    if (form) {
        form.addEventListener('submit', enviarReporte);
    }

    const btnCancelar = document.getElementById('btnCancelar');
    if (btnCancelar) {
        btnCancelar.addEventListener('click', () => {
            window.location.href = 'pasajero_inicio.html';
        });
    }

    const btnCerrarSesion = document.getElementById('btnCerrarSesion');
    if (btnCerrarSesion) {
        btnCerrarSesion.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.removeItem('user_data');
            window.location.href = 'inicio_sesion.html';
        });
    }
    
    cargarDatosUsuario();
    loadInitialNotifications();
    verificarSaldoBajo(usuarioActual.saldo);
});

function cargarDatosUsuario() {
    const userData = localStorage.getItem('user_data');
    if (userData) {
        usuarioActual = JSON.parse(userData);
        
        // ✅ CORREGIDO: Pasar el objeto usuarioActual, no el string
        actualizarInterfazUsuario(usuarioActual);
    }
}

function actualizarInterfazUsuario(usuario) {
    console.log('Actualizando interfaz con:', usuario);
    
    if (!usuario || !usuario.nombre) {
        console.warn('Datos de usuario incompletos:', usuario);
        return;
    }
    
    const nombreCompleto = usuario.nombre;
    const primerNombre = nombreCompleto.split(' ')[0];

    // Actualizar menú offcanvas
    const offcanvasHeader = document.querySelector('.offcanvas-profile-header');
    if (offcanvasHeader) {
        offcanvasHeader.innerHTML = `
            <i class="fa-solid fa-circle-user profile-icon"></i>
            <h4>${primerNombre}</h4>
            <p>${usuario.email || 'usuario@tucsa.com'}</p>
            ${usuario.tipo !== 'normal' ? `<small class="badge bg-success">Tarifa ${usuario.tipo}</small>` : ''}
        `;
    }
}

function actualizarMenuLateral(usuario) {
    const nombreEl = document.getElementById('menuNombreUsuario');
    const emailEl = document.getElementById('menuEmailUsuario');
    
    if (nombreEl) nombreEl.textContent = usuario.nombre.split(' ')[0];
    if (emailEl) emailEl.textContent = usuario.email;
}

// --- 2. Función para Enviar el Reporte ---
async function enviarReporte(event) {
    event.preventDefault();

    const btnEnviar = document.getElementById('btnEnviar');
    
    // Deshabilitar botón
    if(btnEnviar) {
        btnEnviar.disabled = true;
        btnEnviar.textContent = "Enviando...";
    }

    // Obtener valores del HTML (CORREGIDO: usar las variables declaradas)
    const rutaValor = document.getElementById('ruta').value;
    const unidadValor = document.getElementById('unidad').value;
    const fechaValor = document.getElementById('fechaHora').value;
    const descripcionValor = document.getElementById('descripcion').value;

    // Validar que no estén vacíos (opcional pero recomendado)
    if (!rutaValor || !unidadValor || !fechaValor || !descripcionValor) {
        mostrarMensaje("Por favor completa todos los campos.", false);
        if(btnEnviar) {
            btnEnviar.disabled = false;
            btnEnviar.textContent = "Enviar Reporte";
        }
        return;
    }

    const reporteData = {
        // Si el ID es nulo, enviamos cadena vacía para que no rompa el tipo de dato
        id_usuario: usuarioActual && usuarioActual.id_usuario ? String(usuarioActual.id_usuario) : "",
        
        // CORREGIDO: Usar las variables con los valores reales
        ruta: rutaValor ? String(rutaValor) : "",
        numero_unidad: unidadValor ? String(unidadValor) : "",
        fecha_hora: fechaValor ? String(fechaValor) : "",
        descripcion: descripcionValor ? String(descripcionValor) : "",
        
        estado: "Pendiente"
    };

    // Hacemos un log para que veas en la consola qué se está enviando exactamente
    console.log("Datos que se enviarán:", reporteData);

    try {
        const response = await fetch(`${API_BASE}/quejas`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(reporteData)
        });

        const data = await response.json();

        if (response.ok) {
            mostrarMensaje("¡Reporte enviado correctamente! Redirigiendo...", true);
            document.getElementById('formQueja').reset();
            
            // Esperar 2 segundos y redirigir
            setTimeout(() => {
                window.location.href = 'pasajero_inicio.html';
            }, 2000);

        } else {
            mostrarMensaje(data.detail || "Error al enviar el reporte (422).", false);
            console.error("Detalle del error:", data);
        }

    } catch (error) {
        console.error(error);
        mostrarMensaje("Error de conexión con el servidor.", false);
    } finally {
        if (btnEnviar && !document.querySelector('.alert-success')) { 
            // Solo reactivar si no fue éxito (para evitar doble click mientras redirige)
            btnEnviar.disabled = false;
            btnEnviar.textContent = "Enviar Reporte";
        }
    }
}

// --- 3. Función de Utilidad para Mensajes (GLOBAL) ---
function mostrarMensaje(texto, exito) {
    const mensajeDiv = document.getElementById('mensajeAlerta');
    if (!mensajeDiv) return;

    mensajeDiv.textContent = texto;
    mensajeDiv.className = exito 
        ? 'alert alert-success mt-3' 
        : 'alert alert-danger mt-3';
    mensajeDiv.classList.remove('d-none');

    if (!exito) {
        setTimeout(() => {
            mensajeDiv.classList.add('d-none');
        }, 5000);
    }
}

// Función async para cargar notificaciones iniciales
async function loadInitialNotifications() {
    try {
        // El await debe estar dentro de una función async
        await PassengerNotificationManager.loadNotifications();
        
        // Actualizar la UI después de cargar
        PassengerNotificationManager.updateNotificationsDropdown();
        PassengerNotificationManager.updateNotificationBadge();
        
        // Iniciar actualización automática
        PassengerNotificationManager.startAutoRefresh(3000); // Cada 60 segundos
        
    } catch (error) {
        console.error('Error cargando notificaciones iniciales:', error);
    }
}
function verificarSaldoBajo(saldo) {
    const saldoBajo = saldo < 20.00; // Considerar saldo bajo menos de $20
    const lowBalanceDot = document.getElementById('low-balance-dot');
    const lowBalanceAlert = document.getElementById('low-balance-alert-item');
    
    if (saldoBajo) {
        // Mostrar punto rojo de notificación
        if (lowBalanceDot) {
            lowBalanceDot.style.display = 'block';
            lowBalanceDot.style.backgroundColor = '#dc3545';
        }
        // Mostrar alerta de saldo bajo
        if (lowBalanceAlert) {
            lowBalanceAlert.style.display = 'block';
        }
    } else {
        // Ocultar notificaciones de saldo bajo
        if (lowBalanceDot) {
            lowBalanceDot.style.display = 'none';
        }
        if (lowBalanceAlert) {
            lowBalanceAlert.style.display = 'none';
        }
    }
}