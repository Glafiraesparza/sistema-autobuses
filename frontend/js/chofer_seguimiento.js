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
    }

    getChoferData() {
        const usuarioData = localStorage.getItem('tucsa_chofer');
        if (!usuarioData) return null;
        return JSON.parse(usuarioData);
    }

    setupEventListeners() {
        // Botón de refrescar
        document.getElementById('refrescar-reportes')?.addEventListener('click', () => {
            this.cargarIncidentes();
            this.cargarQuejas();
        });
        
        // Cuando se abre el modal, cargar datos
        const modal = document.getElementById('seguimientoReportesModal');
        if (modal) {
            modal.addEventListener('shown.bs.modal', () => {
                this.cargarIncidentes();
                this.cargarQuejas();
            });
        }
    }

    async cargarIncidentes() {
        try {
            const idChofer = this.usuario.id_personal;
            
            // Cargar incidentes (emergencias reportadas por este chofer)
            const response = await fetch(`https://sistema-autobuses.onrender.com/api/notificaciones/chofer/${idChofer}`, {
                headers: UserAuthPersonal.getAuthHeaders()
            });
            
            if (response.ok) {
                const data = await response.json();
                const incidentes = data.notificaciones?.filter(n => n.tipo === 'emergencia') || [];
                this.incidentes = incidentes;
                this.renderizarIncidentes();
            } else {
                console.error('Error cargando incidentes:', response.status);
                this.renderizarIncidentesVacio();
            }
        } catch (error) {
            console.error('Error:', error);
            this.renderizarIncidentesVacio();
        }
    }

    async cargarQuejas() {
        try {
            const idChofer = this.usuario.id_personal;
            
            // Cargar quejas donde el chofer fue mencionado
            const response = await fetch(`https://sistema-autobuses.onrender.com/api/quejas/todas?limit=100`, {
                headers: UserAuthPersonal.getAuthHeaders()
            });
            
            if (response.ok) {
                const data = await response.json();
                // Filtrar quejas que mencionan a este chofer (por número de unidad)
                const quejasChofer = data.quejas.filter(q => 
                    q.numero_unidad === this.usuario.id_camion_asignado?.toString() ||
                    q.descripcion?.toLowerCase().includes(this.usuario.nombre?.toLowerCase())
                );
                this.quejas = quejasChofer;
                this.renderizarQuejas();
            } else {
                console.error('Error cargando quejas:', response.status);
                this.renderizarQuejasVacio();
            }
        } catch (error) {
            console.error('Error:', error);
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
                    <div>
                        <h6 class="mb-1">
                            <i class="bi bi-exclamation-triangle-fill text-danger me-1"></i>
                            ${inc.titulo || 'Incidente reportado'}
                        </h6>
                        <p class="mb-1 small">${inc.mensaje || 'Sin descripción'}</p>
                        <small class="text-muted">
                            <i class="bi bi-calendar me-1"></i>
                            ${this.formatearFecha(inc.timestamp)}
                        </small>
                    </div>
                    <div>
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
                    <div>
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
                    </div>
                    <div>
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