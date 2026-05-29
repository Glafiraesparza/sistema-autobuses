class QRScanner {
    constructor() {
        this.videoElement = document.getElementById('qr-video');
        this.canvasElement = document.createElement('canvas');
        this.canvasContext = this.canvasElement.getContext('2d');
        this.stream = null;
        this.currentFacingMode = 'environment'; // 'environment' para cámara trasera
        this.isScanning = false;
        this.scanStats = {
            successful: 0,
            failed: 0,
            total: 0
        };
        
        // ✅ URL completa del backend
        this.API_BASE_URL = `https://sistema-autobuses.onrender.com`;
        
        this.initializeEventListeners();
        this.loadOperatorInfo();
    }

    initializeEventListeners() {
        document.getElementById('start-scanner').addEventListener('click', () => this.startScanner());
        document.getElementById('stop-scanner').addEventListener('click', () => this.stopScanner());
        document.getElementById('switch-camera').addEventListener('click', () => this.switchCamera());
        document.getElementById('scan-again').addEventListener('click', () => this.resetScanner());
    }

    async startScanner() {
        try {
            this.isScanning = true;
            this.updateScannerControls();
            
            const constraints = {
                video: {
                    facingMode: this.currentFacingMode,
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            };

            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.videoElement.srcObject = this.stream;
            
            // Esperar a que el video esté listo
            this.videoElement.onloadedmetadata = () => {
                this.videoElement.play();
                this.scanQRCode();
            };

            this.hideResult();
            
        } catch (error) {
            console.error('Error al acceder a la cámara:', error);
            this.showError('No se pudo acceder a la cámara. Asegúrate de permitir el acceso.');
            this.isScanning = false;
            this.updateScannerControls();
        }
    }

    stopScanner() {
        this.isScanning = false;
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        this.updateScannerControls();
    }

    async switchCamera() {
        this.stopScanner();
        this.currentFacingMode = this.currentFacingMode === 'environment' ? 'user' : 'environment';
        
        // Pequeña pausa antes de reiniciar
        await new Promise(resolve => setTimeout(resolve, 500));
        this.startScanner();
    }

    scanQRCode() {
        if (!this.isScanning) return;

        if (this.videoElement.readyState === this.videoElement.HAVE_ENOUGH_DATA) {
            this.canvasElement.height = this.videoElement.videoHeight;
            this.canvasElement.width = this.videoElement.videoWidth;
            
            this.canvasContext.drawImage(this.videoElement, 0, 0, this.canvasElement.width, this.canvasElement.height);
            
            const imageData = this.canvasContext.getImageData(0, 0, this.canvasElement.width, this.canvasElement.height);
            
            try {
                const code = jsQR(imageData.data, imageData.width, imageData.height, {
                    inversionAttempts: "dontInvert",
                });
                
                if (code) {
                    console.log("✅ QR detectado:", code.data);
                    this.processQRCode(code.data);
                }
            } catch (error) {
                console.warn("Error procesando QR:", error);
            }
        }

        if (this.isScanning) {
            requestAnimationFrame(() => this.scanQRCode());
        }
    }

    async processQRCode(nonce) {
        if (!this.isScanning) return;

        // ✅ NUEVO: Validar formato del nonce antes de procesar
        if (!nonce || typeof nonce !== 'string' || nonce.length !== 32) {
            console.warn("❌ Formato de QR inválido:", nonce);
            return;
        }

        this.stopScanner();
        this.showLoading();

        try {
            console.log(`🔍 Procesando QR con nonce: ${nonce}`);
            console.log(`🔍 Longitud del nonce: ${nonce.length}`);
            
            const response = await fetch(`${this.API_BASE_URL}/api/qr/validar`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ nonce: nonce.trim() }) // ✅ trim() para eliminar espacios
            });

            console.log(`📡 Response status: ${response.status}`);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ Error response:', errorText);
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            console.log('📦 Resultado del backend:', result);

            this.scanStats.total++;
            
            if (result.valido) {
                this.scanStats.successful++;
                this.showSuccessResult(result);
            } else {
                this.scanStats.failed++;
                this.showErrorResult(result);
            }

            this.updateStats();

        } catch (error) {
            console.error('❌ Error al validar QR:', error);
            this.scanStats.failed++;
            this.updateStats();
            this.showError(`Error: ${error.message}`);
        }
    }

    showSuccessResult(result) {
        const resultElement = document.getElementById('scan-result');
        const paymentDetails = document.getElementById('payment-details');
        
        resultElement.className = 'scan-result result-success';
        document.getElementById('result-title').textContent = 'Pago Procesado Exitosamente';
        document.getElementById('result-nonce').textContent = result.nonce || 'N/A';
        document.getElementById('result-status').textContent = 'Éxito';
        document.getElementById('result-status').style.color = 'var(--success-green)';
        document.getElementById('result-message').textContent = result.mensaje;
        document.getElementById('result-message').style.color = 'var(--success-green)';
        
        // Mostrar detalles del pago
        paymentDetails.style.display = 'block';
        document.getElementById('result-user').textContent = result.nombre_usuario || 'N/A';
        document.getElementById('result-user-type').textContent = result.tipo_usuario || 'normal';
        document.getElementById('result-amount').textContent = result.monto || '0';
        document.getElementById('result-new-balance').textContent = result.nuevo_saldo || '0';
        
        resultElement.style.display = 'block';
        
        // Reproducir sonido de éxito (opcional)
        this.playSuccessSound();
    }

    showErrorResult(result) {
        const resultElement = document.getElementById('scan-result');
        const paymentDetails = document.getElementById('payment-details');
        
        resultElement.className = 'scan-result result-error';
        document.getElementById('result-title').textContent = 'Error en el Escaneo';
        document.getElementById('result-nonce').textContent = result.nonce || 'N/A';
        document.getElementById('result-status').textContent = 'Error';
        document.getElementById('result-status').style.color = 'var(--danger-red)';
        document.getElementById('result-message').textContent = result.mensaje;
        document.getElementById('result-message').style.color = 'var(--danger-red)';
        
        // Ocultar detalles del pago
        paymentDetails.style.display = 'none';
        
        resultElement.style.display = 'block';
    }

    showError(message) {
        const resultElement = document.getElementById('scan-result');
        
        resultElement.className = 'scan-result result-error';
        document.getElementById('result-title').textContent = 'Error';
        document.getElementById('result-nonce').textContent = 'N/A';
        document.getElementById('result-status').textContent = 'Error';
        document.getElementById('result-status').style.color = 'var(--danger-red)';
        document.getElementById('result-message').textContent = message;
        document.getElementById('result-message').style.color = 'var(--danger-red)';
        
        document.getElementById('payment-details').style.display = 'none';
        resultElement.style.display = 'block';
    }

    showLoading() {
        const resultElement = document.getElementById('scan-result');
        resultElement.className = 'scan-result';
        document.getElementById('result-title').textContent = 'Procesando QR...';
        document.getElementById('result-nonce').textContent = '...';
        document.getElementById('result-status').textContent = 'Procesando';
        document.getElementById('result-message').textContent = 'Validando código QR...';
        document.getElementById('payment-details').style.display = 'none';
        resultElement.style.display = 'block';
    }

    hideResult() {
        document.getElementById('scan-result').style.display = 'none';
    }

    resetScanner() {
        this.hideResult();
        this.startScanner();
    }

    updateScannerControls() {
        const startBtn = document.getElementById('start-scanner');
        const stopBtn = document.getElementById('stop-scanner');
        
        startBtn.disabled = this.isScanning;
        stopBtn.disabled = !this.isScanning;
    }

    updateStats() {
        document.getElementById('successful-scans').textContent = this.scanStats.successful;
        document.getElementById('failed-scans').textContent = this.scanStats.failed;
        document.getElementById('total-scans').textContent = this.scanStats.total;
    }

    loadOperatorInfo() {
        // En una implementación real, esto vendría de la sesión o API
        document.getElementById('operator-name').textContent = 'Operador #001';
        document.getElementById('route-info').textContent = 'Ruta 40 - Norte';
    }

    playSuccessSound() {
        // Opcional: reproducir sonido de éxito
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.value = 800;
            oscillator.type = 'sine';
            
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.5);
        } catch (error) {
            console.log('Audio no disponible');
        }
    }
}

// Inicializar el escáner cuando la página cargue
document.addEventListener('DOMContentLoaded', () => {
    window.qrScanner = new QRScanner();
    
    // Verificar permisos de cámara
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('Tu navegador no soporta el acceso a la cámara. Usa Chrome, Firefox o Safari.');
    }
});

// ✅ NUEVO: Función para testing manual
function testQRScanner() {
    // Test manual - simular escaneo de QR existente
    const testNonce = "29d92897f9b84255a26dea5a1dfa081e"; // El nonce que generaste
    console.log("🧪 TEST: Intentando escanear QR con nonce:", testNonce);
    window.qrScanner.processQRCode(testNonce);
}

// Hacer la función global para probar desde consola
window.testQRScanner = testQRScanner;