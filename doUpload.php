<?php
session_start();
if (empty($_SESSION['loggedin'])) {
    http_response_code(404);
    echo '<h1>Seite nicht gefunden</h1>';
    exit;
}

// Konfiguration
$debugMode = true;
$uploadDir = __DIR__ . '/files/';
$logFile = __DIR__ . '/log/log.txt';
$debugLogFile = __DIR__ . '/log/debug_log.txt';
$allowedExt = ['txt', 'pdf', 'png', 'jpg', 'jpeg', 'gif', 'doc', 'docx'];

// Sicherstellen, dass das Upload-Verzeichnis existiert
if (!is_dir($uploadDir)) {
    mkdir($uploadDir, 0755, true);
}

// Debug-Informationen sammeln
$debugInfo = [];
if ($debugMode) {
    $debugInfo[] = "=== UPLOAD DEBUG LOG ===";
    $debugInfo[] = "Timestamp: " . date('Y-m-d H:i:s');
    $debugInfo[] = "=== COMPLETE _FILES ARRAY ===";
    ob_start();
    var_dump($_FILES);
    $files_dump  = ob_get_clean();
    $debugInfo[] = htmlspecialchars_decode(strip_tags($files_dump));    //for text file
}

// init counter
$totalUploaded = 0;
$totalRejected = 0;

// check, if there are any files uploaded
if (isset($_FILES['field'])) {
    $debugInfo[] = "=== ANALYZING FILES STRUCTURE ===";
    
    // Spezielle Verarbeitung für multi-file Uploads
    foreach ($_FILES['field'] as $property => $values) {
        $debugInfo[] = "Property: '$property' - Type: " . gettype($values);
        if (is_array($values)) {
            foreach ($values as $index => $value) {
                $uploadField = "  Field[$index]: ";
                $debugInfo[] = is_array($value)
                    ? $uploadField . implode(", ", $value)
                    : $uploadField . $value;
            }
        }
    }

    // Start processing upload files
    $debugInfo[] = "=== PROCESSING UPLOAD FILES ===";
    $debugInfo[] = "By standard array method";
    if (is_array($_FILES['field']['name'])) {
        foreach ($_FILES['field']['name'] as $fieldIdx => $files) {
            foreach ((array)$files as $idx => $originalName) {
                processFile($fieldIdx, $idx, $originalName, $debugInfo, $totalUploaded, $totalRejected);
            }
        }
    }
}

// write the debug log
if ($debugMode) {
    file_put_contents($debugLogFile,
        implode(PHP_EOL, $debugInfo) . PHP_EOL . PHP_EOL, FILE_APPEND | LOCK_EX);
}

// build the log entry
$timestamp = date('Y-m-d H:i:s');
$logMessage = "[$timestamp] Erfolgreich: $totalUploaded, Abgelehnt: $totalRejected" . PHP_EOL;
file_put_contents($logFile, $logMessage, FILE_APPEND | LOCK_EX);

// display upload results
$title = 'Upload-Ergebnis';
ob_start();
include './view/uploadResult.phtml';
$content = ob_get_clean();
include './view/layout.phtml';

/**
 * process a single file
 */
