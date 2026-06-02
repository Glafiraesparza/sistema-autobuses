/**
 * Módulo de Seguimiento de Quejas e Incidentes
 * Para administradores - Gestiona el seguimiento de reportes
 */

class SeguimientoManager {
    constructor() {
        this.usuario = null;
        this.quejas = [];
        this.filtroActual = 'todos';
        this.modalInstance = null;
        this.initialize();
    }

    async initialize() {
        try {
            // Verificar permisos de administrador
            const hasAccess = await UserAuthPersonal.checkPagePermissions('administrador');
            if (!hasAccess) return;

            this.usuario = UserAuthPersonal.getCurrentUser();
            
            if (!this.usuario) {
                UserAuthPersonal.showNotification('Error: No se pudo cargar la información del usuario', 'error');
                return;
            }

            // Inicializar NotificationManager
            NotificationManager.initialize(null, 'personal', this.usuario.id_personal);
            await NotificationManager.loadNotifications();
            
            // Cargar datos
            await this.cargarEstadisticas();
            await this.cargarQuejas();
            
            // Inicializar eventos
            this.initializeEventListeners();
            
            // Actualizar UI del usuario
            UserAuthPersonal.updateUserInterface();
            
            // Iniciar auto-refresh cada 30 segundos
            this.startAutoRefresh();
            
        } catch (error) {
            console.error('Error inicializando seguimiento:', error);
            UserAuthPersonal.showNotification('Error al inicializar la aplicación', 'error');
        }
    }

    async cargarEstadisticas() {
        try {
            const response = await fetch(`https://sistema-autobuses.onrender.com/api/quejas/estadisticas`, {
                headers: UserAuthPersonal.getAuthHeaders()
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    document.getElementById('total-quejas').textContent = data.estadisticas.total || 0;
                    document.getElementById('pendientes-count').textContent = data.estadisticas.pendientes || 0;
                    document.getElementById('proceso-count').textContent = data.estadisticas.en_proceso || 0;
                    document.getElementById('resueltos-count').textContent = data.estadisticas.resueltos || 0;
                    document.getElementById('quejas-badge').textContent = data.estadisticas.quejas_usuario || 0;
                    document.getElementById('incidentes-badge').textContent = data.estadisticas.incidentes || 0;
                }
            }
        } catch (error) {
            console.error('Error cargando estadísticas:', error);
        }
    }

    async cargarQuejas() {
    try {
        // Cargar quejas de usuarios (de colección quejas)
        let urlQuejas = `https://sistema-autobuses.onrender.com/api/quejas/todas?limit=500`;
        
        // Cargar incidentes de trabajadores (de colección notificaciones)
        let urlIncidentes = `https://sistema-autobuses.onrender.com/api/quejas/incidentes-notificaciones?limit=500`;
        
        if (this.filtroActual !== 'todos') {
            urlQuejas += `&estado=${this.filtroActual}`;
            urlIncidentes += `&estado=${this.filtroActual}`;
        }

        // Hacer ambas peticiones en paralelo
        const [responseQuejas, responseIncidentes] = await Promise.all([
            fetch(urlQuejas, { headers: UserAuthPersonal.getAuthHeaders() }),
            fetch(urlIncidentes, { headers: UserAuthPersonal.getAuthHeaders() })
        ]);
        
        let todasLasQuejas = [];
        
        if (responseQuejas.ok) {
            const dataQuejas = await responseQuejas.json();
            if (dataQuejas.success) {
                todasLasQuejas = [...todasLasQuejas, ...dataQuejas.quejas];
            }
        }
        
        if (responseIncidentes.ok) {
            const dataIncidentes = await responseIncidentes.json();
            if (dataIncidentes.success) {
                todasLasQuejas = [...todasLasQuejas, ...dataIncidentes.quejas];
            }
        }
        
        this.quejas = todasLasQuejas;
        this.renderizarTablas();
        
    } catch (error) {
        console.error('Error cargando quejas e incidentes:', error);
        this.mostrarTablaVacia();
    }
}

