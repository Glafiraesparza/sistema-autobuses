const API_BASE = `https://${IP_API}:8000/api`; 
let usuarioActual = null;

// Función para obtener el token de autenticación
function getAuthToken() {
    return localStorage.getItem('auth_token');
}

// Verificar autenticación
function verificarAutenticacion() {
    const token = getAuthToken();
    const userData = localStorage.getItem('user_data');
    
    if (!token || !userData) {
        window.location.href = 'inicio_sesion.html';
        return null;
    }
    
    return JSON.parse(userData);
}

// --- 1. Cargar Datos ---
function cargarDatosUsuario() {
    usuarioActual = verificarAutenticacion();
    
    if (!usuarioActual) {
        console.log("No hay sesión, redirigiendo...");
        window.location.href = 'inicio_sesion.html';
        return;
    }
    
    const emailInput = document.getElementById('email');
    const nombreInput = document.getElementById('nombre');

    if(emailInput) emailInput.value = usuarioActual.email;
    if(nombreInput) nombreInput.value = usuarioActual.nombre;

    actualizarMenuLateral(usuarioActual);
    
    // Verificar saldo bajo si existe
    if (usuarioActual.saldo) {
        verificarSaldoBajo(usuarioActual.saldo);
    }
}

function actualizarMenuLateral(usuario) {
    const header = document.querySelector('.offcanvas-profile-header');
    if (header && usuario.nombre) {
        const primerNombre = usuario.nombre.split(' ')[0];
        header.innerHTML = `
            <i class="fa-solid fa-circle-user profile-icon"></i>
            <h4>${primerNombre}</h4>
            <p>${usuario.email || 'usuario@tucsa.com'}</p>
            ${usuario.tipo !== 'normal' ? `<small class="badge bg-success">Tarifa ${usuario.tipo}</small>` : ''}
        `;
    }
}

// --- 2. Mensajes y Utilidades ---
function mostrarMensaje(texto, exito) {
    const mensajeDiv = document.getElementById('mensaje');
    if (!mensajeDiv) return;

    mensajeDiv.textContent = texto;
    mensajeDiv.className = exito 
        ? 'alert alert-success mt-3' 
        : 'alert alert-danger mt-3';
    mensajeDiv.style.display = 'block';

    setTimeout(() => {
        mensajeDiv.style.display = 'none';
    }, 4000);
}

function cerrarSesion(redireccionarA = 'inicio_sesion.html') {
    // Limpiar notificaciones al cerrar sesión
    if (typeof PassengerNotificationManager !== 'undefined' && PassengerNotificationManager.stopAutoRefresh) {
        PassengerNotificationManager.stopAutoRefresh();
    }
    
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_data');
    if (redireccionarA) {
        window.location.href = redireccionarA;
    }
}

// --- 3. Manejo del Formulario ---
async function handleSubmit(event) {
    event.preventDefault();

    if (!usuarioActual || !usuarioActual.id_usuario) {
        mostrarMensaje("Error de sesión. Recarga la página.", false);
        return;
    }

    const nombre = document.getElementById('nombre').value;

    const datosUpdate = {
        nombre: nombre
    };

    const btnGuardar = document.getElementById('guardarCambios');
    btnGuardar.disabled = true;
    btnGuardar.textContent = "Guardando...";

    try {
        const response = await fetch(`${API_BASE}/usuarios/${usuarioActual.id_usuario}/configuracion`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getAuthToken()}`
            },
            body: JSON.stringify(datosUpdate)
        });

        const data = await response.json();

        if (response.ok) {
            mostrarMensaje("¡Nombre actualizado correctamente!", true);
            
            const nuevoUserData = { ...usuarioActual, ...data };
            localStorage.setItem('user_data', JSON.stringify(nuevoUserData));
            usuarioActual = nuevoUserData;
            
            actualizarMenuLateral(usuarioActual);

        } else {
            mostrarMensaje(data.detail || "Error al actualizar.", false);
        }

    } catch (error) {
        console.error(error);
        mostrarMensaje("Error de conexión con el servidor.", false);
    } finally {
        btnGuardar.disabled = false;
        btnGuardar.textContent = "Guardar Cambios";
    }
}

// --- Nueva función para restablecer contraseña ---
async function handleRestablecerPassword() {
    if (!usuarioActual || !usuarioActual.email) {
        mostrarMensaje("Error: No se pudo obtener el correo de la sesión.", false);
        return;
    }

    const email = usuarioActual.email;
    
    // Mostrar confirmación
    const confirmar = confirm(`Se enviará un enlace de recuperación a ${email}. ¿Continuar?`);
    if (!confirmar) return;

    const btnRestablecer = document.getElementById('btnRestablecerPassword');
    
    // Guardar estado original del botón
    const originalText = btnRestablecer.innerHTML;
    const originalDisabled = btnRestablecer.disabled;
    
    // Mostrar loading
    btnRestablecer.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-2"></i>Procesando...';
    btnRestablecer.disabled = true;

    try {
        const response = await fetch(`${API_BASE}/password/solicitar-recuperacion`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getAuthToken()}`
            },
            body: JSON.stringify({
                email: email
            })
        });
        
        const data = await response.json();
        
        if (data.exito) {
            mostrarMensaje('✅ ' + data.mensaje, true);
            
            // Guardar email para siguiente paso
            localStorage.setItem('emailRecuperacion', email);
            
            // Cerrar sesión actual y redirigir
            cerrarSesion('restablecer_contraseña.html');
            
        } else {
            mostrarMensaje('❌ ' + data.mensaje, false);
        }

    } catch (error) {
        console.error('Error:', error);
        mostrarMensaje('❌ Error de conexión con el servidor', false);
    } finally {
        // Restaurar botón
        btnRestablecer.innerHTML = originalText;
        btnRestablecer.disabled = originalDisabled;
    }
}

