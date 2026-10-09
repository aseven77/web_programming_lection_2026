<?php
// Скопируйте в config.php и укажите настройки своей локальной базы.
$pdo = new PDO(
    'mysql:host=localhost;dbname=site;charset=utf8mb4',
    'root',
    '',
    [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]
);
