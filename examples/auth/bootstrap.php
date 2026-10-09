<?php
// Подключать до HTML. Другие страницы не должны повторять session_start().
ini_set('session.use_strict_mode', '1');
session_set_cookie_params([
    'httponly' => true,
    'samesite' => 'Lax',
    'secure' => isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
    'path' => '/',
]);
session_start();
require_once __DIR__ . '/config.php';

function auth_e(string $value): string {
    return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function auth_field(array $data, string $key): string {
    return is_string($data[$key] ?? null) ? $data[$key] : '';
}

function auth_csrf(): string {
    if (!isset($_SESSION['auth_csrf']) || !is_string($_SESSION['auth_csrf'])) {
        $_SESSION['auth_csrf'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['auth_csrf'];
}

function auth_valid_csrf($token): bool {
    return is_string($token) && hash_equals(auth_csrf(), $token);
}

function auth_check_post(): void {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        header('Allow: POST');
        http_response_code(405);
        exit('Используйте форму с методом POST.');
    }
    if (!auth_valid_csrf($_POST['csrf'] ?? null)) {
        http_response_code(403);
        exit('Токен формы устарел. Вернитесь на страницу, обновите её и повторите действие.');
    }
}