// --- 4. Funciones para Notificaciones ---
function loadInitialNotifications() {
    try {
        // Verificar si el módulo está disponible
        if (typeof PassengerNotificationManager !== 'undefined') {
            
            // Inicializar el manager
            if (PassengerNotificationManager.initialize) {
                PassengerNotificationManager.initialize((notifications) => {
                    console.log('🔔 Notificaciones actualizadas:', notifications);
                    
                    // Actualizar la UI
                    if (PassengerNotificationManager.updateNotificationsDropdown) {
                        PassengerNotificationManager.updateNotificationsDropdown();
                    }
                    if (PassengerNotificationManager.updateNotificationBadge) {
                        PassengerNotificationManager.updateNotificationBadge();
                    }
                });
            }
            
            // Cargar notificaciones
            if (PassengerNotificationManager.loadNotifications) {
                PassengerNotificationManager.loadNotifications()
                    .then(() => {
                        console.log('🔔 Notificaciones cargadas en configuración');
                        
                        // Actualizar UI
                        if (PassengerNotificationManager.updateNotificationsDropdown) {
                            PassengerNotificationManager.updateNotificationsDropdown();
                        }
                        if (PassengerNotificationManager.updateNotificationBadge) {
                            PassengerNotificationManager.updateNotificationBadge();
                        }
                        
                        // Iniciar actualización automática
                        if (PassengerNotificationManager.startAutoRefresh) {
                            PassengerNotificationManager.startAutoRefresh(30000); // Cada 30 segundos
                        }
                    })
                    .catch(error => {
                        console.error('Error cargando notificaciones:', error);
                    });
            }
        } else {
            console.warn('⚠️ PassengerNotificationManager no está definido');
        }
        
    } catch (error) {
        console.error('Error en loadInitialNotifications:', error);
    }
}

function verificarSaldoBajo(saldo) {
    const saldoBajo = saldo < 20.00;
    const lowBalanceDot = document.getElementById('low-balance-dot');
    
    if (lowBalanceDot) {
        if (saldoBajo) {
            lowBalanceDot.style.display = 'block';
            lowBalanceDot.style.backgroundColor = '#dc3545';
        } else {
            lowBalanceDot.style.display = 'none';
        }
    }
}

// --- 5. Inicialización ---
document.addEventListener('DOMContentLoaded', () => {
    // Cargar datos del usuario
    cargarDatosUsuario();
    
    // Configurar notificaciones después de un breve delay
    setTimeout(() => {
        loadInitialNotifications();
    }, 500);

    // Event listeners del formulario
    const form = document.getElementById('configurarCuentaForm');
    if (form) {
        form.addEventListener('submit', handleSubmit);
    }

    // Botón cancelar
    const btnCancelar = document.getElementById('cancelar');
    if (btnCancelar) {
        btnCancelar.addEventListener('click', () => {
            window.location.href = 'pasajero_inicio.html';
        });
    }
    
    // Botón restablecer contraseña (corregido)
    const btnRestablecer = document.querySelector('.btn-outline-secondary');
    if (btnRestablecer && btnRestablecer.href.includes('recuperar_contrasena.html')) {
        btnRestablecer.addEventListener('click', function(e) {
            e.preventDefault();
            handleRestablecerPassword();
        });
    }
    
    // Cerrar sesión
    const logoutBtn = document.querySelector('.logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            cerrarSesion();
        });
    }
    
    // Event listener para la campana de notificaciones
    const notificationBell = document.querySelector('.notification-icon-solid');
    if (notificationBell) {
        notificationBell.addEventListener('click', function() {
            // Forzar actualización de notificaciones al hacer clic
            if (typeof PassengerNotificationManager !== 'undefined' && 
                PassengerNotificationManager.loadNotifications) {
                PassengerNotificationManager.loadNotifications()
                    .then(() => {
                        if (PassengerNotificationManager.updateNotificationsDropdown) {
                            PassengerNotificationManager.updateNotificationsDropdown();
                        }
                    });
            }
        });
    }
});

// Función auxiliar para debug
function debugNotifications() {
    console.log('🔍 Estado de notificaciones:');
    console.log('- PassengerNotificationManager definido:', typeof PassengerNotificationManager !== 'undefined');
    console.log('- localStorage user_data:', localStorage.getItem('user_data'));
    console.log('- localStorage auth_token:', localStorage.getItem('auth_token'));
}