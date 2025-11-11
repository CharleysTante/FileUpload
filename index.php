<?php
session_start();

/*
// HTTPS erzwingen (für Production)
if (empty($_SERVER['HTTPS']) || $_SERVER['HTTPS'] === 'off') {
    header('Location: https://' . $_SERVER['HTTP_HOST'] . $_SERVER['REQUEST_URI']);
    exit;
}
*/

// Konfiguration
$userName  = 'upload';
$pwdHash   = '$2y$10$GRb9NWWM9AuLXw.fICc57.3P3OCkbtP4ezE1ONxOUiCenDLr4Ccs6';    // 3242

// Logout-Funktionalität
if (filter_input(INPUT_GET, 'logout')) {
    $_SESSION = $_POST = null;
    session_destroy();
}

$error = null;
if (!empty($_SESSION['loggedin']) || doLogin($error, $userName, $pwdHash)) {
    $tmpl = './view/upload.html';     // Geschützter Bereich, wenn eingeloggt
}
else {
    $tmpl = './view/login.phtml';     // Login-Formular anzeigen
}

ob_start();
include $tmpl;
$content = ob_get_clean();
include './view/layout.phtml';    

function doLogin(?string &$error, string $userName, string $pwdHash) : bool
{
    // Falls Login-Formular abgeschickt wurde
    $inputName = filter_input(INPUT_POST, 'username');
    $inputPwd  = filter_input(INPUT_POST, 'password');
    if ($inputName && $inputPwd) {
        if (strtolower($inputName) === $userName
            && password_verify($inputPwd, $pwdHash)) {
            $_SESSION['loggedin'] = true;
            $_SESSION['username'] = strtolower($inputName);
        } else {
            $error = "Falscher Benutzername oder Passwort!";
        }
    }

   return !empty($_SESSION['loggedin']);
}
