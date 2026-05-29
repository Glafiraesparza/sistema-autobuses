// Configuración
const API_BASE_URL = `https://${IP_API}:8000/api`;
let currentUser = null;
let qrTimer = null;
let currentQRCode = null;
let qrActive = false;
let cooldownTimer = null;

// Session Manager para manejar cambios de usuario
class SessionManager {
    constructor() {
        this.currentUserId = null;
        this.sessionKey = 'current_qr_session';
    }

    initialize() {
        this.setupStorageListeners();
        this.clearPreviousSession();
    }

    setupStorageListeners() {
        window.addEventListener('storage', (e) => {
            if (e.key === 'user_data' || e.key === 'auth_token') {
                console.log('🔍 Cambio detectado en sesión de usuario');
                this.handleUserChange();
            }
        });
    }

    clearPreviousSession() {
        const savedQR = localStorage.getItem('currentQR');
        if (savedQR) {
            const qrData = JSON.parse(savedQR);
            const currentUserData = localStorage.getItem('user_data');
            
            if (currentUserData) {
                const currentUser = JSON.parse(currentUserData);
                if (qrData.id_usuario !== currentUser.id_usuario) {
                    console.log('🧹 Limpiando QR de usuario anterior');
                    localStorage.removeItem('currentQR');
                    this.clearQRInterface();
                }
            }
        }
    }

    handleUserChange() {
        console.log('🔄 Cambio de usuario detectado, limpiando estado...');
        this.clearQRState();
        location.reload();
    }

    clearQRState() {
        localStorage.removeItem('currentQR');
        sessionStorage.removeItem('qr_timer');
        
        if (qrTimer) {
            clearInterval(qrTimer);
            qrTimer = null;
        }
        
        if (cooldownTimer) {
            clearInterval(cooldownTimer);
            cooldownTimer = null;
        }
        
        qrActive = false;
        currentQRCode = null;
        
        this.clearQRInterface();
    }

    clearQRInterface() {
        const qrResult = document.getElementById('qr-result');
        const qrCanvas = document.getElementById('qr-canvas');
        
        if (qrResult) qrResult.style.display = 'none';
        if (qrCanvas) qrCanvas.innerHTML = '';
        
        updateGenerateButton();
    }
}

// ✅ CORREGIDO: Cooldown Manager - Comportamiento diferenciado
class CooldownManager {
    constructor() {
        this.isInCooldown = false;
        this.cooldownTime = 360; // 3 minutos en segundos
        this.currentTimeLeft = 0;
    }

    async checkCooldown() {
        if (!currentUser) return { inCooldown: false };
        
        try {
            const authToken = localStorage.getItem('auth_token');
            const response = await fetch(`${API_BASE_URL}/qr/cooldown/${currentUser.id_usuario}`, {
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            });
            
            if (response.ok) {
                const result = await response.json();
                this.isInCooldown = result.cooldown;
                if (this.isInCooldown && result.tiempo_restante) {
                    this.currentTimeLeft = Math.floor(result.tiempo_restante);
                    this.startCooldown(this.currentTimeLeft);
                }
                return result;
            }
            return { inCooldown: false };
        } catch (error) {
            console.warn('Error verificando cooldown:', error);
            return { inCooldown: false };
        }
    }

    // ✅ CORREGIDO: Solo iniciar cooldown para usuarios NO normales
    startCooldown(initialTime = null) {
        // Solo usuarios NO normales tienen cooldown
        if (!currentUser || currentUser.tipo === 'normal') {
            console.log('🔓 Usuario normal - sin cooldown');
            return;
        }

        console.log('⏳ Iniciando cooldown para usuario especial:', currentUser.tipo);
        
        this.isInCooldown = true;
        let timeLeft = initialTime || this.cooldownTime;
        this.currentTimeLeft = timeLeft;
        
        this.showCooldown();
        this.updateCooldownDisplay(timeLeft);
        
        // Limpiar timer anterior si existe
        if (cooldownTimer) {
            clearInterval(cooldownTimer);
        }
        
        cooldownTimer = setInterval(() => {
            timeLeft--;
            this.currentTimeLeft = timeLeft;
            this.updateCooldownDisplay(timeLeft);
            
            if (timeLeft <= 0) {
                this.isInCooldown = false;
                clearInterval(cooldownTimer);
                this.hideCooldown();
                updateGenerateButton();
                console.log('🔓 Cooldown terminado');
            }
        }, 1000);
        
        updateGenerateButton();
    }

