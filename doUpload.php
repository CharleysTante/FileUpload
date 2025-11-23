<?php
header("Content-Security-Policy: default-src 'self'");
header("X-Content-Type-Options: nosniff");
session_start();

if (empty($_SESSION['loggedin'])) {
    http_response_code(404);
    echo '<h1>Seite nicht gefunden</h1>';
    exit;
}

// config
$debugMode = true;
$ajaxMode  = true;
$uploadDir = __DIR__ . '/files/';
$logFile   = __DIR__ . '/logs/log.txt';
$debugLogFile = __DIR__ . '/logs/debug_log.txt';
$allowedExtensions = ['txt', 'pdf', 'png', 'jpg', 'jpeg', 'gif', 'doc', 'docx', 'exe'];

// Instanziierung der Klasse 'FileUploader'
require_once 'FileUploader.php';
try {
    $uploader = new FileUploader(
        $debugMode,
        $ajaxMode,
        $uploadDir,
        $logFile,
        $debugLogFile,
        $allowedExtensions
    );
} catch(\Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Schwerwiegender Fehler: ' . $e->getMessage()
    ]);

    $timestamp = date('Y-m-d H:i:s');
    file_put_contents('upload.log', "[$timestamp] FATAL ERROR: {$e->getMessage()}\n", FILE_APPEND);
    exit;
}
$uploader->processUpload('field');