function processFile(
    int $fieldIdx,
    int $fileIdx,
    string $originalName,
    array &$debugInfo,
    int &$totalUploaded,
    int &$totalRejected) : void
{
    global $uploadDir, $allowedExt;
    
    $debugInfo[] = "Processing field[$fieldIdx][$fileIdx]: '$originalName'";
    
    if (empty($originalName)) {
        $debugInfo[] = "  Skipped - empty filename";
        return;
    }
    
    // Temporären Pfad und Fehlercode holen
    $tmpName = $_FILES['field']['tmp_name'][$fieldIdx];
    $error = $_FILES['field']['error'][$fieldIdx];
    
    if (is_array($tmpName)) {
        $tmpName = $tmpName[$fileIdx];
        $error = $error[$fileIdx];
    }
    
    $debugInfo[] = "  Temp: $tmpName, Error: $error";
    
    if ($error === UPLOAD_ERR_NO_FILE) {
        $debugInfo[] = "  Skipped - UPLOAD_ERR_NO_FILE";
        return;
    }
    
    if ($error !== UPLOAD_ERR_OK) {
        $debugInfo[] = "  Rejected - Upload error: " . getUploadError($error);
        $totalRejected++;
        return;
    }

    if (!file_exists($tmpName)) {
        $debugInfo[] = "  Rejected - Temporary file doesn't exist";
        $totalRejected++;
        return;
    }

    // normalise file names
    $normalizedFilename = normalizeFilename($originalName);
    $fileExt = strtolower(pathinfo($normalizedFilename, PATHINFO_EXTENSION));
    $targetPath = $uploadDir . $normalizedFilename;

    // check that the file extension is allowed
    if (! in_array($fileExt, $allowedExt)) {
        $debugInfo[] = "  Rejected - File extension not allowed: '$fileExt'";
        $totalRejected++;
        return;
    }

    // check that the file is not executable
    if (isExecutableFile($tmpName)) {
        $debugInfo[] = "  Rejected - File is executable: '$originalName'";
        $totalRejected++;
        return;
    }
    
    if (move_uploaded_file($tmpName, $targetPath)) {
        $debugInfo[] = "  Successfully uploaded to: '$targetPath'";
        $totalUploaded++;
    } else {
        $debugInfo[] = "  Rejected - move_uploaded_file failed";
        $totalRejected++;
    }
}

/**
 * Normalisiert Dateinamen:
 * - Entfernt Sonderzeichen
 * - Ersetzt Umlaute
 * - Ersetzt Leerzeichen mit Unterstrichen
 */
function normalizeFilename(string $filename) : string
{
    // Umlaute ersetzen
    $replacements = [
        'ä' => 'ae', 'ö' => 'oe', 'ü' => 'ue', 'ß' => 'ss',
        'Ä' => 'Ae', 'Ö' => 'Oe', 'Ü' => 'Ue'
    ];
    $filename = str_replace(array_keys($replacements), array_values($replacements), $filename);

    // Leerzeichen und unerwünschte Zeichen ersetzen
    $filename = preg_replace('/[^a-zA-Z0-9._-]/', '_', $filename);
    $filename = preg_replace('/_{2,}/', '_', $filename);

    return $filename;
}

/**
 * Prüft auf ausführbare Dateien anhand der Magic Bytes
 */
function isExecutableFile(string $filepath) : bool
{
    $executableSignatures = [
        "\x7FELF",          // ELF Binary
        "MZ",               // Windows PE
        "#!",               // Shell Script
        "\xCA\xFE\xBA\xBE", // Java Class
    ];
    
    $handle = fopen($filepath, 'rb');
    if (!$handle) return true;
    
    $header = fread($handle, 4);
    fclose($handle);
    
    foreach ($executableSignatures as $signature) {
        if (strpos($header, $signature) === 0) {
            return true;
        }
    }
    
    return false;
}

/**
 * Gibt eine lesbare Fehlermeldung für Upload-Fehler zurück
 */
function getUploadError(int $errorCode) : string
{
    $errors = [
        UPLOAD_ERR_INI_SIZE => 'Die Datei ist größer als die erlaubte Größe',
        UPLOAD_ERR_FORM_SIZE => 'Die Datei ist größer als die im Formular angegebene Größe',
        UPLOAD_ERR_PARTIAL => 'Die Datei wurde nur teilweise hochgeladen',
        UPLOAD_ERR_NO_FILE => 'Es wurde keine Datei hochgeladen',
        UPLOAD_ERR_NO_TMP_DIR => 'Temporärer Ordner fehlt',
        UPLOAD_ERR_CANT_WRITE => 'Fehler beim Schreiben der Datei auf die Festplatte',
        UPLOAD_ERR_EXTENSION => 'Eine PHP-Erweiterung hat den Upload gestoppt',
    ];

    return isset($errors[$errorCode])
        ? $errors[$errorCode]
        : "Unbekannter Fehler ($errorCode)";
}