    updateCooldownDisplay(seconds) {
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        const cooldownElement = document.getElementById('cooldown-timer');
        
        if (cooldownElement) {
            cooldownElement.textContent = `${minutes}:${secs.toString().padStart(2, '0')}`;
        }
    }

    showCooldown() {
        const cooldownSection = document.getElementById('cooldown-section');
        if (cooldownSection) {
            cooldownSection.style.display = 'block';
        }
    }

    hideCooldown() {
        const cooldownSection = document.getElementById('cooldown-section');
        if (cooldownSection) {
            cooldownSection.style.display = 'none';
        }
    }

    //  CORREGIDO: Manejar cuando se usa un QR - PARA TODOS los usuarios
async handleQRUsed() {
    console.log(' Verificando comportamiento post-uso para usuario:', currentUser?.tipo);

    //  PARA TODOS LOS USUARIOS: quitar QR inmediatamente
    console.log(' QR removido inmediatamente para usuario:', currentUser?.tipo);
    this.clearQRAfterUse();

    //  SOLO usuarios especiales: iniciar cooldown
    if (currentUser && currentUser.tipo !== 'normal') {
        console.log(' Usuario especial - iniciando cooldown');
        this.startCooldown();
    }
}

clearQRAfterUse() {
    const qrResult = document.getElementById('qr-result');
    const qrCanvas = document.getElementById('qr-canvas');

    if (qrResult) qrResult.style.display = 'none';
    if (qrCanvas) qrCanvas.innerHTML = '';

    if (currentQRCode) {
        currentQRCode.clear();
        currentQRCode = null;
    }

    qrActive = false;
    localStorage.removeItem('currentQR');

    if (qrTimer) {
        clearInterval(qrTimer);
        qrTimer = null;
    }

    updateGenerateButton();

    //  MENSAJE DIFERENCIADO
    if (currentUser && currentUser.tipo !== 'normal') {
        showError('QR usado exitosamente. Debes esperar 3 minutos para generar otro.');
    } else {
        showError('QR usado exitosamente. Puedes generar otro cuando lo necesites.');
    }
}

    clearQRAfterUse() {
        const qrResult = document.getElementById('qr-result');
        const qrCanvas = document.getElementById('qr-canvas');
        
        if (qrResult) qrResult.style.display = 'none';
        if (qrCanvas) qrCanvas.innerHTML = '';
        
        if (currentQRCode) {
            currentQRCode.clear();
            currentQRCode = null;
        }
        
        qrActive = false;
        localStorage.removeItem('currentQR');
        
        if (qrTimer) {
            clearInterval(qrTimer);
            qrTimer = null;
        }
        
        updateGenerateButton();
        showError('QR usado exitosamente. Puedes generar otro cuando lo necesites.');
    }
}

// Inicializar managers
const sessionManager = new SessionManager();
const cooldownManager = new CooldownManager();

// Inicialización
document.addEventListener('DOMContentLoaded', function() {
    PassengerNotificationManager.initialize((notifications) => {
        console.log('🔔 Notificaciones de retraso actualizadas:', notifications);
        // Actualizar la UI cuando cambien las notificaciones
        PassengerNotificationManager.updateNotificationsDropdown();
        PassengerNotificationManager.updateNotificationBadge();
    });

    sessionManager.initialize();
    initializeApp();
    loadInitialNotifications();
    
});

