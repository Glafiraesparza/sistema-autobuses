const API_BASE = `https://sistema-autobuses.onrender.com/api`;
let map;
let rutasCargadas = [];
let capaRutaActual = null;
/*Agregue 16/11/2025 Tomás Inicio*/
let usuarioActual = null;
let marcadorUsuario = null;
let intervaloActualizacionTiempo = null;
/*Agregue 16/11/2025 Tomás Fin*/

// Función para obtener el token de autenticación
function getAuthToken() {
    return localStorage.getItem('auth_token');
}

// Función para verificar si el usuario está autenticado
function verificarAutenticacion() {
    const token = getAuthToken();
    const userData = localStorage.getItem('user_data');
    
    if (!token || !userData) {
        // Redirigir al login si no hay token o datos de usuario
        window.location.href = 'inicio_sesion.html';
        return null;
    }
    
    return JSON.parse(userData);
}
/*Modifique 16/11/2025 Tomás Inicio*/
async function cargarDatosUsuario() {
    try {
        const userData = verificarAutenticacion();
        if (!userData) return;

        usuarioActual = userData;
        actualizarInterfazUsuario(userData);
        
        // Cargar rutas favoritas después de cargar los datos del usuario
        await cargarRutasFavoritas();
        
    } catch (error) {
        console.error('Error cargando datos del usuario:', error);
        window.location.href = 'inicio_sesion.html';
    }
}
/*Modifique 16/11/2025 Tomás Fin*/

// Función para actualizar la interfaz con los datos del usuario
function actualizarInterfazUsuario(usuario) {
    // 1. Actualizar saludo con primer nombre
    const nombreCompleto = usuario.nombre;
    const primerNombre = nombreCompleto.split(' ')[0]; // Tomar solo el primer nombre
    document.querySelector('h1').textContent = `Hola ${primerNombre}`;
    
    // 2. Actualizar saldo
    document.getElementById('current-balance').innerHTML = `$${usuario.saldo.toFixed(2)} <span>MXN</span>`;
    
    // 3. Actualizar CLABE
    document.getElementById('clabe-number').textContent = formatearCLABE(usuario.clabe_recarga);
    
    // 4. Actualizar costo del pasaje según tipo de usuario
    const costoPasaje = document.querySelector('.col-6.col-lg-4 .info-card-secondary h3');
    if (costoPasaje) {
        costoPasaje.innerHTML = `$${usuario.tarifa_actual.toFixed(2)} <span>MXN</span>`;
    }
    
    // 5. Actualizar información del menú offcanvas
    actualizarMenuUsuario(usuario);
    
    // 6. Verificar saldo bajo y mostrar notificación
    verificarSaldoBajo(usuario.saldo);
}

// Función para formatear la CLABE con espacios
function formatearCLABE(clabe) {
    if (!clabe) return 'No disponible';
    // Formato: XXXX XXXX XXXX XXXX XX
    return clabe.replace(/(\d{4})(\d{4})(\d{4})(\d{4})(\d{2})/, '$1 $2 $3 $4 $5');
}

// Función para actualizar el menú lateral
function actualizarMenuUsuario(usuario) {
    const offcanvasHeader = document.querySelector('.offcanvas-profile-header');
    if (offcanvasHeader) {
        const nombreCompleto = usuario.nombre;
        const primerNombre = nombreCompleto.split(' ')[0];
        offcanvasHeader.innerHTML = `
            <i class="fa-solid fa-circle-user profile-icon"></i>
            <h4>${primerNombre}</h4>
            <p>${usuario.email || 'usuario@tucsa.com'}</p>
            ${usuario.tipo !== 'normal' ? `<small class="badge bg-success">Tarifa ${usuario.tipo}</small>` : ''}
        `;
    }
}

// Función para verificar saldo bajo y mostrar notificación
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

// Función para cerrar sesión
function cerrarSesion() {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_data');
    window.location.href = 'inicio_sesion.html';
}

// Agregar evento de cierre de sesión
document.addEventListener('DOMContentLoaded', function() {
    const logoutBtn = document.querySelector('.logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            cerrarSesion();
        });
    }
});

/*Modifique 16/11/2025 Tomás Inicio*/
// Inicializar mapa
function inicializarMapa() {
    map = L.map('map').setView([21.91616, -102.31644], 13);
    
    // Capa rápida
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(map);
    
    // ⭐ AGREGAR MARCADOR DEL USUARIO ⭐
    agregarMarcadorUsuario();
    
    // ⭐ CONFIGURAR EVENTOS DE ZOOM PARA PARADAS ⭐
    configurarEventosZoom();
    
    console.log('🗺️ Mapa inicializado con ubicación del usuario');
}
/*Modifique 16/11/2025 Tomás Fin*/
// Cargar listado de rutas para los botones
async function cargarListadoRutas() {
try {
    const response = await fetch(`${API_BASE}/rutas`);
    rutasCargadas = await response.json();
    mostrarBotonesRutas(rutasCargadas);
    
} catch (error) {
    console.error("Error cargando rutas:", error);
    document.getElementById('lista-rutas').innerHTML = 
        '<p style="color: red;">Error cargando rutas</p>';
}
}

