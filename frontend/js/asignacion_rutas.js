document.addEventListener('DOMContentLoaded', function() {
    let asignacionesPendientes = {};

    // Inicializar la aplicación
    initializeApp();

    async function initializeApp() {
        // Usar UserAuthPersonal para verificar permisos
        const hasAccess = await UserAuthPersonal.checkPagePermissions('administrador');
        if (!hasAccess) return;
        
        // ✅ CORREGIDO: Inicializar NotificationManager ANTES de cargar notificaciones
        const usuario = UserAuthPersonal.getCurrentUser();
        if (usuario) {
            NotificationManager.initialize(
                (notifications) => {
                    // Callback cuando se actualizan las notificaciones
                    console.log('Notificaciones actualizadas:', notifications.length);
                },
                'personal', 
                usuario.id_personal
            );
        }
        
        inicializarDragAndDrop();
        await cargarDatosTablero();
        
        // ✅ CORREGIDO: Cargar notificaciones después de inicializar
        await NotificationManager.loadNotifications();
        
        // ✅ CORREGIDO: Actualizar la UI de notificaciones
        NotificationManager.updateNotificationBadge();
        NotificationManager.updateNotificationsDropdown();
        
        // Actualizar UI con información del usuario
        UserAuthPersonal.updateUserInterface();
        UserAuthPersonal.adjustUIForRole();
        
        // ✅ CORREGIDO: Configurar intervalo de actualización
        NotificationManager.startAutoRefresh(3000); // 3 segundos

        // Configurar botón de guardar
        document.querySelector('.btn-admin-primary').addEventListener('click', guardarAsignaciones);
        
        // ✅ AGREGADO: Configurar evento para el dropdown de notificaciones
        configurarEventosNotificaciones();
    }
    // ✅ AGREGADO: Configurar eventos para el dropdown de notificaciones
    function configurarEventosNotificaciones() {
        // Asegurarse de que el dropdown de notificaciones funcione
        const notificationDropdown = document.querySelector('.notification-menu');
        if (notificationDropdown) {
            // Actualizar dropdown cuando se abra
            notificationDropdown.addEventListener('show.bs.dropdown', function() {
                NotificationManager.updateNotificationsDropdown();
            });
        }
    }


    function inicializarDragAndDrop() {
        // Los eventos de drag and drop se inicializan en crearSlotVacio
        document.addEventListener('dragstart', handleDragStart);
    }

    function handleDragStart(e) {
        if (e.target.classList.contains('resource-card')) {
            const tipo = e.target.classList.contains('card-type-driver') ? 'chofer' : 'unidad';
            const id = e.target.getAttribute(`data-${tipo}-id`);
            const nombre = e.target.querySelector('.resource-name').textContent;
            
            e.dataTransfer.setData('application/json', JSON.stringify({
                tipo: tipo,
                id: id,
                nombre: nombre
            }));
            
            e.target.classList.add('dragging');
        }
    }

    function handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    }

    function handleDragEnter(e) {
        e.preventDefault();
        if (e.target.classList.contains('drop-zone-box')) {
            e.target.classList.add('drop-zone-hover');
        }
    }

    function handleDragLeave(e) {
        if (e.target.classList.contains('drop-zone-box')) {
            e.target.classList.remove('drop-zone-hover');
        }
    }

    function handleDrop(e) {
        e.preventDefault();
        e.target.classList.remove('drop-zone-hover');
        
        const dropZone = e.target.classList.contains('drop-zone-box') ? 
            e.target : e.target.closest('.drop-zone-box');
        
        if (!dropZone) return;
        
        try {
            const data = JSON.parse(e.dataTransfer.getData('application/json'));
            const ruta = dropZone.getAttribute('data-ruta');
            const tipo = dropZone.classList.contains('chofer-drop-zone') ? 'chofer' : 'unidad';
            
            // Validar que sea el tipo correcto
            if (data.tipo !== tipo) {
                mostrarNotificacion(`Solo puedes soltar un ${tipo === 'chofer' ? 'chofer' : 'unidad'} aquí`, 'error');
                return;
            }
            
            // Actualizar la interfaz
            actualizarDropZone(dropZone, data);
            
            // Guardar en asignaciones pendientes
            if (!asignacionesPendientes[ruta]) {
                asignacionesPendientes[ruta] = {};
            }
            asignacionesPendientes[ruta][tipo] = {
                id: data.id,
                nombre: data.nombre
            };
            
            console.log('Asignaciones pendientes:', asignacionesPendientes);
            
            // Remover clase dragging del elemento original
            document.querySelectorAll('.resource-card').forEach(card => {
                card.classList.remove('dragging');
            });
            
        } catch (error) {
            console.error('Error en drop:', error);
            mostrarNotificacion('Error al asignar recurso', 'error');
        }
    }

    function actualizarDropZone(dropZone, data) {
        const assignedElement = dropZone.querySelector('.assigned-driver, .assigned-unit');
        
        if (assignedElement) {
            assignedElement.innerHTML = `
                <div class="assigned-resource">
                    <strong>${data.nombre}</strong>
                    <button class="btn btn-sm btn-outline-danger ms-2 remove-assignment" 
                            data-tipo="${data.tipo}" 
                            data-ruta="${dropZone.getAttribute('data-ruta')}">
                        <i class="bi bi-x"></i>
                    </button>
                </div>
            `;
            
            // Ocultar icono y texto por defecto
            dropZone.querySelector('i').style.display = 'none';
            dropZone.querySelector('p').style.display = 'none';
            
            // Agregar evento al botón de eliminar
            assignedElement.querySelector('.remove-assignment').addEventListener('click', function(e) {
                e.stopPropagation();
                const tipo = this.getAttribute('data-tipo');
                const ruta = this.getAttribute('data-ruta');
                eliminarAsignacion(ruta, tipo, dropZone);
            });
        }
    }

    function eliminarAsignacion(ruta, tipo, dropZone) {
        // Remover de asignaciones pendientes
        if (asignacionesPendientes[ruta] && asignacionesPendientes[ruta][tipo]) {
            delete asignacionesPendientes[ruta][tipo];
        }
        
        // Restaurar drop zone
        const assignedElement = dropZone.querySelector('.assigned-driver, .assigned-unit');
        if (assignedElement) {
            assignedElement.innerHTML = '';
            dropZone.querySelector('i').style.display = 'block';
            dropZone.querySelector('p').style.display = 'block';
        }
        
        console.log('Asignaciones pendientes después de eliminar:', asignacionesPendientes);
    }

    async function cargarDatosTablero() {
        try {
            // Determinar turno actual
            const ahora = new Date();
            const hora = ahora.getHours();
            const turno = hora >= 15 ? 'vespertino' : 'matutino';

            // Cargar choferes del turno actual
            const responseChoferes = await fetch(`https://sistema-autobuses.onrender.com/api/choferes/turno/${turno}`, {
                headers: getAuthHeaders()
            });
            const dataChoferes = await responseChoferes.json();

            // Cargar todas las unidades (sin filtrar por estado, ya que el estado no indica asignación)
            const responseUnidades = await fetch(`https://sistema-autobuses.onrender.com/api/unidades/activas`, {
                headers: getAuthHeaders()
            });
            const dataUnidades = await responseUnidades.json();

            // Cargar asignaciones activas para filtrar (solo las que tienen jornada_completada: null)
            const responseAsignaciones = await fetch(`https://sistema-autobuses.onrender.com/api/asignacion-rutas/activas`, {
                headers: getAuthHeaders()
            });
            let asignacionesActivas = [];
            if (responseAsignaciones.ok) {
                asignacionesActivas = await responseAsignaciones.json();
            }

            if (dataChoferes.success && dataUnidades.success) {
                // Filtrar choferes que NO estén en asignaciones activas (jornada_completada: null)
                const choferesAsignados = new Set(asignacionesActivas.map(a => a.id_personal));
                const choferesDisponibles = dataChoferes.choferes.filter(chofer => 
                    chofer.activo && 
                    chofer.id_personal && 
                    !choferesAsignados.has(chofer.id_personal)
                );

                // Filtrar unidades que NO estén en asignaciones activas (jornada_completada: null)
                const unidadesAsignadas = new Set(asignacionesActivas.map(a => a.id_unidad));
                const unidadesDisponibles = dataUnidades.unidades.filter(unidad => 
                    unidad.id_unidad && 
                    !unidadesAsignadas.has(unidad.id_unidad)
                );

                console.log('📊 Choferes disponibles:', choferesDisponibles.length);
                console.log('📊 Unidades disponibles:', unidadesDisponibles.length);
                console.log('📊 Asignaciones activas:', asignacionesActivas.length);

                actualizarTablero(choferesDisponibles, unidadesDisponibles, turno, asignacionesActivas);
            } else {
                throw new Error('Error al cargar datos del tablero');
            }

        } catch (error) {
            console.error('Error al cargar datos del tablero:', error);
            mostrarNotificacion('Error al cargar datos del tablero', 'error');
        }
    }


    function actualizarTablero(choferes, unidades, turnoActual, asignacionesActivas = []) {
        // Actualizar choferes disponibles
        const columnaChoferes = document.querySelector('.board-column:nth-child(1) .column-body');
        const badgeChoferes = document.querySelector('.board-column:nth-child(1) .badge-count');
        
        columnaChoferes.innerHTML = '';
        badgeChoferes.textContent = choferes.length;

        choferes.forEach(chofer => {
            const choferCard = crearCardChofer(chofer);
            columnaChoferes.appendChild(choferCard);
        });

        // Actualizar unidades disponibles
        const columnaUnidades = document.querySelector('.board-column:nth-child(2) .column-body');
        const badgeUnidades = document.querySelector('.board-column:nth-child(2) .badge-count');
        
        columnaUnidades.innerHTML = '';
        badgeUnidades.textContent = unidades.length;

        unidades.forEach(unidad => {
            const unidadCard = crearCardUnidad(unidad);
            columnaUnidades.appendChild(unidadCard);
        });

        // Actualizar rutas con asignaciones existentes y slots vacíos
        actualizarRutasConAsignaciones(asignacionesActivas);

        // Actualizar información del turno
        const tituloTablero = document.querySelector('h2');
        if (tituloTablero) {
            tituloTablero.innerHTML = `Tablero de Asignación <small class="text-muted fs-6">(Turno ${turnoActual})</small>`;
        }
    }

    function crearCardChofer(chofer) {
        const card = document.createElement('div');
        card.className = 'resource-card card-type-driver';
        card.draggable = true;
        
        // Usar id_personal como identificador
        const personalId = chofer.id_personal;
        card.setAttribute('data-chofer-id', personalId);
        
        const iniciales = chofer.nombre ? 
            chofer.nombre.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2) : 'CH';
        
        card.innerHTML = `
            <div class="card-header-row">
                <div class="d-flex align-items-center">
                    <div class="user-avatar-img-small me-2">${iniciales}</div>
                    <p class="resource-name m-0">${chofer.nombre || 'Chofer'}</p>
                </div>
                <i class="bi bi-grip-vertical text-muted"></i>
            </div>
            <div class="resource-details">
                <i class="bi bi-clock"></i> Turno ${chofer.turno || 'No especificado'}
                ${chofer.id_personal ? `<br><small class="text-muted">ID: ${chofer.id_personal}</small>` : ''}
            </div>
        `;
        
        return card;
    }

    function crearCardUnidad(unidad) {
        const card = document.createElement('div');
        card.className = 'resource-card card-type-bus';
        card.draggable = true;
        
        // Usar id_unidad como identificador
        const unidadId = unidad.id_unidad;
        card.setAttribute('data-unidad-id', unidadId);
        
        let estadoIcono = 'bi-fuel-pump';
        let estadoTexto = 'Disponible';
        let estadoClase = 'text-success';
        
        // El estado ahora solo indica mantenimiento, no asignación
        if (unidad.estado === 'mantenimiento') {
            estadoIcono = 'bi-tools';
            estadoTexto = 'En Mantenimiento';
            estadoClase = 'text-warning';
            card.draggable = false; // No se puede arrastrar si está en mantenimiento
            card.style.opacity = '0.6';
        }
        
        card.innerHTML = `
            <div class="card-header-row">
                <p class="resource-name">${unidad.id_unidad || 'Unidad'}</p>
                <i class="bi bi-grip-vertical text-muted"></i>
            </div>
            <div class="resource-details">
                <i class="bi ${estadoIcono}"></i> <span class="${estadoClase}">${estadoTexto}</span>
                <br>
                <small class="text-muted">${unidad.placas ? `Placas: ${unidad.placas}` : ''}</small>
                ${unidad.id_unidad ? `<br><small class="text-muted">ID: ${unidad.id_unidad}</small>` : ''}
            </div>
        `;
        
        return card;
    }

    async function guardarAsignaciones() {
        try {
            const asignacionesCompletas = [];
            
            console.log('📋 Asignaciones pendientes:', asignacionesPendientes);
            
            // Verificar asignaciones completas por ruta
            for (const [ruta, recursos] of Object.entries(asignacionesPendientes)) {
                if (recursos.chofer && recursos.unidad) {
                    // Convertir IDs a números
                    const idPersonal = parseInt(recursos.chofer.id);
                    const idUnidad = recursos.unidad.id;
                    
                    if (isNaN(idPersonal)) {
                        console.log(`❌ IDs no son números válidos: ${recursos.chofer.id}, ${recursos.unidad.id}`);
                        mostrarNotificacion(`Error: IDs no válidos en la asignación de ${ruta}`, 'error');
                        continue;
                    }
                    
                    asignacionesCompletas.push({
                        id_personal: idPersonal,
                        id_unidad: idUnidad,
                        ruta: ruta
                    });
                }
            }
            
            console.log('📦 Asignaciones a guardar:', asignacionesCompletas);
            
            if (asignacionesCompletas.length === 0) {
                mostrarNotificacion('No hay asignaciones completas para guardar', 'warning');
                return;
            }
            
            // Guardar cada asignación
            const resultados = [];
            for (const asignacion of asignacionesCompletas) {
                try {
                    const response = await fetch(`https://sistema-autobuses.onrender.com/api/asignacion-rutas/`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            ...getAuthHeaders()
                        },
                        body: JSON.stringify(asignacion)
                    });
                    
                    if (response.ok) {
                        resultados.push({
                            ruta: asignacion.ruta,
                            success: true,
                            mensaje: `Asignación para ${asignacion.ruta} guardada correctamente`
                        });
                    } else {
                        const errorData = await response.json();
                        resultados.push({
                            ruta: asignacion.ruta,
                            success: false,
                            mensaje: `Error en ${asignacion.ruta}: ${errorData.detail || 'Error desconocido'}`
                        });
                    }
                } catch (error) {
                    resultados.push({
                        ruta: asignacion.ruta,
                        success: false,
                        mensaje: `Error de conexión en ${asignacion.ruta}: ${error.message}`
                    });
                }
            }
            
            // Mostrar resultados
            const exitosas = resultados.filter(r => r.success);
            const errores = resultados.filter(r => !r.success);
            
            if (exitosas.length > 0) {
                mostrarNotificacion(`Se guardaron ${exitosas.length} asignaciones correctamente`, 'success');
                // Limpiar asignaciones pendientes y recargar tablero
                asignacionesPendientes = {};
                await cargarDatosTablero();
            }
            
            if (errores.length > 0) {
                errores.forEach(error => {
                    mostrarNotificacion(error.mensaje, 'error');
                });
            }
            
        } catch (error) {
            console.error('Error al guardar asignaciones:', error);
            mostrarNotificacion('Error al guardar las asignaciones', 'error');
        }
    }

    function actualizarRutasConAsignaciones(asignacionesActivas) {
        const rutas = ['40_Norte', '40_Sur'];
        const columnaRutas = document.querySelector('.board-column:nth-child(3) .column-body');
        
        columnaRutas.innerHTML = '';

        // Agrupar asignaciones por ruta
        const asignacionesPorRuta = {};
        rutas.forEach(ruta => {
            asignacionesPorRuta[ruta] = asignacionesActivas.filter(a => a.ruta === ruta);
        });

        // Para cada ruta, mostrar las asignaciones existentes y un slot vacío
        rutas.forEach(ruta => {
            const asignacionesRuta = asignacionesPorRuta[ruta];
            
            // Mostrar asignaciones existentes
            asignacionesRuta.forEach(asignacion => {
                const assignmentSlot = crearSlotAsignacionExistente(asignacion);
                columnaRutas.appendChild(assignmentSlot);
            });

            // Siempre agregar un slot vacío al final de cada ruta
            const slotVacio = crearSlotVacio(ruta);
            columnaRutas.appendChild(slotVacio);
        });
    }

    function crearSlotAsignacionExistente(asignacion) {
        const slot = document.createElement('div');
        slot.className = 'assignment-slot assignment-slot-active';
        slot.innerHTML = `
            <div class="d-flex justify-content-between mb-3">
                <h5 class="fw-bold text-dark">
                    <i class="bi bi-signpost-2-fill me-2" style="color: ${asignacion.ruta === '40_Norte' ? '#007bff' : '#28a745'};"></i>
                    Ruta ${asignacion.ruta.replace('_', ' ')}
                </h5>
                <span class="badge bg-success">Asignada</span>
            </div>
            <div class="row g-2">
                <div class="col-6">
                    <div class="resource-card card-type-driver m-0 assigned-resource">
                        <div class="card-header-row">
                            <p class="resource-name small">ID: ${asignacion.id_personal}</p>
                        </div>
                        <div class="resource-details">
                            <small>Chofer Asignado</small>
                        </div>
                    </div>
                </div>
                <div class="col-6">
                    <div class="resource-card card-type-bus m-0 assigned-resource">
                        <div class="card-header-row">
                            <p class="resource-name small">ID: ${asignacion.id_unidad}</p>
                        </div>
                        <div class="resource-details">
                            <small>Unidad Asignada</small>
                        </div>
                    </div>
                </div>
            </div>
            <div class="mt-2 text-end">
                <button class="btn btn-sm btn-outline-danger liberar-asignacion" 
                        data-id-asignacion="${asignacion.id_asignacion}">
                    <i class="bi bi-x-circle me-1"></i>Liberar
                </button>
            </div>
        `;

        // Agregar evento al botón de liberar
        slot.querySelector('.liberar-asignacion').addEventListener('click', async function() {
            const idAsignacion = this.getAttribute('data-id-asignacion');
            await liberarAsignacion(idAsignacion);
        });

        return slot;
    }

    function crearSlotVacio(ruta) {
        const slot = document.createElement('div');
        slot.className = 'assignment-slot';
        slot.innerHTML = `
            <div class="d-flex justify-content-between mb-3">
                <h5 class="fw-bold text-dark">
                    <i class="bi bi-signpost-2-fill me-2" style="color: ${ruta === '40_Norte' ? '#007bff' : '#28a745'};"></i>
                    Ruta ${ruta.replace('_', ' ')}
                </h5>
                <span class="badge bg-warning text-dark">Disponible</span>
            </div>
            <div class="row g-2">
                <div class="col-6">
                    <div class="drop-zone-box chofer-drop-zone" data-ruta="${ruta}">
                        <i class="bi bi-person-badge mb-2"></i>
                        <p class="m-0 small">Arrastra Chofer</p>
                        <div class="assigned-driver"></div>
                    </div>
                </div>
                <div class="col-6">
                    <div class="drop-zone-box unidad-drop-zone" data-ruta="${ruta}">
                        <i class="bi bi-bus-front mb-2"></i>
                        <p class="m-0 small">Arrastra Unidad</p>
                        <div class="assigned-unit"></div>
                    </div>
                </div>
            </div>
        `;

        // Inicializar eventos de drag and drop para este slot
        const dropZones = slot.querySelectorAll('.drop-zone-box');
        dropZones.forEach(zone => {
            zone.addEventListener('dragover', handleDragOver);
            zone.addEventListener('drop', handleDrop);
            zone.addEventListener('dragenter', handleDragEnter);
            zone.addEventListener('dragleave', handleDragLeave);
        });

        return slot;
    }

    async function liberarAsignacion(idAsignacion) {
        if (!confirm('¿Estás seguro de que quieres liberar esta asignación? La unidad volverá a estar disponible.')) {
            return;
        }

        try {
            const response = await fetch(`https://sistema-autobuses.onrender.com/api/asignacion-rutas/${idAsignacion}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });

            if (response.ok) {
                mostrarNotificacion('Asignación liberada correctamente. Unidad ahora disponible.', 'success');
                // Recargar el tablero para reflejar los cambios
                await cargarDatosTablero();
            } else {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Error al liberar asignación');
            }
        } catch (error) {
            console.error('Error al liberar asignación:', error);
            mostrarNotificacion('Error al liberar la asignación', 'error');
        }
    }

    function getAuthHeaders() {
        return UserAuthPersonal.getAuthHeaders();
    }

    function mostrarNotificacion(mensaje, tipo) {
        const toast = document.createElement('div');
        toast.className = `alert alert-${tipo === 'error' ? 'danger' : tipo === 'warning' ? 'warning' : 'success'} alert-dismissible fade show position-fixed`;
        toast.style.top = '20px';
        toast.style.right = '20px';
        toast.style.zIndex = '9999';
        toast.innerHTML = `
            ${mensaje}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        document.body.appendChild(toast);
        
        // Auto-remover después de 5 segundos
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 5000);
    }

    // Función para cerrar sesión
    window.logout = function() {
        // ✅ AGREGADO: Detener la actualización automática de notificaciones al cerrar sesión
        if (NotificationManager.stopAutoRefresh) {
            NotificationManager.stopAutoRefresh();
        }
        UserAuthPersonal.logout();
    };
});