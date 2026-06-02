/**
 * Módulo de Gestión de Tarifas y Descuentos
 * Para administradores - Permite modificar tarifas y aplicar descuentos
 */

class GestionTarifas {
    constructor() {
        this.usuario = null;
        this.tarifasActuales = null;
        this.initialize();
    }

    async initialize() {
        try {
            // Verificar permisos de administrador
            const hasAccess = await UserAuthPersonal.checkPagePermissions('administrador');
            if (!hasAccess) return;

            this.usuario = UserAuthPersonal.getCurrentUser();
            
            if (!this.usuario) {
                UserAuthPersonal.showNotification('Error: No se pudo cargar la información del usuario', 'error');
                return;
            }

            // Inicializar NotificationManager
            NotificationManager.initialize(null, 'personal', this.usuario.id_personal);
            await NotificationManager.loadNotifications();
            
            // Cargar tarifas
            await this.cargarTarifas();
            
            // Inicializar eventos
            this.initializeEventListeners();
            
            // Actualizar UI del usuario
            UserAuthPersonal.updateUserInterface();
            
            // Cargar descuentos activos
            await this.cargarDescuentosActivos();
            
        } catch (error) {
            console.error('Error inicializando:', error);
            UserAuthPersonal.showNotification('Error al inicializar la aplicación', 'error');
        }
    }

    async cargarTarifas() {
        try {
            const response = await fetch(`https://sistema-autobuses.onrender.com/api/configuracion-tarifas/tarifas`, {
                headers: UserAuthPersonal.getAuthHeaders()
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    this.tarifasActuales = data.tarifas;
                    this.actualizarInterfaz();
                    
                    // Mostrar última actualización
                    if (data.ultima_actualizacion) {
                        const fecha = new Date(data.ultima_actualizacion);
                        document.getElementById('ultima-actualizacion').innerHTML = 
                            `Última actualización: ${fecha.toLocaleString('es-MX')} por ${data.actualizado_por || 'sistema'}`;
                    }
                }
            } else {
                console.error('Error cargando tarifas:', response.status);
            }
        } catch (error) {
            console.error('Error:', error);
            UserAuthPersonal.showNotification('Error al cargar tarifas', 'error');
        }
    }

    actualizarInterfaz() {
        if (!this.tarifasActuales) return;
        
        // Actualizar tarjetas
        document.getElementById('precio-normal').textContent = `$${this.tarifasActuales.normal.toFixed(2)}`;
        document.getElementById('precio-estudiante').textContent = `$${this.tarifasActuales.estudiante.toFixed(2)}`;
        document.getElementById('precio-adulto_mayor').textContent = `$${this.tarifasActuales.adulto_mayor.toFixed(2)}`;
        document.getElementById('precio-discapacitado').textContent = `$${this.tarifasActuales.discapacitado.toFixed(2)}`;
        
        // Actualizar inputs
        document.getElementById('input-normal').value = this.tarifasActuales.normal;
        document.getElementById('input-estudiante').value = this.tarifasActuales.estudiante;
        document.getElementById('input-adulto_mayor').value = this.tarifasActuales.adulto_mayor;
        document.getElementById('input-discapacitado').value = this.tarifasActuales.discapacitado;
    }

