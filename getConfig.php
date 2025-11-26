<?php
header("Content-Security-Policy: default-src 'self'");
header("X-Content-Type-Options: nosniff");
header("Content-Type: application/json");

require_once 'FileUploader.php';

try {
    $config = FileUploader::getUploadConfig();
    echo json_encode([
        'success' => true,
        'config'  => $config,
    ]);
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'config' => null,
        'error'  => 'Konfiguration konnte nicht geladen werden',
    ]);
}
