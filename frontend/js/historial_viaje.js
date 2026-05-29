const API_BASE = `https://sistema-autobuses.onrender.com/api`;
let usuarioActual = null;
let transacciones = [];
let transaccionesFiltradasActuales = [];
let paginaActual = 1;
const TRANSACCIONES_POR_PAGINA = 5

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

// Cargar datos del usuario y transacciones
async function cargarDatosUsuario() {
    try {
        const userData = verificarAutenticacion();
        if (!userData) return;

        usuarioActual = userData;
        actualizarInterfazUsuario(userData);
        await cargarTransacciones();
        
    } catch (error) {
        console.error('Error cargando datos:', error);
        window.location.href = 'inicio_sesion.html';
    }
}

// Actualizar interfaz con datos del usuario
function actualizarInterfazUsuario(usuario) {
    // Actualizar saludo
    const nombreCompleto = usuario.nombre;
    const primerNombre = nombreCompleto.split(' ')[0];
    document.querySelector('h1').textContent = `Hola ${primerNombre}`;

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

// Cargar transacciones desde la API
async function cargarTransacciones() {
    try {
        if (!usuarioActual) return;

        const response = await fetch(`${API_BASE}/transacciones/usuario/${usuarioActual.id_usuario}`, {
            headers: {
                'Authorization': `Bearer ${getAuthToken()}`
            }
        });

        if (!response.ok) {
            throw new Error('Error al cargar transacciones');
        }

        const data = await response.json();
        
        // ✅ ELIMINAR ESTE FILTRADO - El backend ya filtra por "pago_viaje"
        // transacciones = data.transacciones.filter(t => t.tipo === "pago_viaje");
        
        // ✅ USAR DIRECTAMENTE las transacciones del backend
        transacciones = data.transacciones;
        
        console.log('Transacciones de viajes cargadas:', transacciones);
        
        // ✅ CONVERTIR FECHAS A OBJETOS DATE para ordenamiento correcto
        transacciones.forEach(transaccion => {
            transaccion.fecha_date = new Date(transaccion.fecha_transaccion);
        });
        
        // Actualizar estadísticas
        actualizarEstadisticas(transacciones);
        
        // Cargar viajes en la interfaz
        cargarViajes(transacciones);

        // Cargar opciones de rutas
        cargarOpcionesRutas(transacciones);
        
    } catch (error) {
        console.error('Error cargando transacciones:', error);
        mostrarError('No se pudieron cargar los viajes. Intenta más tarde.');
    }
}

// Actualizar estadísticas
function actualizarEstadisticas(transaccionesFiltradas) {
    const totalViajes = transaccionesFiltradas.length;
    const totalGastado = transaccionesFiltradas.reduce((sum, t) => sum + t.monto, 0);
    
    // Viajes este mes - SIEMPRE calculado sobre TODAS las transacciones (sin filtros)
    const ahora = new Date();
    const viajesMes = transacciones.filter(t => {
        const fechaTransaccion = new Date(t.fecha_transaccion);
        return fechaTransaccion.getMonth() === ahora.getMonth() && 
               fechaTransaccion.getFullYear() === ahora.getFullYear();
    }).length;
    
    // Ruta más frecuente - calculado sobre transacciones filtradas
    const rutasFrecuencia = {};
    transaccionesFiltradas.forEach(t => {
        if (t.nombre_ruta) {
            rutasFrecuencia[t.nombre_ruta] = (rutasFrecuencia[t.nombre_ruta] || 0) + 1;
        }
    });
    
    const rutaFrecuente = Object.keys(rutasFrecuencia).length > 0 
        ? Object.keys(rutasFrecuencia).reduce((a, b) => rutasFrecuencia[a] > rutasFrecuencia[b] ? a : b)
        : 'N/A';
    
    // Actualizar UI
    document.getElementById('total-viajes').textContent = totalViajes;
    document.getElementById('total-gastado').textContent = `$${totalGastado.toFixed(2)}`;
    document.getElementById('viajes-mes').textContent = viajesMes; // Este NO cambia con filtros
    document.getElementById('ruta-frecuente').textContent = rutaFrecuente;
}


// Cargar viajes en la interfaz
function cargarViajes(transaccionesAMostrar, pagina = 1) {
    const contenedor = document.getElementById('lista-viajes');
    const sinViajes = document.getElementById('sin-viajes');
    
    // Guardar transacciones filtradas para paginación
    transaccionesFiltradasActuales = transaccionesAMostrar;
    paginaActual = pagina;
    
    if (transaccionesAMostrar.length === 0) {
        contenedor.style.display = 'none';
        sinViajes.style.display = 'block';
        actualizarPaginacion(0, pagina);
        return;
    }
    
    contenedor.style.display = 'block';
    sinViajes.style.display = 'none';
    
    // Limpiar contenedor
    contenedor.innerHTML = '';
    
    // Calcular índices para la paginación
    const inicio = (pagina - 1) * TRANSACCIONES_POR_PAGINA;
    const fin = inicio + TRANSACCIONES_POR_PAGINA;
    const transaccionesPagina = transaccionesAMostrar.slice(inicio, fin);
    
    // Crear elementos para cada viaje en la página actual
    transaccionesPagina.forEach(transaccion => {
        const viajeElement = crearElementoViaje(transaccion);
        contenedor.appendChild(viajeElement);
    });
    
    // Actualizar paginación
    actualizarPaginacion(transaccionesAMostrar.length, pagina);
    
    // Actualizar estadísticas con los filtros aplicados
    actualizarEstadisticas(transaccionesAMostrar);
}

function actualizarPaginacion(totalTransacciones, paginaActual) {
    const paginacionContainer = document.querySelector('.pagination');
    const totalPaginas = Math.ceil(totalTransacciones / TRANSACCIONES_POR_PAGINA);
    
    // Limpiar paginación existente
    paginacionContainer.innerHTML = '';
    
    // Si solo hay una página o menos, ocultar la paginación
    if (totalPaginas <= 1) {
        paginacionContainer.style.display = 'none';
        return;
    }
    
    paginacionContainer.style.display = 'flex';
    
    // Botón Anterior
    const liAnterior = document.createElement('li');
    liAnterior.className = `page-item ${paginaActual === 1 ? 'disabled' : ''}`;
    liAnterior.innerHTML = `
        <a class="page-link" href="#" onclick="cambiarPagina(${paginaActual - 1})">Anterior</a>
    `;
    paginacionContainer.appendChild(liAnterior);
    
    // Números de página
    for (let i = 1; i <= totalPaginas; i++) {
        const li = document.createElement('li');
        li.className = `page-item ${i === paginaActual ? 'active' : ''}`;
        li.innerHTML = `
            <a class="page-link" href="#" onclick="cambiarPagina(${i})">${i}</a>
        `;
        paginacionContainer.appendChild(li);
    }
    
    // Botón Siguiente
    const liSiguiente = document.createElement('li');
    liSiguiente.className = `page-item ${paginaActual === totalPaginas ? 'disabled' : ''}`;
    liSiguiente.innerHTML = `
        <a class="page-link" href="#" onclick="cambiarPagina(${paginaActual + 1})">Siguiente</a>
    `;
    paginacionContainer.appendChild(liSiguiente);
}

// Cambiar página - NUEVA FUNCIÓN
function cambiarPagina(nuevaPagina) {
    if (nuevaPagina < 1 || nuevaPagina > Math.ceil(transaccionesFiltradasActuales.length / TRANSACCIONES_POR_PAGINA)) {
        return;
    }
    cargarViajes(transaccionesFiltradasActuales, nuevaPagina);
    
    // Scroll suave hacia arriba para mejor UX
    window.scrollTo({
        top: document.getElementById('lista-viajes').offsetTop - 100,
        behavior: 'smooth'
    });
}



// Crear elemento HTML para un viaje
function crearElementoViaje(transaccion) {
    const div = document.createElement('div');
    div.className = 'historial-card';
    
    // Formatear fecha
    const fecha = new Date(transaccion.fecha_transaccion);
    const fechaFormateada = fecha.toLocaleDateString('es-MX', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    });
    const horaFormateada = fecha.toLocaleTimeString('es-MX', {
        hour: '2-digit',
        minute: '2-digit'
    });
    
    // Determinar nombre de ruta (usar "Ruta desconocida" si no hay información)
    const nombreRuta = transaccion.nombre_ruta || 'Ruta desconocida';
    
    div.innerHTML = `
        <div class="viaje-header">
            <span class="ruta-badge">${nombreRuta}</span>
            <span class="fecha-hora">${fechaFormateada} - ${horaFormateada}</span>
        </div>
        
        <div class="saldo-info">
            <div class="saldo-item">
                <div class="saldo-label">Saldo Anterior</div>
                <div class="saldo-valor saldo-anterior">$${transaccion.saldo_anterior.toFixed(2)}</div>
            </div>
            
            <div class="saldo-item">
                <div class="saldo-label">Tarifa</div>
                <div class="saldo-valor tarifa">-$${transaccion.monto.toFixed(2)}</div>
            </div>
            
            <div class="saldo-item">
                <div class="saldo-label">Saldo Posterior</div>
                <div class="saldo-valor saldo-posterior">$${transaccion.saldo_posterior.toFixed(2)}</div>
            </div>
        </div>
    `;
    
    return div;
}