    renderizarTablas() {
        const quejasUsuario = this.quejas.filter(q => q.tipo_reporte !== 'incidente_trabajador');
        const incidentes = this.quejas.filter(q => q.tipo_reporte === 'incidente_trabajador');
        
        this.renderizarTablaQuejas(quejasUsuario);
        this.renderizarTablaIncidentes(incidentes);
    }

    renderizarTablaQuejas(quejas) {
        const tbody = document.querySelector('#tabla-quejas tbody');
        if (!tbody) return;

        if (quejas.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">No hay quejas registradas</td></tr>';
            return;
        }

        tbody.innerHTML = quejas.map(queja => `
            <tr>
                <td><small>${queja._id.substring(0, 8)}...</small></td>
                <td>
                    <strong>${this.escapeHtml(queja.nombre_usuario || 'Usuario')}</strong><br>
                    <small class="text-muted">${queja.email_usuario || ''}</small>
                </td>
                <td>${this.escapeHtml(queja.ruta || 'N/A')}</td>
                <td>${this.escapeHtml(queja.numero_unidad || 'N/A')}</td>
                <td>
                    <div style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" 
                         title="${this.escapeHtml(queja.descripcion)}">
                        ${this.truncateText(queja.descripcion, 50)}
                    </div>
                </td>
                <td>${this.getEstadoBadge(queja.estado)}</td>
                <td><small>${this.formatearFecha(queja.fecha_reporte)}</small></td>
                <td>
                    <button class="btn-seguimiento btn-sm" onclick="seguimientoManager.abrirModalSeguimiento('${queja._id}')">
                        <i class="bi bi-eye me-1"></i>Seguimiento
                    </button>
                </td>
            </tr>
        `).join('');
    }

    renderizarTablaIncidentes(incidentes) {
        const tbody = document.querySelector('#tabla-incidentes tbody');
        if (!tbody) return;

        if (incidentes.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">No hay incidentes registrados</td></tr>';
            return;
        }

        tbody.innerHTML = incidentes.map(incidente => `
            <tr>
                <td><small>${incidente._id.substring(0, 8)}...</small></td>
                <td>
                    <strong>${this.escapeHtml(incidente.nombre_usuario || 'Trabajador')}</strong><br>
                    <small class="text-muted">ID: ${incidente.id_usuario}</small>
                </td>
                <td>${this.escapeHtml(incidente.ruta || 'N/A')}</td>
                <td>${this.escapeHtml(incidente.numero_unidad || 'N/A')}</td>
                <td>
                    <div style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" 
                         title="${this.escapeHtml(incidente.descripcion)}">
                        ${this.truncateText(incidente.descripcion, 50)}
                    </div>
                </td>
                <td>${this.getEstadoBadge(incidente.estado)}</td>
                <td><small>${this.formatearFecha(incidente.fecha_reporte)}</small></td>
                <td>
                    <button class="btn-seguimiento btn-sm" onclick="seguimientoManager.abrirModalSeguimiento('${incidente._id}')">
                        <i class="bi bi-eye me-1"></i>Seguimiento
                    </button>
                </td>
            </tr>
        `).join('');
    }

    async abrirModalSeguimiento(idQueja) {
        const queja = this.quejas.find(q => q._id === idQueja);
    if (!queja) {
        UserAuthPersonal.showNotification('No se encontró el reporte', 'error');
        return;
    }

    // Guardar tipo de reporte para saber qué endpoint usar al guardar
    if (queja.origen === 'notificacion' || queja.tipo_reporte === 'incidente_trabajador') {
        document.getElementById('tipo-reporte')?.setAttribute('value', 'incidente_notificacion');
    } else {
        document.getElementById('tipo-reporte')?.setAttribute('value', 'queja');
    }

        // Llenar datos en el modal
        document.getElementById('seguimiento-id').value = idQueja;
        document.getElementById('detalle-nombre').textContent = queja.nombre_usuario || queja.id_usuario;
        document.getElementById('detalle-ruta').textContent = queja.ruta || 'N/A';
        document.getElementById('detalle-unidad').textContent = queja.numero_unidad || 'N/A';
        document.getElementById('detalle-descripcion').textContent = queja.descripcion || 'Sin descripción';
        document.getElementById('nuevo-estado').value = queja.estado || 'Pendiente';
        document.getElementById('notas-seguimiento').value = queja.notas_admin || '';
        
        // Renderizar historial
        this.renderizarHistorial(queja.historial_estados || []);
        
        // Mostrar modal
        if (!this.modalInstance) {
            const modalElement = document.getElementById('seguimientoModal');
            this.modalInstance = new bootstrap.Modal(modalElement);
        }
        this.modalInstance.show();
    }

