document.addEventListener('DOMContentLoaded', function() {

    PassengerNotificationManager.initialize((notifications) => {
        console.log('🔔 Notificaciones de retraso actualizadas:', notifications);
        // Actualizar la UI cuando cambien las notificaciones
        PassengerNotificationManager.updateNotificationsDropdown();
        PassengerNotificationManager.updateNotificationBadge();
    });
    const form = document.getElementById('solicitudForm');
    const fileUploadArea = document.getElementById('fileUploadArea');
    const documentoInput = document.getElementById('documento');
    const previewContainer = document.getElementById('previewContainer');
    const fechaNacimientoInput = document.getElementById('fecha_nacimiento');
    const edadCalculadaDiv = document.getElementById('edadCalculada');
    const tieneDiscapacidadCheckbox = document.getElementById('tiene_discapacidad');
    const seccionDiscapacidad = document.getElementById('seccionDiscapacidad');
    const loadingOverlay = document.getElementById('loadingOverlay');
    const progressBar = document.querySelector('.progress-bar');
    const contadorSegundos = document.getElementById('contadorSegundos');

    let usuarioActual = null;
    

    // Cargar datos del usuario
function cargarDatosUsuario() {
    const userData = localStorage.getItem('user_data');
    if (userData) {
        usuarioActual = JSON.parse(userData);
        
        // ✅ CORREGIDO: Pasar el objeto usuarioActual, no el string
        actualizarInterfazUsuario(usuarioActual);
        
        // Si el usuario ya tiene tarifa preferencial, bloquear formulario
        if (usuarioActual.tipo !== 'normal') {
            mostrarEstadoTarifaPreferencial(usuarioActual);
            bloquearFormulario();
        } else {
            // Solo prellenar datos si no tiene tarifa preferencial
            document.getElementById('nombre_completo').value = usuarioActual.nombre || '';
            document.getElementById('email').value = usuarioActual.email || '';
        }
    }
}

    

// Mostrar estado de tarifa preferencial existente
function mostrarEstadoTarifaPreferencial(usuario) {
    // Ocultar el formulario normal
    document.getElementById('solicitudForm').style.display = 'none';
    
    // Crear y mostrar tarjeta de estado actual
    const estadoHTML = `
        <div class="row justify-content-center">
            <div class="col-12 col-lg-8">
                <div class="info-card info-card-success">
                    <div class="card-body text-center">
                        <div class="mb-4">
                            <i class="fa-solid fa-circle-check success-icon"></i>
                            <h2 class="text-success mt-3">¡Ya Cuentas con Tarifa Preferencial!</h2>
                        </div>
                        
                        <div class="row justify-content-center mb-4">
                            <div class="col-md-6">
                                <div class="estado-tarjeta">
                                    <div class="estado-icono">
                                        <i class="fa-solid fa-user-tag"></i>
                                    </div>
                                    <div class="estado-info">
                                        <h4>Tipo de Usuario</h4>
                                        <span class="badge bg-success fs-6">${usuario.tipo}</span>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-6">
                                <div class="estado-tarjeta">
                                    <div class="estado-icono">
                                        <i class="fa-solid fa-money-bill-wave"></i>
                                    </div>
                                    <div class="estado-info">
                                        <h4>Tarifa Actual</h4>
                                        <span class="tarifa-actual">$${usuario.tarifa_actual} MXN</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="alert alert-info">
                            <h5><i class="fa-solid fa-info-circle me-2"></i>Información</h5>
                            <p class="mb-2">Tu tarifa preferencial está activa y se aplicará automáticamente en todos tus viajes.</p>
                            <small>Si necesitas realizar algún cambio, contacta con soporte.</small>
                        </div>
                        
                        <div class="d-grid gap-2 d-md-flex justify-content-center mt-4">
                            <a href="pasajero_inicio.html" class="btn btn-primary btn-lg me-md-3">
                                <i class="fa-solid fa-arrow-left me-2"></i>
                                Volver al Panel
                            </a>
                            <button class="btn btn-outline-secondary btn-lg" onclick="mostrarDetallesTarifa()">
                                <i class="fa-solid fa-circle-info me-2"></i>
                                Ver Detalles
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Insertar después del título principal
    const mainContent = document.querySelector('.main-content .container');
    const tituloPrincipal = mainContent.querySelector('.row.mb-4');
    tituloPrincipal.insertAdjacentHTML('afterend', estadoHTML);
}

// Bloquear el formulario completo
function bloquearFormulario() {
    const form = document.getElementById('solicitudForm');
    const inputs = form.querySelectorAll('input, select, textarea, button');
    document.getElementById('formulario_contenedor').style.display = 'none';
    
    inputs.forEach(input => {
        input.disabled = true;
        input.style.opacity = '0.6';
        input.style.cursor = 'not-allowed';
    });
    
    // También deshabilitar el área de upload
    const fileUploadArea = document.getElementById('fileUploadArea');
    if (fileUploadArea) {
        fileUploadArea.style.opacity = '0.6';
        fileUploadArea.style.cursor = 'not-allowed';
        fileUploadArea.onclick = null;
        fileUploadArea.ondragover = null;
        fileUploadArea.ondrop = null;
    }
}

// Función opcional para mostrar detalles de la tarifa
function mostrarDetallesTarifa() {
    const modalHTML = `
        <div class="modal fade" id="modalDetalles" tabindex="-1">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header bg-primary text-white">
                        <h5 class="modal-title">
                            <i class="fa-solid fa-info-circle me-2"></i>
                            Detalles de tu Tarifa Preferencial
                        </h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="row">
                            <div class="col-6">
                                <strong>Tipo de Usuario:</strong>
                            </div>
                            <div class="col-6">
                                <span class="badge bg-success">${usuarioActual.tipo}</span>
                            </div>
                            
                            <div class="col-6">
                                <strong>Tarifa Actual:</strong>
                            </div>
                            <div class="col-6">
                                <span class="fw-bold text-success">$${usuarioActual.tarifa_actual} MXN</span>
                            </div>
                            
                            <div class="col-6">
                                <strong>Ahorro por Viaje:</strong>
                            </div>
                            <div class="col-6">
                                <span class="text-success">$${(11.00 - usuarioActual.tarifa_actual).toFixed(2)} MXN</span>
                            </div>
                            
                            <div class="col-6">
                                <strong>Estado:</strong>
                            </div>
                            <div class="col-6">
                                <span class="badge bg-success">Activa</span>
                            </div>
                        </div>
                        
                        <hr>
                        
                        <div class="alert alert-warning">
                            <h6><i class="fa-solid fa-clock me-2"></i>Próxima Renovación</h6>
                            <p class="mb-0">Tu tarifa preferencial es permanente. No requiere renovación.</p>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-primary" data-bs-dismiss="modal">Cerrar</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    const modal = new bootstrap.Modal(document.getElementById('modalDetalles'));
    modal.show();
    
    // Limpiar el modal después de cerrar
    document.getElementById('modalDetalles').addEventListener('hidden.bs.modal', function() {
        this.remove();
    });
}

    // Actualizar interfaz con datos del usuario
function actualizarInterfazUsuario(usuario) {
    console.log('Actualizando interfaz con:', usuario);
    
    if (!usuario || !usuario.nombre) {
        console.warn('Datos de usuario incompletos:', usuario);
        return;
    }
    
    const nombreCompleto = usuario.nombre;
    const primerNombre = nombreCompleto.split(' ')[0];

    // Actualizar menú offcanvas
    const offcanvasHeader = document.querySelector('.offcanvas-profile-header');
    if (offcanvasHeader) {
        offcanvasHeader.innerHTML = `
            <i class="fa-solid fa-circle-user profile-icon"></i>
            <h4>${primerNombre}</h4>
            <p>${usuario.email || 'usuario@tucsa.com'}</p>
            ${usuario.tipo !== 'normal' ? `<small class="badge bg-success">Tarifa ${usuario.tipo}</small>` : ''}
        `;
    }
    
    // Actualizar el saludo en la tarjeta principal
    const saludoElement = document.querySelector('.info-card-primary h1');
    if (saludoElement) {
        if (usuario.tipo !== 'normal') {
            saludoElement.innerHTML = `Hola ${primerNombre} <span class="badge bg-success ms-2">Tarifa ${usuario.tipo}</span>`;
        } else {
            saludoElement.textContent = `Hola ${primerNombre}`;
        }
    }
}

    // Calcular edad automáticamente
    fechaNacimientoInput.addEventListener('change', function() {
        const fechaNacimiento = new Date(this.value);
        const hoy = new Date();
        let edad = hoy.getFullYear() - fechaNacimiento.getFullYear();
        const mes = hoy.getMonth() - fechaNacimiento.getMonth();
        
        if (mes < 0 || (mes === 0 && hoy.getDate() < fechaNacimiento.getDate())) {
            edad--;
        }
        
        if (edad > 0) {
            edadCalculadaDiv.textContent = `${edad} años`;
            edadCalculadaDiv.className = 'form-text';
            
            if (edad >= 60) {
                edadCalculadaDiv.innerHTML += ' <span class="text-success">✓ Eres adulto mayor</span>';
                document.getElementById('es_adulto_mayor').checked = true;
                document.getElementById('es_adulto_mayor').disabled = false; // Habilitar si cumple la edad
            } else {
                edadCalculadaDiv.innerHTML += ' <span class="text-warning">✗ No eres adulto mayor</span>';
                document.getElementById('es_adulto_mayor').checked = false;
                document.getElementById('es_adulto_mayor').disabled = true; // Deshabilitar si no cumple
            }
        } else {
            edadCalculadaDiv.textContent = 'Fecha inválida';
            edadCalculadaDiv.className = 'form-text text-danger';
        }
    });

    // Mostrar/ocultar sección de discapacidad
    tieneDiscapacidadCheckbox.addEventListener('change', function() {
        if (this.checked) {
            seccionDiscapacidad.style.display = 'block';
            // Marcar tipo de discapacidad como requerido
            document.querySelectorAll('input[name="tipo_discapacidad"]').forEach(radio => {
                radio.required = true;
            });
        } else {
            seccionDiscapacidad.style.display = 'none';
            // Quitar requerido
            document.querySelectorAll('input[name="tipo_discapacidad"]').forEach(radio => {
                radio.required = false;
                radio.checked = false;
            });
            document.getElementById('requiere_silla_ruedas').checked = false;
        }
    });

    // Manejar área de subida de archivos
    fileUploadArea.addEventListener('click', function() {
        documentoInput.click();
    });

    fileUploadArea.addEventListener('dragover', function(e) {
        e.preventDefault();
        this.classList.add('dragover');
    });

    fileUploadArea.addEventListener('dragleave', function() {
        this.classList.remove('dragover');
    });

    fileUploadArea.addEventListener('drop', function(e) {
        e.preventDefault();
        this.classList.remove('dragover');
        if (e.dataTransfer.files.length) {
            documentoInput.files = e.dataTransfer.files;
            mostrarPrevisualizacion(e.dataTransfer.files[0]);
        }
    });

    documentoInput.addEventListener('change', function() {
        if (this.files.length) {
            mostrarPrevisualizacion(this.files[0]);
        }
    });

    // Mostrar previsualización de imagen
    function mostrarPrevisualizacion(file) {
        previewContainer.innerHTML = '';
        
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = function(e) {
                const img = document.createElement('img');
                img.src = e.target.result;
                img.className = 'preview-image';
                img.alt = 'Vista previa del documento';
                previewContainer.appendChild(img);
            };
            reader.readAsDataURL(file);
        } else {
            previewContainer.innerHTML = `
                <div class="alert alert-info mt-2">
                    <i class="bi bi-file-earmark"></i>
                    Archivo: ${file.name}
                </div>
            `;
        }
        
        fileUploadArea.querySelector('p').textContent = 'Documento seleccionado';
        fileUploadArea.classList.add('bg-light');
    }

    // Envío del formulario
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        if (!usuarioActual) {
            mostrarAlerta('❌ No se encontraron datos de usuario. Inicia sesión nuevamente.', 'error');
            return;
        }

        // Validaciones
        if (!validarFormulario()) {
            return;
        }

        // Mostrar overlay de carga
        mostrarOverlayCarga();

        try {
            // Crear FormData
            const formData = new FormData();
            formData.append('id_usuario', usuarioActual.id_usuario);
            formData.append('nombre_completo', document.getElementById('nombre_completo').value);
            formData.append('email', document.getElementById('email').value);
            formData.append('fecha_nacimiento', document.getElementById('fecha_nacimiento').value);
            formData.append('es_adulto_mayor', document.getElementById('es_adulto_mayor').checked);
            formData.append('tiene_discapacidad', document.getElementById('tiene_discapacidad').checked);
            
            if (document.getElementById('tiene_discapacidad').checked) {
                const tipoDiscapacidad = document.querySelector('input[name="tipo_discapacidad"]:checked');
                if (tipoDiscapacidad) {
                    formData.append('tipo_discapacidad', tipoDiscapacidad.value);
                }
                formData.append('requiere_silla_ruedas', document.getElementById('requiere_silla_ruedas').checked);
            }
            
            formData.append('tipo_documento', document.getElementById('tipo_documento').value);
            formData.append('documento', documentoInput.files[0]);

            // Simular progreso de validación
            simularProgresoValidacion();

            // Enviar solicitud
            const response = await fetch(`https://${IP_API}:8000/api/tarifa-preferencial/solicitar`, {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (data.exito) {
                // Esperar a que termine la simulación
                setTimeout(() => {
                    ocultarOverlayCarga();
                    mostrarResultadoExitoso(data);
                }, 1000);
            } else {
                ocultarOverlayCarga();
                mostrarAlerta(data.mensaje, 'error');
            }

        } catch (error) {
            ocultarOverlayCarga();
            mostrarAlerta('❌ Error de conexión: ' + error.message, 'error');
        }
    });

    // Validar formulario
    function validarFormulario() {
        const fechaNacimiento = new Date(document.getElementById('fecha_nacimiento').value);
        const hoy = new Date();
        let edad = hoy.getFullYear() - fechaNacimiento.getFullYear();
        
        // Validar que se haya ingresado fecha de nacimiento
        if (!fechaNacimientoInput.value) {
            mostrarAlerta('❌ Por favor ingresa tu fecha de nacimiento', 'error');
            fechaNacimientoInput.focus();
            return false;
        }

        // VALIDACIÓN DE OPCIÓN ESPECIAL - AGREGAR ESTO
        const esAdultoMayor = document.getElementById('es_adulto_mayor').checked;
        const tieneDiscapacidad = document.getElementById('tiene_discapacidad').checked;
        
        if (!esAdultoMayor && !tieneDiscapacidad) {
            mostrarAlerta('❌ Debes seleccionar al menos una opción: "Adulto mayor" o "Persona con discapacidad"', 'error');
            
            // Resaltar visualmente las opciones
            const opcionesEspeciales = document.querySelectorAll('#es_adulto_mayor, #tiene_discapacidad');
            opcionesEspeciales.forEach(opcion => {
                opcion.parentElement.style.color = 'var(--accent-pink)';
                opcion.parentElement.style.fontWeight = 'bold';
            });
            
            // Scroll a las opciones
            document.querySelector('.form-section:nth-child(2)').scrollIntoView({ 
                behavior: 'smooth', 
                block: 'center' 
            });
            
            return false;
        } else {
            // Remover estilos de error si se selecciona una opción
            const opcionesEspeciales = document.querySelectorAll('#es_adulto_mayor, #tiene_discapacidad');
            opcionesEspeciales.forEach(opcion => {
                opcion.parentElement.style.color = '';
                opcion.parentElement.style.fontWeight = '';
            });
        }

        if (esAdultoMayor && edad < 60) {
            mostrarAlerta('❌ Debes tener al menos 60 años para solicitar tarifa de adulto mayor', 'error');
            return false;
        }

        if (tieneDiscapacidad) {
            const tipoDiscapacidad = document.querySelector('input[name="tipo_discapacidad"]:checked');
            if (!tipoDiscapacidad) {
                mostrarAlerta('❌ Por favor selecciona el tipo de discapacidad', 'error');
                return false;
            }
        }

        // Validar tipo de documento
        const tipoDocumento = document.getElementById('tipo_documento').value;
        if (!tipoDocumento) {
            mostrarAlerta('❌ Por favor selecciona el tipo de documento que estás presentando', 'error');
            return false;
        }

        // VALIDACIÓN DEL ARCHIVO (sin required en el HTML)
        if (!documentoInput.files.length) {
            mostrarAlerta('❌ Debe adjuntar un archivo de documento válido para continuar con la solicitud', 'error');
            
            // Resaltar visualmente el área de upload
            fileUploadArea.classList.add('error');
            fileUploadArea.style.border = '3px dashed var(--accent-pink)';
            fileUploadArea.style.backgroundColor = 'rgba(220, 53, 69, 0.1)';
            
            // Agregar mensaje visual dentro del área
            const existingError = fileUploadArea.querySelector('.file-error');
            if (!existingError) {
                const errorMsg = document.createElement('div');
                errorMsg.className = 'file-error text-danger mt-2 fw-bold';
                errorMsg.innerHTML = '<i class="fa-solid fa-exclamation-triangle"></i> Archivo requerido';
                fileUploadArea.appendChild(errorMsg);
            }
            
            // Scroll al área de upload para que sea visible
            setTimeout(() => {
                fileUploadArea.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'center' 
                });
            }, 100);
            
            return false;
        } else {
            // Remover estilos de error si el archivo está presente
            fileUploadArea.classList.remove('error');
            fileUploadArea.style.border = '';
            fileUploadArea.style.backgroundColor = '';
            const existingError = fileUploadArea.querySelector('.file-error');
            if (existingError) {
                existingError.remove();
            }
        }

        // Validar tamaño del archivo (máx 5MB)
        const archivo = documentoInput.files[0];
        if (archivo && archivo.size > 5 * 1024 * 1024) {
            mostrarAlerta('❌ El archivo es demasiado grande. El tamaño máximo permitido es 5MB', 'error');
            return false;
        }

        return true;
    }

    // Mostrar overlay de carga con progreso
    function mostrarOverlayCarga() {
        loadingOverlay.style.display = 'flex';
    }

    function ocultarOverlayCarga() {
        loadingOverlay.style.display = 'none';
        progressBar.style.width = '0%';
    }

    function simularProgresoValidacion() {
        let segundos = 5;
        contadorSegundos.textContent = `${segundos} segundos restantes`;
        
        const intervalo = setInterval(() => {
            segundos--;
            const progreso = ((5 - segundos) / 5) * 100;
            progressBar.style.width = `${progreso}%`;
            contadorSegundos.textContent = `${segundos} segundos restantes`;
            
            if (segundos <= 0) {
                clearInterval(intervalo);
            }
        }, 1000);
    }

    // Mostrar resultado exitoso
    function mostrarResultadoExitoso(data) {
        const tipoUsuario = data.tipo_usuario_actualizado;
        const tarifa = data.tarifa_actualizada;
        
        const modalHTML = `
            <div class="modal fade" id="modalExito" tabindex="-1">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content">
                        <div class="modal-header bg-success text-white">
                            <h5 class="modal-title">
                                <i class="bi bi-check-circle-fill"></i>
                                ¡Solicitud Aprobada!
                            </h5>
                        </div>
                        <div class="modal-body text-center">
                            <div class="mb-4">
                                <i class="bi bi-patch-check-fill text-success" style="font-size: 4rem;"></i>
                                <h3 class="text-success mt-3">Validación Exitosa</h3>
                            </div>
                            
                            <div class="alert alert-success">
                                <h6>✅ Documentos Validados Correctamente</h6>
                                <p class="mb-0">Tu tarifa preferencial ha sido aplicada</p>
                            </div>
                            
                            <div class="row text-start">
                                <div class="col-6">
                                    <strong>Tipo de Usuario:</strong>
                                </div>
                                <div class="col-6 text-end">
                                    <span class="badge bg-success">${tipoUsuario}</span>
                                </div>
                                
                                <div class="col-6">
                                    <strong>Nueva Tarifa:</strong>
                                </div>
                                <div class="col-6 text-end fw-bold text-success">
                                    $${tarifa} MXN
                                </div>
                                
                                <div class="col-6">
                                    <strong>ID Solicitud:</strong>
                                </div>
                                <div class="col-6 text-end">
                                    <small>${data.id_solicitud}</small>
                                </div>
                            </div>
                            
                            <div class="mt-4 p-3 bg-light rounded">
                                <small class="text-muted">
                                    <i class="bi bi-info-circle"></i>
                                    Tu nueva tarifa será aplicada en tu próximo viaje
                                </small>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-success w-100" onclick="redirigirAPanel()">
                                <i class="bi bi-check-lg"></i>
                                Entendido
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        const modal = new bootstrap.Modal(document.getElementById('modalExito'));
        modal.show();
        
        // Actualizar datos locales del usuario
        if (usuarioActual) {
            usuarioActual.tipo = tipoUsuario;
            usuarioActual.tarifa_actual = tarifa;
            localStorage.setItem('user_data', JSON.stringify(usuarioActual));
        }
    }

    // Función para mostrar alertas
    function mostrarAlerta(mensaje, tipo) {
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${tipo === 'error' ? 'danger' : 'info'} alert-dismissible fade show mt-3`;
        alertDiv.innerHTML = `
            ${mensaje}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        form.parentNode.insertBefore(alertDiv, form.nextSibling);
        
        if (tipo === 'info') {
            setTimeout(() => {
                if (alertDiv.parentNode) {
                    alertDiv.remove();
                }
            }, 5000);
        }
    }

    // Redirigir al panel principal
    window.redirigirAPanel = function() {
        window.location.href = 'pasajero_inicio.html';
    };

    

    // Inicializar
    cargarDatosUsuario();
    loadInitialNotifications();
    verificarSaldoBajo(usuarioActual.saldo);
});
async function loadInitialNotifications() {
    try {
        // El await debe estar dentro de una función async
        await PassengerNotificationManager.loadNotifications();
        
        // Actualizar la UI después de cargar
        PassengerNotificationManager.updateNotificationsDropdown();
        PassengerNotificationManager.updateNotificationBadge();
        
        // Iniciar actualización automática
        PassengerNotificationManager.startAutoRefresh(3000); // Cada 60 segundos
        
    } catch (error) {
        console.error('Error cargando notificaciones iniciales:', error);
    }
}
function verificarSaldoBajo(saldo) {
    const saldoBajo = saldo < 20.00; // Considerar saldo bajo menos de $20
    const lowBalanceDot = document.getElementById('low-balance-dot');
    const lowBalanceAlert = document.getElementById('low-balance-alert-item');
    
    if (saldoBajo) {
        // Mostrar punto rojo de notificación
        if (lowBalanceDot) {
            lowBalanceDot.style.display = 'block';
            lowBalanceDot.style.backgroundColor = '#dc3545';
        }
        // Mostrar alerta de saldo bajo
        if (lowBalanceAlert) {
            lowBalanceAlert.style.display = 'block';
        }
    } else {
        // Ocultar notificaciones de saldo bajo
        if (lowBalanceDot) {
            lowBalanceDot.style.display = 'none';
        }
        if (lowBalanceAlert) {
            lowBalanceAlert.style.display = 'none';
        }
    }
}