// Aplicar filtros
function aplicarFiltros() {
    const filtroRuta = document.getElementById('filtro-ruta').value.toLowerCase();
    const filtroMes = document.getElementById('filtro-mes').value;
    const filtroOrden = document.getElementById('filtro-orden').value;
    
    let transaccionesFiltradas = [...transacciones];
    
    // Filtrar por ruta
    if (filtroRuta) {
        transaccionesFiltradas = transaccionesFiltradas.filter(t => 
            t.nombre_ruta?.toLowerCase().includes(filtroRuta)
        );
    }
    
    // Filtrar por mes
    if (filtroMes) {
        transaccionesFiltradas = transaccionesFiltradas.filter(t => {
            const fecha = new Date(t.fecha_transaccion);
            return (fecha.getMonth() + 1).toString() === filtroMes;
        });
    }
    
    // Ordenar
    switch (filtroOrden) {
        case 'fecha-asc':
            transaccionesFiltradas.sort((a, b) => a.fecha_date - b.fecha_date);
            break;
        case 'fecha-desc':
            transaccionesFiltradas.sort((a, b) => b.fecha_date - a.fecha_date);
            break;
    }
    
    console.log(`🔍 Filtros aplicados: ${transaccionesFiltradas.length} resultados`);
    
    // Siempre empezar en la página 1 cuando se aplican filtros
    cargarViajes(transaccionesFiltradas, 1);
}



