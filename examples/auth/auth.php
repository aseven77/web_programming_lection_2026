<?php
require_once __DIR__ . '/bootstrap.php';

function auth_user(): ?array {
    global $pdo;
    $id = $_SESSION['user_id'] ?? null;
    if (!is_int($id) || $id < 1) {
        return null;
    }
    $stmt = $pdo->prepare('SELECT id, name, email, role FROM users WHERE id = ?');
    $stmt->execute([$id]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$user) {
        unset($_SESSION['user_id']);
        return null;
    }
    return $user;
}

function auth_require_user(): array {
    $user = auth_user();
    if ($user === null) {
        header('Location: login.php', true, 303);
        exit;
    }
    return $user;
}
