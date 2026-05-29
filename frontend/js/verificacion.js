document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('verificacionForm');
    const codigoInput = document.getElementById('codigo_verificacion');
    const emailInput = document.getElementById('email');
    const reenviarLink = document.getElementById('reenviarCodigo');

    // Obtener email de la URL o localStorage
    const urlParams = new URLSearchParams(window.location.search);
    const email = urlParams.get('email') || localStorage.getItem('emailParaVerificacion');
    
    if (!email) {
        alert('❌ Error: No se encontró información de email. Regresa al inicio de sesión.');
        window.location.href = 'inicio_sesion.html';
        return;
    }

    emailInput.value = email;

    // Validación en tiempo real del código
    codigoInput.addEventListener('input', function() {
        const codigo = this.value.replace(/\D/g, ''); // Solo números
        this.value = codigo;
        
        if (codigo.length === 6) {
            this.classList.add('is-valid');
            this.classList.remove('is-invalid');
        } else {
            this.classList.remove('is-valid');
            this.classList.remove('is-invalid');
        }
    });

    // Envío del formulario
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const codigo = codigoInput.value.trim();
        
        if (codigo.length !== 6) {
            mostrarAlerta('❌ Por favor ingresa un código de 6 dígitos', 'error');
            codigoInput.classList.add('is-invalid');
            return;
        }

        // Mostrar loading
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="bi bi-arrow-repeat spinner"></i> Verificando...';
        submitBtn.disabled = true;

        try {
            const response = await fetch(`https://sistema-autobuses.onrender.com/api/usuarios/verificar-codigo`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: email,
                    codigo_verificacion: codigo
                })
            });
            
            if (response.ok) {
                const result = await response.json();
                mostrarAlerta('✅ Verificación exitosa. Ahora puedes iniciar sesión normalmente.', 'success');
                
                // Limpiar localStorage y redirigir después de 2 segundos
                setTimeout(() => {
                    localStorage.removeItem('emailParaVerificacion');
                    window.location.href = 'inicio_sesion.html';
                }, 2000);
                
            } else {
                const error = await response.json();
                mostrarAlerta('❌ Error: ' + error.detail, 'error');
                codigoInput.classList.add('is-invalid');
            }
        } catch (error) {
            mostrarAlerta('❌ Error de conexión: ' + error.message, 'error');
        } finally {
            // Restaurar botón
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    });

    // ✅ AGREGUE 19/11/2025 Tomás - Reenviar código con funcionalidad completa
    reenviarLink.addEventListener('click', async function(e) {
        e.preventDefault();
        
        // Deshabilitar el enlace temporalmente para evitar múltiples clics
        reenviarLink.style.pointerEvents = 'none';
        const originalText = reenviarLink.innerHTML;
        reenviarLink.innerHTML = '<i class="bi bi-arrow-repeat spinner"></i> Enviando...';
        
        try {
            const response = await fetch(`https://sistema-autobuses.onrender.com/api/usuarios/reenviar-codigo-verificacion`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: email
                })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                mostrarAlerta('✅ ' + data.mensaje, 'success');
                
                // Contador de tiempo para próximo reenvío
                iniciarContadorReenvio();
                
            } else {
                mostrarAlerta('❌ ' + data.detail, 'error');
            }
            
        } catch (error) {
            mostrarAlerta('❌ Error de conexión: ' + error.message, 'error');
        } finally {
            // Restaurar el enlace después de 2 segundos
            setTimeout(() => {
                reenviarLink.innerHTML = originalText;
                reenviarLink.style.pointerEvents = 'auto';
            }, 2000);
        }
    });

    // ✅ AGREGUE 19/11/2025 Tomás - Función para contador de reenvío
    function iniciarContadorReenvio() {
        let segundos = 60; // 1 minuto de espera
        reenviarLink.style.pointerEvents = 'none';
        
        const intervalo = setInterval(() => {
            reenviarLink.innerHTML = `Espera ${segundos}s para reenviar`;
            segundos--;
            
            if (segundos <= 0) {
                clearInterval(intervalo);
                reenviarLink.innerHTML = '¿No recibiste el código? Reenviar';
                reenviarLink.style.pointerEvents = 'auto';
            }
        }, 1000);
    }

    // ✅ AGREGUE 19/11/2025 Tomás - Función para mostrar alertas mejoradas
    function mostrarAlerta(mensaje, tipo) {
        // Remover alerta anterior si existe
        const existingAlert = document.querySelector('.alert');
        if (existingAlert) {
            existingAlert.remove();
        }

        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${tipo === 'error' ? 'danger' : 'success'} alert-dismissible fade show mt-3`;
        alertDiv.innerHTML = `
            ${mensaje}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;

        // Insertar después del formulario
        form.parentNode.insertBefore(alertDiv, form.nextSibling);

        // Auto-remover después de 5 segundos para éxito
        if (tipo === 'success') {
            setTimeout(() => {
                if (alertDiv.parentNode) {
                    alertDiv.remove();
                }
            }, 5000);
        }
    }

    // Focus automático en el campo de código
    codigoInput.focus();
});