/*Modifique 16/11/2025 Tomás Inicio*/
// Mostrar botones de rutas en el sidebar
// Mostrar botones de rutas en el sidebar
function mostrarBotonesRutas(rutas) {
    const lista = document.getElementById('lista-rutas');
    lista.innerHTML = '';
    
    // Crear el botón dropdown principal
    const dropdownButton = document.createElement('button');
    dropdownButton.className = 'btn btn-outline-secondary dropdown-toggle w-100 text-start';
    dropdownButton.type = 'button';
    dropdownButton.setAttribute('data-bs-toggle', 'dropdown');
    dropdownButton.setAttribute('aria-expanded', 'false');
    dropdownButton.innerHTML = 'Selecciona una ruta';
    
    // Crear el menú dropdown
    const dropdownMenu = document.createElement('ul');
    dropdownMenu.className = 'dropdown-menu w-100';
    
    // Obtener rutas favoritas del usuario actual
    const rutasFavoritas = usuarioActual?.rutas_favoritas?.map(ruta => ruta.nombre) || [];
    
    // Separar rutas en favoritas y no favoritas
    const rutasFavoritasList = [];
    const rutasNoFavoritasList = [];
    
    rutas.forEach(ruta => {
        if (rutasFavoritas.includes(ruta.nombre)) {
            rutasFavoritasList.push(ruta);
        } else {
            rutasNoFavoritasList.push(ruta);
        }
    });
    
    // Agregar sección de rutas favoritas (si hay alguna)
    if (rutasFavoritasList.length > 0) {
        // Agregar separador para favoritas
        const favoritasHeader = document.createElement('li');
        favoritasHeader.innerHTML = `
            <h6 class="dropdown-header text-warning">
                <i class="fa-solid fa-star me-2"></i>Rutas Favoritas
            </h6>
        `;
        dropdownMenu.appendChild(favoritasHeader);
        
        // Agregar rutas favoritas
        rutasFavoritasList.forEach(ruta => {
            const dropdownItem = crearItemRuta(ruta, true);
            dropdownMenu.appendChild(dropdownItem);
        });
        
        // Agregar separador
        const divider = document.createElement('li');
        divider.innerHTML = '<hr class="dropdown-divider">';
        dropdownMenu.appendChild(divider);
    }
    
    // Agregar sección de todas las rutas
    const todasHeader = document.createElement('li');
    todasHeader.innerHTML = '<h6 class="dropdown-header">Todas las Rutas</h6>';
    dropdownMenu.appendChild(todasHeader);
    
    // Agregar rutas no favoritas
    rutasNoFavoritasList.forEach(ruta => {
        const dropdownItem = crearItemRuta(ruta, false);
        dropdownMenu.appendChild(dropdownItem);
    });
    
    // Agregar elementos al contenedor
    lista.appendChild(dropdownButton);
    lista.appendChild(dropdownMenu);
}
/*Modifique 16/11/2025 Tomás Fin*/
/*Agregue 16/11/2025 Tomás Inicio*/
// Función auxiliar para crear items de ruta
function crearItemRuta(ruta, esFavorita) {
    const dropdownItem = document.createElement('li');
    const itemLink = document.createElement('a');
    itemLink.className = 'dropdown-item d-flex justify-content-between align-items-center';
    itemLink.href = '#';
    
    // Determinar icono de estrella según si es favorita
    const iconoEstrella = esFavorita ? 
        'fa-solid fa-star text-warning' : 
        'fa-regular fa-star text-muted';
    
    itemLink.innerHTML = `
        <div class="flex-grow-1">
            <strong>${ruta.nombre}</strong>
            <div class="text-muted small">
                ${ruta.tiempo_estimado} min  
            </div>
        </div>
        <div class="ms-2">
            <i class="${iconoEstrella} star-icon" 
            data-ruta-nombre="${ruta.nombre}"></i>
        </div>
    `;
    
    // Evento para seleccionar la ruta
    itemLink.onclick = (e) => {
        e.preventDefault();
        mostrarRutaEnMapa(ruta);
        // Actualizar texto del botón dropdown con la ruta seleccionada
        const dropdownButton = document.querySelector('#lista-rutas button');
        dropdownButton.innerHTML = `
            <strong class="ruta">${ruta.nombre}</strong>
            <span class="tiempo text-muted ">  - ${ruta.tiempo_estimado} min</span>
        `;
    };
    
    // Evento para marcar/desmarcar como favorita
    const starIcon = itemLink.querySelector('.star-icon');
    starIcon.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation(); // Evita que se active el evento del item
        
        const rutaNombre = e.target.getAttribute('data-ruta-nombre');
        toggleFavorita(rutaNombre, e.target);
    };
    
    dropdownItem.appendChild(itemLink);
    return dropdownItem;
}
/*Agregue 16/11/2025 Tomás Fin*/

// Función para alternar entre favorita y no favorita
function toggleFavorita(rutaId, starElement) {
    const esFavorita = starElement.classList.contains('fa-solid');
    
    if (esFavorita) {
        // Quitar de favoritos
        starElement.classList.remove('fa-solid', 'text-warning');
        starElement.classList.add('fa-regular', 'text-muted');
        console.log(`Ruta ${rutaId} quitada de favoritos`);
        
        // Aquí puedes agregar lógica para guardar en tu base de datos
        // Ejemplo: actualizarRutaFavorita(rutaId, false);
        
    } else {
        // Agregar a favoritos
        starElement.classList.remove('fa-regular', 'text-muted');
        starElement.classList.add('fa-solid', 'text-warning');
        console.log(`Ruta ${rutaId} marcada como favorita`);
        
        // Aquí puedes agregar lógica para guardar en tu base de datos
        // Ejemplo: actualizarRutaFavorita(rutaId, true);
    }
    
    // Opcional: Mostrar feedback visual con un tooltip o toast
    mostrarFeedbackFavorita(esFavorita);
}

// Función para mostrar feedback (opcional)
function mostrarFeedbackFavorita(eraFavorita) {
    const mensaje = eraFavorita ? 'Quitada de favoritos' : 'Marcada como favorita';
    
    // Puedes implementar un toast de Bootstrap aquí
    // Ejemplo con alert simple:
    console.log(mensaje);
    
    // Para usar toasts de Bootstrap, descomenta esto:
    /*
    const toast = new bootstrap.Toast(document.getElementById('feedbackToast'));
    document.getElementById('toastMessage').textContent = mensaje;
    toast.show();
    */
}

// Mostrar una ruta específica en el mapa
function mostrarRutaEnMapa(ruta) {
// Limpiar ruta anterior
if (capaRutaActual) {
    map.removeLayer(capaRutaActual);
}

// Quitar clase 'activa' de todos los botones
document.querySelectorAll('.ruta-btn').forEach(btn => {
    btn.classList.remove('activa');
});

// Marcar botón como activo
event.target.classList.add('activa');

// Convertir coordenadas para Leaflet
const coordenadas = ruta.coordenadas.map(coord => [coord.lat, coord.lng]);

// Dibujar la ruta en el mapa
capaRutaActual = L.layerGroup();

// Línea de la ruta
const polyline = L.polyline(coordenadas, {
    color: '#3366FF',
    weight: 6,
    opacity: 0.8,
    smoothFactor: 1
}).addTo(capaRutaActual);


// Añadir al mapa
capaRutaActual.addTo(map);

// Ajustar vista para mostrar toda la ruta
map.fitBounds(polyline.getBounds(), { padding: [20, 20] });

// Popup informativo
polyline.bindPopup(`
    <div style="text-align: center;">
        <h3>${ruta.nombre}</h3>
        <p>⏱️ ${ruta.tiempo_estimado} minutos estimados</p>
        <p>📍 ${ruta.coordenadas.length} puntos de ruta</p>
    </div>
`);
}

