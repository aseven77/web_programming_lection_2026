<?php
require_once __DIR__ . '/access.php';
auth_require_admin();

function e(string $value): string {
    return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}
function positiveId($value): int {
    return (int) filter_var($value, FILTER_VALIDATE_INT,
        ['options' => ['min_range' => 1]]);
}
function findNews(PDO $pdo, int $id) {
    $stmt = $pdo->prepare('SELECT id, title, content FROM news WHERE id = ?');
    $stmt->execute([$id]);
    return $stmt->fetch(PDO::FETCH_ASSOC);
}

$errors = [];
$id = 0;
$title = '';
$content = '';
$editing = false;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    auth_check_post();
    $action = is_string($_POST['action'] ?? null) ? $_POST['action'] : '';
    $id = positiveId($_POST['id'] ?? null);
    $title = is_string($_POST['title'] ?? null) ? trim($_POST['title']) : '';
    $content = is_string($_POST['content'] ?? null) ? trim($_POST['content']) : '';
    $editing = $action === 'update';

    if (!in_array($action, ['create', 'update', 'delete'], true)) {
        $errors[] = 'Неизвестная операция.';
    } elseif ($action !== 'create' && ($id === 0 || !findNews($pdo, $id))) {
        http_response_code(404);
        $errors[] = 'Новость не найдена. Вернитесь к списку.';
    }
    if (in_array($action, ['create', 'update'], true)) {
        if ($title === '' || mb_strlen($title, 'UTF-8') > 255) {
            $errors[] = 'Заголовок должен содержать от 1 до 255 символов.';
        }
        if ($content === '' || mb_strlen($content, 'UTF-8') > 10000) {
            $errors[] = 'Текст должен содержать от 1 до 10000 символов.';
        }
    }

    if (!$errors) {
        if ($action === 'create') {
            $stmt = $pdo->prepare('INSERT INTO news (title, content) VALUES (?, ?)');
            $stmt->execute([$title, $content]);
        } elseif ($action === 'update') {
            $stmt = $pdo->prepare('UPDATE news SET title = ?, content = ? WHERE id = ?');
            $stmt->execute([$title, $content, $id]);
        } else {
            $stmt = $pdo->prepare('DELETE FROM news WHERE id = ?');
            $stmt->execute([$id]);
        }
        header('Location: admin.php', true, 303);
        exit;
    }
} elseif (isset($_GET['edit'])) {
    $id = positiveId($_GET['edit']);
    $item = $id > 0 ? findNews($pdo, $id) : false;
    if (!$item) {
        http_response_code(404);
        $errors[] = 'Новость не найдена.';
    } else {
        $editing = true;
        $title = $item['title'];
        $content = $item['content'];
    }
}

$news = $pdo->query('SELECT id, title, content FROM news ORDER BY id DESC')
    ->fetchAll(PDO::FETCH_ASSOC);
?>

<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Управление новостями</title>
</head>
<body>
<h1>Управление новостями</h1>
<?php foreach ($errors as $error): ?>
    <p role="alert"><?= e($error) ?></p>
<?php endforeach; ?>

<h2><?= $editing ? 'Редактирование' : 'Добавление' ?></h2>
<form method="post" action="admin.php">
    <input type="hidden" name="csrf" value="<?= auth_e(auth_csrf()) ?>">
    <input type="hidden" name="action" value="<?= $editing ? 'update' : 'create' ?>">
    <input type="hidden" name="id" value="<?= $id ?>">
    <p><label>Заголовок
        <input name="title" maxlength="255" required value="<?= e($title) ?>">
    </label></p>
    <p><label>Текст
        <textarea name="content" maxlength="10000" required><?= e($content) ?></textarea>
    </label></p>
    <button type="submit">Сохранить</button>
    <a href="admin.php">К новой записи</a>
</form>

<h2>Все новости</h2>
<?php if (!$news): ?>
    <p>Новостей пока нет.</p>
<?php endif; ?>
<?php foreach ($news as $item): ?>
    <article>
        <h3><?= e($item['title']) ?></h3>
        <p><?= nl2br(e($item['content'])) ?></p>
        <a href="admin.php?edit=<?= (int) $item['id'] ?>">Редактировать</a>
        <form method="post" action="admin.php">
    <input type="hidden" name="csrf" value="<?= auth_e(auth_csrf()) ?>">
            <input type="hidden" name="action" value="delete">
            <input type="hidden" name="id" value="<?= (int) $item['id'] ?>">
            <button type="submit">Удалить</button>
        </form>
    </article>
<?php endforeach; ?>
</body>
</html>
