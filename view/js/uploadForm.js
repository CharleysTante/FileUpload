class FileUploadUI {
    constructor() {
        this.fieldCount = document.querySelectorAll('.upload-section').length;
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
        
        // Zurücksetzen der Nachricht
        this.showMessage('', '');
        
        try {
            const result = await this.uploadWithProgress(formData);
            
            if (result.success) {
                let successMessage = `<div>${result.message}</div>`;

                if (result.rejected !== null) {
                    successMessage += `<div class="message-rejected">${result.rejected}</div>`;
                }
                this.showMessage(successMessage, 'success');

                // Formular zurücksetzen
                event.target.reset();
                for (let i = 1; i <= this.fieldCount; i++) {
                    document.getElementById(`textField${i}`).value = '';
                    document.getElementById(`fileInfo${i}`).textContent = '';
                }
                // Progress Bar nach Erfolg langsam ausblenden - Zeit verdoppelt auf 6 Sekunden
                setTimeout(() => {
                    this.updateProgressBar(0, true);
                    this.showMessage('', ''); // Nachricht auch ausblenden
                }, 60000); // 6000ms = 6 Sekunden
            } else {
                throw new Error(result.error || 'Upload fehlgeschlagen');
            }
        } catch (error) {
            console.error('Fehler:', error);
            alert('Upload fehlgeschlagen: ' + error.message);
            // Progress Bar bei Fehler sofort ausblenden
            this.updateProgressBar(0, true);
            this.showMessage('', ''); // Nachricht ausblenden
        }
    }

    uploadWithProgress(formData) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            
            // Progress Event
            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable) {
                    const percentComplete = (e.loaded / e.total) * 100;
                    this.updateProgressBar(percentComplete, false);
                }
            });

            // Load Event
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

    updateProgressBar(percent, hide = false) {
        const progressContainer = document.querySelector('.progress-container');
        const progressFill = document.querySelector('.progress-fill');

        if (hide) {
            progressContainer.style.display = 'none';
            progressFill.style.width = '0%';
        } else {
            progressContainer.style.display = 'block';
            progressFill.style.width = `${percent}%`;
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

// Initialisierung wenn DOM geladen
document.addEventListener('DOMContentLoaded', () => {
    new FileUploadUI();
});