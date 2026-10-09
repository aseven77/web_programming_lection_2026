<?php
require_once __DIR__ . '/auth.php';

function auth_require_admin(): array {
    $user = auth_require_user();
    if ($user['role'] !== 'admin') {
        http_response_code(403);
        exit('Недостаточно прав. Управление новостями доступно администратору.');
    }
    return $user;
}
