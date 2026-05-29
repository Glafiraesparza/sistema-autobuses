const API_BASE = `https://${IP_API}:8000/api`;
let map;
let intervaloActualizacion;
let intervaloSimulacion;
let todasLasRutas = [];
let todosLosCamiones = [];
let capasRutas = [];
let paradaFija = { lat: 21.91616, lng: -102.31644, nombre_parada: "Parada Centro" };

// Elementos del DOM
const estadoRuta = document.getElementById('estado-ruta');
const nombreParadaElement = document.getElementById('nombre-parada');
const ultimaActualizacionElement = document.getElementById('ultima-actualizacion');
const tiemposContainer = document.getElementById('tiempos-container');
const infoParadaElement = document.getElementById('info-parada');

// Inicializar mapa
function inicializarMapa() {
    if (map) {
        map.remove();
    }
    
    map = L.map('mapa-parada').setView([paradaFija.lat, paradaFija.lng], 14);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(map);
    
    // Agregar marcador de la parada fija
    const paradaIcon = L.divIcon({
        className: 'parada-marker',
        html: '<i class="fa-solid fa-map-marker-alt parada-icon"></i>',
        iconSize: [40, 40],
        iconAnchor: [20, 40]
    });
    
    L.marker([paradaFija.lat, paradaFija.lng], { icon: paradaIcon })
        .addTo(map)
        .bindPopup(`
            <div style="text-align: center;">
                <strong>📍 ${paradaFija.nombre_parada}</strong><br>
                <small>Parada de autobús</small>
            </div>
        `)
        .openPopup();
    
    console.log('🗺️ Mapa inicializado para pantalla de parada');
}

// Cargar todas las rutas y inicializar simulación
async function cargarTodasLasRutas() {
    try {
        console.log('🔄 Cargando todas las rutas...');
        estadoRuta.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-1"></i> Cargando rutas...';
        
        const response = await fetch(`${API_BASE}/rutas`);
        
        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }
        
        todasLasRutas = await response.json();
        
        // Limpiar simulación anterior
        limpiarSimulacion();
        
        // Inicializar simulación para cada ruta
        todasLasRutas.forEach(ruta => {
            inicializarSimulacionParaRuta(ruta);
        });
        
        // Actualizar interfaz
        nombreParadaElement.textContent = paradaFija.nombre_parada;
        infoParadaElement.textContent = `Mostrando los 5 camiones más cercanos de ${todasLasRutas.length} rutas`;
        estadoRuta.innerHTML = '<i class="fa-solid fa-signal me-1"></i> En tiempo real';
        
        // Iniciar actualización de tiempos
        iniciarActualizacionTiempos();
        
        console.log(`✅ ${todasLasRutas.length} rutas cargadas, ${todosLosCamiones.length} camiones inicializados`);
        
    } catch (error) {
        console.error('❌ Error cargando rutas:', error);
        estadoRuta.innerHTML = '<i class="fa-solid fa-exclamation-triangle me-1"></i> Error';
        tiemposContainer.innerHTML = `
            <div class="text-center py-4">
                <i class="fa-solid fa-wifi-slash fa-2x text-danger mb-2"></i>
                <p class="text-danger">Error cargando información</p>
                <button class="btn btn-sm btn-outline-primary" onclick="cargarTodasLasRutas()">
                    Reintentar
                </button>
            </div>
        `;
    }
}

