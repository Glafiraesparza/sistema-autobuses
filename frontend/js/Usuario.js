class GestorUsuarios {
    constructor() {
        this.filtrosActuales = {
            query: '',
            rol: '',
            activo: undefined
        };
        this.usuario = null;
    }

    async initialize() {
        // Usar UserAuthPersonal para verificar permisos
        const hasAccess = await UserAuthPersonal.checkPagePermissions('administrador');
        if (!hasAccess) return;
        
        await this.cargarDatosUsuario();
        await this.cargarUsuariosConFiltros();
        this.inicializarFiltros();
        this.inicializarEventListeners();
        
        // Cargar notificaciones
        await NotificationManager.loadNotifications();
        NotificationManager.startAutoRefresh();
    }

    async cargarDatosUsuario() {
        // Usar UserAuthPersonal para obtener datos del usuario
        this.usuario = UserAuthPersonal.getCurrentUser();
        if (!this.usuario) {
            console.error('No se pudo cargar la información del usuario');
            return;
        }
        
        // Actualizar la interfaz de usuario
        UserAuthPersonal.updateUserInterface();
        UserAuthPersonal.adjustUIForRole();
    }

    inicializarEventListeners() {
        // Botón de nuevo usuario
        const btnNuevoUsuario = document.querySelector('.btn-admin-primary');
        if (btnNuevoUsuario) {
            btnNuevoUsuario.addEventListener('click', () => {
                if (!UserAuthPersonal.checkAdminPermissions()) return;
                this.mostrarModalNuevoUsuario();
            });
        }

        // Cerrar sesión
        const logoutBtn = document.querySelector('.logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.logout();
            });
        }
    }

    inicializarFiltros() {
        console.log('Inicializando filtros...');
        
        // Inicializar NotificationManager
        NotificationManager.initialize((notifications) => {
            console.log('Notificaciones actualizadas:', notifications);
            NotificationManager.updateNotificationBadge();
            NotificationManager.updateNotificationsDropdown();
        });

        // Event listener para búsqueda en tiempo real
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filtrosActuales.query = e.target.value;
                this.aplicarFiltros();
            });
        }

        // Event listeners para filtros de rol
        document.querySelectorAll('.filter-badge[data-rol]').forEach(badge => {
            badge.addEventListener('click', (e) => {
                const rol = e.currentTarget.getAttribute('data-rol');
                this.aplicarFiltroRol(rol);
            });
        });

        // Event listeners para filtros de estado
        document.querySelectorAll('.filter-badge[data-activo]').forEach(badge => {
            badge.addEventListener('click', (e) => {
                const activo = e.currentTarget.getAttribute('data-activo') === 'true';
                this.aplicarFiltroActivo(activo);
            });
        });

        console.log('Filtros inicializados correctamente');
    }

    aplicarFiltroRol(rol) {
        console.log('Aplicando filtro rol:', rol);
        
        // Remover active de todos los badges de rol
        document.querySelectorAll('.filter-badge[data-rol]').forEach(badge => {
            badge.classList.remove('active');
        });
        
        // Activar el badge seleccionado
        const badgeSeleccionado = document.querySelector(`.filter-badge[data-rol="${rol}"]`);
        if (badgeSeleccionado) {
            badgeSeleccionado.classList.add('active');
        }
        
        this.filtrosActuales.rol = rol;
        this.aplicarFiltros();
    }

    aplicarFiltroActivo(activo) {
        console.log('Aplicando filtro activo:', activo);
        
        document.querySelectorAll('.filter-badge[data-activo]').forEach(badge => {
            badge.classList.remove('active');
        });
        
        const badgeSeleccionado = document.querySelector(`.filter-badge[data-activo="${activo}"]`);
        if (badgeSeleccionado) {
            badgeSeleccionado.classList.add('active');
        }
        
        this.filtrosActuales.activo = activo;
        this.aplicarFiltros();
    }

    aplicarFiltros() {
        console.log('Aplicando filtros:', this.filtrosActuales);
        this.cargarUsuariosConFiltros(this.filtrosActuales);
    }

    getAuthHeaders() {
        // Usar UserAuthPersonal para obtener headers
        return UserAuthPersonal.getAuthHeaders();
    }

    async cargarUsuariosConFiltros(filtros = {}) {
        try {
            console.log('Cargando usuarios con filtros:', filtros);
            
            const params = new URLSearchParams();
            if (filtros.query) params.append('query', filtros.query);
            if (filtros.rol) params.append('rol', filtros.rol);
            if (filtros.activo !== undefined) params.append('activo', filtros.activo);

            const response = await fetch(`https://sistema-autobuses.onrender.com/api/usuarios_personal/buscar/?${params}`, {
                headers: this.getAuthHeaders()
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                this.actualizarTablaUsuarios(data.usuarios);
            } else {
                throw new Error(data.mensaje || 'Error al cargar usuarios');
            }
        } catch (error) {
            console.error('Error al cargar usuarios:', error);
            this.mostrarNotificacion('Error al cargar usuarios: ' + error.message, 'error');
        }
    }

    actualizarTablaUsuarios(usuarios) {
        const tbody = document.querySelector('#tabla-usuarios tbody');
        if (!tbody) {
            console.error('No se encontró la tabla con id #tabla-usuarios');
            return;
        }
        
        tbody.innerHTML = '';

        if (usuarios.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center py-4">
                        <i class="bi bi-search display-4 text-muted d-block mb-2"></i>
                        <p class="text-muted">No se encontraron usuarios</p>
                    </td>
                </tr>
            `;
            return;
        }

        // Verificar permisos de administrador
        const isAdmin = UserAuthPersonal.isAdmin();

        usuarios.forEach(usuario => {
            const row = document.createElement('tr');
            
            const fecha = new Date(usuario.fecha_creacion).toLocaleDateString('es-ES', {
                day: 'numeric',
                month: 'short',
                year: 'numeric'
            });

            const badgeClass = usuario.rol === 'administrador' ? 'badge-rol-administrador' : 'badge-rol-chofer';
            const icono = usuario.rol === 'administrador' ? 'bi-person-gear' : 'bi-person-workspace';
            
            row.innerHTML = `
                <td>${usuario.id_personal}</td>
                <td>${usuario.nombre}</td>
                <td>${usuario.email}</td>
                <td>
                    <span class="${badgeClass}">
                        <i class="bi ${icono}"></i>${usuario.rol}
                    </span>
                </td>
                <td>${usuario.turno}</td>
                <td>
                    <span class="badge ${usuario.activo ? 'bg-success' : 'bg-secondary'}">
                        ${usuario.activo ? 'Activo' : 'Inactivo'}
                    </span>
                </td>
                <td>${fecha}</td>
                <td>
                    <div class="btn-group" role="group">
                        ${isAdmin ? `
                        <button class="btn btn-editar btn-sm me-1" onclick="gestorUsuarios.mostrarModalEditarUsuario('${usuario._id}')" title="Editar usuario">
                            <i class="bi bi-pencil"></i>
                        </button>
                        <button class="btn ${usuario.activo ? 'btn-warning' : 'btn-success'} btn-sm btn-estado me-1" 
                                onclick="gestorUsuarios.cambiarEstadoUsuario('${usuario._id}', ${!usuario.activo})"
                                title="${usuario.activo ? 'Desactivar' : 'Activar'} usuario">
                            <i class="bi ${usuario.activo ? 'bi-pause' : 'bi-play'}"></i>
                        </button>
                        <button class="btn btn-danger btn-sm" 
                                onclick="gestorUsuarios.eliminarUsuario('${usuario._id}', '${usuario.nombre.replace(/'/g, "\\'")}')"
                                title="Eliminar usuario">
                            <i class="bi bi-trash"></i>
                        </button>
                        ` : `
                        <span class="text-muted small">Solo administradores</span>
                        `}
                    </div>
                </td>
            `;
            
            tbody.appendChild(row);
        });
    }

    async eliminarUsuario(usuarioId, usuarioNombre) {
        if (!UserAuthPersonal.checkAdminPermissions()) return;

        if (!confirm(`¿Estás seguro de que quieres eliminar al usuario "${usuarioNombre}"?\n\n⚠️ Esta acción no se puede deshacer.`)) {
            return;
        }

        try {
            const response = await fetch(`https://sistema-autobuses.onrender.com/api/usuarios_personal/${usuarioId}`, {
                method: 'DELETE',
                headers: this.getAuthHeaders()
            });

            const data = await response.json();

            if (data.success) {
                this.mostrarNotificacion(`Usuario "${usuarioNombre}" eliminado correctamente`, 'success');
                await this.cargarUsuariosConFiltros(this.filtrosActuales);
            } else {
                throw new Error(data.mensaje || 'Error al eliminar usuario');
            }
        } catch (error) {
            console.error('Error al eliminar usuario:', error);
            this.mostrarNotificacion('Error al eliminar usuario: ' + error.message, 'error');
        }
    }

    mostrarModalNuevoUsuario() {
        if (!UserAuthPersonal.checkAdminPermissions()) return;

        // Prevenir múltiples modales abiertos
        const modalExistente = document.getElementById('modalNuevoUsuario');
        if (modalExistente) {
            const bsModal = bootstrap.Modal.getInstance(modalExistente);
            if (bsModal) {
                bsModal.show();
            }
            return;
        }

        console.log('Mostrando modal nuevo usuario');
        
        const modalHTML = `
            <div class="modal fade modal-perfil" id="modalNuevoUsuario" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">
                                <i class="bi bi-person-plus me-2"></i>Nuevo Usuario
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <form id="formNuevoUsuario">
                                <div class="mb-3">
                                    <label for="nuevoNombre" class="form-label">Nombre</label>
                                    <input type="text" class="form-control" id="nuevoNombre" required>
                                </div>
                                <div class="mb-3">
                                    <label for="nuevoEmail" class="form-label">Email</label>
                                    <input type="email" class="form-control" id="nuevoEmail" 
                                           placeholder="Dejar vacío para generar automáticamente" readonly>
                                    <div class="form-text">Se generará automáticamente con el formato: nombreID@tucsa.com</div>
                                </div>
                                <div class="mb-3">
                                    <label for="nuevoRol" class="form-label">Rol</label>
                                    <select class="form-select" id="nuevoRol" required>
                                        <option value="">Seleccionar rol</option>
                                        <option value="administrador">Administrador</option>
                                        <option value="chofer">Chofer</option>
                                    </select>
                                </div>
                                <div class="mb-3">
                                    <label for="nuevoTurno" class="form-label">Turno</label>
                                    <select class="form-select" id="nuevoTurno" required>
                                        <option value="">Seleccionar turno</option>
                                        <option value="matutino">Matutino</option>
                                        <option value="vespertino">Vespertino</option>
                                    </select>
                                </div>
                                <div class="mb-3">
                                    <label for="nuevoPassword" class="form-label">Contraseña</label>
                                    <input type="text" class="form-control" id="nuevoPassword" readonly>
                                    <div class="form-text">Contraseña generada automáticamente</div>
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                            <button type="button" class="btn btn-guardar-cambios" id="btnCrearUsuario">
                                <i class="bi bi-check-lg me-1"></i>Crear Usuario
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        const modalElement = document.getElementById('modalNuevoUsuario');
        const modal = new bootstrap.Modal(modalElement);
        
        // Configurar eventos del modal
        this.configurarModalNuevoUsuario();
        
        // Remover el modal cuando se cierre
        modalElement.addEventListener('hidden.bs.modal', () => {
            setTimeout(() => {
                if (modalElement && modalElement.parentNode) {
                    modalElement.remove();
                }
            }, 300);
        });
        
        modal.show();
    }

    configurarModalNuevoUsuario() {
        const modal = document.getElementById('modalNuevoUsuario');
        if (!modal) return;

        // Generar contraseña automática
        this.generarPasswordSegura();

        // Botón crear usuario - prevenir múltiples event listeners
        const btnCrear = modal.querySelector('#btnCrearUsuario');
        if (btnCrear) {
            // Remover event listeners anteriores
            const newBtn = btnCrear.cloneNode(true);
            btnCrear.parentNode.replaceChild(newBtn, btnCrear);
            
            newBtn.addEventListener('click', () => {
                this.crearNuevoUsuario();
            });
        }
    }

    generarPasswordSegura() {
        const passwordInput = document.getElementById('nuevoPassword');
        if (!passwordInput) return;

        const caracteres = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
        let password = '';
        
        password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)];
        password += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)];
        password += '0123456789'[Math.floor(Math.random() * 10)];
        password += '!@#$%^&*'[Math.floor(Math.random() * 8)];
        
        for (let i = 0; i < 4; i++) {
            password += caracteres[Math.floor(Math.random() * caracteres.length)];
        }
        
        password = password.split('').sort(() => 0.5 - Math.random()).join('');
        passwordInput.value = password;
    }

    async crearNuevoUsuario() {
        if (!UserAuthPersonal.checkAdminPermissions()) return;

        const modal = document.getElementById('modalNuevoUsuario');
        if (!modal) return;

        const nombre = modal.querySelector('#nuevoNombre').value;
        const rol = modal.querySelector('#nuevoRol').value;
        const turno = modal.querySelector('#nuevoTurno').value;
        const password = modal.querySelector('#nuevoPassword').value;

        // Validaciones
        if (!nombre || !rol || !turno) {
            this.mostrarNotificacion('Por favor complete todos los campos obligatorios', 'error');
            return;
        }

        if (!password || password.length < 6) {
            this.mostrarNotificacion('La contraseña debe tener al menos 6 caracteres', 'error');
            return;
        }

        try {
            // Enviar null para que el backend genere el email automáticamente con el ID
            const usuarioData = {
                nombre: nombre,
                email: null, // El backend generará el email con el formato nombreID@tucsa.com
                rol: rol,
                turno: turno,
                password: password
            };

            console.log('Enviando datos:', usuarioData);

            const response = await fetch(`https://sistema-autobuses.onrender.com/api/usuarios_personal/`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify(usuarioData)
            });

            const result = await response.json();

            if (response.ok && result.success) {
                this.mostrarNotificacion('Usuario creado exitosamente', 'success');
                
                const bsModal = bootstrap.Modal.getInstance(modal);
                if (bsModal) {
                    bsModal.hide();
                }
                
                // Esperar a que el modal se cierre completamente
                setTimeout(() => {
                    modal.remove();
                    this.cargarUsuariosConFiltros(this.filtrosActuales);
                }, 300);
            } else {
                throw new Error(result.mensaje || 'Error al crear usuario');
            }
        } catch (error) {
            console.error('Error creando usuario:', error);
            this.mostrarNotificacion('Error al crear usuario: ' + error.message, 'error');
        }
    }

    async mostrarModalEditarUsuario(usuarioId) {
        if (!UserAuthPersonal.checkAdminPermissions()) return;

        try {
            const response = await fetch(`https://sistema-autobuses.onrender.com/api/usuarios_personal/${usuarioId}`, {
                headers: this.getAuthHeaders()
            });
            const data = await response.json();
            
            if (data.success) {
                this.mostrarModalEdicionUsuario(data.usuario);
            } else {
                throw new Error('Error al cargar datos del usuario');
            }
        } catch (error) {
            console.error('Error cargando usuario:', error);
            this.mostrarNotificacion('Error al cargar los datos del usuario', 'error');
        }
    }

    mostrarModalEdicionUsuario(usuario) {
        const modalExistente = document.getElementById('modalEditarUsuario');
        if (modalExistente) {
            modalExistente.remove();
        }

        const modalHTML = `
            <div class="modal fade modal-perfil" id="modalEditarUsuario" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">
                                <i class="bi bi-pencil-square me-2"></i>Editar Usuario
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <form id="formEditarUsuario">
                                <div class="mb-3">
                                    <label class="form-label">ID Personal</label>
                                    <input type="text" class="form-control" value="${usuario.id_personal}" readonly>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Email</label>
                                    <input type="text" class="form-control" value="${usuario.email}" readonly>
                                </div>
                                <div class="mb-3">
                                    <label for="editUsuarioNombre" class="form-label">Nombre</label>
                                    <input type="text" class="form-control" id="editUsuarioNombre" 
                                           value="${usuario.nombre}" required>
                                </div>
                                <div class="mb-3">
                                    <label for="editUsuarioTurno" class="form-label">Turno</label>
                                    <select class="form-select" id="editUsuarioTurno" required>
                                        <option value="matutino" ${usuario.turno === 'matutino' ? 'selected' : ''}>Matutino</option>
                                        <option value="vespertino" ${usuario.turno === 'vespertino' ? 'selected' : ''}>Vespertino</option>
                                    </select>
                                </div>
                                <div class="mb-3">
                                    <label for="editUsuarioPassword" class="form-label">Nueva Contraseña</label>
                                    <input type="password" class="form-control" id="editUsuarioPassword" 
                                           placeholder="Dejar vacío para no cambiar">
                                    <div class="form-text">Mínimo 6 caracteres</div>
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                            <button type="button" class="btn btn-guardar-cambios" onclick="gestorUsuarios.guardarCambiosUsuario('${usuario._id}')">
                                <i class="bi bi-check-lg me-1"></i>Guardar Cambios
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        const modal = new bootstrap.Modal(document.getElementById('modalEditarUsuario'));
        modal.show();
    }

    async guardarCambiosUsuario(usuarioId) {
        if (!UserAuthPersonal.checkAdminPermissions()) return;

        const nombre = document.getElementById('editUsuarioNombre').value;
        const turno = document.getElementById('editUsuarioTurno').value;
        const password = document.getElementById('editUsuarioPassword').value;

        if (password && password.length < 6) {
            this.mostrarNotificacion('La contraseña debe tener al menos 6 caracteres', 'error');
            return;
        }

        try {
            const updateData = {
                nombre: nombre,
                turno: turno
            };

            if (password) {
                updateData.password = password;
            }

            const response = await fetch(`https://sistema-autobuses.onrender.com/api/usuarios_personal/${usuarioId}/editar`, {
                method: 'PUT',
                headers: this.getAuthHeaders(),
                body: JSON.stringify(updateData)
            });

            const data = await response.json();

            if (data.success) {
                this.mostrarNotificacion('Usuario actualizado correctamente', 'success');
                
                const modal = bootstrap.Modal.getInstance(document.getElementById('modalEditarUsuario'));
                if (modal) {
                    modal.hide();
                }
                
                await this.cargarUsuariosConFiltros(this.filtrosActuales);
            } else {
                throw new Error(data.mensaje);
            }
        } catch (error) {
            console.error('Error guardando cambios:', error);
            this.mostrarNotificacion('Error al guardar cambios: ' + error.message, 'error');
        }
    }

    async cambiarEstadoUsuario(usuarioId, nuevoEstado) {
        if (!UserAuthPersonal.checkAdminPermissions()) return;

        if (!confirm(`¿Estás seguro de que quieres ${nuevoEstado ? 'activar' : 'desactivar'} este usuario?`)) {
            return;
        }

        try {
            const response = await fetch(`https://sistema-autobuses.onrender.com/api/usuarios_personal/${usuarioId}/estado`, {
                method: 'PUT',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({ activo: nuevoEstado })
            });

            const data = await response.json();
            
            if (data.success) {
                this.mostrarNotificacion(data.mensaje, 'success');
                await this.cargarUsuariosConFiltros(this.filtrosActuales);
            } else {
                throw new Error(data.mensaje);
            }
        } catch (error) {
            console.error('Error al cambiar estado:', error);
            this.mostrarNotificacion(error.message, 'error');
        }
    }

    mostrarModalEditarPerfil() {
        // Implementación del modal de edición de perfil
        this.mostrarNotificacion('Funcionalidad de edición de perfil - Por implementar', 'info');
    }

    logout() {
        UserAuthPersonal.logout();
    }

    mostrarNotificacion(mensaje, tipo) {
        // Usar UserAuthPersonal para mostrar notificaciones
        UserAuthPersonal.showNotification(mensaje, tipo);
    }
}

// Instancia global e inicialización
const gestorUsuarios = new GestorUsuarios();

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    gestorUsuarios.initialize();
});