// Variables para la simulación automática
let camiones = [];
let intervaloSimulacion;
let rutaActual = null;

// Crear 10 camiones para una ruta y comenzar simulación automáticamente
function crearYSimularCamiones(ruta) {
    // Limpiar camiones anteriores y detener simulación previa
    eliminarCamiones();
    
    const coordenadas = ruta.coordenadas.map(coord => [coord.lat, coord.lng]);
    const totalPuntos = coordenadas.length;
    
    // Crear 10 camiones distribuidos a lo largo de la ruta
    for (let i = 0; i < 10; i++) {
        // Distribuir camiones uniformemente
        const progreso = i / 10;
        const posicionInicial = Math.floor(progreso * (totalPuntos - 1));
        
        const camion = {
            id: i + 1,
            marker: null,
            ruta: ruta,
            posicionActual: posicionInicial,
            progreso: progreso,
            velocidad: 0.3 + Math.random() * 0.4, // Velocidad más lenta para mejor visualización
            direccion: 1
        };
        
        // Crear marcador personalizado para camiones
        const iconoCamion = L.divIcon({
            className: 'camion-marker',
            html: `🚌<div class="camion-numero">${i + 1}</div>`,
            iconSize: [30, 30],
            iconAnchor: [15, 15]
        });
        
        // Posición inicial del camión
        const posicion = coordenadas[posicionInicial];
        camion.marker = L.marker(posicion, { icon: iconoCamion })
            .addTo(map)
            .bindPopup(`
                <div style="text-align: center;">
                    <strong>Camión ${i + 1}</strong><br>
                    Ruta: ${ruta.nombre}<br>
                    Velocidad: ${camion.velocidad.toFixed(1)}x
                </div>
            `);
        
        camiones.push(camion);
    }
    
    // Iniciar simulación automáticamente
    iniciarSimulacion();
}

// Mover todos los camiones a lo largo de la ruta
function moverCamiones() {
    camiones.forEach(camion => {
        const coordenadas = camion.ruta.coordenadas.map(coord => [coord.lat, coord.lng]);
        const totalPuntos = coordenadas.length;
        
        // ✅ AUMENTAR VELOCIDAD (de 0.00003 a 0.0003 - 10x más rápido)
        camion.progreso += (0.0003 * camion.velocidad);
        
        // Si llega al final, reiniciar (ruta cíclica)
        if (camion.progreso >= 1) {
            camion.progreso = 0;
        }
        
        // Calcular posición exacta (interpolación entre puntos)
        const posicionExacta = camion.progreso * (totalPuntos - 1);
        const puntoInferior = Math.floor(posicionExacta);
        const puntoSuperior = Math.min(puntoInferior + 1, totalPuntos - 1);
        const factorInterpolacion = posicionExacta - puntoInferior;
        
        // Interpolar entre los dos puntos más cercanos
        const lat1 = coordenadas[puntoInferior][0];
        const lng1 = coordenadas[puntoInferior][1];
        const lat2 = coordenadas[puntoSuperior][0];
        const lng2 = coordenadas[puntoSuperior][1];
        
        const latActual = lat1 + (lat2 - lat1) * factorInterpolacion;
        const lngActual = lng1 + (lng2 - lng1) * factorInterpolacion;
        
        // Actualizar posición del marcador
        camion.marker.setLatLng([latActual, lngActual]);
        
        // Actualizar popup
        camion.marker.setPopupContent(`
            <div style="text-align: center;">
                <strong>Camión ${camion.id}</strong><br>
                Ruta: ${camion.ruta.nombre}<br>
                Progreso: ${Math.round(camion.progreso * 100)}%<br>
                Vel: ${camion.velocidad.toFixed(1)}x
            </div>
        `);
    });
}

// Eliminar camiones anteriores
function eliminarCamiones() {
    // Detener simulación actual
    if (intervaloSimulacion) {
        clearInterval(intervaloSimulacion);
    }
    
    // Remover marcadores del mapa
    camiones.forEach(camion => {
        if (camion.marker) {
            map.removeLayer(camion.marker);
        }
    });
    camiones = [];
}

// Iniciar simulación automáticamente
function iniciarSimulacion() {
    if (camiones.length === 0) return;
    
    // Limpiar intervalo anterior si existe
    if (intervaloSimulacion) {
        clearInterval(intervaloSimulacion);
    }
    
    // Iniciar nueva simulación
    intervaloSimulacion = setInterval(moverCamiones, 50); // Actualizar cada 50ms para movimiento más suave
    console.log('🚚 Simulación automática iniciada');
}

/*Agregue 16/11/2025 Tomás Inicio*/
// Modificar la función mostrarRutaEnMapa
function mostrarRutaEnMapa(ruta) {
    // Guardar referencia a la ruta actual
    rutaActual = ruta;
    
    // Limpiar ruta anterior, camiones y paradas
    if (capaRutaActual) {
        map.removeLayer(capaRutaActual);
    }
    eliminarCamiones();
    ocultarParadas();
    mostrarParadas = false;
    
    // Detener actualización anterior
    detenerActualizacionTiempoReal();
    
    // ✅ ACTUALIZAR MARCADOR DEL USUARIO SEGÚN LA RUTA
    actualizarMarcadorUsuario(ruta.nombre);
    
    // Convertir coordenadas para Leaflet
    const coordenadas = ruta.coordenadas.map(coord => [coord.lat, coord.lng]);
    
    // Línea de la ruta
    capaRutaActual = L.polyline(coordenadas, {
        color: '#3366FF',
        weight: 6,
        opacity: 0.8,
        smoothFactor: 1
    }).addTo(map);
    
    // Ajustar vista para mostrar toda la ruta + marcador del usuario
    const bounds = capaRutaActual.getBounds();
    bounds.extend([UBICACION_USUARIO_ACTUAL.lat, UBICACION_USUARIO_ACTUAL.lng]);
    map.fitBounds(bounds, { padding: [20, 20] });
    
    // Popup informativo actualizado
    capaRutaActual.bindPopup(`
        <div style="text-align: center;">
            <h3>${ruta.nombre}</h3>
            <p>⏱️ <span id="tiempo-popup">${ruta.tiempo_estimado}</span> minutos estimados</p>
            <p>📍 ${ruta.coordenadas.length} puntos de ruta</p>
            <p>🚌 10 camiones en movimiento</p>
            <p>🧍 Ubicación actual configurada</p>
        </div>
    `);
    
    // Verificar si hay paradas
    if (ruta.paradas && ruta.paradas.length > 0) {
        actualizarParadasSegunZoom();
    }
    
    // Crear y simular camiones automáticamente
    crearYSimularCamiones(ruta);
    
    // Iniciar actualización de tiempo en tiempo real
    iniciarActualizacionTiempoReal();
    
    // Actualizar inmediatamente el tiempo
    setTimeout(() => actualizarTiempoEnDropdown(), 1000);
}
/*Modifique 16/11/2025 Tomás Fin*/
// Variables para paradas
let paradasLayer = null;
let mostrarParadas = false;
const ZOOM_MINIMO_PARADAS = 15; // Nivel de zoom para mostrar paradas

