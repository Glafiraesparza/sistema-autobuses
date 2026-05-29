const API_BASE = `https://sistema-autobuses.onrender.com/api`;
let map;
let rutasCargadas = [];
let rutaSeleccionada = null;
let camionSeleccionado = null;
let camionSimulado = null;
let intervaloSimulacion;
let marcadorCamion = null;
let polylineRuta = null;
let paradasLayer = null;

// ⭐⭐ CONFIGURACIÓN: Cambia entre paradas de BD y dinámicas ⭐⭐
const USAR_PARADAS_BD = false; // ⭐ false = Paradas dinámicas (RECOMENDADO)

// CONFIGURACIÓN DE DIRECCIONES POR RUTA
const CONFIG_DIRECCION_RUTAS = {
    "40 Norte": "norte",    // Orden: 1,2,3,4,5,6,7 (ascendente)
    "40 Sur": "norte"         // Orden: 7,6,5,4,3,2,1 (descendente)
};

// NUEVA VARIABLE: Para rastrear paradas ya pasadas
let paradasPasadas = new Set();

// Inicializar mapa
function inicializarMapa() {
    map = L.map('map',{
        zoomControl: false,
    }).setView([21.91616, -102.31644], 17);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        minZoom:14,
        maxZoom: 17
    }).addTo(map);
    
    console.log('🗺️ Mapa del camión inicializado');
    console.log(`🔧 Configuración: USAR_PARADAS_BD = ${USAR_PARADAS_BD}`);
}

// Cargar rutas disponibles
async function cargarRutas() {
    try {
        const response = await fetch(`${API_BASE}/rutas`);
        rutasCargadas = await response.json();
        llenarSelectorRutas();
    } catch (error) {
        console.error("Error cargando rutas:", error);
    }
}

// Llenar selector de rutas
function llenarSelectorRutas() {
    const selectRuta = document.getElementById('select-ruta');
    selectRuta.innerHTML = '<option value="">Selecciona ruta</option>';
    
    rutasCargadas.forEach(ruta => {
        const option = document.createElement('option');
        option.value = ruta.nombre;
        option.textContent = ruta.nombre;
        selectRuta.appendChild(option);
    });
    
    // Event listener para cambio de ruta
    selectRuta.addEventListener('change', function() {
        const rutaNombre = this.value;
        if (rutaNombre) {
            const ruta = rutasCargadas.find(r => r.nombre === rutaNombre);
            if (ruta) {
                seleccionarRuta(ruta);
            }
        } else {
            limpiarMapa();
        }
    });
    
    // Event listener para cambio de camión
    document.getElementById('select-camion').addEventListener('change', function() {
        const numeroCamion = parseInt(this.value);
        if (rutaSeleccionada) {
            reiniciarSimulacionCamion(numeroCamion);
        }
    });
}

// Seleccionar ruta y mostrar en mapa
function seleccionarRuta(ruta) {
    rutaSeleccionada = ruta;
    limpiarMapa();
    
    // Dibujar ruta
    const coordenadas = ruta.coordenadas.map(coord => [coord.lat, coord.lng]);
    polylineRuta = L.polyline(coordenadas, {
        color: '#3366FF',
        weight: 6,
        opacity: 0.8,
        smoothFactor: 1
    }).addTo(map);
    
    // ⭐⭐ COMENTADO: Ya se maneja en iniciarSimulacionCamion() ⭐⭐
    // Mostrar paradas desde la base de datos
    // mostrarParadasDesdeBD(ruta);
    
    // Ajustar vista
    map.fitBounds(polylineRuta.getBounds(), { padding: [20, 20] });
    
    // Iniciar simulación del camión seleccionado
    const numeroCamion = parseInt(document.getElementById('select-camion').value);
    iniciarSimulacionCamion(ruta, numeroCamion);
}

// ⭐⭐ FUNCIÓN ACTUALIZADA: Mostrar paradas desde la base de datos O dinámicas ⭐⭐
function mostrarParadasDesdeBD(ruta) {
    // ⭐ DECISIÓN: Paradas de BD vs Dinámicas ⭐
    if (USAR_PARADAS_BD) {
        // Verificar si la ruta tiene paradas en la base de datos
        if (!ruta.paradas || ruta.paradas.length === 0) {
            console.warn('⚠️ La ruta no tiene paradas en la base de datos, usando dinámicas:', ruta);
            const paradasDinamicas = crearParadasBasicas(ruta);
            mostrarParadasEnMapa(paradasDinamicas, ruta.nombre);
            return;
        }
        
        console.log(`🚏 Mostrando ${ruta.paradas.length} paradas desde BD`);
        mostrarParadasEnMapa(ruta.paradas, ruta.nombre);
    } else {
        // Usar paradas dinámicas
        console.log('🔄 Usando paradas dinámicas (BD deshabilitada)');
        const paradasDinamicas = crearParadasBasicas(ruta);
        mostrarParadasEnMapa(paradasDinamicas, ruta.nombre);
    }
}