    renderizarHistorial(historial) {
        const container = document.getElementById('historial-cambios');
        if (!container) return;

        if (!historial || historial.length === 0) {
            container.innerHTML = '<p class="text-muted text-center">No hay historial de cambios</p>';
            return;
        }

        container.innerHTML = historial.map(entry => `
            <div class="historial-entry">
                <div class="d-flex justify-content-between align-items-start">
                    <div>
                        <span class="estado">${this.getEstadoBadge(entry.estado)}</span>
                        <p class="mt-2 mb-1">${this.escapeHtml(entry.notas)}</p>
                        <small class="text-muted">Realizado por: ${entry.realizado_por || 'Sistema'}</small>
                    </div>
                    <small class="fecha">${this.formatearFecha(entry.fecha)}</small>
                </div>
            </div>
        `).join('');
    }

    async guardarSeguimiento() {
    const idQueja = document.getElementById('seguimiento-id').value;
    const nuevoEstado = document.getElementById('nuevo-estado').value;
    const notas = document.getElementById('notas-seguimiento').value;
    const tipo = document.getElementById('tipo-reporte')?.value || 'queja';
    
    if (!nuevoEstado) {
        UserAuthPersonal.showNotification('Debes seleccionar un estado', 'error');
        return;
    }

    const btnGuardar = document.getElementById('btn-guardar-seguimiento');
    const textoOriginal = btnGuardar.innerHTML;
    btnGuardar.disabled = true;
    btnGuardar.innerHTML = '<i class="bi bi-hourglass-split me-1"></i>Guardando...';

    try {
        let url;
        let body;
        
        // Determinar qué endpoint usar según el tipo
        const queja = this.quejas.find(q => q._id === idQueja);
        
        if (queja && queja.tipo_reporte === 'incidente_trabajador' && queja.origen === 'notificacion') {
            // Incidente de notificación
            url = `https://sistema-autobuses.onrender.com/api/quejas/incidentes-notificaciones/${idQueja}/seguimiento`;
            body = {
                estado: nuevoEstado,
                notas_admin: notas,
                admin_id: this.usuario.id_personal
            };
        } else {
            // Queja normal
            url = `https://sistema-autobuses.onrender.com/api/quejas/${idQueja}/seguimiento`;
            body = {
                estado: nuevoEstado,
                notas_admin: notas,
                admin_id: this.usuario.id_personal
            };
        }
        
        console.log('📤 Enviando a:', url);
        
        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                ...UserAuthPersonal.getAuthHeaders()
            },
            body: JSON.stringify(body)
        });

        const responseText = await response.text();
        console.log('📄 Respuesta raw:', responseText);
        
        let data;
        try {
            data = JSON.parse(responseText);
        } catch(e) {
            console.error('Error parseando JSON:', e);
            throw new Error(`Respuesta inválida: ${responseText.substring(0, 100)}`);
        }

        if (response.ok && data.success) {
            UserAuthPersonal.showNotification('Seguimiento actualizado correctamente', 'success');
            
            await this.cargarEstadisticas();
            await this.cargarQuejas();
            
            if (this.modalInstance) {
                this.modalInstance.hide();
            }
        } else {
            throw new Error(data.detail || data.message || 'Error al actualizar');
        }
    } catch (error) {
        console.error('❌ Error:', error);
        UserAuthPersonal.showNotification('Error: ' + error.message, 'error');
    } finally {
        btnGuardar.disabled = false;
        btnGuardar.innerHTML = textoOriginal;
    }
}

    async enviarNotificacionUsuario(idQueja, nuevoEstado, notas) {
        const queja = this.quejas.find(q => q._id === idQueja);
        if (!queja) return;

        // Crear notificación para el usuario/chofer
        const notificacionData = {
            tipo: 'seguimiento',
            titulo: `Actualización de tu reporte - ${nuevoEstado}`,
            mensaje: `Tu reporte ha sido actualizado a: ${nuevoEstado}\n\nNota del administrador: ${notas}`,
            id_usuario: queja.id_usuario,
            id_reporte: idQueja,
            timestamp: new Date().toISOString()
        };

        try {
            await fetch(`https://sistema-autobuses.onrender.com/api/notificaciones/usuario`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...UserAuthPersonal.getAuthHeaders()
                },
                body: JSON.stringify(notificacionData)
            });
        } catch (error) {
            console.error('Error enviando notificación:', error);
        }
    }

    getEstadoBadge(estado) {
        const estados = {
            'Pendiente': '<span class="estado-pendiente"><i class="bi bi-hourglass-split me-1"></i>Pendiente</span>',
            'En Proceso': '<span class="estado-proceso"><i class="bi bi-arrow-repeat me-1"></i>En Proceso</span>',
            'Resuelto': '<span class="estado-resuelto"><i class="bi bi-check-circle me-1"></i>Resuelto</span>'
        };
        return estados[estado] || `<span class="estado-pendiente">${estado}</span>`;
    }

    formatearFecha(fecha) {
        if (!fecha) return 'N/A';
        try {
            const date = new Date(fecha);
            return date.toLocaleDateString('es-MX', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch {
            return fecha;
        }
    }

    truncateText(text, maxLength) {
        if (!text) return '';
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    mostrarTablaVacia() {
        const tbody1 = document.querySelector('#tabla-quejas tbody');
        const tbody2 = document.querySelector('#tabla-incidentes tbody');
        if (tbody1) tbody1.innerHTML = '<tr><td colspan="8" class="text-center text-muted">Error al cargar datos</td></tr>';
        if (tbody2) tbody2.innerHTML = '<tr><td colspan="8" class="text-center text-muted">Error al cargar datos</td></tr>';
    }

    initializeEventListeners() {
        // Filtros
        document.getElementById('btn-filtrar-todos')?.addEventListener('click', () => {
            this.filtroActual = 'todos';
            this.cargarQuejas();
        });
        document.getElementById('btn-filtrar-pendientes')?.addEventListener('click', () => {
            this.filtroActual = 'Pendiente';
            this.cargarQuejas();
        });
        document.getElementById('btn-filtrar-proceso')?.addEventListener('click', () => {
            this.filtroActual = 'En Proceso';
            this.cargarQuejas();
        });
        document.getElementById('btn-filtrar-resueltos')?.addEventListener('click', () => {
            this.filtroActual = 'Resuelto';
            this.cargarQuejas();
        });

        // Guardar seguimiento
        document.getElementById('btn-guardar-seguimiento')?.addEventListener('click', () => {
            this.guardarSeguimiento();
        });

        // Cerrar sesión
        document.querySelector('.logout-btn')?.addEventListener('click', (e) => {
            e.preventDefault();
            UserAuthPersonal.logout();
        });

        // Actualizar al hacer foco
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                this.cargarEstadisticas();
                this.cargarQuejas();
            }
        });
    }

    startAutoRefresh() {
        setInterval(() => {
            if (!document.hidden) {
                this.cargarEstadisticas();
                this.cargarQuejas();
            }
        }, 30000);
    }
}

// Instancia global
const seguimientoManager = new SeguimientoManager();

// Función global para logout
window.logout = function() {
    UserAuthPersonal.logout();
};