// Función para mostrar/ocultar paradas según el zoom
function actualizarParadasSegunZoom() {
    const zoomActual = map.getZoom();
    
    if (zoomActual >= ZOOM_MINIMO_PARADAS && !mostrarParadas && rutaActual && rutaActual.paradas) {
        mostrarParadasEnMapa(rutaActual.paradas);
        mostrarParadas = true;
    } else if (zoomActual < ZOOM_MINIMO_PARADAS && mostrarParadas) {
        ocultarParadas();
        mostrarParadas = false;
    }
}

// Mostrar paradas en el mapa
function mostrarParadasEnMapa(paradas) {
    // Limpiar paradas anteriores
    ocultarParadas();
    
    // Crear capa para paradas
    paradasLayer = L.layerGroup();
    
    // Agregar cada parada como marcador
    paradas.forEach((parada, index) => {
        // Marcador simple para paradas
        const marcadorParada = L.circleMarker([parada.lat, parada.lng], {
            radius: 6,
            fillColor: '#FF6B35',
            color: '#FFFFFF',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.8
        }).addTo(paradasLayer);
        
        // Popup básico (sin nombre, solo indicación)
        marcadorParada.bindPopup(`
            <div style="text-align: center;">
                <strong>🚏 Parada de Autobús</strong><br>
                Ruta: ${rutaActual.nombre}<br>
                Parada #${index + 1}
            </div>
        `);
        
        // Efecto hover
        marcadorParada.on('mouseover', function() {
            this.setStyle({
                fillColor: '#FF4500',
                radius: 8
            });
        });
        
        marcadorParada.on('mouseout', function() {
            this.setStyle({
                fillColor: '#FF6B35',
                radius: 6
            });
        });
    });
    
    // Agregar capa al mapa
    paradasLayer.addTo(map);
    console.log(`🚏 Mostrando ${paradas.length} paradas de la ruta ${rutaActual.nombre}`);
}

// Ocultar paradas
function ocultarParadas() {
    if (paradasLayer) {
        map.removeLayer(paradasLayer);
        paradasLayer = null;
    }
}

// Función para manejar cambio de zoom
function configurarEventosZoom() {
    map.on('zoomend', function() {
        actualizarParadasSegunZoom();
    });
    
    map.on('moveend', function() {
        actualizarParadasSegunZoom();
    });
}
//Modifique 19/11/2025 Tomás Inicio
// Función para copiar la CLABE al portapapeles
async function copiarClabe() {
    const clabeElement = document.getElementById('clabe-number');
    const clabeText = clabeElement.textContent.replace(/\s/g, ''); // Remover espacios
    const copyButton = event.currentTarget;
    
    try {
        // Copiar al portapapeles
        await navigator.clipboard.writeText(clabeText);
        
        // Feedback visual de éxito
        const originalText = copyButton.innerHTML;
        copyButton.innerHTML = '<i class="fa-solid fa-check"></i> ¡Copiado!';
        copyButton.classList.add('copy-success');
        
        // ✅ AGREGUE 19/11/2025 Tomás - Procesar recarga automática después de 5 segundos
        setTimeout(() => {
            procesarRecargaAutomatica(clabeText);
        }, 5000); // 5 segundos
        
        // Restaurar botón después de 2 segundos
        setTimeout(() => {
            copyButton.innerHTML = originalText;
            copyButton.classList.remove('copy-success');
        }, 2000);
        
    } catch (err) {
        console.error('Error al copiar: ', err);
        fallbackCopyTextToClipboard(clabeText, copyButton);
    }
}
//Modifique 19/11/2025 Tomás Fin
//Agregue 19/11/2025 Tomás Inicio
async function procesarRecargaAutomatica(clabe) {
    try {
        console.log('🔄 Procesando recarga automática...');
        
        const response = await fetch(`https://sistema-autobuses.onrender.com/api/recargas/procesar-recarga-automatica`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                clabe: clabe,
                monto: 50.00 // Monto fijo de $50
            })
        });
        
        const data = await response.json();
        
        if (data.exito) {
            // Mostrar modal de éxito
            mostrarModalRecargaExitosa(data);
            
            // Actualizar saldo en la interfaz
            if (usuarioActual) {
                usuarioActual.saldo = data.saldo_nuevo;
                actualizarInterfazUsuario(usuarioActual);
                localStorage.setItem('user_data', JSON.stringify(usuarioActual));
            }
            
            console.log('✅ Recarga procesada exitosamente');
        } else {
            console.error('❌ Error en recarga:', data.mensaje);
            mostrarModalErrorRecarga(data.mensaje);
        }
        
    } catch (error) {
        console.error('❌ Error procesando recarga:', error);
        mostrarModalErrorRecarga('Error de conexión');
    }
}