// ⭐⭐ FUNCIÓN MEJORADA: Crear paradas básicas sobre la ruta ⭐⭐
function crearParadasBasicas(ruta) {
    const paradas = [];
    const coordenadas = ruta.coordenadas;
    
    if (!coordenadas || coordenadas.length === 0) {
        console.error('❌ No hay coordenadas en la ruta para crear paradas');
        return paradas;
    }
    
    // Crear paradas distribuidas uniformemente sobre la ruta
    const numParadas = 40; // Número fijo de paradas
    const intervalo = Math.floor(coordenadas.length / (numParadas - 1));
    
    console.log(`🏗️ Creando ${numParadas} paradas dinámicas sobre la ruta`);
    
    for (let i = 0; i < numParadas; i++) {
        const indiceCoordenada = i * intervalo;
        // Asegurar que no nos salgamos del array
        const indiceSeguro = Math.min(indiceCoordenada, coordenadas.length - 1);
        
        paradas.push({
            orden: i + 1,
            lat: coordenadas[indiceSeguro].lat,
            lng: coordenadas[indiceSeguro].lng,
            nombre: `Parada ${i + 1}`
        });
        
        console.log(`   📍 Parada ${i + 1} en [${coordenadas[indiceSeguro].lat}, ${coordenadas[indiceSeguro].lng}]`);
    }
    
    console.log(`✅ Creadas ${paradas.length} paradas dinámicas EXACTAMENTE sobre la ruta`);
    return paradas;
}

// Mostrar paradas en el mapa
function mostrarParadasEnMapa(paradas, nombreRuta) {
    paradasLayer = L.layerGroup();
    
    paradas.forEach((parada, index) => {
        // Marcador de parada
        const marcadorParada = L.circleMarker([parada.lat, parada.lng], {
            radius: 8,
            fillColor: '#FF6B35',
            color: '#FFFFFF',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.8
        }).addTo(paradasLayer);
        
        // Popup de parada
        marcadorParada.bindPopup(`
            <div style="text-align: center;">
                <strong>🚏 ${parada.nombre || `Parada ${parada.orden}`}</strong><br>
                Parada #${parada.orden}<br>
                Ruta: ${nombreRuta}
            </div>
        `);
        
        // Efecto hover
        marcadorParada.on('mouseover', function() {
            this.setStyle({
                fillColor: '#FF4500',
                radius: 10
            });
        });
        
        marcadorParada.on('mouseout', function() {
            this.setStyle({
                fillColor: '#FF6B35',
                radius: 8
            });
        });
        
        // También agregar número de parada
        L.marker([parada.lat, parada.lng], {
            icon: L.divIcon({
                className: 'parada-number',
                html: `<div style="background: #FF6B35; color: white; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; font-weight: bold;">${parada.orden}</div>`,
                iconSize: [20, 20],
                iconAnchor: [10, 10]
            })
        }).addTo(paradasLayer);
    });
    
    paradasLayer.addTo(map);
}

