// Funktion zum vollständigen Zurücksetzen des Formulars
// Notwendig nur! für den Zurückbutton des Browsers
function resetUploadForm() {
    const form = document.getElementById('uploadForm');
    if (form) {
        form.reset();
    }
    
    // Textfelder leeren
    const textFields = document.querySelectorAll('.text-field');
    textFields.forEach(field => field.value = '');
    
    // File-Info Texte leeren
    const fileInfos = document.querySelectorAll('.file-info');
    fileInfos.forEach(info => info.textContent = '');
    
    // FieldFiles-Objekte zurücksetzen
    if (typeof fieldFiles !== 'undefined') {
        fieldFiles.field1 = [];
        fieldFiles.field2 = [];
        fieldFiles.field3 = [];
    }
    
    // Versteckte File-Inputs zurücksetzen
    const hiddenInputs = document.querySelectorAll('.hidden-input');
    hiddenInputs.forEach(input => {
        // Erstelle ein neues Input-Element um die Files zu leeren
        const newInput = input.cloneNode(true);
        input.parentNode.replaceChild(newInput, input);
        
        // Event-Listener wieder hinzufügen
        if (newInput.id === 'actualFileInput1') {
            newInput.addEventListener('change', function() {
                updateTextField(this, 'textField1', 'field1');
            });
        } else if (newInput.id === 'actualFileInput2') {
            newInput.addEventListener('change', function() {
                updateTextField(this, 'textField2', 'field2');
            });
        } else if (newInput.id === 'actualFileInput3') {
            newInput.addEventListener('change', function() {
                updateTextField(this, 'textField3', 'field3');
            });
        }
    });
}

// Formular zurücksetzen wenn die Seite geladen wird
window.addEventListener('DOMContentLoaded', resetUploadForm);

// Auch beim Zurück-Button des Browsers
window.addEventListener('pageshow', function(event) {
    if (event.persisted) {
        resetUploadForm();
    }
});

// ---------------------------------------------------------------- //

// Doppelklick für alle Sections um den Dateiauswahldialog zu öffnen
['section1', 'section2', 'section3'].forEach(sectionId => {
    document.getElementById(sectionId).addEventListener('dblclick', function() {
        const number = sectionId.replace('section', '');
        openFileDialog('actualFileInput' + number);
    });
});

// ---------------------------------------------------------------- //

// Dateien werden pro Feld gespeichert
const fieldFiles = {
    field1: [],
    field2: [], 
    field3: []
};

// Funktion zum Öffnen des Dateiauswahldialogs
function openFileDialog(inputId) {
    document.getElementById(inputId).click();
}

// Funktion zum Aktualisieren des Textfelds bei Dateiauswahl
function updateTextField(fileInput, textFieldId, fieldKey) {
    const files = fileInput.files;
    const textField = document.getElementById(textFieldId);
    const fileInfo = document.getElementById('fileInfo' + textFieldId.slice(-1));
    
    if (files.length > 0) {
        // Dateien zum Feld hinzufügen
        fieldFiles[fieldKey] = Array.from(files);
        
        const fileNames = Array.from(files).map(file => file.name).join(', ');
        textField.value = fileNames;
        fileInfo.textContent = `${files.length} Datei(en) ausgewählt`;
        
        // Verstecktes Input aktualisieren
        updateHiddenInput(fieldKey);
    } else {
        textField.value = '';
        fileInfo.textContent = '';
    }
}

// Aktualisiert das versteckte File Input
function updateHiddenInput(fieldKey) {
    // Da wir File Inputs nicht direkt manipulieren können,
    // müssen wir das Formular mit FormData bearbeiten
    // Für jetzt lassen wir die ursprünglichen Inputs
}

// Drag & Drop Funktionen für alle drei Bereiche
function setupDragAndDrop(sectionId, textFieldId, fieldKey, fileInputId) {
    const section = document.getElementById(sectionId);
    const textField = document.getElementById(textFieldId);
    const fileInput = document.getElementById(fileInputId);
    const fileInfo = document.getElementById('fileInfo' + textFieldId.slice(-1));

    // Verhindere Standardverhalten für Drag-Events
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        section.addEventListener(eventName, preventDefaults, false);
    });

    // Hervorhebung beim Dragover
    ['dragenter', 'dragover'].forEach(eventName => {
        section.addEventListener(eventName, () => {
            section.classList.add('dragover');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        section.addEventListener(eventName, () => {
            section.classList.remove('dragover');
        }, false);
    });

    // Handle Drop
    section.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        
        if (files.length > 0) {
            // Dateien zum Feld hinzufügen
            fieldFiles[fieldKey] = Array.from(files);
            
            // Aktualisiere das Textfeld
            const fileNames = Array.from(files).map(file => file.name).join(', ');
            textField.value = fileNames;
            fileInfo.textContent = `${files.length} Datei(en) per Drag & Drop hinzugefügt`;
            
            // Aktualisiere das versteckte File Input
            updateFileInput(fileInput, files);
        }
    }, false);
}

// Aktualisiert ein File Input Element (funktioniert nur für einzelne Dateien)
function updateFileInput(fileInput, files) {
    // Da wir die files-Property nicht direkt setzen können,
    // erstellen wir ein neues DataTransfer Objekt
    const dt = new DataTransfer();
    for (let file of files) {
        dt.items.add(file);
    }
    fileInput.files = dt.files;
}

// Hilfsfunktion zur Verhinderung von Standardverhalten
function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

// Event Listener für die versteckten File Inputs
document.getElementById('actualFileInput1').addEventListener('change', function() {
    updateTextField(this, 'textField1', 'field1');
});

document.getElementById('actualFileInput2').addEventListener('change', function() {
    updateTextField(this, 'textField2', 'field2');
});

document.getElementById('actualFileInput3').addEventListener('change', function() {
    updateTextField(this, 'textField3', 'field3');
});

// Formular Submit Handler
document.getElementById('uploadForm').addEventListener('submit', function(e) {
    // Hier könnten wir zusätzliche Validierung durchführen
    console.log('Formular wird abgeschickt');
});

// Initialisiere Drag & Drop für alle drei Bereiche
document.addEventListener('DOMContentLoaded', () => {
    setupDragAndDrop('section1', 'textField1', 'field1', 'actualFileInput1');
    setupDragAndDrop('section2', 'textField2', 'field2', 'actualFileInput2');
    setupDragAndDrop('section3', 'textField3', 'field3', 'actualFileInput3');
});