async function initializeApp() {
    if (!checkAuthentication()) {
        return;
    }
    
    await loadUserData();
    setupEventListeners();
    checkExistingQR();
    
    await cooldownManager.checkCooldown();
    
    startBalanceUpdates();
}

// ✅ NUEVO: Función para verificar el estado del QR
async function checkQRStatus() {
    if (!qrActive || !currentUser) return;
    
    try {
        const authToken = localStorage.getItem('auth_token');
        const savedQR = localStorage.getItem('currentQR');
        
        if (!savedQR) return;
        
        const qrData = JSON.parse(savedQR);
        
        // Verificar el estado del QR en el backend
        const response = await fetch(`${API_BASE_URL}/qr/status/${qrData.nonce}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            const status = await response.json();
            
            if (status.estado === 'usado') {
                console.log('🔍 QR detectado como USADO - limpiando interfaz');
                await cooldownManager.handleQRUsed();
            } else if (status.estado === 'expirado') {
                console.log('🔍 QR detectado como EXPIRADO - limpiando interfaz');
                const qrResult = document.getElementById('qr-result');
                if (qrResult) qrResult.style.display = 'none';
                qrActive = false;
                updateGenerateButton();
                localStorage.removeItem('currentQR');
                showError('El QR ha expirado. Ya puedes generar uno nuevo.');
            }
        }
    } catch (error) {
        console.warn('Error verificando estado del QR:', error);
    }
}

// Actualización periódica del saldo y estado del QR
function startBalanceUpdates() {
    setInterval(async () => {
        if (currentUser) {
            await updateUserBalance();
            await checkQRStatus(); // ✅ NUEVO: Verificar estado del QR
            verificarSaldoBajo(currentUser.saldo);
        }
    }, 5000); // Verificar cada 5 segundos
}

// Actualizar saldo del usuario en tiempo real
async function updateUserBalance() {
    try {
        const authToken = localStorage.getItem('auth_token');
        const response = await fetch(`${API_BASE_URL}/usuarios/${currentUser.id_usuario}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            const updatedUser = await response.json();
            const oldBalance = currentUser.saldo;
            const newBalance = updatedUser.saldo;
            
            // ✅ MEJORADO: Detectar uso de QR por cambio de saldo
            if (oldBalance !== newBalance && qrActive) {
                console.log('💳 Cambio de saldo detectado:', {
                    anterior: oldBalance,
                    nuevo: newBalance,
                    diferencia: oldBalance - newBalance,
                    qrActivo: qrActive
                });
                
                // Si el saldo disminuyó y tenemos un QR activo, probablemente fue usado
                if (newBalance < oldBalance) {
                    console.log('🔍 Saldo reducido - verificando estado del QR...');
                    // Forzar verificación inmediata del estado del QR
                    await checkQRStatus();
                }
            }
            
            currentUser.saldo = newBalance;
            
            const userData = localStorage.getItem('user_data');
            if (userData) {
                const storedUser = JSON.parse(userData);
                storedUser.saldo = newBalance;
                localStorage.setItem('user_data', JSON.stringify(storedUser));
            }
            
            updateUserInterface();
        }
    } catch (error) {
        console.warn('Error actualizando saldo:', error);
    }
}

// Verificar si hay un QR activo guardado en localStorage
function checkExistingQR() {
    const savedQR = localStorage.getItem('currentQR');
    if (savedQR) {
        const qrData = JSON.parse(savedQR);
        const expirationTime = new Date(qrData.timestamp_expiracion);
        const now = new Date();
        
        console.log('🔍 QR guardado encontrado:', qrData);
        
        const currentUserData = localStorage.getItem('user_data');
        if (currentUserData) {
            const currentUser = JSON.parse(currentUserData);
            if (qrData.id_usuario !== currentUser.id_usuario) {
                console.log('❌ QR pertenece a otro usuario, limpiando...');
                localStorage.removeItem('currentQR');
                return;
            }
        }
        
        if (expirationTime > now) {
            displayQR(qrData);
            startQRTimer(expirationTime);
        } else {
            localStorage.removeItem('currentQR');
            qrActive = false;
            updateGenerateButton();
        }
    }
}

