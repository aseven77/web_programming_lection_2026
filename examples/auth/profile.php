<?php
require_once __DIR__ . '/auth.php';
$user = auth_require_user();
header('Cache-Control: no-store');
?>
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Мой профиль</title>
</head>
<body>
<h1>Здравствуйте, <?= auth_e($user['name']) ?>!</h1>
<p>Email: <?= auth_e($user['email']) ?></p>
<p>Роль: <?= auth_e($user['role']) ?></p>
<form method="post" action="logout.php">
    <input type="hidden" name="csrf" value="<?= auth_e(auth_csrf()) ?>">
    <button type="submit">Выйти</button>
</form>
</body>
</html>
