// Módulo para gestión de autenticación y permisos de personal TUCSA
const UserAuthPersonal = (function() {
    // Constantes
    const API_BASE_URL = `https://${IP_API}:8000/api`;
    let currentUser = null;

    // Métodos públicos
    return {
        // Inicializar y cargar datos del usuario
        async initialize() {
            await this.loadUserData();
            return this.isAuthenticated();
        },

        // Cargar datos del usuario desde localStorage (para personal TUCSA)
        async loadUserData() {
            try {
                const userData = localStorage.getItem('tucsa_personal');
                const authToken = localStorage.getItem('tucsa_token');
                
                if (!userData || !authToken) {
                    throw new Error('Usuario no autenticado');
                }
                
                currentUser = JSON.parse(userData);
                console.log('🔍 Personal TUCSA cargado desde sesión:', currentUser);
                
                // Verificar que el usuario tenga datos básicos
                if (!currentUser.email && !currentUser.nombre) {
                    console.warn('Usuario no tiene datos básicos válidos');
                    return true;
                }
                
                // Intentar obtener datos actualizados si tenemos un ID
                try {
                    const userId = currentUser._id || currentUser.id || currentUser.id_personal;
                    if (userId) {
                        console.log('🆔 Intentando actualizar datos para personal ID:', userId);
                        
                        const response = await fetch(`${API_BASE_URL}/usuarios_personal/${userId}`, {
                            headers: {
                                'Authorization': `Bearer ${authToken}`,
                                'Content-Type': 'application/json'
                            }
                        });
                        
                        if (response.ok) {
                            const userResponse = await response.json();
                            console.log('📋 Respuesta de la API:', userResponse);
                            
                            if (userResponse.success && userResponse.usuario) {
                                currentUser = { ...currentUser, ...userResponse.usuario };
                                localStorage.setItem('tucsa_personal', JSON.stringify(currentUser));
                                console.log('✅ Datos actualizados del personal:', currentUser);
                            } else if (userResponse.usuario) {
                                currentUser = { ...currentUser, ...userResponse.usuario };
                                localStorage.setItem('tucsa_personal', JSON.stringify(currentUser));
                                console.log('✅ Datos actualizados del personal (sin success):', currentUser);
                            }
                        } else if (response.status === 404) {
                            console.warn('❌ Personal no encontrado en API, usando datos locales');
                        } else {
                            console.warn('⚠️ Error en respuesta de API, usando datos locales. Status:', response.status);
                        }
                    } else {
                        console.log('ℹ️ No hay ID de usuario, usando datos locales del login');
                    }
                } catch (apiError) {
                    console.warn('⚠️ No se pudieron obtener datos actualizados, usando datos locales:', apiError.message);
                }
                
                return true;
                
            } catch (error) {
                console.error('❌ Error cargando datos del personal:', error.message);
                currentUser = null;
                return false;
            }
        },

        // Verificar si el usuario está autenticado
        isAuthenticated() {
            return currentUser !== null;
        },

        // Verificar si el usuario es administrador
        isAdmin() {
            return this.isAuthenticated() && currentUser.rol === 'administrador';
        },

        // Verificar si el usuario es chofer
        isChofer() {
            return this.isAuthenticated() && currentUser.rol === 'chofer';
        },

        // Obtener datos del usuario actual
        getCurrentUser() {
            return currentUser;
        },

        // Obtener headers de autenticación para fetch (para personal TUCSA)
        getAuthHeaders() {
            const authToken = localStorage.getItem('tucsa_token');
            return {
                'Content-Type': 'application/json',
                ...(authToken && { 'Authorization': `Bearer ${authToken}` })
            };
        },

        // Actualizar la interfaz de usuario con datos del usuario
        updateUserInterface() {
            const userNameElement = document.getElementById('user-name');
            const userEmailElement = document.getElementById('user-email');
            const userTypeElement = document.getElementById('user-type');
            
            if (userNameElement && currentUser) {
                userNameElement.textContent = currentUser.nombre || currentUser.nombreCompleto || 'Usuario Personal';
            }
            
            if (userEmailElement && currentUser) {
                userEmailElement.textContent = currentUser.email || 'personal@tucsa.com';
            }
            
            if (userTypeElement && currentUser) {
                const rolTexto = currentUser.rol ? 
                    currentUser.rol.charAt(0).toUpperCase() + currentUser.rol.slice(1) : 
                    'Personal';
                
                userTypeElement.textContent = rolTexto;
                
                // Añadir clase según el rol
                userTypeElement.className = 'user-type-badge ' + 
                    (currentUser.rol === 'administrador' ? 'badge-admin' : 
                    currentUser.rol === 'chofer' ? 'badge-chofer' : 'badge-usuario');
            }
        },

        // Ajustar la UI según el rol del usuario
        adjustUIForRole() {
            if (!this.isAdmin()) {
                this.hideAdminElements();
                this.showNonAdminMessage();
            }
        },

        // Ocultar elementos de administración
        hideAdminElements() {
            document.querySelectorAll('.admin-only').forEach(element => {
                element.style.display = 'none';
            });

            document.querySelectorAll('.btn-admin-primary').forEach(btn => {
                btn.style.display = 'none';
            });
        },

        // Mostrar mensaje para no administradores
        showNonAdminMessage() {
            console.log('👤 Usuario no administrador, elementos ocultos');
        },

        // Verificar permisos de administrador (para usar antes de acciones)
        checkAdminPermissions() {
            if (!this.isAdmin()) {
                this.showNotification('No tienes permisos de administrador para realizar esta acción', 'error');
                return false;
            }
            return true;
        },

        // Redirigir si no es administrador
        redirectIfNotAdmin(redirectUrl = 'inicio_sesion_personal_TUCSA.html') {
            if (!this.isAdmin()) {
                this.showNotification('No tienes permisos de administrador para acceder a esta página', 'error');
                window.location.href = redirectUrl;
                return false;
            }
            return true;
        },

        // Redirigir si no está autenticado
        redirectIfNotAuthenticated(redirectUrl = 'inicio_sesion_personal_TUCSA.html') {
            if (!this.isAuthenticated()) {
                this.showNotification('Debes iniciar sesión para acceder a esta página', 'error');
                window.location.href = redirectUrl;
                return false;
            }
            return true;
        },

        // Verificar permisos para una página específica
        async checkPagePermissions(requiredRole = 'administrador', redirectUrl = 'inicio_sesion_personal_TUCSA.html') {
            const isAuthenticated = await this.initialize();
            
            if (!isAuthenticated) {
                this.showNotification('Debes iniciar sesión para acceder a esta página', 'error');
                window.location.href = redirectUrl;
                return false;
            }

            if (requiredRole === 'administrador' && !this.isAdmin()) {
                this.showNotification('No tienes permisos de administrador para acceder a esta página', 'error');
                window.location.href = redirectUrl;
                return false;
            }

            if (requiredRole === 'chofer' && !this.isChofer()) {
                this.showNotification('No tienes permisos de chofer para acceder a esta página', 'error');
                window.location.href = redirectUrl;
                return false;
            }

            if (requiredRole === 'any') {
                return true;
            }

            return true;
        },

        // Mostrar notificación
        showNotification(message, type = 'info') {
            let toastEl = document.getElementById('auth-toast-personal');
            if (!toastEl) {
                toastEl = document.createElement('div');
                toastEl.id = 'auth-toast-personal';
                toastEl.className = 'toast';
                toastEl.setAttribute('role', 'alert');
                toastEl.setAttribute('aria-live', 'assertive');
                toastEl.setAttribute('aria-atomic', 'true');
                toastEl.innerHTML = `
                    <div class="toast-header">
                        <strong class="me-auto">Notificación</strong>
                        <button type="button" class="btn-close" data-bs-dismiss="toast"></button>
                    </div>
                    <div class="toast-body"></div>
                `;
                document.body.appendChild(toastEl);
            }

            const toast = new bootstrap.Toast(toastEl);
            const toastHeader = toastEl.querySelector('.toast-header');
            const toastBody = toastEl.querySelector('.toast-body');
            
            let icon = '';
            let title = '';
            
            switch(type) {
                case 'success':
                    icon = 'fa-circle-check text-success';
                    title = 'Éxito';
                    break;
                case 'error':
                    icon = 'fa-circle-exclamation text-danger';
                    title = 'Error';
                    break;
                case 'warning':
                    icon = 'fa-triangle-exclamation text-warning';
                    title = 'Advertencia';
                    break;
                default:
                    icon = 'fa-circle-info text-info';
                    title = 'Información';
            }
            
            toastHeader.innerHTML = `
                <i class="fa-solid ${icon} me-2"></i>
                <strong class="me-auto">${title}</strong>
                <button type="button" class="btn-close" data-bs-dismiss="toast"></button>
            `;
            
            toastBody.textContent = message;
            toast.show();
        },

        // Cerrar sesión (para personal TUCSA)
        logout(redirectUrl = 'inicio_sesion_personal_TUCSA.html') {
            console.log('🚪 Cerrando sesión del personal TUCSA...');
            localStorage.removeItem('tucsa_token');
            localStorage.removeItem('tucsa_personal');
            localStorage.removeItem('tucsa_last_login');
            currentUser = null;
            window.location.href = redirectUrl;
        },

        // Depuración: mostrar estado actual
        debug() {
            console.log('🔍 Debug UserAuthPersonal:');
            console.log(' - Authenticated:', this.isAuthenticated());
            console.log(' - Current User:', this.getCurrentUser());
            console.log(' - Is Admin:', this.isAdmin());
            console.log(' - Is Chofer:', this.isChofer());
            console.log(' - LocalStorage tucsa_personal:', localStorage.getItem('tucsa_personal'));
            console.log(' - LocalStorage tucsa_token:', localStorage.getItem('tucsa_token') ? 'Presente' : 'Ausente');
        }
    };
})();

// Hacer disponible globalmente
window.UserAuthPersonal = UserAuthPersonal;