function limpiarFiltros() {
    document.getElementById('filtro-ruta').value = '';
    document.getElementById('filtro-mes').value = '';
    document.getElementById('filtro-orden').value = 'fecha-desc';
    
    // Volver al orden original y página 1
    const transaccionesOrdenOriginal = [...transacciones].sort((a, b) => b.fecha_date - a.fecha_date);
    cargarViajes(transaccionesOrdenOriginal, 1);
}
// Mostrar error
function mostrarError(mensaje) {
    const sinViajes = document.getElementById('sin-viajes');
    sinViajes.innerHTML = `
        <i class="fa-solid fa-exclamation-triangle"></i>
        <h4>Error al cargar viajes</h4>
        <p>${mensaje}</p>
        <button class="btn btn-primary mt-2" onclick="cargarDatosUsuario()">
            Reintentar
        </button>
    `;
    sinViajes.style.display = 'block';
}

// Función para cerrar sesión
function cerrarSesion() {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_data');
    window.location.href = 'inicio_sesion.html';
}

// Inicializar
document.addEventListener('DOMContentLoaded', function() {
    PassengerNotificationManager.initialize((notifications) => {
            console.log('🔔 Notificaciones de retraso actualizadas:', notifications);
            // Actualizar la UI cuando cambien las notificaciones
            PassengerNotificationManager.updateNotificationsDropdown();
            PassengerNotificationManager.updateNotificationBadge();
        });

    cargarDatosUsuario();
    loadInitialNotifications();
    verificarSaldoBajo(usuarioActual.saldo);
    
    // Agregar event listeners a los filtros
    document.getElementById('filtro-ruta').addEventListener('change', aplicarFiltros);
    document.getElementById('filtro-mes').addEventListener('change', aplicarFiltros);
    document.getElementById('filtro-orden').addEventListener('change', aplicarFiltros);
    
    // Event listener para cerrar sesión
    const logoutBtn = document.querySelector('.logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            cerrarSesion();
        });
    }
});

// Cargar opciones de rutas para el filtro
function cargarOpcionesRutas(transacciones) {
    const filtroRuta = document.getElementById('filtro-ruta');
    
    // Obtener rutas únicas
    const rutasUnicas = [...new Set(transacciones
        .filter(t => t.nombre_ruta)
        .map(t => t.nombre_ruta)
    )];
    
    // Limpiar opciones existentes (excepto la primera)
    while (filtroRuta.children.length > 1) {
        filtroRuta.removeChild(filtroRuta.lastChild);
    }
    
    // Agregar opciones de rutas
    rutasUnicas.forEach(ruta => {
        const option = document.createElement('option');
        option.value = ruta.toLowerCase();
        option.textContent = ruta;
        filtroRuta.appendChild(option);
    });
}

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