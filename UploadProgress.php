<?php

class UploadProgress {
    private string $progressKey;
    private int $updateInterval;
    
    public function __construct(string $identifier = '', int $updateInterval = 1) {
        $this->progressKey = 'upload_' . ($identifier ?: uniqid());
        $this->updateInterval = $updateInterval;
    }
    
    public function initialize(int $totalSize): void {
        $_SESSION[$this->progressKey] = [
            'total' => $totalSize,
            'uploaded' => 0,
            'percentage' => 0,
            'start_time' => time(),
            'last_update' => 0,
            'completed' => false
        ];
    }
    
    public function update(int $uploadedBytes): void {
        $currentTime = time();
        
        if (isset($_SESSION[$this->progressKey]) && 
            ($currentTime - $_SESSION[$this->progressKey]['last_update']) >= $this->updateInterval) {
            
            $_SESSION[$this->progressKey]['uploaded'] = $uploadedBytes;
            $_SESSION[$this->progressKey]['percentage'] = 
                round(($uploadedBytes / $_SESSION[$this->progressKey]['total']) * 100, 2);
            $_SESSION[$this->progressKey]['last_update'] = $currentTime;
        }
    }
    
    public function getProgress(): array {
        return $_SESSION[$this->progressKey] ?? [
            'total' => 0,
            'uploaded' => 0,
            'percentage' => 0,
            'start_time' => time(),
            'completed' => false
        ];
    }
    
    public function complete(): void {
        if (isset($_SESSION[$this->progressKey])) {
            $_SESSION[$this->progressKey]['percentage'] = 100;
            $_SESSION[$this->progressKey]['uploaded'] = $_SESSION[$this->progressKey]['total'];
            $_SESSION[$this->progressKey]['completed'] = true;
        }
    }
    
    public function cleanup(): void {
        if (isset($_SESSION[$this->progressKey])) {
            unset($_SESSION[$this->progressKey]);
        }
    }
    
    public function getKey(): string {
        return $this->progressKey;
    }
    
    public function calculateSpeed(array $progress): float {
        if (!isset($progress['start_time']) || $progress['uploaded'] === 0) {
            return 0;
        }
        
        $timeElapsed = time() - $progress['start_time'];
        return $timeElapsed > 0 ? round($progress['uploaded'] / $timeElapsed / 1024, 2) : 0;
    }
}