function mostrarModalRecargaExitosa(data) {
    // Crear modal dinámicamente
    const modalHTML = `
        <div class="modal fade" id="modalRecargaExitosa" tabindex="-1" aria-labelledby="modalRecargaExitosaLabel" aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header bg-success text-white">
                        <h5 class="modal-title" id="modalRecargaExitosaLabel">
                            <i class="fa-solid fa-circle-check me-2"></i>
                            Recarga Exitosa
                        </h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body text-center">
                        <div class="mb-4">
                            <i class="fa-solid fa-money-bill-wave fa-4x text-success mb-3"></i>
                            <h3 class="text-success">+$50.00 MXN</h3>
                            <p class="text-muted">Recarga procesada exitosamente</p>
                        </div>
                        
                        <div class="row text-start">
                            <div class="col-6">
                                <strong>Saldo anterior:</strong>
                            </div>
                            <div class="col-6 text-end">
                                $${data.saldo_anterior.toFixed(2)} MXN
                            </div>
                            
                            <div class="col-6">
                                <strong>Recarga:</strong>
                            </div>
                            <div class="col-6 text-end text-success">
                                +$50.00 MXN
                            </div>
                            
                            <div class="col-6">
                                <strong>Nuevo saldo:</strong>
                            </div>
                            <div class="col-6 text-end fw-bold">
                                $${data.saldo_nuevo.toFixed(2)} MXN
                            </div>
                        </div>
                        
                        <div class="mt-4 p-3 bg-light rounded">
                            <small class="text-muted">
                                <i class="fa-solid fa-info-circle me-1"></i>
                                La recarga se procesó automáticamente al copiar tu CLABE
                            </small>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-success w-100" data-bs-dismiss="modal">
                            <i class="fa-solid fa-check me-2"></i>
                            Entendido
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Agregar modal al body si no existe
    if (!document.getElementById('modalRecargaExitosa')) {
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }
    
    // Mostrar modal
    const modal = new bootstrap.Modal(document.getElementById('modalRecargaExitosa'));
    modal.show();
    
    // Limpiar modal después de cerrar
    document.getElementById('modalRecargaExitosa').addEventListener('hidden.bs.modal', function() {
        this.remove();
    });
}

function mostrarModalErrorRecarga(mensaje) {
    const modalHTML = `
        <div class="modal fade" id="modalErrorRecarga" tabindex="-1" aria-labelledby="modalErrorRecargaLabel" aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header bg-danger text-white">
                        <h5 class="modal-title" id="modalErrorRecargaLabel">
                            <i class="fa-solid fa-circle-exclamation me-2"></i>
                            Error en Recarga
                        </h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body text-center">
                        <div class="mb-4">
                            <i class="fa-solid fa-triangle-exclamation fa-3x text-danger mb-3"></i>
                            <h4 class="text-danger">Recarga Fallida</h4>
                            <p class="text-muted">${mensaje}</p>
                        </div>
                        <div class="alert alert-warning">
                            <small>
                                <i class="fa-solid fa-lightbulb me-1"></i>
                                Verifica que hayas copiado tu CLABE correctamente
                            </small>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-danger w-100" data-bs-dismiss="modal">
                            <i class="fa-solid fa-times me-2"></i>
                            Cerrar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    if (!document.getElementById('modalErrorRecarga')) {
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }
    
    const modal = new bootstrap.Modal(document.getElementById('modalErrorRecarga'));
    modal.show();
    
    document.getElementById('modalErrorRecarga').addEventListener('hidden.bs.modal', function() {
        this.remove();
    });
}
//Agregue 19/11/2025 Tomás Fin

// Fallback para navegadores que no soportan Clipboard API
function fallbackCopyTextToClipboard(text, button) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.opacity = 0;
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
        const successful = document.execCommand('copy');
        if (successful) {
            const originalText = button.innerHTML;
            button.innerHTML = '<i class="fa-solid fa-check"></i> ¡Copiado!';
            button.classList.add('copy-success');
            
            setTimeout(() => {
                button.innerHTML = originalText;
                button.classList.remove('copy-success');
            }, 2000);
        }
    } catch (err) {
        console.error('Fallback: Error al copiar: ', err);
        alert('No se pudo copiar la CLABE. Por favor, cópiala manualmente.');
    }
    
    document.body.removeChild(textArea);
}

// Inicializar tooltips de Bootstrap (si los estás usando)
document.addEventListener('DOMContentLoaded', function() {
    PassengerNotificationManager.initialize((notifications) => {
        console.log('🔔 Notificaciones de retraso actualizadas:', notifications);
        // Actualizar la UI cuando cambien las notificaciones
        PassengerNotificationManager.updateNotificationsDropdown();
        PassengerNotificationManager.updateNotificationBadge();
    });

    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    const tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });
    loadInitialNotifications();
});
document.addEventListener('DOMContentLoaded', () => {
    cargarDatosUsuario();
    inicializarMapa();
    cargarListadoRutas();
});

/*Agregue 16/11/2025 Tomás Inicio*/

// Función para cargar rutas favoritas del usuario
async function cargarRutasFavoritas() {
    try {
        if (!usuarioActual) return;
        
        const response = await fetch(`${API_BASE}/usuarios/${usuarioActual.id_usuario}/rutas-favoritas`, {
            headers: {
                'Authorization': `Bearer ${getAuthToken()}`
            }
        });
        
        if (response.ok) {
            const rutasFavoritasNombres = await response.json();
            
            // Actualizar el objeto usuarioActual
            usuarioActual.rutas_favoritas = rutasFavoritasNombres.map(nombre => ({ nombre }));
            
            // Actualizar localStorage
            localStorage.setItem('user_data', JSON.stringify(usuarioActual));
            
            // Si ya hay rutas cargadas, reordenar la lista
            if (rutasCargadas.length > 0) {
                mostrarBotonesRutas(rutasCargadas);
            }
            
        } else {
            console.error('Error cargando rutas favoritas:', response.status);
        }
    } catch (error) {
        console.error('Error cargando rutas favoritas:', error);
    }
}

// Función para marcar rutas favoritas en la interfaz
function marcarRutasFavoritasEnInterfaz(rutasFavoritas) {
    // Esperar a que las rutas se carguen
    setTimeout(() => {
        const starIcons = document.querySelectorAll('.star-icon');
        starIcons.forEach(icon => {
            const rutaNombre = icon.closest('.dropdown-item').querySelector('strong').textContent;
            
            if (rutasFavoritas.includes(rutaNombre)) {
                // Marcar como favorita
                icon.classList.remove('fa-regular', 'text-muted');
                icon.classList.add('fa-solid', 'text-warning');
            } else {
                // Marcar como no favorita
                icon.classList.remove('fa-solid', 'text-warning');
                icon.classList.add('fa-regular', 'text-muted');
            }
        });
    }, 500); // Pequeño delay para asegurar que las rutas estén cargadas
}