// Cargar datos del usuario desde localStorage
async function loadUserData() {
    try {
        const userData = localStorage.getItem('user_data');
        const authToken = localStorage.getItem('auth_token');
        
        if (!userData || !authToken) {
            throw new Error('Usuario no autenticado');
        }
        
        currentUser = JSON.parse(userData);
        
        console.log('🔍 Usuario cargado desde sesión:', currentUser);
        
        try {
            const response = await fetch(`${API_BASE_URL}/usuarios/${currentUser.id_usuario}`, {
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            });
            
            if (response.ok) {
                const updatedUser = await response.json();
                currentUser = { ...currentUser, ...updatedUser };
                localStorage.setItem('user_data', JSON.stringify(currentUser));
                console.log('🔍 Datos actualizados del usuario:', currentUser);
            }
        } catch (apiError) {
            console.warn('No se pudieron obtener datos actualizados, usando datos locales:', apiError);
        }
        
        updateUserInterface();
        
    } catch (error) {
        console.error('Error cargando datos del usuario:', error);
        showError('Debes iniciar sesión para usar esta función');
        
        setTimeout(() => {
            window.location.href = 'inicio_sesion.html';
        }, 3000);
        
        return;
    }
}

// Actualizar interfaz con datos del usuario
function updateUserInterface() {
    if (!currentUser) return;
    
    console.log('🔍 Actualizando UI con usuario:', currentUser);
    
    const balanceElement = document.getElementById('current-balance');
    if (balanceElement) {
        balanceElement.textContent = `$${currentUser.saldo.toFixed(2)} MXN`;
    }
    
    const fareElement = document.getElementById('current-fare');
    if (fareElement && currentUser.tarifa_actual) {
        fareElement.textContent = `$${currentUser.tarifa_actual.toFixed(2)} MXN`;
    }
    
    const userNameElement = document.getElementById('user-name');
    const userEmailElement = document.getElementById('user-email');
    const userTypeElement = document.getElementById('user-type');

    const offcanvasHeader = document.querySelector('.offcanvas-profile-header');
    if (offcanvasHeader) {
        const nombreCompleto = currentUser.nombre;
        const primerNombre = nombreCompleto.split(' ')[0];
        offcanvasHeader.innerHTML = `
            <i class="fa-solid fa-circle-user profile-icon"></i>
            <h4>${primerNombre}</h4>
            <p>${currentUser.email || 'usuario@tucsa.com'}</p>
            ${currentUser.tipo !== 'normal' ? `<small class="badge bg-success">Tarifa ${currentUser.tipo}</small>` : ''}
        `;
    }
    if (userTypeElement) {
        const tipoDisplay = {
            'normal': 'Usuario Normal',
            'estudiante': 'Estudiante',
            'adulto_mayor': 'Adulto Mayor', 
            'discapacitado': 'Persona con Discapacidad'
        };
        userTypeElement.textContent = tipoDisplay[currentUser.tipo] || 'Usuario Especial';
    }
    
    // ✅ NUEVO: Actualizar el estado del botón después de cargar datos
    updateGenerateButton();
}

// Configurar event listeners
function setupEventListeners() {
    const generateBtn = document.getElementById('generate-qr-btn');
    const downloadBtn = document.getElementById('download-qr-btn');
    const shareBtn = document.getElementById('share-qr-btn');
    
    if (generateBtn) {
        generateBtn.addEventListener('click', generateQR);
    }
    
    if (downloadBtn) {
        downloadBtn.addEventListener('click', downloadQR);
    }
    
    if (shareBtn) {
        shareBtn.addEventListener('click', shareQR);
    }
    
    window.addEventListener('logout', function() {
        sessionManager.clearQRState();
    });
}

