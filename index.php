<?php
session_start();

/*
// force HTTPS (for production)
if (empty($_SERVER['HTTPS']) || $_SERVER['HTTPS'] === 'off') {
    header('Location: https://' . $_SERVER['HTTP_HOST'] . $_SERVER['REQUEST_URI']);
    exit;
}
*/

// set credentials
$userName = 'upload';
$pwdHash  = '$2y$10$GRb9NWWM9AuLXw.fICc57.3P3OCkbtP4ezE1ONxOUiCenDLr4Ccs6';    // 3242

// logout functionality
if (filter_input(INPUT_GET, 'logout')) {
    $_SESSION = $_POST = null;
    session_destroy();
}

$error = null;
if (!empty($_SESSION['loggedin']) || doLogin($error, $userName, $pwdHash)) {
    $tmpl = './view/upload.html';     // protected area when logged in
}
else {
    $tmpl = './view/login.phtml';     // show login form
}

ob_start();
include $tmpl;
$content = ob_get_clean();
include './view/layout.phtml';

function doLogin(?string &$error, string $userName, string $pwdHash) : bool
{
    // if login form has been submitted
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