// Función para actualizar rutas favoritas en el servidor
// Función para actualizar rutas favoritas en el servidor
async function actualizarRutasFavoritas(rutaNombre, esFavorita) {
    try {
        if (!usuarioActual) return;
        
        // Obtener rutas favoritas actuales
        const response = await fetch(`${API_BASE}/usuarios/${usuarioActual.id_usuario}/rutas-favoritas`, {
            headers: {
                'Authorization': `Bearer ${getAuthToken()}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Error obteniendo rutas favoritas');
        }
        
        let rutasFavoritas = await response.json();
        
        // Actualizar la lista
        if (esFavorita) {
            // Agregar ruta si no existe
            if (!rutasFavoritas.includes(rutaNombre)) {
                rutasFavoritas.push(rutaNombre);
            }
        } else {
            // Remover ruta si existe
            rutasFavoritas = rutasFavoritas.filter(ruta => ruta !== rutaNombre);
        }
        
        // Enviar actualización al servidor
        const updateResponse = await fetch(`${API_BASE}/usuarios/${usuarioActual.id_usuario}/rutas-favoritas`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getAuthToken()}`
            },
            body: JSON.stringify(rutasFavoritas)
        });
        
        if (updateResponse.ok) {
            console.log(`Ruta "${rutaNombre}" ${esFavorita ? 'agregada a' : 'eliminada de'} favoritas`);
            mostrarFeedbackFavorita(esFavorita, rutaNombre);
            
            // Actualizar datos locales del usuario
            usuarioActual.rutas_favoritas = rutasFavoritas.map(nombre => ({ nombre }));
            localStorage.setItem('user_data', JSON.stringify(usuarioActual));
            
            // ✅ REFRESCAR LA LISTA DE RUTAS para reordenar
            if (rutasCargadas.length > 0) {
                mostrarBotonesRutas(rutasCargadas);
            }
            
        } else {
            throw new Error('Error actualizando rutas favoritas');
        }
        
    } catch (error) {
        console.error('Error actualizando rutas favoritas:', error);
        mostrarFeedbackFavoritaError();
        
        // Revertir cambio visual en caso de error
        setTimeout(() => {
            if (rutasCargadas.length > 0) {
                mostrarBotonesRutas(rutasCargadas);
            }
        }, 1000);
    }
}

// Función mejorada para alternar entre favorita y no favorita
function toggleFavorita(rutaNombre, starElement) {
    const esFavorita = starElement.classList.contains('fa-solid');
    const nuevaEstado = !esFavorita;
    
    // Actualizar visualmente inmediatamente (feedback responsivo)
    if (nuevaEstado) {
        starElement.classList.remove('fa-regular', 'text-muted');
        starElement.classList.add('fa-solid', 'text-warning');
    } else {
        starElement.classList.remove('fa-solid', 'text-warning');
        starElement.classList.add('fa-regular', 'text-muted');
    }
    
    // Actualizar en el servidor
    actualizarRutasFavoritas(rutaNombre, nuevaEstado);
}

// Función mejorada para mostrar feedback
function mostrarFeedbackFavorita(esFavorita, rutaNombre) {
    const mensaje = esFavorita ? 
        `✓ "${rutaNombre}" agregada a favoritos` : 
        `✗ "${rutaNombre}" eliminada de favoritos`;
    
    // Crear toast de Bootstrap (si tienes Bootstrap toast configurado)
    mostrarToast(mensaje, esFavorita ? 'success' : 'info');
}

function mostrarFeedbackFavoritaError() {
    mostrarToast('❌ Error al actualizar favoritos', 'danger');
}

