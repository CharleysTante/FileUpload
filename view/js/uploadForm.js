class FileUploadUI {
    constructor() {
        this.fieldCount = document.querySelectorAll('.upload-section').length;
        this.uploadStartTime = null;
        this.lastLoaded = 0;
        this.lastTime = null;
        this.hideProgressTimer = null;
        this.initializeEvents();
    }

    initializeEvents() {
        for (let i = 1; i <= this.fieldCount; i++) {
            const textField = document.getElementById(`textField${i}`);
            const fileInput = document.getElementById(`actualFileInput${i}`);
            const browseBtn = document.querySelector(`.browse-btn[data-field="${i}"]`);

            // Text field Click Event
            textField.addEventListener('click', () => this.triggerFileInput(fileInput));
            
            // Button Click Event
            browseBtn.addEventListener('click', () => this.triggerFileInput(fileInput));
            
            // File Input Change
            fileInput.addEventListener('change', (e) => this.updateTextField(e, i, textField));
            
            // Drag & Drop Events
            this.setupDragAndDrop(i, textField, fileInput);
        }

        // Form Submit
        document.getElementById('uploadForm').addEventListener('submit', (e) => this.handleSubmit(e));
    }

    triggerFileInput(fileInput) {
        fileInput.click();
    }

    updateTextField(event, fieldId, textField) {
        const files = Array.from(event.target.files);
        const fileInfo = document.getElementById(`fileInfo${fieldId}`);

        if (files.length > 0) {
            textField.value = files.map(f => f.name).join(', ');
            fileInfo.textContent = `${files.length} Datei(en) ausgewählt`;
        } else {
            textField.value = '';
            fileInfo.textContent = '';
        }
    }

    setupDragAndDrop(fieldId, textField, fileInput) {
        const sectionUpl = document.getElementById(`section${fieldId}`);
        const fileInfo = document.getElementById(`fileInfo${fieldId}`);

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

        const existingFiles = Array.from(fileInput.files || []);
        const existingFileKeys = existingFiles.map(f => `${f.name}-${f.size}`);
        const uniqueNewFiles = Array.from(newFiles).filter(newFile => 
            !existingFileKeys.includes(`${newFile.name}-${newFile.size}`)
        );

        if (uniqueNewFiles.length === 0) {
            fileInfo.textContent = 'Alle Dateien waren bereits vorhanden';
            return;
        }

        // Kombiniere Dateien und aktualisiere Input
        const allFiles = [...existingFiles, ...uniqueNewFiles];
        const dataTransfer = new DataTransfer();
        allFiles.forEach(file => dataTransfer.items.add(file));
        fileInput.files = dataTransfer.files;

        // Aktualisiere UI
        textField.value = allFiles.map(f => f.name).join(', ');
        this.updateFileInfoMessage(allFiles.length, uniqueNewFiles.length, newFiles.length, fileInfo);
    }

    updateFileInfoMessage(totalFiles, newFilesCount, droppedFilesCount, fileInfo) {
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
            if (fileInput.files.length > 0) {
                hasFiles = true;
                break;
            }
        }

        if (!hasFiles) {
            alert('Bitte wählen Sie mindestens eine Datei aus!');
            return;
        }

        // before resetting, do delete existing timers
        this.clearHideProgressTimer();

        // immediate reset of the progress bar without animation
        this.resetProgressBarImmediately();

        try {
            const result = await this.uploadWithProgress(formData);
            
            if (result.success) {
                let successMessage = `<div>${result.message}</div>`;

                if (result.rejected !== null) {
                    successMessage += `<div class="message-rejected">${result.rejected}</div>`;
                }
                this.showMessage(successMessage, 'success');

                // reset form
                event.target.reset();
                for (let i = 1; i <= this.fieldCount; i++) {
                    document.getElementById(`textField${i}`).value = '';
                    document.getElementById(`fileInfo${i}`).textContent = '';
                }

                // set timer for hiding the progress bar
                this.hideProgressTimer = setTimeout(() => {
                    this.updateProgressBar(0, true);
                    this.showMessage('', '');
                    this.hideProgressTimer = null;
                }, 6000); // 6 seconds
            } else {
                throw new Error(result.error || 'Upload fehlgeschlagen');
            }
        } catch (error) {
            console.error('Fehler:', error);
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
        
        const progressFill = document.querySelector('.progress-fill');
        const progressText = document.querySelector('.progress-text');
        const progressSpeed = document.querySelector('.progress-speed');
        const progressTime = document.querySelector('.progress-time');
        
        // temporarily disable transition
        progressFill.classList.add('no-transition');
        
        // immediate reset
        progressFill.style.width = '0%';
        progressText.textContent = '0%';
        progressText.style.left = '50%';
        progressText.classList.remove('white-text');
        progressSpeed.textContent = 'Geschwindigkeit: -';
        progressTime.textContent = 'Verbleibend: -';
        
        // reset message
        this.showMessage('', '');
        
        // reset upload timer
        this.uploadStartTime = Date.now();
        this.lastLoaded = 0;
        this.lastTime = Date.now();
        
        // display progress container
        document.querySelector('.progress-container').style.display = 'block';
        
        // do reactivate transition after a short delay
        setTimeout(() => {
            progressFill.classList.remove('no-transition');
        }, 50);
    }

    uploadWithProgress(formData) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            
            // progress event
            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable) {
                    const percentComplete = (e.loaded / e.total) * 100;
                    const speed = this.calculateSpeed(e.loaded);
                    const remainingTime = this.calculateRemainingTime(e.loaded, e.total, speed);
                    
                    this.updateProgressBar(percentComplete, false, speed, remainingTime);
                }
            });

            // load event
            xhr.addEventListener('load', () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        const response = JSON.parse(xhr.responseText);
                        resolve(response);
                    } catch (e) {
                        console.error('Fehler beim Parsen der Response:', e);
                        reject(new Error('Ungültige Antwort vom Server'));
                    }
                } else {
                    try {
                        const errorResponse = JSON.parse(xhr.responseText);
                        reject(new Error(errorResponse.error || `HTTP Error: ${xhr.status}`));
                    } catch (e) {
                        reject(new Error(`HTTP Error: ${xhr.status}`));
                    }
                }
            });

            // Error Event
            xhr.addEventListener('error', () => {
                reject(new Error('Netzwerkfehler - Verbindung zum Server fehlgeschlagen'));
            });

            // Timeout Event
            xhr.addEventListener('timeout', () => {
                reject(new Error('Zeitüberschreitung - Server antwortet nicht'));
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
            return Math.round(bytesPerSecond) + ' B/s';
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
        const progressFill = document.querySelector('.progress-fill');
        const progressText = document.querySelector('.progress-text');
        const progressSpeed = document.querySelector('.progress-speed');
        const progressTime = document.querySelector('.progress-time');

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
        messageContainer.innerHTML = message;
        messageContainer.className = 'message-container';
        
        if (type === 'success') {
            messageContainer.classList.add('message-success');
        } else if (type === 'error') {
            messageContainer.classList.add('message-error');
        }
    }
}

// initialisation when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new FileUploadUI();
});
