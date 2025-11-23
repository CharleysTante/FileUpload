<?php

class FileUploader
{
    // config
    private array $config;

    // results
    private array $fUploaded = [];
    private int $totalRejected = 0;
    private int $totalSkipped = 0;
    private array $debugInfo = [];
    private string $filesDump = '';

    // uploaded file raw data
    private ?array $upldFiles;

    // process upload timestamp
    private string $timestamp;

    public function __construct(
        bool $debugMode,
        bool $ajaxMode,         // currently not used
        string $uploadDir,
        string $logFile,
        string $debugLogFile,
        array $allowedExtensions
    ) {
        $this->config = [
            'debugMode' => $debugMode,
            'ajaxMode' => $ajaxMode,
            'uploadDir' => rtrim($uploadDir, '/') . '/',
            'logFile' => $logFile,
            'debugLogFile' => $debugLogFile,
            'allowedExtensions' => $allowedExtensions,
        ];

        $this->ensureDirectoryExists();
        $this->initializeDebugLog();
    }

    public function processUpload(string $fieldName): array
    {
        $this->timestamp = date('Y-m-d H:i:s');
        $this->upldFiles = $_FILES[$fieldName] ?? null;

        if ($this->config['debugMode']) {
            $this->debugServerInfos();
        }

        $this->analyzeFilesStructure();
        try {
            if (filter_input(INPUT_SERVER, 'REQUEST_METHOD') !== 'POST') {
                throw new RuntimeException('Ungültige Anfragemethode');
            }
            $this->processFiles();

            if (empty($this->fUploaded)) {
                throw new RuntimeException('No allowed files found in upload data');
            }
            $this->sendSuccessResponse();                // for AJAX upload only
        } catch (Exception $e) {
            $this->sendErrorResponse($e->getMessage());  // for AJAX upload only
        }
        $this->writeLogs();
        exit;

        // for POST upload only
        // $this->dsplUploadResultsPOST();
    }

    private function getResults(): array
    {
        return [
            'totalUploaded' => count($this->fUploaded),
            'totalRejected' => $this->totalRejected,
            'totalSkipped'  => $this->totalSkipped,
            'debugInfo'     => $this->debugInfo,
            'files_dump'    => $this->filesDump,
            'timestamp'     => $this->timestamp,
        ];
    }

    private function ensureDirectoryExists(): bool
    {
        $path = $this->config['uploadDir'];
        return is_writable($path)
            ?: mkdir($path, 0755, true);
    }

    private function initializeDebugLog(): void
    {
        if (! $this->config['debugMode']) {
            return;
        }

        $this->debugInfo[] = '=== UPLOAD DEBUG LOG ===';
        $this->debugInfo[] = 'Timestamp: ' . date('Y-m-d H:i:s');
        $this->debugInfo[] = '=== COMPLETE $_FILES ARRAY ===';

        // for browser display (with HTML formatting)
        ob_start();
        var_dump($_FILES ?? null);
        $this->filesDump = ob_get_clean();

        // for text files (without HTML)
        $textDump = htmlspecialchars_decode(strip_tags($this->filesDump));
        $this->debugInfo[] = $textDump;
    }

    private function analyzeFilesStructure(): void
    {
        $this->debugInfo[] = '=== ANALYZING FILES STRUCTURE ===';

        foreach ($this->genUploadData() as $property => $values) {
            $this->debugInfo[] = "Property: '$property' - Type: " . gettype($values);
            if (is_array($values)) {
                foreach ($values as $index => $value) {
                    $uploadField = "  Field[$index]: ";
                    $this->debugInfo[] = is_array($value)
                        ? $uploadField . implode(', ', $value)
                        : $uploadField . $value;
                }
            }
        }
        $this->debugInfo[] = '';
    }

