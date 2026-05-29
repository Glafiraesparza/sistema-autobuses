// Módulo para gestión de notificaciones de pasajeros - Filtrado por tipo "retraso"
const PassengerNotificationManager = (function() {
    let notificaciones = [];
    let notificacionesFiltradas = []; // Solo notificaciones de retraso
    let onNotificationsUpdate = null;
    let authHeaders = {
        'Content-Type': 'application/json'
    };

    // Métodos públicos
    return {
        // Inicializar el manager
        initialize(callback = null, customHeaders = null) {
            if (callback) {
                onNotificationsUpdate = callback;
            }
            
            if (customHeaders) {
                authHeaders = { ...authHeaders, ...customHeaders };
            }
            
            console.log('🔔 PassengerNotificationManager inicializado - Filtrado por tipo "retraso"');
        },

        // Configurar headers de autenticación personalizados
        setAuthHeaders(headers) {
            authHeaders = { ...authHeaders, ...headers };
        },

        // Cargar notificaciones desde la API y filtrar por tipo "retraso"
        async loadNotifications() {
    try {
        const userId = this.getCurrentUserId();
        if (!userId) {
            console.error('❌ No se pudo obtener ID del usuario');
            this.showSimpleNotification('Error: No se pudo identificar al usuario', 'error');
            return [];
        }
        
        console.log('🔄 Cargando notificaciones para usuario ID:', userId);
        
        const url = `https://${IP_API}:8000/api/notificaciones/usuario/${userId}`;

        const response = await fetch(url, { 
            headers: {
                'Content-Type': 'application/json'
            }
        });
                
                console.log('📡 URL llamada:', url);
                console.log('📡 Status respuesta:', response.status);
                
                if (response.ok) {
                    const result = await response.json();
                    console.log('✅ Resultado del servidor:', result);
                    
                    if (result.success) {
                        notificaciones = result.notificaciones;
                        // FILTRAR SOLO RETRASOS
                        notificacionesFiltradas = notificaciones.filter(notif => 
                            notif.tipo && notif.tipo.toLowerCase() === 'retraso'
                        );
                        console.log('✅ Notificaciones cargadas. Totales:', notificaciones.length, 'Retrasos:', notificacionesFiltradas.length);
                        this.notifyUpdate();
                        return notificacionesFiltradas;
                    }
                } else {
                    const errorText = await response.text();
                    console.error('❌ Error del servidor:', errorText);
                }
                throw new Error('Error cargando notificaciones');
            } catch (error) {
                console.error('❌ Error cargando notificaciones:', error);
                notificaciones = [];
                notificacionesFiltradas = [];
                this.notifyUpdate();
                return [];
            }
        },

        // Obtener notificaciones actuales (solo retrasos)
        getNotifications() {
            return notificacionesFiltradas;
        },

        // Obtener todas las notificaciones sin filtrar (para debugging)
        getAllNotifications() {
            return notificaciones;
        },

        // Obtener notificaciones no leídas (solo retrasos)
        getUnreadNotifications() {
            return notificacionesFiltradas.filter(notif => !notif.leida);
        },

        // Obtener notificaciones por tipo (compatible, pero siempre filtrará por retraso)
        getNotificationsByType(tipo) {
            // Forzar filtrado por retraso aunque se pida otro tipo
            if (tipo && tipo.toLowerCase() !== 'retraso') {
                console.warn('⚠️ PassengerNotificationManager: Solo se muestran notificaciones de tipo "retraso"');
            }
            return notificacionesFiltradas;
        },

        // Obtener notificaciones por chofer (solo retrasos)
        getNotificationsByChofer(idChofer) {
            return notificacionesFiltradas.filter(notif => notif.id_chofer === idChofer);
        },

        // Marcar notificación como leída
        async markAsRead(idNotificacion) {
            try {
                const response = await fetch(`https://${IP_API}:8000/api/notificaciones/${idNotificacion}/leida`, {
                    method: 'PUT',
                    headers: authHeaders
                });
                
                if (response.ok) {
                    // Actualizar en ambas listas
                    const notifIndex = notificaciones.findIndex(n => n.id_notificacion === idNotificacion);
                    const notifFiltradaIndex = notificacionesFiltradas.findIndex(n => n.id_notificacion === idNotificacion);
                    
                    if (notifIndex !== -1) {
                        notificaciones[notifIndex].leida = true;
                    }
                    if (notifFiltradaIndex !== -1) {
                        notificacionesFiltradas[notifFiltradaIndex].leida = true;
                    }
                    
                    this.notifyUpdate();
                    return true;
                }
                return false;
            } catch (error) {
                console.error('❌ Error marcando notificación como leída:', error);
                return false;
            }
        },

        // Marcar todas como leídas (solo las de retraso)
        async markAllAsRead() {
            try {
                const unreadNotifications = this.getUnreadNotifications();
                const promises = unreadNotifications.map(notif => 
                    this.markAsRead(notif.id_notificacion)
                );
                
                await Promise.all(promises);
                return true;
            } catch (error) {
                console.error('❌ Error marcando todas como leídas:', error);
                return false;
            }
        },

        // Actualizar badge de notificaciones
        updateNotificationBadge(containerSelector = '.dropdown-menu .dropdown-header') {
            const unreadCount = this.getUnreadNotifications().length;
            const badge = document.querySelector(containerSelector);
            
            if (badge) {
                badge.textContent = `Retrasos (${unreadCount})`;
            }

            // Actualizar dot indicador
            const dot = document.getElementById('low-balance-dot');
            if (dot) {
                dot.style.display = unreadCount > 0 ? 'block' : 'none';
            }

            return unreadCount;
        },

        // Actualizar dropdown de notificaciones CON BOTÓN ELIMINAR
updateNotificationsDropdown(dropdownSelector = '.dropdown-menu.notification-menu', maxItems = 5) {
    const dropdownMenu = document.querySelector(dropdownSelector);
    if (!dropdownMenu) return;

    const dropdownHeader = dropdownMenu.querySelector('.dropdown-header');
    let notificationsContainer = dropdownHeader?.nextElementSibling;
    
    // Limpiar contenedor existente o crear nuevo
    if (notificationsContainer && notificationsContainer.classList.contains('dropdown-notifications')) {
        notificationsContainer.remove();
    }
    
    notificationsContainer = document.createElement('div');
    notificationsContainer.className = 'dropdown-notifications';
    dropdownMenu.insertBefore(notificationsContainer, dropdownHeader.nextSibling);
    
    if (notificacionesFiltradas.length === 0) {
        notificationsContainer.innerHTML = `
            <li>
                <a class="dropdown-item text-muted" href="#">
                    <i class="fa-solid fa-clock me-2"></i>
                    No hay retrasos reportados
                </a>
            </li>
        `;
    } else {
        const notificationsToShow = notificacionesFiltradas.slice(0, maxItems);
        notificationsContainer.innerHTML = notificationsToShow.map(notif => {
            const icono = this.getNotificationIcon(notif.tipo);
            const color = this.getNotificationColor(notif.tipo);
            const esNoLeida = !notif.leida;
            const tiempoRetraso = notif.tiempo_estimado ? ` (${notif.tiempo_estimado} min)` : '';
            const rutaInfo = notif.ruta_afectada ? ` - Ruta: ${notif.ruta_afectada}` : '';
            
            return `
                <li class="notification-item-container">
                    <div class="dropdown-item notification-item p-2" 
                         data-notification-id="${notif.id_notificacion}">
                        <div class="d-flex justify-content-between align-items-start">
                            <div class="d-flex align-items-start flex-grow-1 me-2" 
                                 onclick="PassengerNotificationManager.handleNotificationClick(${notif.id_notificacion})"
                                 style="cursor: pointer;">
                                <i class="fa-solid ${icono} me-2 ${color} mt-1"></i>
                                <div class="d-flex flex-column flex-grow-1">
                                    <span class="small">${notif.titulo}${tiempoRetraso}${rutaInfo}</span>
                                    <small class="text-muted mt-1">${notif.mensaje}</small>
                                    <small class="text-muted mt-2">
                                        <i class="fa-regular fa-clock me-1"></i>
                                        ${notif.timestamp_formateado || 'Ahora'}
                                    </small>
                                </div>
                            </div>
                            <div class="d-flex align-items-start">
                                ${esNoLeida ? '<span class="badge bg-warning me-2">Nuevo</span>' : ''}
                                <button class="btn btn-sm btn-outline-danger delete-notification-btn"
                                        onclick="event.stopPropagation(); PassengerNotificationManager.handleDeleteNotification(${notif.id_notificacion})"
                                        title="Eliminar notificación">
                                    <i class="fa-solid fa-times"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </li>
            `;
        }).join('');
    }
},

        // Manejar clic en notificación
        async handleNotificationClick(idNotificacion) {
            const notificacion = notificacionesFiltradas.find(n => n.id_notificacion === idNotificacion);
            if (notificacion) {
                await this.markAsRead(idNotificacion);
                this.showNotificationDetail(notificacion);
            }
        },
        // AGREGAR método deleteNotification:
        async deleteNotification(idNotificacion) {
            try {
                const userId = this.getCurrentUserId();
                if (!userId) {
                    console.error('❌ No se pudo obtener ID del usuario');
                    this.showSimpleNotification('Error: No se pudo identificar al usuario', 'error');
                    return false;
                }

                console.log('🔄 Eliminando notificación', idNotificacion, 'para usuario', userId);

                const response = await fetch(`https://${IP_API}:8000/api/notificaciones/usuario/${idNotificacion}?id_usuario=${userId}`, {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
        
        console.log('📡 Status de respuesta:', response.status);
        
        if (response.ok) {
            const result = await response.json();
            console.log('✅ Respuesta del servidor:', result);
            
            if (result.success) {
                // ✅ FORZAR recarga de notificaciones desde el servidor
                console.log('🔄 Recargando notificaciones desde servidor...');
                await this.loadNotifications();
                this.updateNotificationsDropdown();
                this.updateNotificationBadge();
                return true;
            }
            return false;
        } else {
            const error = await response.text();
            console.error('❌ Error del servidor:', error);
            return false;
        }
      } catch (error) {
        console.error('❌ Error de conexión:', error);
        return false;
    }
},

       // REEMPLAZAR el método getCurrentUserId
    getCurrentUserId() {
        try {
            // PRIMERO: Intentar obtener de user_data (donde realmente está)
            const userData = localStorage.getItem('user_data');
            console.log('📋 Datos de usuario en user_data:', userData);
            
            if (userData) {
                try {
                    const usuario = JSON.parse(userData);
                    console.log('👤 Usuario parseado desde user_data:', usuario);
                    
                    // Diferentes posibles ubicaciones del ID
                    if (usuario.id_usuario) {
                        return usuario.id_usuario;
                    } else if (usuario.id) {
                        return usuario.id;
                    } else if (usuario.userId) {
                        return usuario.userId;
                    }
                } catch (parseError) {
                    console.error('❌ Error parseando user_data:', parseError);
                }
            }
            
            // SEGUNDO: Intentar de tucsa_usuario (por si acaso)
            const usuarioData = localStorage.getItem('tucsa_usuario');
            if (usuarioData) {
                const usuario = JSON.parse(usuarioData);
                return usuario.id_usuario;
            }
            
            // TERCERO: Buscar en cualquier key que pueda tener datos de usuario
            console.log('🔍 Buscando en todas las keys...');
            const allKeys = Object.keys(localStorage);
            for (let key of allKeys) {
                if (key.includes('user') || key.includes('usuario') || key.includes('auth')) {
                    try {
                        const data = localStorage.getItem(key);
                        const parsed = JSON.parse(data);
                        console.log(`🔑 Key "${key}":`, parsed);
                        
                        if (parsed && (parsed.id_usuario || parsed.id || parsed.userId)) {
                            console.log(`✅ ID encontrado en key "${key}":`, parsed.id_usuario || parsed.id || parsed.userId);
                            return parsed.id_usuario || parsed.id || parsed.userId;
                        }
                    } catch (e) {
                        // Ignorar errores de parseo
                    }
                }
            }
            
            console.error('❌ No se pudo obtener ID del usuario en ninguna ubicación');
            return null;
        } catch (error) {
            console.error('❌ Error obteniendo ID de usuario:', error);
            return null;
        }
    },

        // AGREGAR este método para manejar eliminación:
        async handleDeleteNotification(idNotificacion) {
            const confirmacion = confirm('¿Estás seguro de que quieres eliminar esta notificación?');
            if (!confirmacion) return;

            const success = await this.deleteNotification(idNotificacion);
            if (success) {
                this.showSimpleNotification('Notificación eliminada', 'success');
                await this.loadNotifications(); // Recargar notificaciones
            } else {
                this.showSimpleNotification('Error eliminando notificación', 'error');
            }
        },

        // Mostrar detalle de notificación
        showNotificationDetail(notificacion) {
            const modalHTML = `
                <div class="modal fade" id="modalDetalleNotificacion" tabindex="-1">
                    <div class="modal-dialog modal-lg">
                        <div class="modal-content">
                            <div class="modal-header ${this.getNotificationColor(notificacion.tipo)}">
                                <h5 class="modal-title">
                                    <i class="fa-solid ${this.getNotificationIcon(notificacion.tipo)} me-2"></i>
                                    ${notificacion.titulo}
                                </h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                            </div>
                            <div class="modal-body">
                                <div class="row">
                                    <div class="col-md-6">
                                        <strong>Tipo:</strong>
                                        <span class="badge ${this.getNotificationColor(notificacion.tipo)} ms-2">
                                            ${notificacion.tipo}
                                        </span>
                                    </div>
                                    <div class="col-md-6">
                                        <strong>Fecha/Hora:</strong>
                                        <span class="ms-2">${notificacion.timestamp_formateado || 'N/A'}</span>
                                    </div>
                                </div>
                                <div class="row mt-3">
                                    <div class="col-12">
                                        <strong>Mensaje:</strong>
                                        <p class="mt-2">${notificacion.mensaje}</p>
                                    </div>
                                </div>
                                ${notificacion.ruta_afectada ? `
                                <div class="row mt-3">
                                    <div class="col-12">
                                        <strong>Ruta Afectada:</strong>
                                        <span class="ms-2">${notificacion.ruta_afectada}</span>
                                    </div>
                                </div>
                                ` : ''}
                                ${notificacion.tiempo_estimado ? `
                                <div class="row mt-3">
                                    <div class="col-12">
                                        <strong>Tiempo Estimado de Retraso:</strong>
                                        <span class="ms-2">${notificacion.tiempo_estimado} minutos</span>
                                    </div>
                                </div>
                                ` : ''}
                                ${notificacion.id_chofer ? `
                                <div class="row mt-3">
                                    <div class="col-12">
                                        <strong>Chofer Reportante:</strong>
                                        <span class="ms-2">ID ${notificacion.id_chofer}</span>
                                    </div>
                                </div>
                                ` : ''}
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>
                                <button type="button" class="btn btn-warning" onclick="PassengerNotificationManager.verAlternativas('${notificacion.ruta_afectada}')">
                                    <i class="fa-solid fa-route me-1"></i>Ver Rutas Alternativas
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            const modalExistente = document.getElementById('modalDetalleNotificacion');
            if (modalExistente) {
                modalExistente.remove();
            }

            document.body.insertAdjacentHTML('beforeend', modalHTML);
            const modal = new bootstrap.Modal(document.getElementById('modalDetalleNotificacion'));
            modal.show();
        },

        // Ver rutas alternativas
        verAlternativas(rutaAfectada) {
            // Mostrar notificación simple
            this.showSimpleNotification(`Buscando rutas alternativas para: ${rutaAfectada}`, 'info');
            
            const modal = bootstrap.Modal.getInstance(document.getElementById('modalDetalleNotificacion'));
            if (modal) {
                modal.hide();
            }
            
            // Aquí puedes integrar con tu sistema de rutas
            console.log(`🔍 Buscando alternativas para ruta: ${rutaAfectada}`);
        },

        // Mostrar notificación simple (reemplaza UserAuthPersonal.showNotification)
        showSimpleNotification(mensaje, tipo = 'info') {
            // Crear notificación toast básica
            const toastId = 'notification-toast-' + Date.now();
            const toastHTML = `
                <div id="${toastId}" class="toast align-items-center text-bg-${tipo === 'info' ? 'info' : tipo === 'warning' ? 'warning' : 'success'} border-0 position-fixed top-0 end-0 m-3" role="alert">
                    <div class="d-flex">
                        <div class="toast-body">
                            ${mensaje}
                        </div>
                        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
                    </div>
                </div>
            `;
            
            document.body.insertAdjacentHTML('beforeend', toastHTML);
            const toastElement = document.getElementById(toastId);
            const toast = new bootstrap.Toast(toastElement, { delay: 3000 });
            toast.show();
            
            // Remover del DOM después de ocultar
            toastElement.addEventListener('hidden.bs.toast', () => {
                toastElement.remove();
            });
        },

        // Obtener icono según tipo de notificación
        getNotificationIcon(tipo) {
            const icons = {
                'emergencia': 'fa-exclamation-triangle',
                'retraso': 'fa-clock',
                'asistencia': 'fa-life-ring',
                'sistema': 'fa-info-circle',
                'info': 'fa-info-circle',
                'warning': 'fa-exclamation-triangle',
                'error': 'fa-times-circle'
            };
            return icons[tipo] || 'fa-clock'; // Por defecto reloj para retrasos
        },

        // Obtener color según tipo de notificación
        getNotificationColor(tipo) {
            const colors = {
                'emergencia': 'text-danger',
                'retraso': 'text-warning',
                'asistencia': 'text-primary',
                'sistema': 'text-info',
                'info': 'text-info',
                'warning': 'text-warning',
                'error': 'text-danger'
            };
            return colors[tipo] || 'text-warning'; // Por defecto amarillo para retrasos
        },

        // Notificar actualización
        notifyUpdate() {
            if (onNotificationsUpdate && typeof onNotificationsUpdate === 'function') {
                onNotificationsUpdate(notificacionesFiltradas);
            }
        },

        // Configurar actualización automática
        startAutoRefresh(interval = 3000) {
            setInterval(async () => {
                await this.loadNotifications();
            }, interval);
        },

        // Limpiar notificaciones
        clear() {
            notificaciones = [];
            notificacionesFiltradas = [];
            this.notifyUpdate();
        },

        // Depuración
        debug() {
            console.log('🔔 PassengerNotificationManager Debug:');
            console.log(' - Total notifications (all):', notificaciones.length);
            console.log(' - Filtered notifications (retraso):', notificacionesFiltradas.length);
            console.log(' - Unread notifications (retraso):', this.getUnreadNotifications().length);
            console.log(' - All notifications:', notificaciones);
            console.log(' - Filtered notifications:', notificacionesFiltradas);
        }
    };
})();

// Hacer disponible globalmente
window.PassengerNotificationManager = PassengerNotificationManager;