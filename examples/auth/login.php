<?php
require_once __DIR__ . '/auth.php';
if (auth_user() !== null) {
    header('Location: profile.php', true, 303);
    exit;
}
$error = '';
$email = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    auth_check_post();
    $email = strtolower(trim(auth_field($_POST, 'email')));
    $password = auth_field($_POST, 'password');
    $user = false;
    if (strlen($email) <= 191 && filter_var($email, FILTER_VALIDATE_EMAIL) &&
        strlen($password) >= 12 && strlen($password) <= 72 && strpos($password, "\0") === false) {
        $stmt = $pdo->prepare('SELECT id, password_hash FROM users WHERE email = ?');
        $stmt->execute([$email]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
    }
    // Учебный резервный хеш уменьшает различие времени для неизвестного email.
    $hash = $user ? $user['password_hash'] : '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.';
    $validPassword = password_verify($password, $hash);
    if ($user && $validPassword) {
        session_regenerate_id(true);
        $_SESSION['user_id'] = (int) $user['id'];
        $_SESSION['auth_csrf'] = bin2hex(random_bytes(32));
        header('Location: profile.php', true, 303);
        exit;
    }
    $error = 'Неверный email или пароль.';
}
?>
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Вход</title>
</head>
<body>
<h1>Вход</h1>
<?php if ($error !== ''): ?><p role="alert"><?= auth_e($error) ?></p><?php endif; ?>
<form method="post" action="login.php">
    <input type="hidden" name="csrf" value="<?= auth_e(auth_csrf()) ?>">
    <p><label>Email <input type="email" name="email" required autocomplete="username" value="<?= auth_e($email) ?>"></label></p>
    <p><label>Пароль <input type="password" name="password" required autocomplete="current-password"></label></p>
    <button type="submit">Войти</button>
</form>
<p><a href="register.php">Создать учётную запись</a></p>
</body>
</html>