    async guardarTarifas() {
        const nuevasTarifas = {
            normal: parseFloat(document.getElementById('input-normal').value),
            estudiante: parseFloat(document.getElementById('input-estudiante').value),
            adulto_mayor: parseFloat(document.getElementById('input-adulto_mayor').value),
            discapacitado: parseFloat(document.getElementById('input-discapacitado').value)
        };

        // Validaciones
        for (const [tipo, tarifa] of Object.entries(nuevasTarifas)) {
            if (isNaN(tarifa)) {
                UserAuthPersonal.showNotification(`Tarifa inválida para ${tipo}`, 'error');
                return;
            }
            if (tarifa < 0) {
                UserAuthPersonal.showNotification(`La tarifa para ${tipo} no puede ser negativa`, 'error');
                return;
            }
        }

        const btnGuardar = document.getElementById('btn-guardar');
        const textoOriginal = btnGuardar.innerHTML;
        btnGuardar.disabled = true;
        btnGuardar.innerHTML = '<i class="bi bi-hourglass-split me-2"></i>Guardando...';

        try {
            const response = await fetch(`https://sistema-autobuses.onrender.com/api/configuracion-tarifas/tarifas`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    ...UserAuthPersonal.getAuthHeaders()
                },
                body: JSON.stringify({
                    tarifas: nuevasTarifas,
                    admin_id: String(this.usuario.id_personal)
                })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                UserAuthPersonal.showNotification('Tarifas actualizadas correctamente', 'success');
                await this.cargarTarifas();
            } else {
                throw new Error(data.detail || 'Error al actualizar');
            }
        } catch (error) {
            console.error('Error:', error);
            UserAuthPersonal.showNotification('Error al guardar las tarifas', 'error');
        } finally {
            btnGuardar.disabled = false;
            btnGuardar.innerHTML = textoOriginal;
        }
    }

    async restablecerTarifas() {
        const confirmar = confirm('¿Estás seguro de que quieres restablecer las tarifas a los valores predeterminados?\n\nNormal: $11.00\nEstudiante: $5.50\nAdulto Mayor: $5.50\nDiscapacitado: $5.50');
        
        if (!confirmar) return;

        const btn = document.getElementById('btn-restablecer');
        const textoOriginal = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="bi bi-hourglass-split me-2"></i>Restableciendo...';

        try {
            const response = await fetch(`https://sistema-autobuses.onrender.com/api/configuracion-tarifas/restablecer-tarifas`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...UserAuthPersonal.getAuthHeaders()
                },
                body: JSON.stringify({
                    admin_id: String(this.usuario.id_personal)
                })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                UserAuthPersonal.showNotification('Tarifas restablecidas correctamente', 'success');
                await this.cargarTarifas();
            } else {
                throw new Error(data.detail || 'Error al restablecer');
            }
        } catch (error) {
            console.error('Error:', error);
            UserAuthPersonal.showNotification('Error al restablecer las tarifas', 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = textoOriginal;
        }
    }

    async aplicarDescuento() {
        const porcentaje = parseFloat(document.getElementById('descuento-porcentaje').value);
        const duracion = parseInt(document.getElementById('descuento-duracion').value);
        const razon = document.getElementById('descuento-motivo').value.trim();

        // Validaciones
        if (isNaN(porcentaje) || porcentaje <= 0 || porcentaje > 100) {
            UserAuthPersonal.showNotification('Ingresa un porcentaje válido (1-100)', 'error');
            return;
        }

        if (isNaN(duracion) || duracion <= 0) {
            UserAuthPersonal.showNotification('Ingresa una duración válida (mínimo 1 hora)', 'error');
            return;
        }

        if (!razon) {
            UserAuthPersonal.showNotification('Ingresa un motivo para el descuento', 'error');
            return;
        }

        const confirmar = confirm(`¿Aplicar descuento del ${porcentaje}% por ${duracion} horas?\n\nMotivo: ${razon}\n\nEsto afectará a TODOS los usuarios.`);
        
        if (!confirmar) return;

        const btn = document.getElementById('btn-aplicar-descuento');
        const textoOriginal = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="bi bi-hourglass-split me-2"></i>Aplicando descuento...';

        try {
            const response = await fetch(`https://sistema-autobuses.onrender.com/api/configuracion-tarifas/descuento-temporal`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...UserAuthPersonal.getAuthHeaders()
                },
                body: JSON.stringify({
                    porcentaje: porcentaje,
                    razon: razon,
                    duracion_horas: duracion,
                    admin_id: String(this.usuario.id_personal)
                })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                UserAuthPersonal.showNotification(data.mensaje, 'success');
                
                // Limpiar campos
                document.getElementById('descuento-porcentaje').value = '';
                document.getElementById('descuento-motivo').value = '';
                document.getElementById('descuento-duracion').value = '24';
                
                // Recargar tarifas
                await this.cargarTarifas();
                await this.cargarDescuentosActivos();
            } else {
                throw new Error(data.detail || 'Error al aplicar descuento');
            }
        } catch (error) {
            console.error('Error:', error);
            UserAuthPersonal.showNotification('Error al aplicar descuento', 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = textoOriginal;
        }
    }

    async cargarDescuentosActivos() {
        try {
            const response = await fetch(`https://sistema-autobuses.onrender.com/api/configuracion-tarifas/descuentos-activos`, {
                headers: UserAuthPersonal.getAuthHeaders()
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.descuentos && data.descuentos.length > 0) {
                    this.mostrarDescuentosActivos(data.descuentos);
                } else {
                    document.getElementById('descuentos-activos-container').style.display = 'none';
                }
            }
        } catch (error) {
            console.error('Error cargando descuentos activos:', error);
        }
    }

    mostrarDescuentosActivos(descuentos) {
        const container = document.getElementById('descuentos-activos-container');
        const listContainer = document.getElementById('descuentos-activos-list');
        
        if (!container || !listContainer) return;
        
        if (descuentos.length === 0) {
            container.style.display = 'none';
            return;
        }
        
        container.style.display = 'block';
        
        listContainer.innerHTML = descuentos.map(d => {
            const fechaFin = new Date(d.fecha_fin);
            const horasRestantes = Math.max(0, Math.floor((fechaFin - new Date()) / (1000 * 60 * 60)));
            const minutosRestantes = Math.max(0, Math.floor(((fechaFin - new Date()) % (3600000)) / 60000));
            
            return `
                <div class="descuento-card">
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <span class="porcentaje">${d.porcentaje}% OFF</span>
                            <span class="razon ms-2">${d.razon}</span>
                        </div>
                        <small class="vigencia">
                            <i class="bi bi-clock"></i>
                            ${horasRestantes}h ${minutosRestantes}m restantes
                        </small>
                    </div>
                </div>
            `;
        }).join('');
    }

    limpiarDescuentoForm() {
        document.getElementById('descuento-porcentaje').value = '';
        document.getElementById('descuento-duracion').value = '24';
        document.getElementById('descuento-motivo').value = '';
    }

    initializeEventListeners() {
        // Botones principales
        document.getElementById('btn-guardar')?.addEventListener('click', () => this.guardarTarifas());
        document.getElementById('btn-restablecer')?.addEventListener('click', () => this.restablecerTarifas());
        document.getElementById('btn-aplicar-descuento')?.addEventListener('click', () => this.aplicarDescuento());
        document.getElementById('btn-cancelar-descuento')?.addEventListener('click', () => this.limpiarDescuentoForm());
        document.getElementById('btn-refresh')?.addEventListener('click', () => {
            this.cargarTarifas();
            this.cargarDescuentosActivos();
        });
        
        // Cerrar sesión
        document.querySelector('.logout-btn')?.addEventListener('click', (e) => {
            e.preventDefault();
            UserAuthPersonal.logout();
        });
        
        // Actualizar al hacer foco
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                this.cargarTarifas();
                this.cargarDescuentosActivos();
            }
        });
    }
}

// Instancia global
const gestionTarifas = new GestionTarifas();

// Función global para logout
window.logout = function() {
    UserAuthPersonal.logout();
};