// Actualizar estado del botón de generar
function updateGenerateButton() {
    const generateBtn = document.getElementById('generate-qr-btn');
    const saldoInfo = document.getElementById('saldo-info'); // ✅ NUEVO: Elemento para mostrar info de saldo
    
    if (!generateBtn) return;
    
    // ✅ NUEVO: Verificar saldo
    const tarifaActual = currentUser?.tarifa_actual || 0;
    const saldoActual = currentUser?.saldo || 0;
    const saldoSuficiente = saldoActual >= tarifaActual;
    
    if (!saldoSuficiente) {
        generateBtn.disabled = true;
        generateBtn.innerHTML = '<i class="fa-solid fa-wallet me-2"></i>Saldo Insuficiente';
        generateBtn.title = `Saldo insuficiente. Necesitas $${tarifaActual.toFixed(2)} MXN`;
        generateBtn.classList.add('btn-disabled');
        
        // ✅ NUEVO: Mostrar información de saldo
        if (saldoInfo) {
            saldoInfo.innerHTML = `
                <div class="alert alert-warning mt-2">
                    <i class="fa-solid fa-exclamation-triangle me-2"></i>
                    <strong>Saldo insuficiente</strong><br>
                    Tu saldo: $${saldoActual.toFixed(2)} MXN | Tarifa: $${tarifaActual.toFixed(2)} MXN
                </div>
            `;
        }
        return;
    }
    
    if (qrActive || cooldownManager.isInCooldown) {
        generateBtn.disabled = true;
        
        if (cooldownManager.isInCooldown) {
            generateBtn.innerHTML = '<i class="fa-solid fa-clock me-2"></i>En Cooldown';
            generateBtn.title = `Espera ${Math.floor(cooldownManager.currentTimeLeft / 60)}:${(cooldownManager.currentTimeLeft % 60).toString().padStart(2, '0')} para generar otro QR`;
        } else {
            generateBtn.innerHTML = '<i class="fa-solid fa-qrcode me-2"></i>QR Activo';
            generateBtn.title = 'Ya tienes un QR activo';
        }
        
        generateBtn.classList.add('btn-disabled');
        
        // ✅ NUEVO: Limpiar info de saldo si hay otros impedimentos
        if (saldoInfo) {
            saldoInfo.innerHTML = '';
        }
    } else {
        generateBtn.disabled = false;
        generateBtn.innerHTML = '<i class="fa-solid fa-plus me-2"></i>Generar Nuevo QR';
        generateBtn.title = 'Generar un nuevo código QR';
        generateBtn.classList.remove('btn-disabled');
        
        // ✅ NUEVO: Mostrar saldo suficiente
        if (saldoInfo) {
            saldoInfo.innerHTML = `
                <div class="alert alert-success mt-2">
                    <i class="fa-solid fa-check-circle me-2"></i>
                    <strong>Saldo suficiente</strong><br>
                    Tu saldo: $${saldoActual.toFixed(2)} MXN | Tarifa: $${tarifaActual.toFixed(2)} MXN
                </div>
            `;
        }
    }
}

