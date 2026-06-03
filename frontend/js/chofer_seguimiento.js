/**
 * Módulo de seguimiento de reportes para choferes
 */

class ChoferSeguimiento {
    constructor() {
        this.usuario = null;
        this.incidentes = [];
        this.quejas = [];
        this.initialize();
    }

    async initialize() {
        this.usuario = this.getChoferData();
        if (!this.usuario) return;
        
        this.setupEventListeners();
        
        // Cargar incidentes automáticamente al abrir el modal
        const modal = document.getElementById('seguimientoReportesModal');
        if (modal) {
            modal.addEventListener('shown.bs.modal', () => {
                this.cargarIncidentes();
                this.cargarQuejas();
            });
        }
    }

    getChoferData() {
        const usuarioData = localStorage.getItem('tucsa_chofer');
        if (!usuarioData) return null;
        return JSON.parse(usuarioData);
    }

    setupEventListeners() {
        // Botón de refrescar
        const refreshBtn = document.getElementById('refrescar-reportes');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.cargarIncidentes();
                this.cargarQuejas();
            });
        }
    }

    async cargarIncidentes() {
        try {
            if (!this.usuario) {
                console.error('No hay datos de usuario');
                this.renderizarIncidentesVacio();
                return;
            }
            
            const idChofer = this.usuario.id_personal;
            console.log('Cargando incidentes para chofer:', idChofer);
            
            // Cargar incidentes (emergencias) usando fetch normal sin autenticación compleja
            const response = await fetch(`https://sistema-autobuses.onrender.com/api/notificaciones/admin`);
            
            if (response.ok) {
                const data = await response.json();
                // Filtrar incidentes de emergencia para este chofer
                const incidentes = data.notificaciones?.filter(n => 
                    n.tipo === 'emergencia' && 
                    (n.id_chofer == idChofer || n.id_chofer === idChofer.toString())
                ) || [];
                this.incidentes = incidentes;
                this.renderizarIncidentes();
            } else {
                console.error('Error cargando incidentes:', response.status);
                this.renderizarIncidentesVacio();
            }
        } catch (error) {
            console.error('Error en cargarIncidentes:', error);
            this.renderizarIncidentesVacio();
        }
    }

    async cargarQuejas() {
        try {
            if (!this.usuario) {
                console.error('No hay datos de usuario');
                this.renderizarQuejasVacio();
                return;
            }
            
            console.log('Cargando quejas para chofer ID:', this.usuario.id_personal);
            console.log('Cargando quejas para unidad:', this.usuario.id_camion_asignado);
            
            // Cargar quejas
            const response = await fetch(`https://sistema-autobuses.onrender.com/api/quejas/todas?limit=100`);
            
            if (response.ok) {
                const data = await response.json();
                // Filtrar quejas que mencionan a este chofer (por número de unidad)
                const quejasChofer = data.quejas.filter(q => {
                    // Comparar número de unidad
                    const mismaUnidad = q.numero_unidad === this.usuario.id_camion_asignado?.toString();
                    // Buscar en descripción (fallback)
                    const mencionaChofer = q.descripcion?.toLowerCase().includes(this.usuario.nombre?.toLowerCase());
                    
                    return mismaUnidad || mencionaChofer;
                });
                this.quejas = quejasChofer;
                this.renderizarQuejas();
            } else {
                console.error('Error cargando quejas:', response.status);
                this.renderizarQuejasVacio();
            }
        } catch (error) {
            console.error('Error en cargarQuejas:', error);
            this.renderizarQuejasVacio();
        }
    }

    renderizarIncidentes() {
        const container = document.getElementById('incidentes-container');
        const countBadge = document.getElementById('incidentes-count');
        
        if (!container) return;
        
        if (this.incidentes.length === 0) {
            container.innerHTML = `
                <div class="text-center text-muted py-4">
                    <i class="bi bi-check-circle fs-1 text-success"></i>
                    <p class="mt-2">No has reportado incidentes de emergencia</p>
                </div>
            `;
            if (countBadge) countBadge.textContent = '0';
            return;
        }
        
        if (countBadge) countBadge.textContent = this.incidentes.length;
        
        container.innerHTML = this.incidentes.map(inc => `
            <div class="list-group-item reporte-card mb-2 rounded">
                <div class="d-flex justify-content-between align-items-start">
                    <div class="flex-grow-1">
                        <h6 class="mb-1">
                            <i class="bi bi-exclamation-triangle-fill text-danger me-1"></i>
                            ${inc.titulo || 'Incidente reportado'}
                        </h6>
                        <p class="mb-1 small">${inc.mensaje || 'Sin descripción'}</p>
                        <small class="text-muted">
                            <i class="bi bi-calendar me-1"></i>
                            ${this.formatearFecha(inc.timestamp)}
                        </small>
                        ${inc.ruta_afectada ? `<br><small class="text-muted"><i class="bi bi-route me-1"></i>Ruta: ${inc.ruta_afectada}</small>` : ''}
                    </div>
                    <div class="ms-2">
                        ${this.getEstadoBadge(inc.estado_seguimiento || 'Pendiente')}
                    </div>
                </div>
                ${inc.notas_admin ? `
                <div class="mt-2 pt-2 border-top">
                    <small class="text-muted">
                        <i class="bi bi-chat-text me-1"></i>
                        <strong>Nota del administrador:</strong> ${inc.notas_admin}
                    </small>
                </div>
                ` : ''}
            </div>
        `).join('');
    }

    renderizarQuejas() {
        const container = document.getElementById('quejas-container');
        const countBadge = document.getElementById('quejas-count');
        
        if (!container) return;
        
        if (this.quejas.length === 0) {
            container.innerHTML = `
                <div class="text-center text-muted py-4">
                    <i class="bi bi-check-circle fs-1 text-success"></i>
                    <p class="mt-2">No hay quejas relacionadas contigo</p>
                </div>
            `;
            if (countBadge) countBadge.textContent = '0';
            return;
        }
        
        if (countBadge) countBadge.textContent = this.quejas.length;
        
        container.innerHTML = this.quejas.map(queja => `
            <div class="list-group-item reporte-card mb-2 rounded">
                <div class="d-flex justify-content-between align-items-start">
                    <div class="flex-grow-1">
                        <h6 class="mb-1">
                            <i class="bi bi-person-circle text-warning me-1"></i>
                            Queja de usuario
                        </h6>
                        <p class="mb-1 small">${queja.descripcion || 'Sin descripción'}</p>
                        <small class="text-muted">
                            <i class="bi bi-calendar me-1"></i>
                            ${this.formatearFecha(queja.fecha_reporte)}
                        </small>
                        ${queja.ruta ? `<br><small class="text-muted"><i class="bi bi-route me-1"></i>Ruta: ${queja.ruta}</small>` : ''}
                        ${queja.numero_unidad ? `<br><small class="text-muted"><i class="bi bi-bus-front me-1"></i>Unidad: ${queja.numero_unidad}</small>` : ''}
                    </div>
                    <div class="ms-2">
                        ${this.getEstadoBadge(queja.estado)}
                    </div>
                </div>
                ${queja.notas_admin ? `
                <div class="mt-2 pt-2 border-top">
                    <small class="text-muted">
                        <i class="bi bi-chat-text me-1"></i>
                        <strong>Nota del administrador:</strong> ${queja.notas_admin}
                    </small>
                </div>
                ` : ''}
            </div>
        `).join('');
    }

    renderizarIncidentesVacio() {
        const container = document.getElementById('incidentes-container');
        if (container) {
            container.innerHTML = `
                <div class="text-center text-muted py-4">
                    <i class="bi bi-exclamation-circle fs-1"></i>
                    <p class="mt-2">Error al cargar incidentes</p>
                    <button class="btn btn-sm btn-outline-primary mt-2" onclick="window.choferSeguimiento?.cargarIncidentes()">
                        <i class="bi bi-arrow-repeat me-1"></i>Reintentar
                    </button>
                </div>
            `;
        }
    }

    renderizarQuejasVacio() {
        const container = document.getElementById('quejas-container');
        if (container) {
            container.innerHTML = `
                <div class="text-center text-muted py-4">
                    <i class="bi bi-exclamation-circle fs-1"></i>
                    <p class="mt-2">Error al cargar quejas</p>
                    <button class="btn btn-sm btn-outline-primary mt-2" onclick="window.choferSeguimiento?.cargarQuejas()">
                        <i class="bi bi-arrow-repeat me-1"></i>Reintentar
                    </button>
                </div>
            `;
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
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    window.choferSeguimiento = new ChoferSeguimiento();
});