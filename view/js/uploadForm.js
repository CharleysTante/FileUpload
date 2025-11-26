class FileUploadUI {
    constructor() {
        this.fieldCount = document.querySelectorAll('.upload-section').length;
        this.uploadStartTime = null;
        this.lastLoaded = 0;
        this.lastTime = null;
        this.hideProgressTimer = null;
        this.postMaxSize = null;
        this.initializeEvents();
        this.loadServerConfig();
    }

    async loadServerConfig() {
        try {
            const response = await fetch('./getConfig.php');
            const result = await response.json();

            if (result.success && result.config) {
                this.postMaxSize = result.config.post_max_size;
                console.log('Server-Konfiguration geladen:', result.config);
            } else {
                console.warn('Konfiguration konnte nicht geladen werden:', result.error);
            }
        } catch (error) {
            console.error('Fehler beim Laden der Server-Konfiguration:', error);
        }
    }

    initializeEvents() {
        // Verzögerte Initialisierung um DOM sicherzustellen
        setTimeout(() => {
            for (let i = 1; i <= this.fieldCount; i++) {
                this.initializeField(i);
            }

            // Form Submit
            const uploadForm = document.getElementById('uploadForm');
            if (uploadForm) {
                uploadForm.addEventListener('submit', (e) => this.handleSubmit(e));
            }
        }, 0);
    }

    initializeField(i) {
        try {
            const textField = document.getElementById(`textField${i}`);
            const fileInput = document.getElementById(`actualFileInput${i}`);
            const browseBtn = document.querySelector(`.browse-btn[data-field="${i}"]`);

            if (!textField || !fileInput || !browseBtn) {
                console.warn(`Elemente für Feld ${i} nicht gefunden`);
                return;
            }

            // Text field - Verwende mousedown statt click
            textField.addEventListener('mousedown', this.createTextFieldHandler(fileInput));
            
            // Button Click Event
            browseBtn.addEventListener('click', this.createButtonHandler(fileInput));
            
            // File Input Change
            fileInput.addEventListener('change', (e) => this.updateTextField(e, i, textField));
            
            // Drag & Drop Events
            this.setupDragAndDrop(i, textField, fileInput);
        } catch (error) {
            console.error(`Fehler bei Initialisierung von Feld ${i}:`, error);
        }
    }

    // Separater Handler für Textfeld
    createTextFieldHandler(fileInput) {
        return (e) => {
            e.preventDefault();
            setTimeout(() => {
                if (fileInput) {
                    fileInput.click();
                }
            }, 10);
        };
    }

    // Separater Handler für Button
    createButtonHandler(fileInput) {
        return (e) => {
            e.preventDefault();
            if (fileInput) {
                fileInput.click();
            }
        };
    }

    updateTextField(event, fieldId, textField) {
        const files = Array.from(event.target.files);
        const fileInfo = document.getElementById(`fileInfo${fieldId}`);

        if (files.length > 0) {
            textField.value = files.map(f => f.name).join(', ');
            if (fileInfo) fileInfo.textContent = `${files.length} Datei(en) ausgewählt`;
        } else {
            textField.value = '';
            if (fileInfo) fileInfo.textContent = '';
        }
    }

    setupDragAndDrop(fieldId, textField, fileInput) {
        const sectionUpl = document.getElementById(`section${fieldId}`);
        const fileInfo = document.getElementById(`fileInfo${fieldId}`);

        if (!sectionUpl) return;

        // Drag & Drop Event Handler
        sectionUpl.addEventListener('dragover', (e) => {
            e.preventDefault();
            sectionUpl.classList.add('dragover');
        });

        sectionUpl.addEventListener('dragleave', () => {
            sectionUpl.classList.remove('dragover');
        });

        sectionUpl.addEventListener('drop', (e) => {
            e.preventDefault();
            sectionUpl.classList.remove('dragover');
            this.handleFileDrop(e.dataTransfer.files, fileInput, textField, fileInfo);
        });
    }

    handleFileDrop(newFiles, fileInput, textField, fileInfo) {
        if (newFiles.length === 0) return;

        const existingFiles = Array.from(fileInput?.files || []);
        const existingFileKeys = existingFiles.map(f => `${f.name}-${f.size}`);
        const uniqueNewFiles = Array.from(newFiles).filter(newFile => 
            !existingFileKeys.includes(`${newFile.name}-${newFile.size}`)
        );

        if (uniqueNewFiles.length === 0) {
            if (fileInfo) fileInfo.textContent = 'Alle Dateien waren bereits vorhanden';
            return;
        }

        // Kombiniere Dateien und aktualisiere Input
        const allFiles = [...existingFiles, ...uniqueNewFiles];
        const dataTransfer = new DataTransfer();
        allFiles.forEach(file => dataTransfer.items.add(file));
        if (fileInput) fileInput.files = dataTransfer.files;

        // Aktualisiere UI
        if (textField) textField.value = allFiles.map(f => f.name).join(', ');
        this.updateFileInfoMessage(allFiles.length, uniqueNewFiles.length, newFiles.length, fileInfo);
    }

    updateFileInfoMessage(totalFiles, newFilesCount, droppedFilesCount, fileInfo) {
        if (!fileInfo) return;

        const duplicates = droppedFilesCount - newFilesCount;

        fileInfo.textContent = (duplicates > 0) ?
            `${totalFiles} Datei(en) ausgewählt (${newFilesCount} neu, ${duplicates} Doppelte ignoriert)`
            :
            `${totalFiles} Datei(en) ausgewählt (${newFilesCount} neu hinzugefügt)`;
    }

    async handleSubmit(event) {
        event.preventDefault();
        const formData = new FormData(event.target);
        
        // Prüfe ob Dateien ausgewählt wurden
        let hasFiles = false;
        for (let i = 1; i <= this.fieldCount; i++) {
            const fileInput = document.getElementById(`actualFileInput${i}`);
            if (fileInput && fileInput.files.length > 0) {
                hasFiles = true;
                break;
            }
        }

        if (!hasFiles) {
            alert('Bitte wählen Sie mindestens eine Datei aus!');
            return;
        }

        // Verbesserte Vorab-Prüfung mit serverseitiger Konfiguration
        let totalSize = 0;
        for (let i = 1; i <= this.fieldCount; i++) {
            const fileInput = document.getElementById(`actualFileInput${i}`);
            if (fileInput) {
                for (let file of fileInput.files) {
                    totalSize += file.size;
                }
            }
        }

        // Prüfung auf POST_MAX_SIZE Überschreitung (mit 10% Puffer für Overhead)
        if (this.postMaxSize !== null) {
            const estimatedSizeWithOverhead = totalSize * 1.1;

            if (estimatedSizeWithOverhead > this.postMaxSize) {
                const maxSizeMB  = (this.postMaxSize / (1024 * 1024)).toFixed(1);
                const currSizeMB = (estimatedSizeWithOverhead / (1024 * 1024)).toFixed(1);
                alert(`Die Datei(en) sind zu groß (${currSizeMB} MB) zum Hochladen!`
                    + ` Maximal ${maxSizeMB} MB gesamt sind zulässig!`);
                return;
            }
        }

        this.clearHideProgressTimer();

        try {
            const result = await this.uploadWithProgress(formData);

            if (result.success) {
                let successMessage = `<div>${result.message}</div>`;

                if (result.rejected !== null) {
                    successMessage += `<div class="message-rejected">${result.rejected}</div>`;
                }
                this.showMessage(successMessage, 'success');

                // reset form
                const form = event.target;
                if (form && form.reset) {
                    form.reset();
                }

                // Zusätzlich UI zurücksetzen
                for (let i = 1; i <= this.fieldCount; i++) {
                    const textField = document.getElementById(`textField${i}`);
                    const fileInfo = document.getElementById(`fileInfo${i}`);

                    if (textField) textField.value = '';
                    if (fileInfo) fileInfo.textContent = '';
                }

                // set timer for hiding the progress bar
                this.hideProgressTimer = setTimeout(() => {
                    this.updateProgressBar(0, true);
                    this.showMessage('', '');
                    this.hideProgressTimer = null;
                }, 6000); // 6 seconds
            } else {
                const error = new Error(result.error || 'Upload fehlgeschlagen');
                error.code = result.code || 0;
                throw error;
            }
        } catch (error) {
            console.error('Fehler:', error);

            // exceeded 'post_max_size'
            if (error.code === 1001) {
                alert('Upload fehlgeschlagen: ' + error.message);
                return;
            }

            this.showMessage('Upload fehlgeschlagen: ' + error.message, 'error');

            // also in case of error: set timer
            this.hideProgressTimer = setTimeout(() => {
                this.updateProgressBar(0, true);
                this.showMessage('', '');
                this.hideProgressTimer = null;
            }, 4000);
        }
    }

    // clears the hide progress timer
    clearHideProgressTimer() {
        if (this.hideProgressTimer) {
            clearTimeout(this.hideProgressTimer);
            this.hideProgressTimer = null;
        }
    }

    // resets the progress bar IMMEDIATELY without animation
    resetProgressBarImmediately() {
        // do reset timer
        this.clearHideProgressTimer();

        const progressContainer = document.querySelector('.progress-container');
        const progressFill = document.querySelector('.progress-fill');
        const progressText = document.querySelector('.progress-text');
        const progressSpeed = document.querySelector('.progress-speed');
        const progressTime = document.querySelector('.progress-time');

        if (!progressFill || !progressText || !progressSpeed || !progressTime) {
            return;
        }

        progressFill.classList.add('no-transition');
        progressFill.style.width = '0%';
        progressText.textContent = '0%';
        progressText.style.left = '50%';
        progressText.classList.remove('white-text');
        progressSpeed.textContent = 'Geschwindigkeit: -';
        progressTime.textContent = 'Verbleibend: -';

        this.showMessage('', '');

        // do reset upload timer
        this.uploadStartTime = Date.now();
        this.lastLoaded = 0;
        this.lastTime = Date.now();

        if (progressContainer) {
            progressContainer.style.display = 'block';
        }

        // do reactivate transition after a short delay
        setTimeout(() => {
            if (progressFill) {
                progressFill.classList.remove('no-transition');
            }
        }, 50);
    }

    uploadWithProgress(formData) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            
            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable) {
                    const percentComplete = (e.loaded / e.total) * 100;
                    const speed = this.calculateSpeed(e.loaded, e.total);
                    const remainingTime = this.calculateRemainingTime(e.loaded, e.total, speed);
                    
                    this.updateProgressBar(percentComplete, false, speed, remainingTime);
                }
            });

            xhr.addEventListener('load', () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        const response = JSON.parse(xhr.responseText);
                        resolve(response);
                    } catch (e) {
                        console.error('Fehler beim Parsen der Response:', e);
                        const error = new Error('Ungültige Antwort vom Server');
                        error.code = 1002;
                        reject(error);
                    }
                } else {
                    try {
                        const errorResponse = JSON.parse(xhr.responseText);
                        const error = new Error(errorResponse.error || `HTTP Error: ${xhr.status}`);
                        error.code = errorResponse.code || xhr.status;
                        reject(error);
                    } catch (e) {
                        const error = new Error(`HTTP Error: ${xhr.status}`);
                        error.code = xhr.status;
                        reject(error);
                    }
                }
            });

            xhr.addEventListener('error', () => {
                const error = new Error('Netzwerkfehler - Verbindung zum Server fehlgeschlagen');
                error.code = 1003;
                reject(error);
            });

            xhr.addEventListener('timeout', () => {
                const error = new Error('Zeitüberschreitung - Server antwortet nicht');
                error.code = 1004;
                reject(error);
            });

            xhr.open('POST', 'doUpload.php');
            xhr.timeout = 30000;
            xhr.send(formData);
        });
    }

    calculateSpeed(currentLoaded) {
        const now = Date.now();
        const timeDiff = (now - this.lastTime) / 1000;                          // in seconds
        const loadedDiff = currentLoaded - this.lastLoaded;

        this.lastLoaded = currentLoaded;
        this.lastTime = now;

        if (timeDiff > 0) {
            const speed = loadedDiff / timeDiff;                                // bytes pro second
            return this.formatSpeed(speed);
        }
        return '-';
    }

    formatSpeed(bytesPerSecond) {
        if (bytesPerSecond === '-') return bytesPerSecond;

        if (bytesPerSecond < 1024) {
            return Math.round(bytesPerSecond) + ' Byte/s';
        } else if (bytesPerSecond < 1024 * 1024) {
            return (bytesPerSecond / 1024).toFixed(1) + ' KB/s';
        } else {
            return (bytesPerSecond / (1024 * 1024)).toFixed(1) + ' MB/s';
        }
    }

    calculateRemainingTime(loaded, total, currentSpeed) {
        if (currentSpeed === '-' || loaded === 0) return '-';

        const remainingBytes = total - loaded;

        // do convert speed back to bytes per second for calculation
        let bytesPerSecond;
        if (currentSpeed.includes('MB/s')) {
            bytesPerSecond = parseFloat(currentSpeed) * 1024 * 1024;
        } else if (currentSpeed.includes('KB/s')) {
            bytesPerSecond = parseFloat(currentSpeed) * 1024;
        } else {
            bytesPerSecond = parseFloat(currentSpeed);
        }

        if (bytesPerSecond > 0) {
            const seconds = remainingBytes / bytesPerSecond;
            return this.formatTime(seconds);
        }
        return '-';
    }

    formatTime(seconds) {
        if (seconds < 60) {
            return Math.round(seconds) + 's';
        } else if (seconds < 3600) {
            const minutes = Math.floor(seconds / 60);
            const secs = Math.round(seconds % 60);
            return `${minutes}m ${secs}s`;
        } else {
            const hours = Math.floor(seconds / 3600);
            const minutes = Math.round((seconds % 3600) / 60);
            return `${hours}h ${minutes}m`;
        }
    }

    updateProgressBar(percent, hide = false, speed = '-', remainingTime = '-') {
        const progressContainer = document.querySelector('.progress-container');
        const progressFill  = document.querySelector('.progress-fill');
        const progressText  = document.querySelector('.progress-text');
        const progressSpeed = document.querySelector('.progress-speed');
        const progressTime  = document.querySelector('.progress-time');

        if (hide) {
            progressContainer.style.display = 'none';
            progressFill.style.width = '0%';
            progressText.textContent = '0%';
            progressText.style.left = '50%';
            progressText.classList.remove('white-text');
            progressFill.classList.remove('uploading');
        } else {
            progressContainer.style.display = 'block';
            progressFill.style.width = `${percent}%`;

            // fixed central position
            progressText.style.left = '50%';

            // dynamic colour adjustment based on progress
            if (percent >= 50) {
                progressText.classList.add('white-text');
            } else {
                progressText.classList.remove('white-text');
            }

            // percentage display
            progressText.textContent = `${percent.toFixed(1)}%`;
            
            // display speed and remaining time
            progressSpeed.textContent = `Geschwindigkeit: ${speed}`;
            progressTime.textContent = `Verbleibend: ${remainingTime}`;
            
            // animation for active upload
            if (percent > 0 && percent < 100) {
                progressFill.classList.add('uploading');
            } else {
                progressFill.classList.remove('uploading');
            }
        }
    }

    showMessage(message, type = '') {
        const messageContainer = document.querySelector('.message-container');
        if (! messageContainer) {
            return;
        }

        messageContainer.innerHTML = message;
        messageContainer.className = 'message-container';                       // reset any other class

        if (type === 'success') {
            messageContainer.classList.add('message-success');
        } else if (type === 'error') {
            messageContainer.classList.add('message-error');
        }
    }
}

// initialisation when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    try {
        new FileUploadUI();
    } catch (error) {
        console.error('Fehler bei der Initialisierung des FileUploadUI:', error);
    }
});
