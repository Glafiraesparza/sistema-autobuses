document.addEventListener('DOMContentLoaded', function() {
    const form = document.querySelector('form');
    const passwordInput = document.getElementById('password');
    const togglePassword = document.getElementById('togglePassword');
    const usuarioInput = document.getElementById('usuario');

    // Función para mostrar/ocultar contraseña
    function togglePasswordVisibility() {
        if (passwordInput.type === 'password') {
            passwordInput.type = 'text';
            togglePassword.querySelector('i').classList.remove('bi-eye-slash-fill');
            togglePassword.querySelector('i').classList.add('bi-eye-fill');
        } else {
            passwordInput.type = 'password';
            togglePassword.querySelector('i').classList.remove('bi-eye-fill');
            togglePassword.querySelector('i').classList.add('bi-eye-slash-fill');
        }
    }

    // Event listener para mostrar/ocultar contraseña
    togglePassword.addEventListener('click', togglePasswordVisibility);

    // Validación y envío del formulario
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const loginData = {
            email: usuarioInput.value.trim(),
            password: passwordInput.value
        };

        // Validaciones básicas
        if (!loginData.email) {
            showAlert('❌ Por favor ingresa tu email', 'error');
            usuarioInput.focus();
            return;
        }

        if (!loginData.password) {
            showAlert('❌ Por favor ingresa tu contraseña', 'error');
            passwordInput.focus();
            return;
        }

        // Mostrar loading en el botón
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="bi bi-arrow-repeat spinner"></i> Iniciando sesión...';
        submitBtn.disabled = true;

        try {
            const response = await fetch(`https://sistema-autobuses.onrender.com/api/usuarios/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(loginData)
            });
            
            const data = await response.json();
            
            if (response.ok) {
                // ✅ MODIFICACIÓN 19/11/2025 Tomás Inicio - Manejo de verificación requerida
                if (data.requiere_verificacion) {
                    showAlert('📧 Se requiere código de verificación para primer inicio de sesión', 'info');
                    
                    // Guardar email para verificación
                    localStorage.setItem('emailParaVerificacion', loginData.email);
                    
                    // Redirigir a página de verificación después de 1.5 segundos
                    setTimeout(() => {
                        window.location.href = `verificacion.html?email=${encodeURIComponent(loginData.email)}`;
                    }, 1500);
                    
                } else {
                    // Login exitoso sin verificación requerida
                    // Guardar token en localStorage (aunque sea fake por ahora)
                    localStorage.setItem('auth_token', data.access_token);
                    localStorage.setItem('user_data', JSON.stringify(data.usuario));
                    
                    showAlert(`✅ ¡Bienvenido ${data.usuario.nombre}!`, 'success');
                    
                    // Redirigir después de 1.5 segundos
                    setTimeout(() => {
                        window.location.href = 'pasajero_inicio.html';
                    }, 1500);
                }
                // ✅ MODIFICACIÓN 19/11/2025 Tomás Fin - Manejo de verificación requerida
                
            } else {
                showAlert('❌ ' + data.detail, 'error');
                
                // Limpiar contraseña en caso de error
                passwordInput.value = '';
                passwordInput.focus();
            }

        } catch (error) {
            showAlert('❌ Error de conexión: ' + error.message, 'error');
        } finally {
            // Restaurar botón
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    });

    // Función para mostrar alertas
    function showAlert(message, type) {
        // Remover alerta anterior si existe
        const existingAlert = document.querySelector('.alert');
        if (existingAlert) {
            existingAlert.remove();
        }

        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type === 'error' ? 'danger' : type === 'info' ? 'info' : 'success'} alert-dismissible fade show`;
        alertDiv.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;

        // Insertar después del formulario
        form.parentNode.insertBefore(alertDiv, form.nextSibling);

        // Auto-remover después de 5 segundos para éxito/info
        if (type === 'success' || type === 'info') {
            setTimeout(() => {
                if (alertDiv.parentNode) {
                    alertDiv.remove();
                }
            }, 5000);
        }
    }

    // Enter key navigation
    usuarioInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            passwordInput.focus();
        }
    });

    passwordInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            form.dispatchEvent(new Event('submit'));
        }
    });
});