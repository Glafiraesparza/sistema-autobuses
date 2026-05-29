class PanelAdministrativo {
    constructor() {
        this.usuario = null;
        this.autoRefreshInterval = null;
        this.initializeApp();
    }

    async initializeApp() {
        try {
            const hasAccess = await UserAuthPersonal.checkPagePermissions('administrador');
            if (!hasAccess) return;

            this.usuario = UserAuthPersonal.getCurrentUser();
            
            if (!this.usuario) {
                UserAuthPersonal.showNotification('Error: No se pudo cargar la información del usuario', 'error');
                return;
            }

            // ✅ MODIFICADO: Inicializar NotificationManager SOLO para la UI de notificaciones
            NotificationManager.initialize((notifications) => {
                this.onNotificationsUpdate(notifications);
            }, 'personal', this.usuario.id_personal);

            // ✅ CARGAR NOTIFICACIONES INMEDIATAMENTE
            await NotificationManager.loadNotifications();
            
            await this.loadDashboardData();
            this.initializeEventListeners();
            
            // Actualizar UI con información del usuario
            UserAuthPersonal.updateUserInterface();
            UserAuthPersonal.adjustUIForRole();
            
        } catch (error) {
            UserAuthPersonal.showNotification('Error al inicializar la aplicación', 'error');
        }
    }

    async loadDashboardData() {
        try {
            // Cargar todas las métricas en paralelo para mejor rendimiento
            await Promise.all([
                this.loadAllMetrics(),
                this.loadTablasInformativas()
            ]);
            
        } catch (error) {
            UserAuthPersonal.showNotification('Error al cargar datos del dashboard', 'error');
        }
    }

    async loadAllMetrics() {
        try {
            // Cargar todas las métricas en paralelo
            await Promise.all([
                this.loadMetricUsuarios(),
                this.loadMetricUnidades(),
                this.loadMetricRecaudacion(),
                this.loadMetricViajes(),
                this.loadMetricSoporte()
            ]);

        } catch (error) {
            // Si falla el paralelo, intentar secuencial
            await this.loadMetricsSecuencial();
        }
    }

    async loadMetricsSecuencial() {
        try {
            await this.loadMetricUsuarios();
            await this.loadMetricUnidades();
            await this.loadMetricRecaudacion();
            await this.loadMetricViajes();
            await this.loadMetricSoporte();
        } catch (error) {
            // Error silencioso en secuencial
        }
    }

    async loadMetricUsuarios() {
        try {
            const response = await fetch(`https://sistema-autobuses.onrender.com/api/metricas/usuarios-registrados`, {
                headers: UserAuthPersonal.getAuthHeaders()
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    this.updateSingleMetric('Usuarios Registrados', data.total_usuarios);
                }
            }
        } catch (error) {
            this.updateSingleMetric('Usuarios Registrados', 'Error');
        }
    }

    async loadMetricUnidades() {
        try {
            const response = await fetch(`https://sistema-autobuses.onrender.com/api/metricas/unidades-transito`, {
                headers: UserAuthPersonal.getAuthHeaders()
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    this.updateSingleMetric('Unidades en Transito', data.unidades_transito);
                }
            }
        } catch (error) {
            this.updateSingleMetric('Unidades en Transito', 'Error');
        }
    }

    async loadMetricRecaudacion() {
        try {
            const response = await fetch(`https://sistema-autobuses.onrender.com/api/metricas/recaudacion-hoy`, {
                headers: UserAuthPersonal.getAuthHeaders()
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    this.updateSingleMetric('Recaudación (Hoy)', data.recaudacion_formateada);
                }
            }
        } catch (error) {
            this.updateSingleMetric('Recaudación (Hoy)', '$0.00');
        }
    }

    async loadMetricViajes() {
        try {
            const response = await fetch(`https://sistema-autobuses.onrender.com/api/metricas/viajes-hoy`, {
                headers: UserAuthPersonal.getAuthHeaders()
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    this.updateSingleMetric('Viajes Hoy', data.viajes_hoy);
                }
            }
        } catch (error) {
            this.updateSingleMetric('Viajes Hoy', '0');
        }
    }

    async loadMetricSoporte() {
        try {
            const response = await fetch(`https://sistema-autobuses.onrender.com/api/metricas/soporte`, {
                headers: UserAuthPersonal.getAuthHeaders()
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    this.updateSingleMetric('Soporte', data.total_peticiones);
                }
            }
        } catch (error) {
            this.updateSingleMetric('Soporte', 'Error');
        }
    }

    async loadTablasInformativas() {
        try {
            await Promise.all([
                this.loadIncidentes(),
                this.loadInconvenientes(),
                this.loadSoporteDetalle()
            ]);
        } catch (error) {
            console.error('Error cargando tablas informativas:', error);
        }
    }

    // ✅ MODIFICADO: Mantener tu lógica original para cargar incidentes
    async loadIncidentes() {
        try {
            const response = await fetch(`https://sistema-autobuses.onrender.com/api/notificaciones/admin`, {
                headers: UserAuthPersonal.getAuthHeaders()
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    // Filtrar solo incidentes (emergencias) del día de hoy
                    const incidentes = data.notificaciones.filter(n => 
                        n.tipo === 'emergencia' && this.esFechaDeHoy(n.timestamp)
                    );
                    this.updateTablaIncidentes(incidentes);
                    
                    // Actualizar métrica de incidentes
                    this.updateSingleMetric('Incidentes', incidentes.length);
                }
            }
        } catch (error) {
            console.error('Error cargando incidentes:', error);
            this.updateTablaIncidentes([]);
        }
    }

    // ✅ MODIFICADO: Mantener tu lógica original para cargar inconvenientes
    async loadInconvenientes() {
        try {
            const response = await fetch(`https://sistema-autobuses.onrender.com/api/notificaciones/admin`, {
                headers: UserAuthPersonal.getAuthHeaders()
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    // Filtrar solo inconvenientes (retrasos) del día de hoy
                    const inconvenientes = data.notificaciones.filter(n => 
                        n.tipo === 'asistencia' && this.esFechaDeHoy(n.timestamp)
                    );
                    this.updateTablaInconvenientes(inconvenientes);
                    
                    // Actualizar métrica de inconvenientes
                    this.updateSingleMetric('Inconvenientes', inconvenientes.length);
                }
            }
        } catch (error) {
            console.error('Error cargando inconvenientes:', error);
            this.updateTablaInconvenientes([]);
        }
    }

    async loadSoporteDetalle() {
        try {
            const response = await fetch(`https://sistema-autobuses.onrender.com/api/metricas/soporte/detalle`, {
                headers: UserAuthPersonal.getAuthHeaders()
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    this.updateTablaSoporte(data.quejas);
                }
            }
        } catch (error) {
            console.error('Error cargando soporte:', error);
            this.updateTablaSoporte([]);
        }
    }

    // Método auxiliar para verificar si una fecha es de hoy
    esFechaDeHoy(timestamp) {
        if (!timestamp) return false;
        
        try {
            const fechaNotificacion = new Date(timestamp);
            const hoy = new Date();
            
            // Comparar año, mes y día
            return fechaNotificacion.getDate() === hoy.getDate() &&
                   fechaNotificacion.getMonth() === hoy.getMonth() &&
                   fechaNotificacion.getFullYear() === hoy.getFullYear();
        } catch (error) {
            console.error('Error procesando fecha:', error);
            return false;
        }
    }

    updateTablaIncidentes(incidentes) {
        const tbody = document.querySelector('#tabla-incidentes tbody');
        if (!tbody) return;

        if (incidentes.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No hay incidentes reportados hoy</td></tr>';
            return;
        }

        tbody.innerHTML = incidentes.map(incidente => {
            const timestamp = incidente.timestamp_formateado || 
                            (incidente.timestamp ? new Date(incidente.timestamp).toLocaleString() : 'N/A');

            return `
                <tr>
                    <td>#${incidente.id_notificacion || 'N/A'}</td>
                    <td>${this.formatearTipo(incidente.tipo)}</td>
                    <td>${incidente.ruta_afectada || 'N/A'}</td>
                    <td>${incidente.mensaje || 'Sin mensaje'}</td>
                    <td>${timestamp}</td>
                </tr>
            `;
        }).join('');
    }

    updateTablaInconvenientes(inconvenientes) {
        const tbody = document.querySelector('#tabla-inconvenientes tbody');
        if (!tbody) return;

        if (inconvenientes.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No hay inconvenientes reportados hoy</td></tr>';
            return;
        }

        tbody.innerHTML = inconvenientes.map(inconveniente => {
            const timestamp = inconveniente.timestamp_formateado || 
                            (inconveniente.timestamp ? new Date(inconveniente.timestamp).toLocaleString() : 'N/A');

            return `
                <tr>
                    <td>#${inconveniente.id_notificacion || 'N/A'}</td>
                    <td>${this.formatearTipo(inconveniente.tipo)}</td>
                    <td>${inconveniente.ruta_afectada || 'N/A'}</td>
                    <td>${inconveniente.mensaje || 'Sin mensaje'}</td>
                    <td>${timestamp}</td>
                </tr>
            `;
        }).join('');
    }

    updateTablaSoporte(quejas) {
        const tbody = document.querySelector('#tabla-soporte tbody');
        if (!tbody) return;

        if (quejas.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted">No hay mensajes de soporte</td></tr>';
            return;
        }

        tbody.innerHTML = quejas.map(queja => {
            return `
                <tr>
                    <td>${queja.id_usuario || 'N/A'}</td>
                    <td>${queja.tipo_queja || 'General'}</td>
                    <td>${queja.descripcion || 'Sin descripción'}</td>
                </tr>
            `;
        }).join('');
    }

    formatearTipo(tipo) {
        const tipos = {
            'emergencia': 'Emergencia',
            'retraso': 'Retraso',
            'asistencia': 'asistencia'
        };
        return tipos[tipo] || tipo;
    }

    updateSingleMetric(metricName, value) {
        const metricMapping = {
            'Unidades en Transito': '.row.g-4.mb-5 .col-md-4:nth-child(1) .card-text',
            'Usuarios Registrados': '.row.g-4.mb-5 .col-md-4:nth-child(2) .card-text',
            'Recaudación (Hoy)': '.row.g-4.mb-5 .col-md-4:nth-child(3) .card-text',
            'Viajes Hoy': '.row.g-4.mb-5 .col-md-3:nth-child(1) .card-text',
            'Incidentes': '.row.g-4.mb-5 .col-md-3:nth-child(2) .card-text',
            'Inconvenientes': '.row.g-4.mb-5 .col-md-3:nth-child(3) .card-text',
            'Soporte': '.row.g-4.mb-5 .col-md-3:nth-child(4) .card-text'
        };

        const selector = metricMapping[metricName];
        if (!selector) return;

        const element = document.querySelector(selector);
        if (element) {
            element.textContent = value;
        }
    }

    // ✅ MODIFICADO: Callback cuando se actualizan las notificaciones - SOLO para UI
    onNotificationsUpdate(notificaciones) {
        // ✅ SOLO actualizar la UI de notificaciones (badge y dropdown)
        NotificationManager.updateNotificationBadge();
        NotificationManager.updateNotificationsDropdown();
        
        // ❌ NO actualizar las tablas de métricas aquí
        // Las métricas se siguen manejando con tu lógica original en loadIncidentes() y loadInconvenientes()
    }

    initializeEventListeners() {
        // Cerrar sesión
        document.querySelector('.logout-btn')?.addEventListener('click', (e) => {
            e.preventDefault();
            UserAuthPersonal.logout();
        });

        // Iniciar actualización automática
        this.startAutoRefresh();

        // Actualizar al hacer foco en la ventana
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                this.loadDashboardData();
                // ✅ Cargar notificaciones para la barra también
                NotificationManager.loadNotifications();
            }
        });

        // Actualizar al volver a la pestaña
        window.addEventListener('focus', () => {
            this.loadDashboardData();
            // ✅ Cargar notificaciones para la barra también
            NotificationManager.loadNotifications();
        });
    }

    startAutoRefresh() {
        // Limpiar intervalo anterior si existe
        if (this.autoRefreshInterval) {
            clearInterval(this.autoRefreshInterval);
        }

        const METRICS_INTERVAL = 30000; // 30 segundos para métricas
        const NOTIFICATIONS_INTERVAL = 3000; // 3 segundos para notificaciones

        // Actualizar métricas cada 30 segundos
        this.autoRefreshInterval = setInterval(() => {
            this.loadDashboardData();
        }, METRICS_INTERVAL);

        // Actualizar notificaciones cada 3 segundos
        NotificationManager.startAutoRefresh(NOTIFICATIONS_INTERVAL);
    }

    stopAutoRefresh() {
        if (this.autoRefreshInterval) {
            clearInterval(this.autoRefreshInterval);
            this.autoRefreshInterval = null;
        }
        NotificationManager.stopAutoRefresh();
    }

    // Método para actualización manual si se necesita
    refreshData() {
        this.loadDashboardData();
        // ✅ Actualizar notificaciones también
        NotificationManager.loadNotifications();
    }
}

// Instancia global
const adminPanel = new PanelAdministrativo();

// También puedes exponer el método de actualización manual globalmente
window.refreshDashboard = function() {
    adminPanel.refreshData();
};

// Función global para logout
window.logout = function() {
    if (adminPanel) {
        adminPanel.stopAutoRefresh();
    }
    UserAuthPersonal.logout();
};