    private function processFiles(): void
    {
        $this->debugInfo[] = '=== PROCESSING UPLOAD FILES ===';
        $this->debugInfo[] = 'By standard array method';

        foreach ($this->genUploadData('name') as $fieldIdx => $fileArray) {
            foreach ((array)$fileArray as $fileIdx => $origName) {
                $this->debugInfo[] = "Processing field[$fieldIdx][$fileIdx]: '$origName'";

                $tmpName = $this->upldFiles['tmp_name'][$fieldIdx][$fileIdx]    // for multiple upload field
                    ?? $this->upldFiles['tmp_name'][$fieldIdx];
                $error = $this->upldFiles['error'][$fieldIdx][$fileIdx]         // for multiple upload field
                    ?? $this->upldFiles['error'][$fieldIdx];

                $this->processSingleFile($origName, $tmpName, $error);
            }
        }
    }

    private function processSingleFile(string $origName, string $tmpName, int $error): void
    {
        if (empty($origName)) {
            $this->debugInfo[] = '  Skipped - empty file name(s)';
            $this->totalSkipped++;
            return;
        }

        $this->debugInfo[] = "  Temp: {$tmpName}, Error: {$error}";

        // tests in logical order
        if (! $this->shouldProcessFile($origName, $error)) {
            return;
        }

        $cleanedName = $this->cleanFilename($origName);

        if (! $this->validateFile($origName, $cleanedName, $tmpName)) {
            $this->totalRejected++;
            return;
        }

        $this->uploadFile($origName, $cleanedName, $tmpName);
    }

    private function debugServerInfos(): void
    {
        $this->debugInfo[] = '=== SERVER INFORMATION ===';
        $this->debugInfo[] = 'REQUEST_METHOD: ' . filter_input(INPUT_SERVER, 'REQUEST_METHOD');
        $this->debugInfo[] = 'max_file_uploads: ' . ini_get('max_file_uploads');
        $this->debugInfo[] = 'post_max_size: ' . ini_get('post_max_size');
        $this->debugInfo[] = 'upload_max_filesize: ' . ini_get('upload_max_filesize');
        $this->debugInfo[] = 'memory_limit: ' . ini_get('memory_limit');
        $this->debugInfo[] = 'max_execution_time: ' . ini_get('max_execution_time');
        $this->debugInfo[] = 'max_input_time: ' . ini_get('max_input_time');

        // calculate actual upload size
        if (isset($this->upldFiles['size'])) {
            $totalSize = 0;
            foreach ($this->upldFiles['size'] as $inputRaw) {
                $totalSize += is_array($inputRaw)
                    ? array_sum($inputRaw)
                    : $inputRaw;
            }
            $this->debugInfo[] = "actual upload size: " . round($totalSize / 1024 / 1024, 2) . " MB";
        }
        $this->debugInfo[] = '';
    }

    private function shouldProcessFile(string $origName, int $error): bool
    {
        do {
            if (in_array($origName, $this->fUploaded)) {
                $this->debugInfo[] = '  Skipped - File "' . $origName . '" just uploaded';
                $this->totalSkipped++;
                break;
            }

            if ($error === UPLOAD_ERR_NO_FILE) {
                $this->debugInfo[] = '  Rejected - Upload error: ' . $this->getUploadError($error) . ' (UPLOAD_ERR_NO_FILE)';
                $this->totalRejected++;
                break;
            }

            if ($error !== UPLOAD_ERR_OK) {
                $this->debugInfo[] = '  Rejected - Upload error: ' . $this->getUploadError($error);
                $this->totalRejected++;
                break;
            }

            $shouldProcess = true;
        }
        while (0);

        return $shouldProcess ?? false;
    }

    private function validateFile(string $origName, string $cleanedName, string $tmpName): bool
    {
        if (! file_exists($tmpName)) {
            $this->debugInfo[] = "  Rejected - Temporary file '{$tmpName}' does not exist";
            return false;
        }

        $fileExtension = strtolower(pathinfo($cleanedName, PATHINFO_EXTENSION));

        if (! in_array($fileExtension, $this->config['allowedExtensions'])) {
            $this->debugInfo[] = "  Rejected - File extension not allowed: '{$fileExtension}'";
            return false;
        }

        if ($this->isExecutableFile($tmpName)) {
            $this->debugInfo[] = "  Rejected - File is executable: '{$origName}'";
            return false;
        }

        return true;
    }

