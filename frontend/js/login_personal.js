class LoginPersonal {
    constructor() {
        this.initializeEventListeners();
        this.checkExistingSession();
    }

    initializeEventListeners() {
        document.getElementById('loginForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });

        document.getElementById('togglePassword')?.addEventListener('click', () => {
            this.togglePasswordVisibility();
        });

        document.querySelectorAll('input[name="role"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.updateUIForRole(e.target.value);
            });
        });
    }

    togglePasswordVisibility() {
        const passwordInput = document.getElementById('password');
        const toggleIcon = document.getElementById('togglePassword').querySelector('i');
        
        if (passwordInput.type === 'password') {
            passwordInput.type = 'text';
            toggleIcon.className = 'bi bi-eye-fill';
        } else {
            passwordInput.type = 'password';
            toggleIcon.className = 'bi bi-eye-slash-fill';
        }
    }

    updateUIForRole(role) {
        console.log('Rol seleccionado:', role);
    }

    async handleLogin() {
        const email = document.getElementById('usuario').value.trim();
        const password = document.getElementById('password').value;
        const role = document.querySelector('input[name="role"]:checked')?.value;

        // Validaciones previas
        if (!this.validateEmail(email)) {
            this.showError('❌ Por favor ingresa un correo electrónico válido');
            document.getElementById('usuario').focus();
            return;
        }

        if (!email || !password || !role) {
            this.showError('❌ Por favor completa todos los campos');
            return;
        }

        this.showLoading(true);

        try {
            console.log('🌐 Intentando conectar con el servidor...');
            
            // Agregar timeout para evitar esperas infinitas
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 segundos timeout

            const response = await fetch(`https://${IP_API}:8000/api/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: email,
                    password: password,
                    rol: role
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            console.log('📡 Response status:', response.status);
            
            const result = await response.json();
            console.log('📦 Response data:', result);

            if (response.ok && result.success) {
                console.log('✅ Login exitoso');
                this.showSuccess(`✅ ¡Bienvenido ${result.usuario.nombre || ''}!`);
                this.saveSession(result.usuario);
                
                setTimeout(() => {
                    this.redirectToDashboard(result.usuario.rol);
                }, 1500);
                
            } else {
                console.log('❌ Login fallido:', result.mensaje || result.detail);
                this.handleLoginError(result.mensaje || result.detail, result);
            }
        } catch (error) {
            console.error('💥 Error completo:', error);
            this.handleConnectionError(error);
        } finally {
            this.showLoading(false);
        }
    }

    handleConnectionError(error) {
        if (error.name === 'AbortError') {
            this.showError('⏰ Tiempo de espera agotado. El servidor no responde.');
        } else if (error.message.includes('Failed to fetch')) {
            this.showError('🔌 Error de conexión. Verifica que:<br>' +
                          '• El servidor esté ejecutándose<br>' +
                          '• La URL sea correcta<br>' +
                          '• No haya problemas de CORS');
        } else if (error.message.includes('HTTP')) {
            this.showError(`❌ Error del servidor: ${error.message}`);
        } else {
            this.showError('❌ Error inesperado: ' + error.message);
        }
    }

    validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    handleLoginError(errorMessage, result) {
        const lowerCaseMessage = errorMessage.toLowerCase();
        
        // Manejar errores específicos de contraseña
        if (lowerCaseMessage.includes('contraseña') || 
            lowerCaseMessage.includes('password') || 
            lowerCaseMessage.includes('incorrecta') ||
            lowerCaseMessage.includes('inválida') ||
            lowerCaseMessage.includes('credenciales') ||
            errorMessage.includes('Invalid credentials')) {
            
            this.showError('❌ Contraseña incorrecta. Por favor intenta nuevamente');
            this.highlightField('password');
            document.getElementById('password').value = '';
            document.getElementById('password').focus();
            
        } 
        // Manejar errores de rol no correspondiente
        else if (lowerCaseMessage.includes('rol') || 
                 lowerCaseMessage.includes('role') ||
                 lowerCaseMessage.includes('no tiene permisos') ||
                 lowerCaseMessage.includes('no corresponde') ||
                 lowerCaseMessage.includes('permiso denegado')) {
            
            this.showError('❌ El rol seleccionado no corresponde a este usuario. Por favor selecciona el rol correcto.');
            this.highlightRoleSelection();
            
        }
        // Manejar errores de usuario/correo
        else if (lowerCaseMessage.includes('correo') || 
                 lowerCaseMessage.includes('email') || 
                 lowerCaseMessage.includes('usuario') ||
                 lowerCaseMessage.includes('no existe') ||
                 lowerCaseMessage.includes('no encontrado') ||
                 lowerCaseMessage.includes('inválido') ||
                 lowerCaseMessage.includes('not found')) {
            
            this.showError('❌ Correo electrónico no registrado o inválido');
            this.highlightField('usuario');
            document.getElementById('usuario').focus();
            
        } 
        // Manejar cuenta no verificada
        else if (lowerCaseMessage.includes('verific') || 
                 lowerCaseMessage.includes('confirm') ||
                 lowerCaseMessage.includes('activ')) {
            
            this.showError('❌ Cuenta no verificada. Por favor verifica tu email antes de iniciar sesión.');
            
        }
        // Error genérico
        else {
            this.showError(`❌ ${errorMessage}`);
        }
    }

    highlightField(fieldId) {
        document.querySelectorAll('.is-invalid').forEach(el => {
            el.classList.remove('is-invalid');
        });
        
        const field = document.getElementById(fieldId);
        if (field) {
            field.classList.add('is-invalid');
            field.focus();
        }
    }

    highlightRoleSelection() {
        // Resaltar todos los radio buttons de rol
        document.querySelectorAll('input[name="role"]').forEach(radio => {
            radio.closest('.form-check')?.classList.add('border', 'border-danger', 'rounded', 'p-2');
        });
        
        // Quitar el highlight después de 3 segundos
        setTimeout(() => {
            document.querySelectorAll('input[name="role"]').forEach(radio => {
                radio.closest('.form-check')?.classList.remove('border', 'border-danger', 'rounded', 'p-2');
            });
        }, 3000);
    }

    saveSession(usuario) {
        // CAMBIO: Guardar en variable diferente según el rol
        if (usuario.rol === 'chofer') {
            localStorage.setItem('tucsa_chofer', JSON.stringify(usuario)); // ← CHOFER
            localStorage.setItem('tucsa_token_chofer', usuario.token || 'token_simulado');
        } else {
            localStorage.setItem('tucsa_personal', JSON.stringify(usuario)); // ← ADMIN (existente)
            localStorage.setItem('tucsa_token', usuario.token || 'token_simulado');
        }
        localStorage.setItem('tucsa_last_login', new Date().toISOString());
    }

    redirectToDashboard(rol) {
        switch(rol) {
            case 'administrador':
                window.location.href = 'Administrativo.html';
                break;
            case 'chofer':
                window.location.href = 'chofer_inicio.html';
                break;
            default:
                this.showError('❌ Rol no reconocido');
        }
    }

    showError(mensaje) {
        this.showAlert(mensaje, 'danger');
    }

    showSuccess(mensaje) {
        this.showAlert(mensaje, 'success');
    }

    showAlert(mensaje, tipo) {
        const existingAlert = document.getElementById('loginAlert');
        if (existingAlert) {
            existingAlert.remove();
        }

        const alertDiv = document.createElement('div');
        alertDiv.id = 'loginAlert';
        alertDiv.className = `alert alert-${tipo} alert-dismissible fade show`;
        
        let icon = '';
        switch(tipo) {
            case 'danger':
                icon = '<i class="bi bi-exclamation-triangle-fill me-2"></i>';
                break;
            case 'success':
                icon = '<i class="bi bi-check-circle-fill me-2"></i>';
                break;
        }
        
        alertDiv.innerHTML = `
            ${icon}
            ${mensaje}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;

        const cardBody = document.querySelector('.card-body');
        cardBody.insertBefore(alertDiv, cardBody.firstChild);

        if (tipo === 'success') {
            setTimeout(() => {
                if (alertDiv.parentNode) {
                    alertDiv.remove();
                }
            }, 5000);
        }
    }

    showLoading(show) {
        const submitBtn = document.querySelector('button[type="submit"]');
        if (show) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Conectando...';
        } else {
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Iniciar Sesión <i class="bi bi-arrow-right-short"></i>';
            
            document.querySelectorAll('.is-invalid').forEach(el => {
                el.classList.remove('is-invalid');
            });
        }
    }

    checkExistingSession() {
        const existingSession = localStorage.getItem('tucsa_personal');
        if (existingSession) {
            console.log('👤 Sesión existente encontrada');
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new LoginPersonal();
});