// Inicializar simulación para una ruta específica
function inicializarSimulacionParaRuta(ruta) {
    const coordenadas = ruta.coordenadas.map(coord => [coord.lat, coord.lng]);
    const totalPuntos = coordenadas.length;
    
    if (totalPuntos === 0) {
        console.warn(`⚠️ No hay coordenadas en la ruta ${ruta.nombre}`);
        return;
    }
    
    // Crear capa para esta ruta
    const capaRuta = L.layerGroup().addTo(map);
    capasRutas.push(capaRuta);
    
    // Dibujar la ruta en el mapa
    const colorRuta = generarColorParaRuta(ruta.nombre);
    const polyline = L.polyline(coordenadas, {
        color: colorRuta,
        weight: 4,
        opacity: 0.6,
        smoothFactor: 1
    }).addTo(capaRuta);
    
    // Crear 3-5 camiones por ruta
    const numCamiones = 3 + Math.floor(Math.random() * 3); // 3-5 camiones
    
    for (let i = 0; i < numCamiones; i++) {
        // Distribuir camiones uniformemente con variación
        const variacion = (Math.random() * 0.1 - 0.05);
        const progreso = (i / numCamiones) + variacion;
        const posicionInicial = Math.floor(Math.max(0, Math.min(0.95, progreso)) * (totalPuntos - 1));
        
        const camion = {
            id: todosLosCamiones.length + 1,
            marker: null,
            ruta: ruta,
            posicionActual: posicionInicial,
            progreso: Math.max(0, Math.min(0.95, progreso)),
            velocidad: 0.3 + Math.random() * 0.3, // Velocidad similar a pasajero_inicio.js
            direccion: 1,
            ultimaActualizacion: Date.now(),
            color: colorRuta
        };
        
        // Crear marcador personalizado para camiones
        const iconoCamion = L.divIcon({
            className: 'camion-marker',
            html: `🚌<div class="camion-numero" style="background-color: ${colorRuta}">${camion.id}</div>`,
            iconSize: [30, 30],
            iconAnchor: [15, 15]
        });
        
        // Posición inicial del camión
        const posicion = coordenadas[posicionInicial];
        camion.marker = L.marker(posicion, { icon: iconoCamion })
            .addTo(capaRuta)
            .bindPopup(`
                <div style="text-align: center;">
                    <strong>Camión ${camion.id}</strong><br>
                    Ruta: ${ruta.nombre}<br>
                    Velocidad: ${camion.velocidad.toFixed(1)}x
                </div>
            `);
        
        todosLosCamiones.push(camion);
    }
}

