<?php
require_once __DIR__ . '/bootstrap.php';
$errors = [];
$name = '';
$email = '';
$registered = isset($_GET['done']) && $_GET['done'] === '1';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    auth_check_post();
    $name = trim(auth_field($_POST, 'name'));
    $email = strtolower(trim(auth_field($_POST, 'email')));
    $password = auth_field($_POST, 'password');
    $confirmation = auth_field($_POST, 'confirmation');

    if ($name === '' || mb_strlen($name, 'UTF-8') > 80) {
        $errors[] = 'Имя должно содержать от 1 до 80 символов.';
    }
    if (strlen($email) > 191 || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $errors[] = 'Введите корректный email длиной не более 191 байта.';
    }
    if (strlen($password) < 12 || strlen($password) > 72 || strpos($password, "\0") !== false) {
        $errors[] = 'Пароль должен содержать от 12 до 72 байт без нулевого байта.';
    }
    if ($password !== $confirmation) {
        $errors[] = 'Пароли не совпадают.';
    }

    if (!$errors) {
        try {
            $stmt = $pdo->prepare(
                "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'user')"
            );
            $stmt->execute([$name, $email, password_hash($password, PASSWORD_BCRYPT)]);
            header('Location: register.php?done=1', true, 303);
            exit;
        } catch (PDOException $exception) {
            if ((int) ($exception->errorInfo[1] ?? 0) === 1062) {
                $errors[] = 'Этот email уже зарегистрирован.';
            } else {
                error_log((string) $exception);
                http_response_code(500);
                $errors[] = 'Не удалось создать пользователя. Проверьте журнал сервера.';
            }
        }
    }
}
?>
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Регистрация</title>
</head>
<body>
<h1>Регистрация</h1>
<?php if ($registered): ?>
    <p>Регистрация завершена. Теперь можно войти в свою учётную запись.</p>
<?php endif; ?>
<?php foreach ($errors as $error): ?>
    <p role="alert"><?= auth_e($error) ?></p>
<?php endforeach; ?>
<form method="post" action="register.php">
    <input type="hidden" name="csrf" value="<?= auth_e(auth_csrf()) ?>">
    <p><label>Имя <input name="name" maxlength="80" required autocomplete="name" value="<?= auth_e($name) ?>"></label></p>
    <p><label>Email <input type="email" name="email" maxlength="191" required autocomplete="email" value="<?= auth_e($email) ?>"></label></p>
    <p id="password-hint">Пароль: 12–72 байта. Латинская буква занимает один байт, русская обычно два. Для первой проверки используйте латинские буквы и цифры.</p>
    <p><label>Пароль <input type="password" name="password" required autocomplete="new-password" aria-describedby="password-hint"></label></p>
    <p><label>Повтор пароля <input type="password" name="confirmation" required autocomplete="new-password"></label></p>
    <button type="submit">Создать учётную запись</button>
</form>
</body>
</html>
