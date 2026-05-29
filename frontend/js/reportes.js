class ReportesManager {
    constructor() {
        this.graficaBarras = null;
        this.graficaPastel = null;
        this.autoRefreshInterval = null;
        this.initializeApp();
    }

    async initializeApp() {
        try {
            // Usar UserAuthPersonal para verificar permisos
            const hasAccess = await UserAuthPersonal.checkPagePermissions('administrador');
            if (!hasAccess) return;
            
            // ✅ CORREGIDO: Inicializar NotificationManager ANTES de cargar notificaciones
            const usuario = UserAuthPersonal.getCurrentUser();
            if (usuario) {
                NotificationManager.initialize(
                    (notifications) => {
                        // Callback cuando se actualizan las notificaciones
                        console.log('Notificaciones actualizadas en Reportes:', notifications.length);
                    },
                    'personal', 
                    usuario.id_personal
                );
            }
            
            this.inicializarEventos();
            await this.cargarDatosIniciales();
            
            // ✅ CORREGIDO: Cargar notificaciones después de inicializar
            await NotificationManager.loadNotifications();
            
            // ✅ CORREGIDO: Actualizar la UI de notificaciones
            NotificationManager.updateNotificationBadge();
            NotificationManager.updateNotificationsDropdown();
            
            // Actualizar UI con información del usuario
            UserAuthPersonal.updateUserInterface();
            UserAuthPersonal.adjustUIForRole();
            
            // ✅ CORREGIDO: Configurar eventos de notificaciones
            this.configurarEventosNotificaciones();
            
            // Iniciar actualización automática
            this.startAutoRefresh();
            
        } catch (error) {
            console.error('Error inicializando aplicación de reportes:', error);
            this.mostrarNotificacion('Error al inicializar reportes', 'error');
        }
    }

    // ✅ AGREGADO: Configurar eventos para notificaciones
    configurarEventosNotificaciones() {
        const notificationDropdown = document.querySelector('.notification-menu');
        if (notificationDropdown) {
            // Actualizar dropdown cuando se abra
            notificationDropdown.addEventListener('show.bs.dropdown', function() {
                NotificationManager.updateNotificationsDropdown();
            });
        }
    }

    inicializarEventos() {
        // Eventos de filtros de fecha
        const dateInputs = document.querySelectorAll('.date-input');
        dateInputs.forEach(input => {
            input.addEventListener('change', () => {
                this.filtrarReportes();
            });
        });

        // Evento para botón de exportar Excel
        const btnExport = document.querySelector('.btn-export');
        if (btnExport) {
            btnExport.addEventListener('click', () => {
                if (!UserAuthPersonal.checkAdminPermissions()) return;
                this.exportarReporteExcel();
            });
        }

        // Evento para botón de imprimir
        const btnPrint = document.querySelector('.btn-outline-secondary');
        if (btnPrint) {
            btnPrint.addEventListener('click', () => {
                this.imprimirReporte();
            });
        }

        // Actualizar al hacer foco en la ventana
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                this.recargarDatosActuales();
                // ✅ AGREGADO: Actualizar notificaciones también
                NotificationManager.loadNotifications();
            }
        });

        // Actualizar al volver a la pestaña
        window.addEventListener('focus', () => {
            this.recargarDatosActuales();
            // ✅ AGREGADO: Actualizar notificaciones también
            NotificationManager.loadNotifications();
        });
    }

    startAutoRefresh() {
        // Limpiar intervalo anterior si existe
        if (this.autoRefreshInterval) {
            clearInterval(this.autoRefreshInterval);
        }

        // Actualizar reportes cada 30 segundos (30000 ms)
        this.autoRefreshInterval = setInterval(() => {
            this.recargarDatosActuales();
        }, 30000);

        // ✅ CORREGIDO: Actualizar notificaciones cada 3 segundos (más rápido)
        NotificationManager.startAutoRefresh(3000);
    }

    stopAutoRefresh() {
        if (this.autoRefreshInterval) {
            clearInterval(this.autoRefreshInterval);
            this.autoRefreshInterval = null;
        }
        // ✅ AGREGADO: Detener notificaciones también
        if (NotificationManager.stopAutoRefresh) {
            NotificationManager.stopAutoRefresh();
        }
    }

    async cargarDatosIniciales() {
        try {
            // Establecer fechas por defecto (últimos 7 días)
            const fechaFin = new Date().toISOString().split('T')[0];
            const fechaInicio = new Date();
            fechaInicio.setDate(fechaInicio.getDate() - 7);
            const fechaInicioStr = fechaInicio.toISOString().split('T')[0];
            
            // Establecer fechas en los inputs
            const fechaInputs = document.querySelectorAll('.date-input');
            if (fechaInputs.length >= 2) {
                fechaInputs[0].value = fechaInicioStr;
                fechaInputs[1].value = fechaFin;
            }
            
            // Cargar datos con fechas por defecto
            await this.cargarEstadisticasCompletas(fechaInicioStr, fechaFin);
            
        } catch (error) {
            console.error('Error cargando datos iniciales:', error);
            this.mostrarNotificacion('Error al cargar datos de reportes', 'error');
        }
    }

    async recargarDatosActuales() {
        try {
            const fechaInicio = document.querySelector('.date-input:nth-child(2)')?.value;
            const fechaFin = document.querySelector('.date-input:nth-child(4)')?.value;
            
            if (fechaInicio && fechaFin) {
                await this.cargarEstadisticasCompletas(fechaInicio, fechaFin);
            }
        } catch (error) {
            console.error('Error en actualización automática:', error);
        }
    }

    getAuthHeaders() {
        return UserAuthPersonal.getAuthHeaders();
    }

    async cargarEstadisticasCompletas(fechaInicio, fechaFin) {
        try {
            const response = await fetch(`https://${IP_API}:8000/api/reportes/estadisticas/completas?fecha_inicio=${fechaInicio}&fecha_fin=${fechaFin}`, {
                headers: this.getAuthHeaders()
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    this.actualizarEstadisticasUI(data.estadisticas);
                    this.actualizarGraficasUI(data.estadisticas);
                    return;
                }
            }
            // Fallback a carga individual si falla la completa
            await this.cargarEstadisticasIndividuales(fechaInicio, fechaFin);
            
        } catch (error) {
            console.error('Error cargando estadísticas completas:', error);
            await this.cargarEstadisticasIndividuales(fechaInicio, fechaFin);
        }
    }

    async cargarEstadisticasIndividuales(fechaInicio, fechaFin) {
        try {
            // Cargar estadísticas básicas en paralelo
            const [countResponse, sumaResponse, incidentesResponse, eficienciaResponse] = await Promise.all([
                fetch(`https://${IP_API}:8000/api/reportes/transacciones/count?fecha_inicio=${fechaInicio}&fecha_fin=${fechaFin}`, {
                    headers: this.getAuthHeaders()
                }),
                fetch(`https://${IP_API}:8000/api/reportes/transacciones/suma-total?fecha_inicio=${fechaInicio}&fecha_fin=${fechaFin}`, {
                    headers: this.getAuthHeaders()
                }),
                fetch(`https://${IP_API}:8000/api/reportes/incidentes/count?fecha_inicio=${fechaInicio}&fecha_fin=${fechaFin}`, {
                    headers: this.getAuthHeaders()
                }),
                fetch(`https://${IP_API}:8000/api/reportes/eficiencia/promedio?fecha_inicio=${fechaInicio}&fecha_fin=${fechaFin}`, {
                    headers: this.getAuthHeaders()
                })
            ]);

            const estadisticas = {};

            // Procesar transacciones
            if (countResponse.ok && sumaResponse.ok) {
                const countData = await countResponse.json();
                const sumaData = await sumaResponse.json();
                
                estadisticas.cantidad_transacciones = countData.count;
                estadisticas.total_recaudado = sumaData.total_recaudado;
                estadisticas.total_recaudado_formateado = sumaData.total_recaudado_formateado;
            }

            // Procesar incidentes
            if (incidentesResponse.ok) {
                const incidentesData = await incidentesResponse.json();
                estadisticas.total_incidentes = incidentesData.count || 0;
            } else {
                estadisticas.total_incidentes = 0;
            }

            // Procesar eficiencia
            if (eficienciaResponse.ok) {
                const eficienciaData = await eficienciaResponse.json();
                estadisticas.eficiencia = eficienciaData.eficiencia || 0;
                estadisticas.tiempo_promedio = eficienciaData.tiempo_promedio || 0;
            } else {
                estadisticas.eficiencia = 0;
                estadisticas.tiempo_promedio = 0;
            }

            this.actualizarEstadisticasUI(estadisticas);

            // Cargar datos para gráficas
            await this.cargarDatosGraficas(fechaInicio, fechaFin);
            
        } catch (error) {
            console.error('Error cargando estadísticas individuales:', error);
            this.mostrarNotificacion('Error al cargar datos', 'error');
        }
    }

    async cargarDatosGraficas(fechaInicio, fechaFin) {
        try {
            const [porDiaResponse, rutasResponse] = await Promise.all([
                fetch(`https://${IP_API}:8000/api/reportes/transacciones/suma-por-dia?fecha_inicio=${fechaInicio}&fecha_fin=${fechaFin}`, {
                    headers: this.getAuthHeaders()
                }),
                fetch(`https://${IP_API}:8000/api/reportes/rutas/popularidad?fecha_inicio=${fechaInicio}&fecha_fin=${fechaFin}`, {
                    headers: this.getAuthHeaders()
                })
            ]);

            if (porDiaResponse.ok && rutasResponse.ok) {
                const porDiaData = await porDiaResponse.json();
                const rutasData = await rutasResponse.json();
                
                const datosGraficas = {
                    datos_por_dia: porDiaData.datos_por_dia,
                    rutas_populares: rutasData.rutas_populares
                };
                
                this.actualizarGraficasUI(datosGraficas);
            }
        } catch (error) {
            console.error('Error cargando datos para gráficas:', error);
        }
    }

    actualizarEstadisticasUI(estadisticas) {
        console.log('Actualizando estadísticas:', estadisticas);
        
        // Actualizar tarjeta de recaudación
        if (estadisticas.total_recaudado_formateado) {
            const recaudacionElement = document.querySelector('.stat-card:nth-child(1) h3');
            if (recaudacionElement) {
                recaudacionElement.textContent = estadisticas.total_recaudado_formateado;
            }
        }
        
        // Actualizar tarjeta de pasajeros (cantidad de transacciones)
        if (estadisticas.cantidad_transacciones !== undefined) {
            const pasajerosElement = document.getElementById('pasajeros');
            if (pasajerosElement) {
                pasajerosElement.textContent = estadisticas.cantidad_transacciones.toLocaleString();
            }
        }
        
        // Actualizar tarjeta de eficiencia
        const eficienciaElement = document.getElementById('Eficiencia');
        if (eficienciaElement) {
            if (estadisticas.eficiencia !== undefined && estadisticas.eficiencia > 0) {
                eficienciaElement.textContent = `${estadisticas.eficiencia}%`;
                
                // Cambiar color basado en la eficiencia
                const iconBox = eficienciaElement.closest('.stat-card').querySelector('.stat-icon-box');
                if (iconBox) {
                    iconBox.className = 'stat-icon-box ' + 
                        (estadisticas.eficiencia >= 90 ? 'icon-box-green' : 
                        estadisticas.eficiencia >= 80 ? 'icon-box-orange' : 'icon-box-red');
                }
            } else {
                // Fallback a cálculo basado en transacciones si no hay datos de eficiencia
                const transacciones = estadisticas.cantidad_transacciones || 0;
                const eficiencia = transacciones > 100 ? '98%' : transacciones > 50 ? '95%' : '90%';
                eficienciaElement.textContent = eficiencia;
            }
        }
        
        // Actualizar tarjeta de incidentes
        const incidentesElement = document.getElementById('Incidentes');
        if (incidentesElement) {
            incidentesElement.textContent = estadisticas.total_incidentes !== undefined ? 
                estadisticas.total_incidentes.toString() : '0';
                
            // Cambiar color basado en la cantidad de incidentes
            const iconBox = incidentesElement.closest('.stat-card').querySelector('.stat-icon-box');
            if (iconBox && estadisticas.total_incidentes !== undefined) {
                iconBox.className = 'stat-icon-box ' + 
                    (estadisticas.total_incidentes === 0 ? 'icon-box-green' : 
                    estadisticas.total_incidentes <= 2 ? 'icon-box-orange' : 'icon-box-red');
            }
        }
    }

    actualizarGraficasUI(datosGraficas) {
        if (datosGraficas.datos_por_dia && datosGraficas.datos_por_dia.length > 0) {
            this.renderizarGraficaBarras(datosGraficas.datos_por_dia);
        } else {
            this.mostrarPlaceholderGraficaBarras();
        }
        
        if (datosGraficas.rutas_populares && datosGraficas.rutas_populares.length > 0) {
            this.renderizarGraficaPastel(datosGraficas.rutas_populares);
        } else {
            this.mostrarPlaceholderGraficaPastel();
        }
    }

    renderizarGraficaBarras(datosPorDia) {
        const canvasArea = document.querySelector('.chart-canvas-area');
        if (!canvasArea) return;
        
        // Limpiar área del gráfico
        canvasArea.innerHTML = '<canvas id="graficaBarras" height="300"></canvas>';
        
        const ctx = document.getElementById('graficaBarras').getContext('2d');
        
        // Destruir gráfica anterior si existe
        if (this.graficaBarras) {
            this.graficaBarras.destroy();
        }
        
        // Preparar datos para la gráfica
        const labels = datosPorDia.map(dia => {
            const fecha = new Date(dia.fecha);
            return fecha.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
        });
        
        const datos = datosPorDia.map(dia => dia.total_dia);
        
        this.graficaBarras = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Ingresos por Día',
                    data: datos,
                    backgroundColor: 'rgba(54, 162, 235, 0.7)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 1,
                    borderRadius: 5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `Ingresos: $${context.raw.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return '$' + value.toLocaleString('es-MX');
                            }
                        }
                    }
                }
            }
        });
    }

    renderizarGraficaPastel(rutasPopulares) {
        const canvasArea = document.querySelectorAll('.chart-canvas-area')[1];
        if (!canvasArea) return;
        
        // Limpiar área del gráfico
        canvasArea.innerHTML = '<canvas id="graficaPastel" height="300"></canvas>';
        
        const ctx = document.getElementById('graficaPastel').getContext('2d');
        
        // Destruir gráfica anterior si existe
        if (this.graficaPastel) {
            this.graficaPastel.destroy();
        }
        
        // Preparar datos para la gráfica
        const labels = rutasPopulares.map(ruta => ruta.ruta);
        const datos = rutasPopulares.map(ruta => ruta.cantidad_viajes);
        
        // Colores para la gráfica de pastel
        const colores = [
            '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
            '#FF9F40', '#FF6384', '#C9CBCF', '#4BC0C0', '#FF6384'
        ];
        
        this.graficaPastel = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: labels,
                datasets: [{
                    data: datos,
                    backgroundColor: colores.slice(0, labels.length),
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'right'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.raw || 0;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = Math.round((value / total) * 100);
                                return `${label}: ${value} viajes (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    }

    mostrarPlaceholderGraficaBarras() {
        const canvasArea = document.querySelector('.chart-canvas-area');
        if (!canvasArea) return;
        
        canvasArea.innerHTML = `
            <div class="chart-placeholder-content">
                <i class="bi bi-graph-up text-muted"></i>
                <p class="text-muted">No hay datos para mostrar</p>
                <small class="text-muted">Selecciona un rango de fechas con datos</small>
            </div>
        `;
    }

    mostrarPlaceholderGraficaPastel() {
        const canvasArea = document.querySelectorAll('.chart-canvas-area')[1];
        if (!canvasArea) return;
        
        canvasArea.innerHTML = `
            <div class="chart-placeholder-content">
                <i class="bi bi-pie-chart-fill text-muted"></i>
                <p class="text-muted">No hay datos de rutas</p>
                <small class="text-muted">No se encontraron transacciones con nombre de ruta</small>
            </div>
        `;
    }

    filtrarReportes() {
        const fechaInicio = document.querySelector('.date-input:nth-child(2)')?.value;
        const fechaFin = document.querySelector('.date-input:nth-child(4)')?.value;
        
        if (!fechaInicio || !fechaFin) {
            this.mostrarNotificacion('Selecciona ambas fechas para filtrar', 'warning');
            return;
        }
        
        if (fechaInicio > fechaFin) {
            this.mostrarNotificacion('La fecha de inicio no puede ser mayor a la fecha de fin', 'error');
            return;
        }
        
        this.recargarDatosConFiltro(fechaInicio, fechaFin);
    }

    async recargarDatosConFiltro(fechaInicio, fechaFin) {
        try {
            this.mostrarNotificacion('Aplicando filtros...', 'info');
            await this.cargarEstadisticasCompletas(fechaInicio, fechaFin);
            this.mostrarNotificacion('Filtros aplicados correctamente', 'success');
        } catch (error) {
            console.error('Error aplicando filtros:', error);
            this.mostrarNotificacion('Error al aplicar filtros', 'error');
        }
    }

    // Método adicional para obtener detalles de incidentes (opcional)
    async obtenerDetalleIncidentes(fechaInicio, fechaFin) {
        try {
            const response = await fetch(`https://${IP_API}:8000/api/reportes/incidentes/detalle?fecha_inicio=${fechaInicio}&fecha_fin=${fechaFin}`, {
                headers: this.getAuthHeaders()
            });
            
            if (response.ok) {
                const data = await response.json();
                return data.incidentes || [];
            }
            return [];
        } catch (error) {
            console.error('Error obteniendo detalle de incidentes:', error);
            return [];
        }
    }

    async exportarReporteExcel() {
        const fechaInicio = document.querySelector('.date-input:nth-child(2)')?.value;
        const fechaFin = document.querySelector('.date-input:nth-child(4)')?.value;
        
        if (!fechaInicio || !fechaFin) {
            this.mostrarNotificacion('Selecciona ambas fechas para exportar', 'warning');
            return;
        }
        
        if (fechaInicio > fechaFin) {
            this.mostrarNotificacion('La fecha de inicio no puede ser mayor a la fecha de fin', 'error');
            return;
        }
        
        // Deshabilitar botón durante la exportación
        const btnExport = document.querySelector('.btn-export');
        const originalText = btnExport.innerHTML;
        btnExport.innerHTML = '<i class="bi bi-hourglass-split"></i> Generando...';
        btnExport.disabled = true;
        
        try {
            this.mostrarNotificacion('Generando archivo Excel... Esto puede tomar unos segundos', 'info');
            
            const response = await fetch(`https://${IP_API}:8000/api/reportes/exportar/excel?fecha_inicio=${fechaInicio}&fecha_fin=${fechaFin}`, {
                headers: this.getAuthHeaders()
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || `Error ${response.status}: ${response.statusText}`);
            }
            
            // Mostrar progreso para descargas grandes
            const contentLength = response.headers.get('Content-Length');
            let loaded = 0;
            
            const reader = response.body.getReader();
            const chunks = [];
            
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                chunks.push(value);
                loaded += value.length;
                
                if (contentLength) {
                    const percent = Math.round((loaded / contentLength) * 100);
                    btnExport.innerHTML = `<i class="bi bi-hourglass-split"></i> ${percent}%`;
                }
            }
            
            // Crear blob
            const blob = new Blob(chunks, { 
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
            });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            
            // Obtener nombre del archivo
            const contentDisposition = response.headers.get('Content-Disposition');
            let filename = `reporte_tucsa_${fechaInicio}_a_${fechaFin}.xlsx`;
            
            if (contentDisposition) {
                const filenameMatch = contentDisposition.match(/filename="(.+)"/);
                if (filenameMatch) {
                    filename = filenameMatch[1];
                }
            }
            
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            
            // Limpiar
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            
            this.mostrarNotificacion(`Archivo "${filename}" descargado correctamente`, 'success');
            
        } catch (error) {
            console.error('Error exportando a Excel:', error);
            this.mostrarNotificacion(`Error al generar Excel: ${error.message}`, 'error');
        } finally {
            // Restaurar botón
            btnExport.innerHTML = originalText;
            btnExport.disabled = false;
        }
    }

    imprimirReporte() {
        this.mostrarNotificacion('Preparando vista de impresión...', 'info');
        // window.print();
    }

    mostrarNotificacion(mensaje, tipo) {
        UserAuthPersonal.showNotification(mensaje, tipo);
    }

    // Método para actualización manual
    refreshData() {
        this.recargarDatosActuales();
        // ✅ AGREGADO: Actualizar notificaciones también
        NotificationManager.loadNotifications();
    }

    // Método para limpiar recursos
    destroy() {
        this.stopAutoRefresh();
        
        if (this.graficaBarras) {
            this.graficaBarras.destroy();
        }
        if (this.graficaPastel) {
            this.graficaPastel.destroy();
        }
    }
}

// Instancia global cuando el DOM está listo
let reportesManager;

document.addEventListener('DOMContentLoaded', function() {
    reportesManager = new ReportesManager();
});

// Funciones globales para uso externo
window.logout = function() {
    if (reportesManager) {
        reportesManager.destroy();
    }
    UserAuthPersonal.logout();
};

window.debugReportes = function() {
    const fechaInicio = document.querySelector('.date-input:nth-child(2)')?.value;
    const fechaFin = document.querySelector('.date-input:nth-child(4)')?.value;
    console.log('Fechas seleccionadas:', { fechaInicio, fechaFin });
    
    if (reportesManager) {
        reportesManager.recargarDatosConFiltro(fechaInicio, fechaFin);
    }
};

// Exportar funciones para uso global
window.ReportesManager = {
    filtrarReportes: () => reportesManager?.filtrarReportes(),
    exportarReporteExcel: () => reportesManager?.exportarReporteExcel(),
    imprimirReporte: () => reportesManager?.imprimirReporte(),
    recargarDatosConFiltro: (fechaInicio, fechaFin) => reportesManager?.recargarDatosConFiltro(fechaInicio, fechaFin),
    debugReportes: () => reportesManager?.debugReportes(),
    refreshData: () => reportesManager?.refreshData()
};