// Generar nuevo QR
async function generateQR() {
    if (!currentUser) {
        showError('No se pudo obtener información del usuario');
        return;
    }
    
    // ✅ NUEVO: Validar saldo suficiente
    const tarifaActual = currentUser.tarifa_actual || 0;
    const saldoActual = currentUser.saldo || 0;
    
    if (saldoActual < tarifaActual) {
        showError('Saldo insuficiente. Recarga tu cuenta para generar un QR.');
        return;
    }
    
    if (qrActive) {
        showError('Ya tienes un QR activo. Espera a que expire para generar uno nuevo.');
        return;
    }
    
    if (cooldownManager.isInCooldown) {
        showError('Estás en periodo de cooldown. Espera para generar otro QR.');
        return;
    }
    
    const generateBtn = document.getElementById('generate-qr-btn');
    const qrError = document.getElementById('qr-error');
    const authToken = localStorage.getItem('auth_token');
    
    try {
        generateBtn.disabled = true;
        generateBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-2"></i>Generando...';
        qrError.style.display = 'none';
        
        console.log('🔍 Generando QR para usuario:', currentUser.id_usuario, 'Tipo:', currentUser.tipo);
        console.log('💰 Validación de saldo:', { saldo: saldoActual, tarifa: tarifaActual, suficiente: saldoActual >= tarifaActual });
        
        const response = await fetch(`${API_BASE_URL}/qr/generar`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                id_usuario: currentUser.id_usuario
            })
        });
        
        console.log('🔍 Respuesta del servidor:', response.status);
        
        if (!response.ok) {
            if (response.status === 401) {
                showError('Sesión expirada. Redirigiendo al login...');
                setTimeout(() => {
                    window.location.href = 'inicio_sesion.html';
                }, 2000);
                return;
            } else if (response.status === 429) {
                const errorData = await response.json();
                showError(errorData.detail);
                await cooldownManager.checkCooldown();
                updateGenerateButton();
                return;
            }
            
            const errorData = await response.json();
            throw new Error(errorData.detail || `Error ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
            await displayQR(data.qr_data);
            setTimeout(() => updateUserBalance(), 1000);
        } else {
            throw new Error(data.detail || 'Error al generar QR');
        }
        
    } catch (error) {
        console.error('Error generando QR:', error);
        showError(error.message);
        updateGenerateButton();
    }
}

// Mostrar QR generado
async function displayQR(qrData) {
    const qrResult = document.getElementById('qr-result');
    const qrCanvas = document.getElementById('qr-canvas');
    
    // Limpiar QR anterior si existe
    if (currentQRCode) {
        currentQRCode.clear();
        qrCanvas.innerHTML = '';
    }
    
    console.log('🔍 QR Data recibido:', qrData);
    
    // Crear QR con mejor calidad
    currentQRCode = new QRCode(qrCanvas, {
        text: qrData.nonce,
        width: 256,
        height: 256,
        colorDark: "#000000",
        colorLight: "#FFFFFF",
        correctLevel: QRCode.CorrectLevel.H
    });
    
    // Aplicar estilos CSS para mejor visualización
    const canvasElement = qrCanvas.querySelector('canvas');
    if (canvasElement) {
        canvasElement.style.border = '2px solid #3D365C';
        canvasElement.style.borderRadius = '8px';
        canvasElement.style.padding = '10px';
        canvasElement.style.backgroundColor = '#FFFFFF';
    }
    
    // Actualizar información del QR
    document.getElementById('qr-nonce').textContent = qrData.nonce.substring(0, 8) + '...';
    
    // Mostrar hora local correctamente
    const timestampCreacion = new Date(qrData.timestamp_creacion);
    const timestampExpiracion = new Date(qrData.timestamp_expiracion);
    
    document.getElementById('qr-created').textContent = timestampCreacion.toLocaleString('es-MX', {
        timeZone: 'America/Mexico_City',
        hour12: true
    });
    
    document.getElementById('qr-expires').textContent = timestampExpiracion.toLocaleString('es-MX', {
        timeZone: 'America/Mexico_City', 
        hour12: true
    });
    
    // Mostrar sección de resultados
    qrResult.style.display = 'block';
    
    if (currentUser && qrData.id_usuario === currentUser.id_usuario) {
        localStorage.setItem('currentQR', JSON.stringify(qrData));
    }
    
    qrActive = true;
    updateGenerateButton();
    startQRTimer(timestampExpiracion);
}

// Temporizador de expiración del QR
function startQRTimer(expirationTime) {
    if (qrTimer) {
        clearInterval(qrTimer);
    }
    
    function updateTimer() {
        const now = new Date();
        const timeLeft = expirationTime - now;
        
        if (timeLeft <= 0) {
            // QR expirado
            document.getElementById('qr-timer').textContent = '00:00';
            document.getElementById('qr-timer').style.color = 'var(--danger-red)';
            clearInterval(qrTimer);
            
            // Para TODOS los usuarios, limpiar QR expirado
            const qrResult = document.getElementById('qr-result');
            qrResult.style.display = 'none';
            qrActive = false;
            updateGenerateButton();
            localStorage.removeItem('currentQR');
            showError('El QR ha expirado. Ya puedes generar uno nuevo.');
            
            return;
        }
        
        const totalSeconds = Math.floor(timeLeft / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        
        const timerText = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        document.getElementById('qr-timer').textContent = timerText;
        
        const timerElement = document.getElementById('qr-timer');
        if (minutes < 2) {
            timerElement.style.color = 'var(--danger-red)';
            timerElement.classList.add('pulse-warning');
        } else if (minutes < 5) {
            timerElement.style.color = 'var(--warning-orange)';
            timerElement.classList.remove('pulse-warning');
        } else {
            timerElement.style.color = 'var(--accent-pink)';
            timerElement.classList.remove('pulse-warning');
        }
    }
    
    updateTimer();
    qrTimer = setInterval(updateTimer, 1000);
}

// Descargar QR
function downloadQR() {
    const qrCanvas = document.getElementById('qr-canvas');
    const canvas = qrCanvas.querySelector('canvas');
    
    if (!canvas) {
        showError('No hay QR para descargar');
        return;
    }
    
    const link = document.createElement('a');
    link.download = `qr-tucsa-${new Date().toISOString().split('T')[0]}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
}

// Compartir QR
async function shareQR() {
    const qrCanvas = document.getElementById('qr-canvas');
    const canvas = qrCanvas.querySelector('canvas');
    
    if (!canvas) {
        showError('No hay QR para compartir');
        return;
    }
    
    try {
        if (navigator.share) {
            canvas.toBlob(async function(blob) {
                const file = new File([blob], 'qr-tucsa.png', { type: 'image/png' });
                
                await navigator.share({
                    files: [file],
                    title: 'Mi QR de Pago - TUCSA',
                    text: 'Usa este código QR para pagar tu viaje en TUCSA'
                });
            });
        } else {
            downloadQR();
        }
    } catch (error) {
        console.error('Error compartiendo QR:', error);
        downloadQR();
    }
}

// Mostrar errores
function showError(message) {
    const errorElement = document.getElementById('qr-error');
    const errorMessage = document.getElementById('error-message');
    
    if (errorElement && errorMessage) {
        errorMessage.textContent = message;
        errorElement.style.display = 'block';
        
        setTimeout(() => {
            errorElement.style.display = 'none';
        }, 5000);
    }
}

// Verificar autenticación al cargar la página
function checkAuthentication() {
    const userData = localStorage.getItem('user_data');
    const authToken = localStorage.getItem('auth_token');
    
    if (!userData || !authToken) {
        showError('Debes iniciar sesión para acceder a esta página');
        setTimeout(() => {
            window.location.href = 'inicio_sesion.html';
        }, 2000);
        return false;
    }
    
    return true;
}

// Función para limpiar todo al hacer logout
function logout() {
    sessionManager.clearQRState();
    cooldownManager.hideCooldown();
    cooldownManager.isInCooldown = false;
    localStorage.removeItem('user_data');
    localStorage.removeItem('auth_token');
    localStorage.removeItem('currentQR');
    window.location.href = 'inicio_sesion.html';
}

// Limpiar recursos al salir
window.addEventListener('beforeunload', function() {
    if (qrTimer) {
        clearInterval(qrTimer);
    }
    if (cooldownTimer) {
        clearInterval(cooldownTimer);
    }
});

// Escuchar eventos de logout desde otras páginas
window.addEventListener('storage', function(e) {
    if (e.key === 'user_data' && e.newValue === null) {
        sessionManager.handleUserChange();
    }
});

// ✅ NUEVO: Función para testing manual
window.forceQRStatusCheck = async function() {
    await checkQRStatus();
};

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
// Función para verificar saldo bajo y mostrar notificación
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