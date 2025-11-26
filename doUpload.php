<?php
/**
 * called by 'uploadForm.js'
 */
header("Content-Security-Policy: default-src 'self'");
header("X-Content-Type-Options: nosniff");
header("Content-Type: application/json");
session_start();

if (empty($_SESSION['loggedin'])) {
    http_response_code(404);
    echo json_encode('<h1>Seite nicht gefunden</h1>');
    exit;
}

// config
$debugMode = true;
$ajaxMode  = true;
$uploadDir = __DIR__ . '/files/';
$logFile   = __DIR__ . '/logs/log.txt';
$debugLogFile = __DIR__ . '/logs/debug_log.txt';
$allowedExtensions = ['txt', 'pdf', 'png', 'jpg', 'jpeg', 'gif', 'doc', 'docx'];

// instantiation of the 'FileUploader' class
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
        'error'   => 'Schwerwiegender Fehler: ' . $e->getMessage(),
    ]);

    // write debug log file
    $timestamp  = date('Y-m-d H:i:s');
    $logMessage = "[$timestamp] FATAL ERROR: {$e->getMessage()}" . PHP_EOL;
    file_put_contents($debugLogFile, $logMessage, FILE_APPEND | LOCK_EX);
    exit;
}
$uploader->processUpload('field');