    private function uploadFile(string $origName, string $cleanedName, string $tmpName): void
    {
        $targetPath = $this->config['uploadDir'] . $cleanedName;

        if (move_uploaded_file($tmpName, $targetPath)) {
            $this->debugInfo[] = "  Successfully uploaded to: '$targetPath'";
            $this->fUploaded[] = $origName;
        } else {
            $this->debugInfo[] = '  Rejected - move_uploaded_file failed';
            $this->totalRejected++;
        }
    }

    private function cleanFilename(string $filename): ?string
    {
        $replacements = [
            'ä' => 'ae', 'ö' => 'oe', 'ü' => 'ue', 'ß' => 'ss',
            'Ä' => 'Ae', 'Ö' => 'Oe', 'Ü' => 'Ue',
        ];
        $filename = str_replace(array_keys($replacements), array_values($replacements), $filename);
        $filename = preg_replace('/[^a-zA-Z0-9._-]/', '_', $filename);
        $filename = preg_replace('/_{2,}/', '_', $filename);

        return $filename;
    }

    private function isExecutableFile(string $filepath): bool
    {
        $executableSignatures = [
            "\x7FELF",
            "MZ",
            "#!",
            "\xCA\xFE\xBA\xBE",
        ];

        $handle = fopen($filepath, 'rb');
        if (! $handle) {
            return true;
        }

        $header = fread($handle, 4);
        fclose($handle);

        foreach ($executableSignatures as $signature) {
            if (strpos($header, $signature) === 0) {
                return true;
            }
        }

        return false;
    }

    private function getUploadError(int $errorCode): string
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

        return $errors[$errorCode] ?? "Unbekannter Fehler ($errorCode)";
    }

    private function writeLogs(): void
    {
        if ($this->config['debugMode']) {
            file_put_contents(
                $this->config['debugLogFile'],
                implode(PHP_EOL, $this->debugInfo) . PHP_EOL . PHP_EOL,
                FILE_APPEND | LOCK_EX
            );
        }

        $fUploaded  = count($this->fUploaded);
        $logMessage = "[{$this->timestamp}] Erfolgreich: {$fUploaded}, Abgelehnt: {$this->totalRejected}" . PHP_EOL;
        file_put_contents($this->config['logFile'], $logMessage, FILE_APPEND | LOCK_EX);
    }

    private function genUploadData(string $fieldIdx=null) : \Generator
    {
        yield from $fieldIdx ?
            $this->upldFiles[$fieldIdx] ?? []
            :
            $this->upldFiles ?? [];
    }

    /**
     * for $_POST upload only
     *
     * @return void
     */
    private function dsplUploadResultsPOST (): void
    {
        $title   = 'Upload-Ergebnis';
        $results = $this->getResults();
        ob_start();
        include './view/uploadResult.phtml';
        $content = ob_get_clean();
        include './view/layout.phtml';
    }

    /**
     * for AJAX upload only
     *
     * @param array $results
     * @return void
     */
    private function sendSuccessResponse(): void
    {
        http_response_code(200);

        $nUploaded = $this->getResults()['totalUploaded'];
        $nRejected = $this->getResults()['totalRejected'];
        echo json_encode([
            'success'  => true,
            'message'  => 'Upload erfolgreich! - ' . $nUploaded . ' Datei(en) hochgeladen',
            'rejected' => $nRejected ?
                "$nRejected weitere Datei(en) wurde zum Hochladen abgelehnt!"
                :
                null,
        ]);
    }

    /**
     * for AJAX upload only
     *
     * @param string $errorMessage
     * @return void
     */
    private function sendErrorResponse(string $errorMessage): void
    {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'error' => $errorMessage
        ]);
    }
}
