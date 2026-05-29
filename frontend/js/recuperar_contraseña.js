document.addEventListener('DOMContentLoaded', function() {
    const form = document.querySelector('form');
    const emailInput = document.getElementById('email_recovery');

    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const email = emailInput.value.trim();

        // Validaciones básicas
        if (!email) {
            showAlert('❌ Por favor ingresa tu correo electrónico', 'error');
            emailInput.focus();
            return;
        }

        // Validar formato de email
        if (!isValidEmail(email)) {
            showAlert('❌ Por favor ingresa un correo electrónico válido', 'error');
            emailInput.focus();
            return;
        }

        // Mostrar loading en el botón
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="bi bi-arrow-repeat spinner"></i> Enviando...';
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
                
                // Guardar email para siguiente paso
                localStorage.setItem('emailRecuperacion', email);
                
                // Redirigir a página de restablecimiento después de 2 segundos
                setTimeout(() => {
                    window.location.href = 'restablecer_contraseña.html';
                }, 2000);
                
            } else {
                showAlert('❌ ' + data.mensaje, 'error');
                emailInput.focus();
            }

        } catch (error) {
            showAlert('❌ Error de conexión: ' + error.message, 'error');
        } finally {
            // Restaurar botón
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    });

    // Función para validar email
    function isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

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

    // Enter key para enviar formulario
    emailInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            form.dispatchEvent(new Event('submit'));
        }
    });
});