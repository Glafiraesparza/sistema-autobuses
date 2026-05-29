document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('restablecerForm');
    const codigoInput = document.getElementById('codigo_recuperacion');
    const nuevaPasswordInput = document.getElementById('nueva_password');
    const confirmarPasswordInput = document.getElementById('confirmar_password');
    const emailInput = document.getElementById('email');
    const toggleNuevaPassword = document.getElementById('toggleNuevaPassword');
    const toggleConfirmarPassword = document.getElementById('toggleConfirmarPassword');
    const reenviarLink = document.getElementById('reenviarCodigo');

    // Obtener email de localStorage
    const email = localStorage.getItem('emailRecuperacion');
    
    if (!email) {
        showAlert('❌ Error: No se encontró información de email. Regresa a recuperar contraseña.', 'error');
        setTimeout(() => {
            window.location.href = 'recuperar_contraseña.html';
        }, 2000);
        return;
    }

    emailInput.value = email;

    // Funciones para mostrar/ocultar contraseña
    function togglePasswordVisibility(input, icon) {
        if (input.type === 'password') {
            input.type = 'text';
            icon.classList.remove('bi-eye-slash-fill');
            icon.classList.add('bi-eye-fill');
        } else {
            input.type = 'password';
            icon.classList.remove('bi-eye-fill');
            icon.classList.add('bi-eye-slash-fill');
        }
    }

    // Event listeners para mostrar/ocultar contraseña
    toggleNuevaPassword.addEventListener('click', function() {
        togglePasswordVisibility(nuevaPasswordInput, this.querySelector('i'));
    });

    toggleConfirmarPassword.addEventListener('click', function() {
        togglePasswordVisibility(confirmarPasswordInput, this.querySelector('i'));
    });

    // Validación en tiempo real del código
    codigoInput.addEventListener('input', function() {
        const codigo = this.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); // Solo mayúsculas y números
        this.value = codigo;
        
        if (codigo.length === 8) {
            this.classList.add('is-valid');
            this.classList.remove('is-invalid');
        } else {
            this.classList.remove('is-valid');
            this.classList.remove('is-invalid');
        }
    });

    // Validación en tiempo real de contraseñas
    function validarPasswords() {
        const password = nuevaPasswordInput.value;
        const confirmacion = confirmarPasswordInput.value;

        // Validar nueva contraseña
        if (password.length >= 8) {
            nuevaPasswordInput.classList.add('is-valid');
            nuevaPasswordInput.classList.remove('is-invalid');
        } else {
            nuevaPasswordInput.classList.remove('is-valid');
            nuevaPasswordInput.classList.remove('is-invalid');
        }

        // Validar confirmación
        if (confirmacion && password === confirmacion) {
            confirmarPasswordInput.classList.add('is-valid');
            confirmarPasswordInput.classList.remove('is-invalid');
        } else if (confirmacion) {
            confirmarPasswordInput.classList.add('is-invalid');
            confirmarPasswordInput.classList.remove('is-valid');
        } else {
            confirmarPasswordInput.classList.remove('is-valid');
            confirmarPasswordInput.classList.remove('is-invalid');
        }
    }

    nuevaPasswordInput.addEventListener('input', validarPasswords);
    confirmarPasswordInput.addEventListener('input', validarPasswords);

    // Envío del formulario
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const codigo = codigoInput.value.trim().toUpperCase();
        const nuevaPassword = nuevaPasswordInput.value;
        const confirmarPassword = confirmarPasswordInput.value;

        // Validaciones
        if (codigo.length !== 8) {
            showAlert('❌ Por favor ingresa un código de 8 caracteres', 'error');
            codigoInput.focus();
            return;
        }

        if (nuevaPassword.length < 8) {
            showAlert('❌ La contraseña debe tener al menos 8 caracteres', 'error');
            nuevaPasswordInput.focus();
            return;
        }

        if (nuevaPassword !== confirmarPassword) {
            showAlert('❌ Las contraseñas no coinciden', 'error');
            confirmarPasswordInput.focus();
            return;
        }

        // Mostrar loading
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="bi bi-arrow-repeat spinner"></i> Restableciendo...';
        submitBtn.disabled = true;

        try {
            const response = await fetch(`https://${IP_API}:8000/api/password/verificar-codigo`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: email,
                    codigo_recuperacion: codigo,
                    nueva_password: nuevaPassword
                })
            });
            
            const data = await response.json();
            
            if (data.exito) {
                showAlert('✅ ' + data.mensaje, 'success');
                
                // Limpiar localStorage
                localStorage.removeItem('emailRecuperacion');
                
                // Redirigir a inicio de sesión después de 2 segundos
                setTimeout(() => {
                    window.location.href = 'inicio_sesion.html';
                }, 2000);
                
            } else {
                showAlert('❌ ' + data.mensaje, 'error');
                codigoInput.focus();
            }
        } catch (error) {
            showAlert('❌ Error de conexión: ' + error.message, 'error');
        } finally {
            // Restaurar botón
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    });

    // Reenviar código
    reenviarLink.addEventListener('click', async function(e) {
        e.preventDefault();
        
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="bi bi-arrow-repeat spinner"></i> Reenviando...';
        submitBtn.disabled = true;

        try {
            const response = await fetch(`https://${IP_API}:8000/api/password/solicitar-recuperacion`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: email
                })
            });
            
            const data = await response.json();
            
            if (data.exito) {
                showAlert('✅ ' + data.mensaje, 'success');
            } else {
                showAlert('❌ ' + data.mensaje, 'error');
            }
        } catch (error) {
            showAlert('❌ Error de conexión: ' + error.message, 'error');
        } finally {
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
        alertDiv.className = `alert alert-${type === 'error' ? 'danger' : 'success'} alert-dismissible fade show mt-3`;
        alertDiv.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;

        // Insertar después del formulario
        form.parentNode.insertBefore(alertDiv, form.nextSibling);

        // Auto-remover después de 5 segundos para éxito
        if (type === 'success') {
            setTimeout(() => {
                if (alertDiv.parentNode) {
                    alertDiv.remove();
                }
            }, 5000);
        }
    }

    // Navegación con Enter
    codigoInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            nuevaPasswordInput.focus();
        }
    });

    nuevaPasswordInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            confirmarPasswordInput.focus();
        }
    });

    confirmarPasswordInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            form.dispatchEvent(new Event('submit'));
        }
    });
});