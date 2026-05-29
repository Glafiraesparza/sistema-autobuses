document.addEventListener('DOMContentLoaded', function() {
    const form = document.querySelector('form');
    const passwordInput = document.getElementById('password');
    const confirmPasswordInput = document.getElementById('confirm_password');
    const togglePassword = document.getElementById('togglePassword');
    const toggleConfirmPassword = document.getElementById('toggleConfirmPassword');

    // Función para mostrar/ocultar contraseña
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
    togglePassword.addEventListener('click', function() {
        togglePasswordVisibility(passwordInput, this.querySelector('i'));
    });

    toggleConfirmPassword.addEventListener('click', function() {
        togglePasswordVisibility(confirmPasswordInput, this.querySelector('i'));
    });

    // Validación del formulario
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        // Validar que las contraseñas coincidan
        if (passwordInput.value !== confirmPasswordInput.value) {
            alert('❌ Las contraseñas no coinciden');
            return;
        }

        // Validar longitud de contraseña
        if (passwordInput.value.length < 8) {
            alert('❌ La contraseña debe tener al menos 8 caracteres');
            return;
        }

        const usuarioData = {
            nombre: document.getElementById('nombre').value.trim(),
            email: document.getElementById('email').value.trim(),
            password: passwordInput.value
        };

        // Mostrar loading en el botón
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="bi bi-arrow-repeat spinner"></i> Registrando...';
        submitBtn.disabled = true;

        try {
            const response = await fetch(`https://sistema-autobuses.onrender.com/api/usuarios/registro`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(usuarioData)
            });
            
            if (response.ok) {
                const usuario = await response.json();
                alert(`✅ ¡Registro exitoso!\n\nTu cuenta ha sido creada:\n- Tipo: ${usuario.tipo}\n- Tarifa: $${usuario.tarifa_actual}\n- CLABE: ${usuario.clabe_recarga}\n\nGuarda tu CLABE para recargar saldo.`);
                window.location.href = 'inicio_sesion.html';
            } else {
                const error = await response.json();
                alert('❌ Error: ' + error.detail);
            }
        } catch (error) {
            alert('❌ Error de conexión: ' + error.message);
        } finally {
            // Restaurar botón
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    });

    // Validación en tiempo real de contraseñas
    confirmPasswordInput.addEventListener('input', function() {
        if (passwordInput.value !== confirmPasswordInput.value) {
            confirmPasswordInput.classList.add('is-invalid');
            confirmPasswordInput.classList.remove('is-valid');
        } else {
            confirmPasswordInput.classList.remove('is-invalid');
            confirmPasswordInput.classList.add('is-valid');
        }
    });

    passwordInput.addEventListener('input', function() {
        if (passwordInput.value.length < 8) {
            passwordInput.classList.add('is-invalid');
            passwordInput.classList.remove('is-valid');
        } else {
            passwordInput.classList.remove('is-invalid');
            passwordInput.classList.add('is-valid');
        }
        
        // Actualizar validación de confirmación
        if (confirmPasswordInput.value) {
            confirmPasswordInput.dispatchEvent(new Event('input'));
        }
    });
});