// ⭐⭐ FUNCIÓN COMPLETAMENTE ACTUALIZADA: Iniciar simulación de UN SOLO camión ⭐⭐
function iniciarSimulacionCamion(ruta, numeroCamion) {
    // Limpiar simulación anterior COMPLETAMENTE
    limpiarCamionActual();
    
    const coordenadas = ruta.coordenadas.map(coord => [coord.lat, coord.lng]);
    const totalPuntos = coordenadas.length;
    
    // Posición inicial aleatoria para el camión
    const progresoInicial = Math.random();
    const posicionInicial = Math.floor(progresoInicial * (totalPuntos - 1));
    
    // RESETEAR paradas pasadas cuando iniciamos nuevo camión
    paradasPasadas.clear();
    
    // ⭐⭐ NUEVO: Crear paradas dinámicas y guardarlas ⭐⭐
    let paradasParaUsar;
    if (USAR_PARADAS_BD && ruta.paradas && ruta.paradas.length > 0) {
        paradasParaUsar = ruta.paradas;
        console.log(`🗄️ Usando ${paradasParaUsar.length} paradas de BD`);
    } else {
        paradasParaUsar = crearParadasBasicas(ruta);
        console.log(`🔄 Usando ${paradasParaUsar.length} paradas dinámicas`);
    }
    
    camionSimulado = {
        id: numeroCamion,
        marker: null,
        ruta: ruta,
        posicionActual: posicionInicial,
        progreso: progresoInicial,
        velocidad: 0.2 + Math.random() * 0.3,
        direccion: 1,
        ultimaParadaPasada: null,
        // ⭐⭐ NUEVO: Guardar las paradas que estamos usando ⭐⭐
        paradasActivas: paradasParaUsar
    };
    
    // Crear marcador del camión
    const iconoCamion = L.divIcon({
        className: 'camion-marker camion-seleccionado',
        html: `🚌<div class="camion-numero">${numeroCamion}</div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15]
    });
    
    const posicion = coordenadas[posicionInicial];
    marcadorCamion = L.marker(posicion, { 
        icon: iconoCamion,
        zIndexOffset: 1000
    }).addTo(map);
    
    camionSimulado.marker = marcadorCamion;
    
    // Popup del camión
    marcadorCamion.bindPopup(`
        <div style="text-align: center;">
            <strong>Camión ${numeroCamion}</strong><br>
            Ruta: ${ruta.nombre}<br>
            Velocidad: ${(camionSimulado.velocidad * 10).toFixed(1)} km/h
        </div>
    `);
    
    // ⭐⭐ INTERVALO MÁS RÁPIDO: 50ms en lugar de 100ms ⭐⭐
    intervaloSimulacion = setInterval(moverCamion, 50);
    
    // Mostrar las paradas que estamos usando
    mostrarParadasEnMapa(paradasParaUsar, ruta.nombre);
    
    // Actualizar información inicial
    actualizarInformacionCamion();
    actualizarProximasParadas();
    
    console.log(`🚚 Camión ${numeroCamion} simulando en ruta "${ruta.nombre}" (intervalo: 50ms)`);
}

// ⭐⭐ FUNCIÓN MEJORADA: Limpiar camión actual Y paradas ⭐⭐
function limpiarCamionActual() {
    // 1. Limpiar marcador del camión
    if (marcadorCamion) {
        map.removeLayer(marcadorCamion);
        marcadorCamion = null;
    }
    
    // 2. ⭐⭐ NUEVO: Limpiar paradas del mapa ⭐⭐
    if (paradasLayer) {
        map.removeLayer(paradasLayer);
        paradasLayer = null;
        console.log('🗑️ Paradas anteriores eliminadas del mapa');
    }
    
    // 3. Detener simulación
    detenerSimulacion();
    camionSimulado = null;
}
// ⭐⭐ FUNCIÓN MEJORADA: Reiniciar simulación con nuevo número de camión ⭐⭐
function reiniciarSimulacionCamion(nuevoNumero) {
    if (rutaSeleccionada) {
        console.log(`🔄 Cambiando a camión ${nuevoNumero} en ruta ${rutaSeleccionada.nombre}`);
        
        // ⭐⭐ LIMPIAR completamente antes de iniciar nueva simulación ⭐⭐
        limpiarCamionActual();
        
        // Pequeño delay para asegurar que se limpió todo
        setTimeout(() => {
            iniciarSimulacionCamion(rutaSeleccionada, nuevoNumero);
        }, 100);
    }
}

// Mover el camión en la simulación
function moverCamion() {
    if (!camionSimulado) return;
    
    const coordenadas = camionSimulado.ruta.coordenadas.map(coord => [coord.lat, coord.lng]);
    const totalPuntos = coordenadas.length;
    
    camionSimulado.progreso += (0.0002 * camionSimulado.velocidad);
    
    // Ruta cíclica
    if (camionSimulado.progreso >= 1) {
        camionSimulado.progreso = 0;
        // Al reiniciar ruta, limpiar paradas pasadas
        paradasPasadas.clear();
    }
    
    const posicionExacta = camionSimulado.progreso * (totalPuntos - 1);
    const puntoInferior = Math.floor(posicionExacta);
    const puntoSuperior = Math.min(puntoInferior + 1, totalPuntos - 1);
    const factorInterpolacion = posicionExacta - puntoInferior;
    
    const lat1 = coordenadas[puntoInferior][0];
    const lng1 = coordenadas[puntoInferior][1];
    const lat2 = coordenadas[puntoSuperior][0];
    const lng2 = coordenadas[puntoSuperior][1];
    
    const latActual = lat1 + (lat2 - lat1) * factorInterpolacion;
    const lngActual = lng1 + (lng2 - lng1) * factorInterpolacion;
    
    // Actualizar posición del marcador
    camionSimulado.marker.setLatLng([latActual, lngActual]);
    
    // Centrar mapa en el camión (seguimiento automático)
    map.setView([latActual, lngActual], map.getZoom());
    
    // NUEVO: Detectar si el camión pasó alguna parada
    detectarParadasPasadas(latActual, lngActual);
    
    // Actualizar información en tiempo real
    actualizarInformacionCamion();
    actualizarProximasParadas();
}


// ⭐⭐ FUNCIÓN MEJORADA: Detectar paradas que el camión ya pasó ⭐⭐
function detectarParadasPasadas(latCamion, lngCamion) {
    if (!camionSimulado || !camionSimulado.paradasActivas) return;
    
    const paradas = camionSimulado.paradasActivas;
    const nombreRuta = camionSimulado.ruta.nombre;
    const direccionRuta = CONFIG_DIRECCION_RUTAS[nombreRuta] || "norte";
    
    // Umbral más pequeño para detección más precisa
    const UMBRAL_PASADA = 20; // metros (reducido para mayor precisión)
    
    paradas.forEach(parada => {
        // Si ya marcamos esta parada como pasada, ignorar
        if (paradasPasadas.has(parada.orden)) return;
        
        const distancia = calcularDistancia(latCamion, lngCamion, parada.lat, parada.lng);
        
        if (distancia <= UMBRAL_PASADA) {
            // Verificar si está en la dirección correcta usando la nueva lógica
            const paradasOrdenadas = [...paradas].sort((a, b) => a.orden - b.orden);
            const paradaActual = encontrarParadaActual({lat: latCamion, lng: lngCamion}, paradasOrdenadas, direccionRuta);
            
            if (paradaActual && paradaActual.orden === parada.orden) {
                // ¡El camión pasó esta parada!
                paradasPasadas.add(parada.orden);
                camionSimulado.ultimaParadaPasada = parada.orden;
                
                console.log(`✅ Camión ${camionSimulado.id} pasó parada ${parada.orden}: ${parada.nombre}`);
                mostrarNotificacionParada(parada);
            }
        }
    });
}
// NUEVA FUNCIÓN: Verificar si la parada está en la dirección correcta
function esParadaEnDireccionCorrecta(parada, direccion, latCamion, lngCamion) {
    return true;
}


// ⭐⭐ FUNCIÓN SIMPLIFICADA: Ya no es tan crítica con la nueva lógica ⭐⭐
function deberiaSaltarParada(posicionCamion, paradaCercana, paradasOrdenadas, direccion) {
    // Con la nueva lógica, esta función es menos crítica
    // Pero la mantenemos por compatibilidad
    
    const indiceCercano = paradasOrdenadas.findIndex(p => p.orden === paradaCercana.orden);
    
    let siguienteParada;
    if (direccion === "sur") {
        siguienteParada = indiceCercano > 0 ? paradasOrdenadas[indiceCercano - 1] : null;
    } else {
        siguienteParada = indiceCercano < paradasOrdenadas.length - 1 ? paradasOrdenadas[indiceCercano + 1] : null;
    }
    
    if (!siguienteParada) return false;
    
    const distanciaAParadaCercana = calcularDistancia(
        posicionCamion.lat, posicionCamion.lng,
        paradaCercana.lat, paradaCercana.lng
    );
    
    const distanciaASiguienteParada = calcularDistancia(
        posicionCamion.lat, posicionCamion.lng,
        siguienteParada.lat, siguienteParada.lng
    );
    
    // Si estamos significativamente más cerca de la siguiente parada
    return distanciaASiguienteParada < distanciaAParadaCercana * 0.7;
}

// NUEVA FUNCIÓN: Mostrar notificación cuando se pasa una parada
function mostrarNotificacionParada(parada) {
    // Puedes implementar un toast o notificación aquí
}

// ⭐⭐ FUNCIÓN ACTUALIZADA: Encontrar próximas paradas con orden correcto ⭐⭐
function encontrarProximasParadasPorDireccion() {
    if (!camionSimulado || !camionSimulado.paradasActivas) return []; // ⭐ CAMBIO: usar paradasActivas
    
    const paradas = camionSimulado.paradasActivas; // ⭐ CAMBIO: usar paradasActivas
    const nombreRuta = camionSimulado.ruta.nombre;
    const posicionCamion = camionSimulado.marker.getLatLng();
    
    // Ordenar paradas por su campo "orden"
    const paradasOrdenadas = [...paradas].sort((a, b) => a.orden - b.orden);
    
    // 1. Determinar la dirección de la ruta
    const direccionRuta = CONFIG_DIRECCION_RUTAS[nombreRuta] || "norte";
    console.log(`🧭 Ruta ${nombreRuta} - Dirección: ${direccionRuta}`);
    
    // 2. Encontrar la parada más cercana al camión (que no haya sido pasada)
    let paradaMasCercana = null;
    let distanciaMinima = Infinity;
    let indiceMasCercano = -1;
    
    paradasOrdenadas.forEach((parada, index) => {
        // EXCLUIR paradas ya pasadas
        if (paradasPasadas.has(parada.orden)) return;
        
        const distancia = calcularDistancia(
            posicionCamion.lat, posicionCamion.lng,
            parada.lat, parada.lng
        );
        
        if (distancia < distanciaMinima) {
            distanciaMinima = distancia;
            paradaMasCercana = parada;
            indiceMasCercano = index;
        }
    });
    
    // Si no encontramos paradas no pasadas, buscar cualquier parada
    if (!paradaMasCercana) {
        paradasOrdenadas.forEach((parada, index) => {
            const distancia = calcularDistancia(
                posicionCamion.lat, posicionCamion.lng,
                parada.lat, parada.lng
            );
            
            if (distancia < distanciaMinima) {
                distanciaMinima = distancia;
                paradaMasCercana = parada;
                indiceMasCercano = index;
            }
        });
    }
    
    if (!paradaMasCercana) return [];
    
    console.log(`📍 Parada más cercana: ${paradaMasCercana.nombre} (orden: ${paradaMasCercana.orden})`);
    
    // 3. CORREGIDO: Determinar el punto de partida según la dirección
    let puntoDePartida = indiceMasCercano;
    
    if (direccionRuta === "sur") {
        // Para ruta SUR: el camión va de norte a sur (orden DESCENDENTE)
        // Si ya pasamos la parada más cercana, empezar desde la siguiente (orden menor)
        if (deberiaSaltarParada(posicionCamion, paradaMasCercana, paradasOrdenadas, direccionRuta)) {
            puntoDePartida = indiceMasCercano - 1;
            if (puntoDePartida < 0) puntoDePartida = paradasOrdenadas.length - 1; // circular
            console.log(`↘️  Saltando parada ${paradaMasCercana.orden} - ya fue pasada en dirección SUR`);
        }
    } else {
        // Para ruta NORTE: el camión va de sur a norte (orden ASCENDENTE)
        if (deberiaSaltarParada(posicionCamion, paradaMasCercana, paradasOrdenadas, direccionRuta)) {
            puntoDePartida = (indiceMasCercano + 1) % paradasOrdenadas.length;
            console.log(`↗️  Saltando parada ${paradaMasCercana.orden} - ya fue pasada en dirección NORTE`);
        }
    }
    
    // 4. CORREGIDO: Tomar las siguientes paradas según la dirección
    const proximasParadas = [];
    let paradasEncontradas = 0;
    
    if (direccionRuta === "sur") {
        // PARA RUTA SUR: orden DESCENDENTE (7,6,5,4...)
        let indiceActual = puntoDePartida;
        
        while (paradasEncontradas < 3 && paradasEncontradas < paradasOrdenadas.length) {
            const parada = paradasOrdenadas[indiceActual];
            
            // Solo incluir paradas que no hayan sido pasadas
            if (!paradasPasadas.has(parada.orden)) {
                proximasParadas.push(parada);
                paradasEncontradas++;
                console.log(`➕ Agregando parada ${parada.orden} a próximas (SUR)`);
            }
            
            // Moverse hacia ATRÁS en el array (orden descendente)
            indiceActual = indiceActual - 1;
            if (indiceActual < 0) indiceActual = paradasOrdenadas.length - 1; // circular
            
            // Prevenir loop infinito
            if (indiceActual === puntoDePartida) break;
        }
    } else {
        // PARA RUTA NORTE: orden ASCENDENTE (1,2,3,4...)
        let indiceActual = puntoDePartida;
        
        while (paradasEncontradas < 3 && paradasEncontradas < paradasOrdenadas.length) {
            const parada = paradasOrdenadas[indiceActual];
            
            // Solo incluir paradas que no hayan sido pasadas
            if (!paradasPasadas.has(parada.orden)) {
                proximasParadas.push(parada);
                paradasEncontradas++;
                console.log(`➕ Agregando parada ${parada.orden} a próximas (NORTE)`);
            }
            
            // Moverse hacia ADELANTE en el array (orden ascendente)
            indiceActual = (indiceActual + 1) % paradasOrdenadas.length;
            
            // Prevenir loop infinito
            if (indiceActual === puntoDePartida) break;
        }
    }
    
    console.log(`📋 Próximas paradas encontradas: ${proximasParadas.map(p => p.orden).join(', ')}`);
    return proximasParadas;
}
// ⭐⭐ FUNCIÓN CORREGIDA: Incluir la parada actual en las próximas paradas ⭐⭐
function encontrarProximasParadasPorDireccion() {
    if (!camionSimulado || !camionSimulado.paradasActivas) return [];
    
    const paradas = camionSimulado.paradasActivas;
    const nombreRuta = camionSimulado.ruta.nombre;
    const posicionCamion = camionSimulado.marker.getLatLng();
    
    // Ordenar paradas por su campo "orden"
    const paradasOrdenadas = [...paradas].sort((a, b) => a.orden - b.orden);
    
    // 1. Determinar la dirección de la ruta
    const direccionRuta = CONFIG_DIRECCION_RUTAS[nombreRuta] || "norte";
    console.log(`🧭 Ruta ${nombreRuta} - Dirección: ${direccionRuta}`);
    
    // 2. Encontrar la parada ACTUAL 
    const paradaActual = encontrarParadaActual(posicionCamion, paradasOrdenadas, direccionRuta);
    
    if (!paradaActual) {
        console.log('❌ No se pudo determinar la parada actual');
        return [];
    }
    
    console.log(`📍 Parada actual/enfrente: ${paradaActual.nombre} (orden: ${paradaActual.orden})`);
    
    // 3. Encontrar el índice de la parada actual
    const indiceActual = paradasOrdenadas.findIndex(p => p.orden === paradaActual.orden);
    if (indiceActual === -1) return [];
    
    // 4. ⭐⭐ CORREGIDO: INCLUIR la parada actual + las siguientes 2 paradas ⭐⭐
    const proximasParadas = [];
    let paradasEncontradas = 0;
    
    // PRIMERO agregar la parada actual (si no ha sido pasada)
    if (!paradasPasadas.has(paradaActual.orden)) {
        proximasParadas.push(paradaActual);
        paradasEncontradas++;
        console.log(`⭐ Agregando parada ACTUAL ${paradaActual.orden} a próximas`);
    }
    
    if (direccionRuta === "sur") {
        // PARA RUTA SUR: orden DESCENDENTE (buscar paradas con orden MENOR)
        let indiceBusqueda = indiceActual - 1;
        
        while (paradasEncontradas < 3 && indiceBusqueda >= 0) {
            const parada = paradasOrdenadas[indiceBusqueda];
            
            // Solo incluir paradas que no hayan sido pasadas
            if (!paradasPasadas.has(parada.orden)) {
                proximasParadas.push(parada);
                paradasEncontradas++;
                console.log(`➕ Agregando parada ${parada.orden} a próximas (SUR - orden descendente)`);
            }
            
            indiceBusqueda--;
        }
        
        // Si necesitamos más paradas y estamos en modo circular
        if (paradasEncontradas < 3) {
            indiceBusqueda = paradasOrdenadas.length - 1;
            while (paradasEncontradas < 3 && indiceBusqueda > indiceActual) {
                const parada = paradasOrdenadas[indiceBusqueda];
                if (!paradasPasadas.has(parada.orden)) {
                    proximasParadas.push(parada);
                    paradasEncontradas++;
                    console.log(`➕ Agregando parada ${parada.orden} a próximas (SUR - circular)`);
                }
                indiceBusqueda--;
            }
        }
    } else {
        // PARA RUTA NORTE: orden ASCENDENTE (buscar paradas con orden MAYOR)
        let indiceBusqueda = indiceActual + 1;
        
        while (paradasEncontradas < 3 && indiceBusqueda < paradasOrdenadas.length) {
            const parada = paradasOrdenadas[indiceBusqueda];
            
            // Solo incluir paradas que no hayan sido pasadas
            if (!paradasPasadas.has(parada.orden)) {
                proximasParadas.push(parada);
                paradasEncontradas++;
                console.log(`➕ Agregando parada ${parada.orden} a próximas (NORTE - orden ascendente)`);
            }
            
            indiceBusqueda++;
        }
        
        // Si necesitamos más paradas y estamos en modo circular
        if (paradasEncontradas < 3) {
            indiceBusqueda = 0;
            while (paradasEncontradas < 3 && indiceBusqueda < indiceActual) {
                const parada = paradasOrdenadas[indiceBusqueda];
                if (!paradasPasadas.has(parada.orden)) {
                    proximasParadas.push(parada);
                    paradasEncontradas++;
                    console.log(`➕ Agregando parada ${parada.orden} a próximas (NORTE - circular)`);
                }
                indiceBusqueda++;
            }
        }
    }
    
    console.log(`📋 Próximas paradas encontradas: ${proximasParadas.map(p => p.orden).join(', ')}`);
    return proximasParadas;
}

// ⭐⭐ NUEVA FUNCIÓN: Encontrar la parada actual considerando orden y dirección ⭐⭐
function encontrarParadaActual(posicionCamion, paradasOrdenadas, direccion) {
    // 1. Primero, encontrar todas las paradas que están ADELANTE según la dirección
    const paradasAdelante = [];
    
    if (direccion === "sur") {
        // Para SUR: paradas con orden MENOR están adelante
        // Buscar la parada más cercana que tenga orden menor que la última pasada
        const ultimaParadaPasada = Math.max(...Array.from(paradasPasadas), 0);
        const ordenLimite = ultimaParadaPasada > 0 ? ultimaParadaPasada : Infinity;
        
        paradasOrdenadas.forEach(parada => {
            if (parada.orden < ordenLimite && !paradasPasadas.has(parada.orden)) {
                const distancia = calcularDistancia(
                    posicionCamion.lat, posicionCamion.lng,
                    parada.lat, parada.lng
                );
                paradasAdelante.push({ parada, distancia });
            }
        });
        
        // Si no encontramos paradas adelante, usar todas las no pasadas
        if (paradasAdelante.length === 0) {
            paradasOrdenadas.forEach(parada => {
                if (!paradasPasadas.has(parada.orden)) {
                    const distancia = calcularDistancia(
                        posicionCamion.lat, posicionCamion.lng,
                        parada.lat, parada.lng
                    );
                    paradasAdelante.push({ parada, distancia });
                }
            });
        }
    } else {
        // Para NORTE: paradas con orden MAYOR están adelante
        const ultimaParadaPasada = Math.max(...Array.from(paradasPasadas), 0);
        const ordenLimite = ultimaParadaPasada > 0 ? ultimaParadaPasada : 0;
        
        paradasOrdenadas.forEach(parada => {
            if (parada.orden > ordenLimite && !paradasPasadas.has(parada.orden)) {
                const distancia = calcularDistancia(
                    posicionCamion.lat, posicionCamion.lng,
                    parada.lat, parada.lng
                );
                paradasAdelante.push({ parada, distancia });
            }
        });
        
        // Si no encontramos paradas adelante, usar todas las no pasadas
        if (paradasAdelante.length === 0) {
            paradasOrdenadas.forEach(parada => {
                if (!paradasPasadas.has(parada.orden)) {
                    const distancia = calcularDistancia(
                        posicionCamion.lat, posicionCamion.lng,
                        parada.lat, parada.lng
                    );
                    paradasAdelante.push({ parada, distancia });
                }
            });
        }
    }
    
    // 2. De las paradas adelante, encontrar la más cercana
    if (paradasAdelante.length > 0) {
        paradasAdelante.sort((a, b) => a.distancia - b.distancia);
        console.log(`🎯 Parada más cercana en dirección correcta: ${paradasAdelante[0].parada.orden} (${Math.round(paradasAdelante[0].distancia)}m)`);
        return paradasAdelante[0].parada;
    }
    
    // 3. Fallback: parada más cercana de cualquier dirección
    let paradaMasCercana = null;
    let distanciaMinima = Infinity;
    
    paradasOrdenadas.forEach(parada => {
        if (!paradasPasadas.has(parada.orden)) {
            const distancia = calcularDistancia(
                posicionCamion.lat, posicionCamion.lng,
                parada.lat, parada.lng
            );
            if (distancia < distanciaMinima) {
                distanciaMinima = distancia;
                paradaMasCercana = parada;
            }
        }
    });
    
    if (paradaMasCercana) {
        console.log(`⚠️ Usando parada más cercana (sin considerar dirección): ${paradaMasCercana.orden}`);
        return paradaMasCercana;
    }
    
    return null;
}

// Actualizar información del camión en el panel
function actualizarInformacionCamion() {
    if (!camionSimulado) return;
    
    // Velocidad calculada basada en la velocidad de simulación
    const velocidadKmh = Math.floor(15 + (camionSimulado.velocidad * 25));
    document.getElementById('velocidad-actual').textContent = `${velocidadKmh} km/h`;
    
    // Hora actual
    const ahora = new Date();
    document.getElementById('tiempo-actual').textContent = 
        ahora.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}

// ⭐⭐ FUNCIÓN ACTUALIZADA: Actualizar próximas paradas ⭐⭐
function actualizarProximasParadas() {
    if (!camionSimulado || !camionSimulado.paradasActivas) return; // ⭐ CAMBIO: usar paradasActivas
    
    const contenedor = document.getElementById('proximas-paradas');
    contenedor.innerHTML = '';
    
    const nombreRuta = camionSimulado.ruta.nombre;
    const direccionRuta = CONFIG_DIRECCION_RUTAS[nombreRuta] || "norte";
    
    console.log(`🔍 Buscando próximas paradas para ${nombreRuta} (${direccionRuta})`);
    console.log(`📊 Paradas pasadas: ${Array.from(paradasPasadas).join(', ') || 'ninguna'}`);
    console.log(`🎯 Total de paradas activas: ${camionSimulado.paradasActivas.length}`);
    
    // Usar la función mejorada que excluye paradas pasadas
    const proximasParadas = encontrarProximasParadasPorDireccion();
    
    // Mostrar paradas
    if (proximasParadas.length === 0) {
        contenedor.innerHTML = '<p class="text-muted small">No hay paradas próximas</p>';
        console.log('❌ No se encontraron paradas próximas');
        return;
    }
    
    const posicionCamion = camionSimulado.marker.getLatLng();
    
    console.log(`✅ Mostrando ${proximasParadas.length} paradas próximas en orden ${direccionRuta.toUpperCase()}:`);
    
    proximasParadas.forEach((parada, index) => {
        const distancia = calcularDistancia(
            posicionCamion.lat, posicionCamion.lng,
            parada.lat, parada.lng
        );
        
        const tiempoEstimado = calcularTiempoEstimado(distancia);
        
        const paradaElement = document.createElement('div');
        paradaElement.className = `parada-item ${index === 0 ? 'proxima' : ''}`;
        paradaElement.innerHTML = `
            <div class="d-flex justify-content-between align-items-start">
                <div class="flex-grow-1">
                    <div class="parada-nombre">${parada.nombre || `Parada ${parada.orden}`}</div>
                    <div class="parada-tiempo">⏱️ ${tiempoEstimado} min</div>
                    <div class="parada-distancia">📏 ${Math.round(distancia)}m</div>
                </div
            </div>
        `;
        
        console.log(`   ${index + 1}. Parada ${parada.orden} - ${Math.round(distancia)}m - ${tiempoEstimado}min`);
        
        contenedor.appendChild(paradaElement);
    });
}

// Calcular distancia entre dos puntos
function calcularDistancia(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c * 1000;
}

// Calcular tiempo estimado de llegada
function calcularTiempoEstimado(distanciaMetros) {
    const velocidadMs = 6.94; // 25 km/h en m/s
    let tiempoSegundos = distanciaMetros / velocidadMs;
    
    // Añadir tiempo por paradas y tráfico
    const paradasEstimadas = Math.floor(distanciaMetros / 300);
    tiempoSegundos += paradasEstimadas * 20;
    
    const semaforosEstimados = Math.floor(distanciaMetros / 200);
    tiempoSegundos += semaforosEstimados * 5;
    
    let tiempoMinutos = Math.ceil(tiempoSegundos / 60);
    return Math.max(1, Math.min(30, tiempoMinutos));
}

// Limpiar mapa
function limpiarMapa() {
    if (polylineRuta) {
        map.removeLayer(polylineRuta);
        polylineRuta = null;
    }
    
    if (paradasLayer) {
        map.removeLayer(paradasLayer);
        paradasLayer = null;
    }
    
    limpiarCamionActual();
    paradasPasadas.clear();
    
    document.getElementById('proximas-paradas').innerHTML = 
        '<p class="text-muted small">Selecciona una ruta para ver las paradas</p>';
}

// Detener simulación
function detenerSimulacion() {
    if (intervaloSimulacion) {
        clearInterval(intervaloSimulacion);
        intervaloSimulacion = null;
    }
}

// Inicializar cuando se carga la página
document.addEventListener('DOMContentLoaded', function() {
    inicializarMapa();
    cargarRutas();
});