// Función para mostrar toasts (puedes usar Bootstrap toasts)
function mostrarToast(mensaje, tipo = 'info') {
    const toast = document.createElement('div');
    toast.className = `alert alert-${tipo} alert-dismissible fade show position-fixed`;
    toast.style.cssText = `
    position: fixed;
    z-index: 9999;
    box-sizing: border-box;
    word-wrap: break-word;
    overflow-wrap: break-word;
    white-space: normal;
    
    /* Desktop por defecto */
    top: 20px;
    right: 20px;
    min-width: 400px;
    max-width: 500px;
    font-size: 1.5rem;
    padding: 1.2rem;
    
    /* Responsivo con calc y vw */
    max-width: min(500px, 90vw);
    min-width: min(400px, 80vw);
    width: auto;
    
    /* Para móviles - usando media query en JS */
    font-size: clamp(1.1rem, 4vw, 1.5rem);
    padding: clamp(0.8rem, 2vw, 1.2rem);
    
    /* Asegurar que no se salga en pantallas pequeñas */
    left: 50%;
    transform: translateX(-50%);
    right: auto;
    margin: 0 auto;
    
    /* Media query condicional con propiedades CSS */
    /* Esto se aplicará cuando la pantalla sea <= 768px */
    max-width: 90vw;
    min-width: 0;
`;
    toast.innerHTML = `
        <div class="d-flex align-items-center">
            <div class="flex-grow-1">
                <h5 class="alert-heading mb-2">${tipo === 'success' ? '✅' : 'ℹ️'} ${tipo.toUpperCase()}</h5>
                <div class="fs-6">${mensaje}</div>
            </div>
            <button type="button" class="btn-close btn-close-lg" data-bs-dismiss="alert"></button>
        </div>
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
        }
    }, 4000); // Un segundo más para toast más grande
}

// Función para mantener la ruta seleccionada al refrescar la lista
function mantenerRutaSeleccionada() {
    const dropdownButton = document.querySelector('#lista-rutas button');
    const textoActual = dropdownButton.textContent.trim();
    
    // Si ya hay una ruta seleccionada (no es el texto por defecto), mantenerla
    if (textoActual !== 'Selecciona una ruta') {
        // El texto se mantendrá automáticamente porque no lo cambiamos en mostrarBotonesRutas
        return;
    }
}

// Función para agregar marcador del usuario según la ruta seleccionada
function actualizarMarcadorUsuario(rutaNombre) {
    // Remover marcador anterior si existe
    if (marcadorUsuario) {
        map.removeLayer(marcadorUsuario);
    }
    
    const configRuta = CONFIG_RUTAS[rutaNombre];
    if (!configRuta) {
        console.warn(`⚠️ No hay configuración para la ruta: ${rutaNombre}`);
        return;
    }
    
    // Actualizar ubicación global
    UBICACION_USUARIO_ACTUAL = configRuta.ubicacionUsuario;
    
    // Icono personalizado para el usuario
    const iconoUsuario = L.divIcon({
        className: 'usuario-marker',
        html: '<i class="fa-solid fa-location-dot"></i><div class="usuario-texto">Tú</div>',
        iconSize: [30, 30],
        iconAnchor: [15, 30]
    });
    
    // Crear marcador del usuario
    marcadorUsuario = L.marker([
        UBICACION_USUARIO_ACTUAL.lat, 
        UBICACION_USUARIO_ACTUAL.lng
    ], {
        icon: iconoUsuario,
        zIndexOffset: 1000
    }).addTo(map);
    
    // Popup del usuario
    marcadorUsuario.bindPopup(`
        <div style="text-align: center;">
            <strong>📍 Tu ubicación</strong><br>
            <small>Esperando ruta ${rutaNombre}</small><br>
            <small>Dirección: ${configRuta.direccion}</small>
        </div>
    `);
    
    console.log(`📍 Marcador de usuario actualizado para ${rutaNombre}`);
}
// Función para calcular distancia entre dos puntos (Haversine)
function calcularDistancia(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radio de la Tierra en km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distancia = R * c; // Distancia en km
    return distancia * 1000; // Convertir a metros
}

// Función MEJORADA para encontrar camión válido
function encontrarCamionMasCercanoValido() {
    if (!camiones.length || !marcadorUsuario || !rutaActual) {
        console.log('❌ No hay camiones, marcador o ruta');
        return null;
    }
    
    const configRuta = CONFIG_RUTAS[rutaActual.nombre];
    if (!configRuta) {
        console.log('❌ No hay configuración para la ruta:', rutaActual.nombre);
        return null;
    }
    
    let camionMasCercano = null;
    let distanciaMinima = Infinity;
    let camionesValidos = 0;
    
    camiones.forEach(camion => {
        const distanciaRuta = calcularDistanciaSobreRuta(camion);
        const esDireccionCorrecta = estaEnDireccionCorrecta(camion, configRuta.direccion);
        
        console.log(`🚌 Camión ${camion.id}: distancia=${Math.round(distanciaRuta)}m, direcciónCorrecta=${esDireccionCorrecta}`);
        
        if (esDireccionCorrecta && distanciaRuta < distanciaMinima && distanciaRuta < 8000) {
            distanciaMinima = distanciaRuta;
            camionMasCercano = camion;
            camionesValidos++;
        }
    });
    
    console.log(`📊 Camiones válidos encontrados: ${camionesValidos}`);
    
    return camionMasCercano ? {
        camion: camionMasCercano,
        distancia: distanciaMinima
    } : null;
}

// Función mejorada para calcular tiempo estimado de llegada
function calcularTiempoEstimado(distanciaMetros) {
    // Velocidad promedio del camión en m/s (25 km/h ≈ 6.94 m/s)
    const VELOCIDAD_CAMION = 6.94;
    
    // Tiempo base en segundos
    let tiempoSegundos = distanciaMetros / VELOCIDAD_CAMION;
    
    // Añadir tiempo por paradas (20 segundos cada 300 metros)
    const paradasEstimadas = Math.floor(distanciaMetros / 300);
    tiempoSegundos += paradasEstimadas * 20;
    
    // Añadir tiempo por semáforos/tráfico (5 segundos cada 200 metros)
    const semaforosEstimados = Math.floor(distanciaMetros / 200);
    tiempoSegundos += semaforosEstimados * 5;
    
    // Convertir a minutos y asegurar mínimo 1 minuto
    let tiempoMinutos = Math.ceil(tiempoSegundos / 60);
    
    // Límites razonables (1-30 minutos)
    tiempoMinutos = Math.max(1, Math.min(30, tiempoMinutos));
    
    return tiempoMinutos;
}
// Función mejorada para actualizar el tiempo en el dropdown
function actualizarTiempoEnDropdown() {
    if (!rutaActual) return;
    
    const camionCercano = encontrarCamionMasCercanoValido();
    const dropdownButton = document.querySelector('#lista-rutas button');
    
    if (camionCercano && dropdownButton) {
        const tiempoEstimado = calcularTiempoEstimado(camionCercano.distancia);
        
        dropdownButton.innerHTML = `
            <strong class="ruta">${rutaActual.nombre}</strong>
            <span class="tiempo text-muted"> - ${tiempoEstimado} min</span>
        `;
        
        console.log(`🔄 Tiempo actualizado: ${tiempoEstimado} min (Distancia: ${Math.round(camionCercano.distancia)}m, Camión: ${camionCercano.camion.id})`);
        
    } else if (dropdownButton) {
        // Si no hay camiones válidos, mostrar tiempo original
        dropdownButton.innerHTML = `
            <strong class="ruta">${rutaActual.nombre}</strong>
            <span class="tiempo text-muted"> - ${rutaActual.tiempo_estimado} min</span>
        `;
        
        console.log('⚠️ No hay camiones en dirección válida - mostrando tiempo por defecto');
    }
}

// Función para actualizar tiempos en los items del dropdown
function actualizarTiempoEnItemsDropdown(nombreRutaSeleccionada, tiempoEstimado) {
    const dropdownItems = document.querySelectorAll('#lista-rutas .dropdown-item');
    
    dropdownItems.forEach(item => {
        const nombreRuta = item.querySelector('strong').textContent;
        const tiempoElement = item.querySelector('.text-muted.small');
        
        if (nombreRuta === nombreRutaSeleccionada && tiempoElement) {
            tiempoElement.textContent = `${tiempoEstimado} min`;
            tiempoElement.classList.add('text-warning', 'fw-bold');
        } else if (tiempoElement) {
            // Restaurar tiempo original para otras rutas
            const rutaOriginal = rutasCargadas.find(r => r.nombre === nombreRuta);
            if (rutaOriginal) {
                tiempoElement.textContent = `${rutaOriginal.tiempo_estimado} min`;
                tiempoElement.classList.remove('text-warning', 'fw-bold');
            }
        }
    });
}
// Iniciar actualización en tiempo real
function iniciarActualizacionTiempoReal() {
    // Limpiar intervalo anterior si existe
    if (intervaloActualizacionTiempo) {
        clearInterval(intervaloActualizacionTiempo);
    }
    
    // Actualizar cada 5 segundos
    intervaloActualizacionTiempo = setInterval(() => {
        if (rutaActual && camiones.length > 0) {
            actualizarTiempoEnDropdown();
        }
    }, 5000); // 5 segundos
    
    console.log('⏱️ Sistema de tiempo real iniciado');
}

// Detener actualización en tiempo real
function detenerActualizacionTiempoReal() {
    if (intervaloActualizacionTiempo) {
        clearInterval(intervaloActualizacionTiempo);
        intervaloActualizacionTiempo = null;
    }
}
// Configuración de rutas con sus direcciones y ubicaciones de usuario
const CONFIG_RUTAS = {
    "40 Sur": {
        ubicacionUsuario: { lat: 21.916171891063954, lng: -102.31452904465833 },
        direccion: "norte" // CORREGIDO: La ruta 40 Sur va hacia el SUR
    },
    "40 Norte": {
        ubicacionUsuario: { lat: 21.916561625043546, lng: -102.31465429928508 },
        direccion: "norte" // CORREGIDO: La ruta 40 Norte va hacia el NORTE
    }
};
// Variable global para la ubicación actual del usuario
let UBICACION_USUARIO_ACTUAL = null;
// Función para determinar si un camión está en la dirección correcta respecto al usuario
// Función mejorada para dirección correcta
function estaEnDireccionCorrecta(camion, direccionRuta) {
    if (!rutaActual) return false;
    
    const progresoUsuario = encontrarPuntoMasCercanoAUsuario();
    const progresoCamion = camion.progreso;
    
    console.log(`🔍 Dirección: ${direccionRuta}, Usuario: ${progresoUsuario.toFixed(2)}, Camión ${camion.id}: ${progresoCamion.toFixed(2)}`);
    
    if (direccionRuta === "norte") {
        // Para dirección norte: camión debe estar ANTES del usuario en la ruta
        // y la distancia debe ser razonable (no en la otra punta de la ruta circular)
        if (progresoCamion < progresoUsuario) {
            return true;
        } else {
            // Considerar ruta circular: si el camión está muy cerca del final y usuario al inicio
            return (progresoCamion > 0.8 && progresoUsuario < 0.2);
        }
    } else if (direccionRuta === "sur") {
        // Para dirección sur: camión debe estar DESPUÉS del usuario en la ruta
        if (progresoCamion > progresoUsuario) {
            return true;
        } else {
            // Considerar ruta circular: si el camión está al inicio y usuario cerca del final
            return (progresoCamion < 0.2 && progresoUsuario > 0.8);
        }
    }
    
    return false;
}

// Función para encontrar el punto de la ruta más cercano al usuario
function encontrarPuntoMasCercanoAUsuario() {
    if (!rutaActual || !UBICACION_USUARIO_ACTUAL) return 0;
    
    const coordenadas = rutaActual.coordenadas.map(coord => [coord.lat, coord.lng]);
    const totalPuntos = coordenadas.length;
    
    let mejorIndice = 0;
    let distanciaMinima = Infinity;
    
    for (let i = 0; i < coordenadas.length; i++) {
        const distancia = calcularDistancia(
            UBICACION_USUARIO_ACTUAL.lat, UBICACION_USUARIO_ACTUAL.lng,
            coordenadas[i][0], coordenadas[i][1]
        );
        if (distancia < distanciaMinima) {
            distanciaMinima = distancia;
            mejorIndice = i;
        }
    }
    
    // Convertir a progreso (0-1)
    return mejorIndice / (totalPuntos - 1);
}
// Función para agregar el marcador del usuario por primera vez
function agregarMarcadorUsuario() {
    // Ubicación por defecto (puedes cambiarla según necesites)
    UBICACION_USUARIO_ACTUAL = { 
        lat: 21.91616, 
        lng: -102.31644 
    };
    
    // Icono personalizado para el usuario
    const iconoUsuario = L.divIcon({
        className: 'usuario-marker',
        html: '<i class="fa-solid fa-location-dot"></i><div class="usuario-texto">Tú</div>',
        iconSize: [30, 30],
        iconAnchor: [15, 30]
    });
    
    // Crear marcador del usuario
    marcadorUsuario = L.marker([
        UBICACION_USUARIO_ACTUAL.lat, 
        UBICACION_USUARIO_ACTUAL.lng
    ], {
        icon: iconoUsuario,
        zIndexOffset: 1000
    }).addTo(map);
    
    // Popup del usuario
    marcadorUsuario.bindPopup(`
        <div style="text-align: center;">
            <strong>📍 Tu ubicación</strong><br>
            <small>Selecciona una ruta para comenzar</small>
        </div>
    `);
    
    console.log('📍 Marcador de usuario agregado al mapa');
}
// Función para calcular distancia REAL sobre la ruta
function calcularDistanciaSobreRuta(camion) {
    if (!rutaActual || !UBICACION_USUARIO_ACTUAL) return Infinity;
    
    const coordenadas = rutaActual.coordenadas.map(coord => [coord.lat, coord.lng]);
    const totalPuntos = coordenadas.length;
    
    // 1. Calcular progreso del USUARIO
    const progresoUsuario = encontrarPuntoMasCercanoAUsuario();
    
    // 2. Progreso del CAMIÓN
    const progresoCamion = camion.progreso;
    
    // 3. Calcular distancia total de la ruta
    let longitudTotalRuta = 0;
    for (let i = 0; i < coordenadas.length - 1; i++) {
        longitudTotalRuta += calcularDistancia(
            coordenadas[i][0], coordenadas[i][1],
            coordenadas[i + 1][0], coordenadas[i + 1][1]
        );
    }
    
    // 4. Calcular distancia considerando la dirección y circularidad
    let distanciaSobreRuta = 0;
    const configRuta = CONFIG_RUTAS[rutaActual.nombre];
    
    if (configRuta.direccion === "norte") {
        if (progresoCamion <= progresoUsuario) {
            // Camión ANTES del usuario en dirección norte
            distanciaSobreRuta = (progresoUsuario - progresoCamion) * longitudTotalRuta;
        } else {
            // Camión DESPUÉS - considerar ruta circular
            distanciaSobreRuta = ((1 - progresoCamion) + progresoUsuario) * longitudTotalRuta;
        }
    } else { // dirección "sur"
        if (progresoCamion >= progresoUsuario) {
            // Camión DESPUÉS del usuario en dirección sur
            distanciaSobreRuta = (progresoCamion - progresoUsuario) * longitudTotalRuta;
        } else {
            // Camión ANTES - considerar ruta circular
            distanciaSobreRuta = (progresoCamion + (1 - progresoUsuario)) * longitudTotalRuta;
        }
    }
    
    return distanciaSobreRuta;
}
/*Agregue 16/11/2025 Tomás Fin*/
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