// Ya no necesitamos estas variables globales porque las maneja UserAuthPersonal
// const API_BASE_URL = `https://sistema-autobuses.onrender.com/api`;
// let currentUser = null;
const API_BASE_URL = `https://sistema-autobuses.onrender.com/api`;
let unidades = [];

document.addEventListener('DOMContentLoaded', function() {
    const modalAgregarUnidad = new bootstrap.Modal(document.getElementById('modalAgregarUnidad'));
    const modalEditarUnidad = new bootstrap.Modal(document.getElementById('modalEditarUnidad'));
    const toastNotificacion = new bootstrap.Toast(document.getElementById('toastNotificacion'));

    // Inicializar la aplicación
    initializeApp();

     // Inicializar NotificationManager
    NotificationManager.initialize((notifications) => {
        console.log('Notificaciones actualizadas:', notifications);
        // Actualizar tu UI aquí
        NotificationManager.updateNotificationBadge();
        NotificationManager.updateNotificationsDropdown();
    });

    // Cargar notificaciones
    
    
    // Iniciar actualización automática
    

    async function initializeApp() {
        // Usar UserAuthPersonal para verificar permisos
        const hasAccess = await UserAuthPersonal.checkPagePermissions('administrador');
        if (!hasAccess) return;
        
        inicializarEventos();
        await cargarUnidades();
        await NotificationManager.loadNotifications();
        // Actualizar UI con información del usuario
        UserAuthPersonal.updateUserInterface();
        UserAuthPersonal.adjustUIForRole();
        NotificationManager.startAutoRefresh();
    }

    // Ya no necesitamos loadUserData porque UserAuthPersonal lo maneja

    // Ya no necesitamos updateUserInterface porque UserAuthPersonal lo maneja

    // Ya no necesitamos adjustUIForRole porque UserAuthPersonal lo maneja

    function showError(message) {
        // Usar UserAuthPersonal para mostrar errores
        UserAuthPersonal.showNotification(message, 'error');
    }

    function getAuthHeaders() {
        // Usar UserAuthPersonal para obtener headers
        return UserAuthPersonal.getAuthHeaders();
    }

    function verificarPermisosAdministrador() {
        // Usar UserAuthPersonal para verificar permisos
        return UserAuthPersonal.checkAdminPermissions();
    }

    function inicializarEventos() {
        // Eventos para modal de agregar
        document.getElementById('placasUnidad').addEventListener('input', actualizarResumen);
        document.getElementById('capacidadUnidad').addEventListener('input', actualizarResumen);
        document.querySelectorAll('input[name="estadoUnidad"]').forEach(radio => {
            radio.addEventListener('change', actualizarResumen);
        });

        document.getElementById('placasUnidad').addEventListener('blur', function() {
            this.value = formatearPlacas(this.value);
            actualizarResumen();
        });

        document.getElementById('btnGuardarUnidad').addEventListener('click', function() {
            if (!verificarPermisosAdministrador()) return;
            guardarUnidad();
        });

        // Eventos para modal de editar
        document.getElementById('btnActualizarUnidad').addEventListener('click', function() {
            if (!verificarPermisosAdministrador()) return;
            actualizarUnidad();
        });

        // Búsqueda
        document.getElementById('buscarUnidad').addEventListener('input', function() {
            filtrarUnidades(this.value);
        });

        // Botón agregar unidad
        const btnAgregar = document.querySelector('.btn-admin-primary');
        if (btnAgregar) {
            btnAgregar.addEventListener('click', function() {
                if (!verificarPermisosAdministrador()) {
                    mostrarNotificacion('Solo los administradores pueden agregar unidades', 'error');
                    return;
                }
                limpiarFormularioAgregar();
            });
        }
    }

    function formatearPlacas(placas) {
        if (!placas) return '';
        placas = placas.replace(/\s/g, '').toUpperCase();
        if (placas.length > 3 && !placas.includes('-')) {
            placas = placas.slice(0, 3) + '-' + placas.slice(3);
        }
        return placas;
    }

    function actualizarResumen() {
        const placas = document.getElementById('placasUnidad').value || '-';
        const capacidad = document.getElementById('capacidadUnidad').value || '-';
        const estado = document.querySelector('input[name="estadoUnidad"]:checked').value;
        
        document.getElementById('resumenPlacas').textContent = placas;
        document.getElementById('resumenCapacidad').textContent = capacidad;
        
        let estadoTexto = '';
        switch(estado) {
            case 'activo': estadoTexto = 'Activa'; break;
            case 'mantenimiento': estadoTexto = 'En Mantenimiento'; break;
        }
        document.getElementById('resumenEstado').textContent = estadoTexto;
    }

    function limpiarFormularioAgregar() {
        document.getElementById('formAgregarUnidad').reset();
        document.getElementById('estadoActivo').checked = true;
        document.getElementById('modeloUnidad').value = '';
        actualizarResumen();
    }

    async function guardarUnidad() {
        if (!validarFormularioUnidad()) return;

        const unidad = {
            placas: document.getElementById('placasUnidad').value,
            capacidad: parseInt(document.getElementById('capacidadUnidad').value),
            modelo: document.getElementById('modeloUnidad').value || null,
            estado: document.querySelector('input[name="estadoUnidad"]:checked').value
        };

        try {
            const response = await fetch(`${API_BASE_URL}/unidades/`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(unidad)
            });

            const data = await response.json();

            if (response.ok && data.success) {
                mostrarNotificacion(data.mensaje, 'success');
                modalAgregarUnidad.hide();
                limpiarFormularioAgregar();
                await cargarUnidades();
            } else {
                throw new Error(data.mensaje || 'Error al crear unidad');
            }

        } catch (error) {
            console.error('Error al guardar unidad:', error);
            mostrarNotificacion(error.message, 'error');
        }
    }

    function abrirModalEditar(idUnidad) {
        if (!verificarPermisosAdministrador()) return;

        const unidad = unidades.find(u => u._id === idUnidad);
        if (!unidad) return;

        // Llenar formulario con datos actuales
        document.getElementById('editIdUnidad').value = unidad._id;
        document.getElementById('editInfoId').textContent = unidad.id_unidad;
        document.getElementById('editInfoModelo').textContent = unidad.modelo || 'No especificado';
        document.getElementById('editInfoEstado').textContent = obtenerTextoEstado(unidad.estado);
        
        document.getElementById('editPlacasUnidad').value = unidad.placas;
        document.getElementById('editCapacidadUnidad').value = unidad.capacidad;

        // Definir estados permitidos
        const estadosPermitidos = ['activo', 'mantenimiento', 'inactivo'];
        const estadoActual = unidad.estado;
        
        // Verificar si el estado actual está permitido
        const estadoPermitido = estadosPermitidos.includes(estadoActual);

        // Obtener el contenedor de la sección de estado
        const estadoSection = document.querySelector('#formEditarUnidad .mb-3:last-child');
        
        if (!estadoPermitido) {
            // Ocultar completamente la sección de estado
            estadoSection.style.display = 'none';
            
            // Agregar mensaje informativo en la sección de información
            const infoSection = document.querySelector('#formEditarUnidad .alert-info');
            let infoMessage = infoSection.querySelector('.estado-info-message');
            
            if (!infoMessage) {
                infoMessage = document.createElement('div');
                infoMessage.className = 'estado-info-message alert alert-warning mt-2 small';
                infoMessage.innerHTML = `
                    <i class="fa-solid fa-triangle-exclamation me-2"></i>
                    <strong>Estado actual:</strong> ${obtenerTextoEstado(estadoActual)}<br>
                    <small>El estado de esta unidad no puede ser modificado desde esta interfaz.</small>
                `;
                infoSection.appendChild(infoMessage);
            }
        } else {
            // Mostrar la sección de estado y permitir edición
            estadoSection.style.display = 'block';
            
            // Seleccionar estado actual
            document.querySelectorAll('input[name="editEstadoUnidad"]').forEach(radio => {
                radio.checked = radio.value === estadoActual;
                radio.disabled = false;
                radio.parentElement.classList.remove('text-muted');
            });
            
            // Remover mensaje informativo si existe
            const infoMessage = document.querySelector('.estado-info-message');
            if (infoMessage) {
                infoMessage.remove();
            }
        }

        modalEditarUnidad.show();
    }

    async function actualizarUnidad() {
        const idUnidad = document.getElementById('editIdUnidad').value;
        const placas = document.getElementById('editPlacasUnidad').value.trim();
        const capacidad = document.getElementById('editCapacidadUnidad').value;
        const estado = document.querySelector('input[name="editEstadoUnidad"]:checked').value;

        if (!validarUnidad(placas, capacidad)) return;

        try {
            const response = await fetch(`${API_BASE_URL}/unidades/${idUnidad}`, {
                method: 'PUT',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    placas: placas,
                    capacidad: parseInt(capacidad),
                    estado: estado
                })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                mostrarNotificacion(data.mensaje, 'success');
                modalEditarUnidad.hide();
                await cargarUnidades();
            } else {
                throw new Error(data.mensaje || 'Error al actualizar unidad');
            }

        } catch (error) {
            console.error('Error al actualizar unidad:', error);
            mostrarNotificacion(error.message, 'error');
        }
    }

    async function eliminarUnidad(idUnidad) {
        if (!verificarPermisosAdministrador()) return;

        if (!confirm('¿Estás seguro de que deseas eliminar esta unidad?')) {
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/unidades/${idUnidad}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });

            const data = await response.json();

            if (response.ok && data.success) {
                mostrarNotificacion(data.mensaje, 'success');
                await cargarUnidades();
            } else {
                throw new Error(data.mensaje || 'Error al eliminar unidad');
            }

        } catch (error) {
            console.error('Error al eliminar unidad:', error);
            mostrarNotificacion(error.message, 'error');
        }
    }

    function validarFormularioUnidad() {
        const placas = document.getElementById('placasUnidad').value.trim();
        const capacidad = document.getElementById('capacidadUnidad').value;

        if (!placas) {
            mostrarNotificacion('Las placas son requeridas', 'error');
            document.getElementById('placasUnidad').focus();
            return false;
        }

        if (!capacidad) {
            mostrarNotificacion('La capacidad es requerida', 'error');
            document.getElementById('capacidadUnidad').focus();
            return false;
        }

        const formatoPlacas = /^[A-Z]{3}-?\d{3,4}$/;
        if (!formatoPlacas.test(placas)) {
            mostrarNotificacion('Formato de placas inválido. Use: AAA-123 o ABC123', 'error');
            document.getElementById('placasUnidad').focus();
            return false;
        }

        return true;
    }

    function validarUnidad(placas, capacidad) {
        if (!placas) {
            mostrarNotificacion('Las placas son requeridas', 'error');
            return false;
        }

        if (!capacidad) {
            mostrarNotificacion('La capacidad es requerida', 'error');
            return false;
        }

        const formatoPlacas = /^[A-Z]{3}-?\d{3,4}$/;
        if (!formatoPlacas.test(placas)) {
            mostrarNotificacion('Formato de placas inválido. Use: AAA-123 o ABC123', 'error');
            return false;
        }

        return true;
    }

    async function cargarUnidades() {
        try {
            const response = await fetch(`${API_BASE_URL}/unidades/`, {
                headers: getAuthHeaders()
            });
            const data = await response.json();

            if (data.success) {
                unidades = data.unidades;
                actualizarTablaUnidades();
            } else {
                throw new Error('Error al cargar unidades');
            }

        } catch (error) {
            console.error('Error al cargar unidades:', error);
            mostrarNotificacion('Error al cargar las unidades', 'error');
        }
    }

    function actualizarTablaUnidades() {
        const tbody = document.getElementById('tablaUnidades');
        tbody.innerHTML = '';

        if (unidades.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center py-4 text-muted">
                        <i class="fa-solid fa-bus-simple fa-2x mb-3 d-block"></i>
                        No hay unidades registradas
                    </td>
                </tr>
            `;
            return;
        }

        // Obtener el usuario actual desde UserAuthPersonal
        const currentUser = UserAuthPersonal.getCurrentUser();
        const isAdmin = UserAuthPersonal.isAdmin();

        unidades.forEach((unidad, index) => {
            const tr = document.createElement('tr');
            const iniciales = unidad.id_unidad.substring(0, 3);
            const claseEstado = `estado-${unidad.estado}`;
            const textoEstado = obtenerTextoEstado(unidad.estado);

            tr.innerHTML = `
                <td>
                    <div class="user-avatar-cell">
                        <div class="unidad-avatar-img bg-bus-primary">${iniciales}</div>
                        <div class="user-info-text">
                            <h6>${unidad.id_unidad}</h6>
                            <small>ID: UNI-${(index + 1).toString().padStart(3, '0')}</small>
                        </div>
                    </div>
                </td>
                <td><strong>${unidad.placas}</strong></td>
                <td><span class="capacidad-badge">${unidad.capacidad} pasajeros</span></td>
                <td>${unidad.modelo || 'No especificado'}</td>
                <td><span class="badge badge-estado ${claseEstado}">${textoEstado}</span></td>
                <td class="text-end">
                    ${isAdmin ? `
                    <button class="btn btn-sm btn-light border btn-editar-unidad" data-id="${unidad._id}">
                        <i class="bi bi-pencil-fill"></i>
                    </button>
                    <button class="btn btn-sm btn-light border text-danger btn-eliminar-unidad" data-id="${unidad._id}">
                        <i class="bi bi-trash-fill"></i>
                    </button>
                    ` : `
                    <span class="text-muted small">Solo administradores</span>
                    `}
                </td>
            `;
            tbody.appendChild(tr);
        });

        // Re-asignar eventos solo si es administrador
        if (isAdmin) {
            document.querySelectorAll('.btn-editar-unidad').forEach(btn => {
                btn.addEventListener('click', function() {
                    const idUnidad = this.getAttribute('data-id');
                    abrirModalEditar(idUnidad);
                });
            });

            document.querySelectorAll('.btn-eliminar-unidad').forEach(btn => {
                btn.addEventListener('click', function() {
                    const idUnidad = this.getAttribute('data-id');
                    eliminarUnidad(idUnidad);
                });
            });
        }
    }

    function filtrarUnidades(termino) {
        const unidadesFiltradas = unidades.filter(unidad => 
            unidad.placas.toLowerCase().includes(termino.toLowerCase()) ||
            (unidad.modelo && unidad.modelo.toLowerCase().includes(termino.toLowerCase())) ||
            unidad.id_unidad.toLowerCase().includes(termino.toLowerCase())
        );

        const tbody = document.getElementById('tablaUnidades');
        tbody.innerHTML = '';

        if (unidadesFiltradas.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center py-4 text-muted">
                        No se encontraron unidades que coincidan con la búsqueda
                    </td>
                </tr>
            `;
            return;
        }

        // Obtener el usuario actual desde UserAuthPersonal
        const currentUser = UserAuthPersonal.getCurrentUser();
        const isAdmin = UserAuthPersonal.isAdmin();

        unidadesFiltradas.forEach((unidad, index) => {
            const tr = document.createElement('tr');
            const iniciales = unidad.id_unidad.substring(0, 3);
            const claseEstado = `estado-${unidad.estado}`;
            const textoEstado = obtenerTextoEstado(unidad.estado);

            tr.innerHTML = `
                <td>
                    <div class="user-avatar-cell">
                        <div class="unidad-avatar-img bg-bus-primary">${iniciales}</div>
                        <div class="user-info-text">
                            <h6>${unidad.id_unidad}</h6>
                            <small>ID: UNI-${(index + 1).toString().padStart(3, '0')}</small>
                        </div>
                    </div>
                </td>
                <td><strong>${unidad.placas}</strong></td>
                <td><span class="capacidad-badge">${unidad.capacidad} pasajeros</span></td>
                <td>${unidad.modelo || 'No especificado'}</td>
                <td><span class="badge badge-estado ${claseEstado}">${textoEstado}</span></td>
                <td class="text-end">
                    ${isAdmin ? `
                    <button class="btn btn-sm btn-light border btn-editar-unidad" data-id="${unidad._id}">
                        <i class="bi bi-pencil-fill"></i>
                    </button>
                    <button class="btn btn-sm btn-light border text-danger btn-eliminar-unidad" data-id="${unidad._id}">
                        <i class="bi bi-trash-fill"></i>
                    </button>
                    ` : `
                    <span class="text-muted small">Solo administradores</span>
                    `}
                </td>
            `;
            tbody.appendChild(tr);
        });

        // Re-asignar eventos solo si es administrador
        if (isAdmin) {
            document.querySelectorAll('.btn-editar-unidad').forEach(btn => {
                btn.addEventListener('click', function() {
                    const idUnidad = this.getAttribute('data-id');
                    abrirModalEditar(idUnidad);
                });
            });

            document.querySelectorAll('.btn-eliminar-unidad').forEach(btn => {
                btn.addEventListener('click', function() {
                    const idUnidad = this.getAttribute('data-id');
                    eliminarUnidad(idUnidad);
                });
            });
        }
    }

    function obtenerTextoEstado(estado) {
        switch(estado) {
            case 'activo': return 'Activa';
            case 'mantenimiento': return 'Mantenimiento';
            case 'inactivo': return 'Inactiva';
            default: return estado;
        }
    }

    function mostrarNotificacion(mensaje, tipo) {
        // Usar UserAuthPersonal para mostrar notificaciones
        UserAuthPersonal.showNotification(mensaje, tipo);
    }

    // Función para cerrar sesión - usar UserAuthPersonal
    window.logout = function() {
        UserAuthPersonal.logout();
    };

    // Inicializar resumen
    actualizarResumen();
});