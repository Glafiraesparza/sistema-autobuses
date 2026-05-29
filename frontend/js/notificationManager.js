// Módulo para gestión de notificaciones reutilizable
const NotificationManager = (function() {
    let notificaciones = [];
    let onNotificationsUpdate = null;
    let currentUserType = 'personal'; // 'personal' o 'usuario'
    let currentUserId = null;

    // Métodos públicos
    return {
        // Inicializar el manager
        initialize(callback = null, userType = 'personal', userId = null) {
            if (callback) {
                onNotificationsUpdate = callback;
            }
            currentUserType = userType;
            currentUserId = userId;
            console.log(`🔔 NotificationManager inicializado para: ${userType}`);
        },

        // Configurar usuario actual
        setCurrentUser(userType, userId) {
            currentUserType = userType;
            currentUserId = userId;
        },

        // Cargar notificaciones desde la API
        async loadNotifications(apiUrl = `https://${IP_API}:8000/api/notificaciones/admin`) {
            try {
                const userId = this.getCurrentUserId();
                console.log('🔄 Cargando notificaciones para admin ID:', userId);
                
                let url = apiUrl;
                if (userId) {
                    url += `?id_personal=${userId}`;
                }

                const headers = UserAuthPersonal ? UserAuthPersonal.getAuthHeaders() : {
                    'Content-Type': 'application/json'
                };

                const response = await fetch(url, { headers });
                
                if (response.ok) {
                    const result = await response.json();
                    if (result.success) {
                        notificaciones = result.notificaciones.filter(notif => notif.tipo !== 'retraso');
                        console.log('✅ Notificaciones cargadas:', notificaciones.length);
                        this.notifyUpdate();
                        return notificaciones;
                    }
                }
                throw new Error('Error cargando notificaciones');
            } catch (error) {
                console.error('❌ Error cargando notificaciones:', error);
                notificaciones = [];
                this.notifyUpdate();
                return [];
            }
        },

        // Obtener notificaciones actuales
        getNotifications() {
            return notificaciones;
        },

        // Obtener notificaciones no leídas
        getUnreadNotifications() {
            return notificaciones.filter(notif => !notif.leida);
        },

        // Obtener notificaciones por tipo
        getNotificationsByType(tipo) {
            return notificaciones.filter(notif => notif.tipo === tipo);
        },

        // Obtener notificaciones por chofer
        getNotificationsByChofer(idChofer) {
            return notificaciones.filter(notif => notif.id_chofer === idChofer);
        },

        // Marcar notificación como leída
        async markAsRead(idNotificacion) {
            try {
                const headers = UserAuthPersonal ? UserAuthPersonal.getAuthHeaders() : {
                    'Content-Type': 'application/json'
                };

                const response = await fetch(`https://${IP_API}:8000/api/notificaciones/${idNotificacion}/leida`, {
                    method: 'PUT',
                    headers
                });
                
                if (response.ok) {
                    const notifIndex = notificaciones.findIndex(n => n.id_notificacion === idNotificacion);
                    if (notifIndex !== -1) {
                        notificaciones[notifIndex].leida = true;
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

        // ✅ NUEVO: Eliminar notificación
        async deleteNotification(idNotificacion) {
    try {
        const userId = this.getCurrentUserId();
        if (!userId) {
            console.error('❌ No se pudo obtener ID del admin');
            return false;
        }

        console.log('🔄 Eliminando notificación', idNotificacion, 'para admin', userId);

        const response = await fetch(`https://${IP_API}:8000/api/notificaciones/personal/${idNotificacion}?id_personal=${userId}`, {
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

        // AGREGAR método mejorado para obtener ID
        getCurrentUserId() {
            try {
                if (UserAuthPersonal && UserAuthPersonal.getCurrentUser) {
                    const user = UserAuthPersonal.getCurrentUser();
                    console.log('👤 Usuario admin actual:', user);
                    return user?.id_personal;
                }
                
                console.warn('⚠️ UserAuthPersonal no está disponible');
                return null;
            } catch (error) {
                console.error('❌ Error obteniendo ID de personal:', error);
                return null;
            }
        },

        // Marcar todas como leídas
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
        updateNotificationBadge(containerSelector = '.notification-menu .dropdown-header') {
            const unreadCount = this.getUnreadNotifications().length;
            const badge = document.querySelector(containerSelector);
            
            if (badge) {
                const userTypeText = currentUserType === 'personal' ? 'Notificaciones' : 'Retrasos';
                badge.textContent = `${userTypeText} (${unreadCount})`;
            }

            // Actualizar dot indicador
            const dot = document.getElementById('low-balance-dot');
            if (dot) {
                dot.style.display = unreadCount > 0 ? 'block' : 'none';
            }

            return unreadCount;
        },

        // Actualizar dropdown de notificaciones CON BOTÓN ELIMINAR
        updateNotificationsDropdown(dropdownSelector = '.notification-menu', maxItems = 5) {
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
        
        if (notificaciones.length === 0) {
            notificationsContainer.innerHTML = `
                <li>
                    <a class="dropdown-item text-muted" href="#">
                        <i class="fa-solid fa-bell-slash me-2"></i>
                        No hay notificaciones
                    </a>
                </li>
            `;
        } else {
            const notificationsToShow = notificaciones.slice(0, maxItems);
            notificationsContainer.innerHTML = notificationsToShow.map(notif => {
                const icono = this.getNotificationIcon(notif.tipo);
                const color = this.getNotificationColor(notif.tipo);
                const esNoLeida = !notif.leida;
                const choferInfo = notif.id_chofer ? ` - Chofer ID: ${notif.id_chofer}` : '';
                
                return `
                    <li class="notification-item-container">
                        <div class="dropdown-item notification-item p-2" 
                            data-notification-id="${notif.id_notificacion}">
                            <div class="d-flex justify-content-between align-items-start">
                                <div class="d-flex align-items-start flex-grow-1 me-2" 
                                    onclick="NotificationManager.handleNotificationClick(${notif.id_notificacion})"
                                    style="cursor: pointer;">
                                    <i class="fa-solid ${icono} me-2 ${color} mt-1"></i>
                                    <div class="d-flex flex-column flex-grow-1">
                                        <span class="small">${notif.titulo}${choferInfo}</span>
                                        <small class="text-muted mt-1">${notif.mensaje}</small>
                                        <small class="text-muted mt-2">
                                            <i class="fa-regular fa-clock me-1"></i>
                                            ${notif.timestamp_formateado || 'Ahora'}
                                        </small>
                                    </div>
                                </div>
                                <div class="d-flex align-items-start">
                                    ${esNoLeida ? '<span class="badge bg-danger me-2">Nueva</span>' : ''}
                                    <button class="btn btn-sm btn-outline-danger delete-notification-btn"
                                            onclick="event.stopPropagation(); NotificationManager.handleDeleteNotification(${notif.id_notificacion})"
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

    // AGREGAR método handleDeleteNotification:
    async handleDeleteNotification(idNotificacion) {
        console.log('🖱️ Click en eliminar notificación:', idNotificacion);
        
        const confirmacion = confirm('¿Estás seguro de que quieres eliminar esta notificación?');
        if (!confirmacion) {
            console.log('❌ Eliminación cancelada por el usuario');
            return;
        }

        console.log('✅ Confirmación recibida, procediendo a eliminar...');
        
        const success = await this.deleteNotification(idNotificacion);
        if (success) {
            console.log('✅ Notificación eliminada exitosamente');
            this.showSimpleNotification('Notificación eliminada', 'success');
            
            // Recargar notificaciones después de eliminar
            console.log('🔄 Recargando notificaciones...');
            await this.loadNotifications();
            this.updateNotificationsDropdown();
            this.updateNotificationBadge();
        } else {
            console.error('❌ Falló la eliminación de la notificación');
            this.showSimpleNotification('Error eliminando notificación', 'error');
        }
    },

        // Manejar clic en notificación
        async handleNotificationClick(idNotificacion) {
            const notificacion = notificaciones.find(n => n.id_notificacion === idNotificacion);
            if (notificacion) {
                await this.markAsRead(idNotificacion);
                this.showNotificationDetail(notificacion);
            }
        },

        // ✅ NUEVO: Manejar eliminación de notificación
        async handleDeleteNotification(idNotificacion) {
            const confirmacion = confirm('¿Estás seguro de que quieres eliminar esta notificación?');
            if (!confirmacion) return;

            const success = await this.deleteNotification(idNotificacion);
            if (success) {
                this.showSimpleNotification('Notificación eliminada', 'success');
            } else {
                this.showSimpleNotification('Error eliminando notificación', 'error');
            }
        },

        // Mostrar detalle de notificación CON BOTÓN ELIMINAR
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
                                <button type="button" class="btn btn-outline-danger me-auto" 
                                        onclick="NotificationManager.handleDeleteNotification(${notificacion.id_notificacion})">
                                    <i class="fa-solid fa-trash me-1"></i>Eliminar
                                </button>
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>
                                ${notificacion.tipo === 'emergencia' ? `
                                <button type="button" class="btn btn-danger" onclick="NotificationManager.contactarSoporte(${notificacion.id_chofer})">
                                    <i class="fa-solid fa-phone me-1"></i>Contactar Soporte
                                </button>
                                ` : ''}
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

        // Contactar soporte
        contactarSoporte(idChofer) {
            if (UserAuthPersonal) {
                UserAuthPersonal.showNotification(`Contactando soporte para chofer ID: ${idChofer}`, 'info');
            } else {
                alert(`Contactando soporte para chofer ID: ${idChofer}`);
            }
            
            const modal = bootstrap.Modal.getInstance(document.getElementById('modalDetalleNotificacion'));
            if (modal) {
                modal.hide();
            }
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
            return icons[tipo] || 'fa-bell';
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
            return colors[tipo] || 'text-secondary';
        },

        // Notificar actualización
        notifyUpdate() {
            if (onNotificationsUpdate && typeof onNotificationsUpdate === 'function') {
                onNotificationsUpdate(notificaciones);
            }
        },

        // Mostrar notificación simple
        showSimpleNotification(mensaje, tipo = 'info') {
            if (UserAuthPersonal && UserAuthPersonal.showNotification) {
                UserAuthPersonal.showNotification(mensaje, tipo);
            } else {
                // Toast básico como fallback
                const toastId = 'notification-toast-' + Date.now();
                const toastHTML = `
                    <div id="${toastId}" class="toast align-items-center text-bg-${tipo === 'info' ? 'info' : tipo === 'success' ? 'success' : 'warning'} border-0 position-fixed top-0 end-0 m-3" role="alert">
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
                
                toastElement.addEventListener('hidden.bs.toast', () => {
                    toastElement.remove();
                });
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
            this.notifyUpdate();
        },

        // Depuración
        debug() {
            console.log('🔔 NotificationManager Debug:');
            console.log(' - Total notifications:', notificaciones.length);
            console.log(' - Unread notifications:', this.getUnreadNotifications().length);
            console.log(' - Current user type:', currentUserType);
            console.log(' - Current user ID:', this.getCurrentUserId());
            console.log(' - Notifications:', notificaciones);
        }
    };
})();

// Hacer disponible globalmente
window.NotificationManager = NotificationManager;