// Generar color único para cada ruta
function generarColorParaRuta(nombreRuta) {
    const colores = [
        '#3366FF', '#FF3333', '#33CC33', '#FF9933', 
        '#9933FF', '#33FFFF', '#FF33FF', '#FFFF33',
        '#FF6666', '#66FF66', '#6666FF', '#FF66FF'
    ];
    
    let hash = 0;
    for (let i = 0; i < nombreRuta.length; i++) {
        hash = nombreRuta.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colores[Math.abs(hash) % colores.length];
}

// Mover todos los camiones de todas las rutas
function moverTodosLosCamiones() {
    const ahora = Date.now();
    
    todosLosCamiones.forEach(camion => {
        const tiempoTranscurrido = ahora - camion.ultimaActualizacion;
        camion.ultimaActualizacion = ahora;
        
        const coordenadas = camion.ruta.coordenadas.map(coord => [coord.lat, coord.lng]);
        const totalPuntos = coordenadas.length;
        
        if (totalPuntos === 0) return;
        
        // Velocidad similar a pasajero_inicio.js
        const incrementoProgreso = (tiempoTranscurrido / 1000) * (camion.velocidad / 200);
        
        camion.progreso += incrementoProgreso;
        
        // Ruta cíclica
        if (camion.progreso >= 1) {
            camion.progreso = 0;
        }
        
        // Calcular posición exacta
        const posicionExacta = camion.progreso * (totalPuntos - 1);
        const puntoInferior = Math.floor(posicionExacta);
        const puntoSuperior = Math.min(puntoInferior + 1, totalPuntos - 1);
        const factorInterpolacion = posicionExacta - puntoInferior;
        
        // Interpolación suave
        const lat1 = coordenadas[puntoInferior][0];
        const lng1 = coordenadas[puntoInferior][1];
        const lat2 = coordenadas[puntoSuperior][0];
        const lng2 = coordenadas[puntoSuperior][1];
        
        const latActual = lat1 + (lat2 - lat1) * factorInterpolacion;
        const lngActual = lng1 + (lng2 - lng1) * factorInterpolacion;
        
        // Actualizar posición del marcador
        camion.marker.setLatLng([latActual, lngActual]);
    });
}

// Calcular distancia entre dos puntos (Haversine)
function calcularDistancia(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Radio de la Tierra en metros
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // Distancia en metros
}

// Encontrar el punto de la ruta más cercano a la parada fija
function encontrarPuntoMasCercanoAParadaFija(ruta) {
    const coordenadas = ruta.coordenadas;
    let mejorIndice = 0;
    let mejorDistancia = Infinity;
    
    for (let i = 0; i < coordenadas.length; i++) {
        const distancia = calcularDistancia(
            paradaFija.lat, paradaFija.lng,
            coordenadas[i].lat, coordenadas[i].lng
        );
        if (distancia < mejorDistancia) {
            mejorDistancia = distancia;
            mejorIndice = i;
        }
    }
    
    return mejorIndice;
}

// Calcular distancia restante del camión a la parada fija
function calcularDistanciaRestante(camion) {
    const coordenadas = camion.ruta.coordenadas;
    const indiceParada = encontrarPuntoMasCercanoAParadaFija(camion.ruta);
    const indiceCamion = Math.floor(camion.progreso * (coordenadas.length - 1));
    
    let distanciaRestante = 0;
    
    if (indiceCamion <= indiceParada) {
        for (let i = indiceCamion; i < indiceParada; i++) {
            distanciaRestante += calcularDistancia(
                coordenadas[i].lat, coordenadas[i].lng,
                coordenadas[i + 1].lat, coordenadas[i + 1].lng
            );
        }
    } else {
        for (let i = indiceCamion; i < coordenadas.length - 1; i++) {
            distanciaRestante += calcularDistancia(
                coordenadas[i].lat, coordenadas[i].lng,
                coordenadas[i + 1].lat, coordenadas[i + 1].lng
            );
        }
        for (let i = 0; i < indiceParada; i++) {
            distanciaRestante += calcularDistancia(
                coordenadas[i].lat, coordenadas[i].lng,
                coordenadas[i + 1].lat, coordenadas[i + 1].lng
            );
        }
    }
    
    return Math.max(0, distanciaRestante);
}

// Calcular tiempo estimado de llegada
function calcularTiempoEstimadoCamion(camion) {
    const distanciaRestante = calcularDistanciaRestante(camion);
    
    // Velocidad realista (25 km/h ≈ 6.94 m/s)
    const VELOCIDAD_CAMION = 6.94;
    
    // Tiempo base en segundos
    let tiempoSegundos = distanciaRestante / VELOCIDAD_CAMION;
    
    // Añadir tiempo por paradas (20 segundos cada 300 metros)
    const paradasEstimadas = Math.floor(distanciaRestante / 300);
    tiempoSegundos += paradasEstimadas * 20;
    
    // Añadir tiempo por semáforos/tráfico (5 segundos cada 200 metros)
    const semaforosEstimados = Math.floor(distanciaRestante / 200);
    tiempoSegundos += semaforosEstimados * 5;
    
    // Convertir a minutos
    let tiempoMinutos = Math.ceil(tiempoSegundos / 60);
    
    // Asegurar mínimo 1 minuto y máximo 60
    tiempoMinutos = Math.max(1, Math.min(60, tiempoMinutos));
    
    return tiempoMinutos;
}

// Actualizar los tiempos de todos los camiones
function actualizarTiempos() {
    if (todosLosCamiones.length === 0) return;

    const camionesConTiempos = [];
    
    todosLosCamiones.forEach(camion => {
        const tiempo = calcularTiempoEstimadoCamion(camion);
        
        if (tiempo > 0 && tiempo <= 60) {
            const distancia = calcularDistanciaRestante(camion);
            camionesConTiempos.push({
                id: camion.id,
                tiempo: tiempo,
                distancia: distancia,
                ruta: camion.ruta.nombre,
                color: camion.color,
                progreso: camion.progreso
            });
        }
    });
    
    // Ordenar por tiempo y tomar los 5 más cercanos
    camionesConTiempos.sort((a, b) => a.tiempo - b.tiempo);
    const camionesAMostrar = camionesConTiempos.slice(0, 5);
    
    // Actualizar interfaz
    actualizarListaTiempos(camionesAMostrar);
    actualizarTimestamp();
}

// Actualizar la lista de tiempos en la interfaz
function actualizarListaTiempos(camionesCercanos) {
    if (camionesCercanos.length === 0) {
        tiemposContainer.innerHTML = `
            <div class="text-center py-4">
                <i class="fa-solid fa-bus-slash fa-2x text-muted mb-2"></i>
                <p class="text-muted small">No hay camiones en camino</p>
                <small class="text-muted">Próximamente llegará un camión</small>
            </div>
        `;
        return;
    }
    
    tiemposContainer.innerHTML = camionesCercanos.map(camion => `
        <div class="ruta-item ${camion.tiempo <= 3 ? 'ruta-proxima' : ''}" style="border-left-color: ${camion.color}">
            <div class="ruta-info">
                <i class="fa-solid fa-bus ruta-icon" style="color: ${camion.color}"></i>
                <div class="ruta-details">
                    <h4>Camion ${camion.id}</h4>
                    <div class="ruta-numero">Ruta ${camion.ruta}</div>
                </div>
            </div>
            <div class="tiempo-estimado">
                <div class="tiempo-principal ${obtenerClaseTiempo(camion.tiempo)}">
                    ${camion.tiempo} <span class="tiempo-unidad">min</span>
                </div>
                <div class="tiempo-detalles">
                    ${obtenerTextoDistancia(camion.distancia)}
                </div>
            </div>
        </div>
    `).join('');
}

// Obtener clase CSS según el tiempo
function obtenerClaseTiempo(tiempo) {
    if (tiempo <= 3) return 'tiempo-inmediato';
    if (tiempo <= 8) return 'tiempo-cercano';
    return 'tiempo-lejano';
}

// Obtener texto de distancia
function obtenerTextoDistancia(distancia) {
    if (distancia < 200) return 'Aproximándose';
    if (distancia < 500) return 'Muy cercano';
    if (distancia < 1000) return 'Cercano';
    if (distancia < 2000) return 'A distancia media';
    return `${Math.round(distancia / 1000)} km`;
}

// Actualizar timestamp
function actualizarTimestamp() {
    ultimaActualizacionElement.textContent = `Actualizado: ${new Date().toLocaleTimeString()}`;
}

// Limpiar simulación completamente
function limpiarSimulacion() {
    console.log('🧹 Limpiando simulación anterior...');
    
    // Detener actualizaciones
    if (intervaloActualizacion) {
        clearInterval(intervaloActualizacion);
        intervaloActualizacion = null;
    }
    
    if (intervaloSimulacion) {
        clearInterval(intervaloSimulacion);
        intervaloSimulacion = null;
    }
    
    // Remover todas las capas de rutas
    capasRutas.forEach(capa => {
        if (capa && map.hasLayer(capa)) {
            map.removeLayer(capa);
        }
    });
    
    // Limpiar arrays
    todosLosCamiones = [];
    capasRutas = [];
    
    console.log('✅ Simulación anterior limpiada');
}

// Iniciar actualización de tiempos
function iniciarActualizacionTiempos() {
    // Actualizar inmediatamente
    actualizarTiempos();
    
    // Actualizar cada 5 segundos
    if (intervaloActualizacion) {
        clearInterval(intervaloActualizacion);
    }
    intervaloActualizacion = setInterval(actualizarTiempos, 5000);
    
    // Iniciar movimiento de camiones
    if (intervaloSimulacion) {
        clearInterval(intervaloSimulacion);
    }
    intervaloSimulacion = setInterval(moverTodosLosCamiones, 100);
}

// Inicializar cuando se carga la página
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Inicializando pantalla de parada...');
    inicializarMapa();
    cargarTodasLasRutas();
    
    console.log('✅ Pantalla de parada inicializada correctamente');
});

// Función para testing
window.forceUpdate = function() {
    actualizarTiempos();
};

// Función para recargar
window.recargarTodo = function() {
    cargarTodasLasRutas();
};