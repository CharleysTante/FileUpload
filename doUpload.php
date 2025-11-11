<?php

session_start();

if (empty($_SESSION['loggedin'])) {
    http_response_code(404);
    echo '<h1>Seite nicht gefunden</h1>';
    exit;
}

require_once 'FileUploader.php';

$debugMode = true;
$uploadDir = __DIR__ . '/files/';
$logFile = __DIR__ . '/logs/log.txt';
$debugLogFile = __DIR__ . '/logs/debug_log.txt';
$allowedExtensions = ['txt', 'pdf', 'png', 'jpg', 'jpeg', 'gif', 'doc', 'docx'];

$uploader = new FileUploader(
    $debugMode,
    $uploadDir,
    $logFile,
    $debugLogFile,
    $allowedExtensions
);
$results = $uploader->processUpload('field');

$title = 'Upload-Ergebnis';
ob_start();
include './view/uploadResult.phtml';
$content = ob_get_clean();
include './view/layout.phtml';
