<?php
ini_set('display_errors', '0');
header('Content-Type: application/json; charset=utf-8');

function reply(array $data, int $status = 200): void {
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    exit;
}

try {
    require_once __DIR__ . '/auth.php';
    header('Cache-Control: no-store');
    $currentUser = auth_user();
    $method = $_SERVER['REQUEST_METHOD'];
    if ($method === 'GET') {
        $news = $pdo->query('SELECT id, title, content FROM news ORDER BY id DESC')
            ->fetchAll(PDO::FETCH_ASSOC);
        reply([
            'news' => $news,
            'csrf' => $currentUser !== null && $currentUser['role'] === 'admin'
                ? auth_csrf() : null,
        ]);
    }
    if ($method !== 'POST') {
        header('Allow: GET, POST');
        reply(['error' => 'Метод не поддерживается.'], 405);
    }
    if ($currentUser === null) {
        reply(['error' => 'Сначала войдите в систему.'], 401);
    }
    if ($currentUser['role'] !== 'admin') {
        reply(['error' => 'Недостаточно прав.'], 403);
    }
    if (!auth_valid_csrf($_SERVER['HTTP_X_CSRF_TOKEN'] ?? null)) {
        reply(['error' => 'Обновите список и повторите действие: неверный токен.'], 403);
    }
    $type = strtolower(trim(explode(';', $_SERVER['CONTENT_TYPE'] ?? '')[0]));
    if ($type !== 'application/json') {
        reply(['error' => 'Ожидается application/json.'], 415);
    }
    try {
        $data = json_decode(file_get_contents('php://input'), true, 512, JSON_THROW_ON_ERROR);
    } catch (JsonException $e) {
        reply(['error' => 'Некорректный JSON.'], 400);
    }
    if (!is_array($data) || !isset($data['action']) || !is_string($data['action'])) {
        reply(['error' => 'Укажите операцию action.'], 400);
    }

    if ($data['action'] === 'create') {
        $title = is_string($data['title'] ?? null) ? trim($data['title']) : '';
        $content = is_string($data['content'] ?? null) ? trim($data['content']) : '';
        if ($title === '' || mb_strlen($title, 'UTF-8') > 255 ||
            $content === '' || mb_strlen($content, 'UTF-8') > 10000) {
            reply(['error' => 'Введите заголовок (1–255 символов) и текст (1–10000).'], 422);
        }
        $stmt = $pdo->prepare('INSERT INTO news (title, content) VALUES (?, ?)');
        $stmt->execute([$title, $content]);
        reply(['item' => [
            'id' => (int) $pdo->lastInsertId(),
            'title' => $title,
            'content' => $content,
        ]], 201);
    }
    if ($data['action'] === 'delete') {
        $id = filter_var($data['id'] ?? null, FILTER_VALIDATE_INT,
            ['options' => ['min_range' => 1]]);
        if (!$id) {
            reply(['error' => 'Некорректный идентификатор.'], 422);
        }
        $stmt = $pdo->prepare('DELETE FROM news WHERE id = ?');
        $stmt->execute([$id]);
        if ($stmt->rowCount() === 0) {
            reply(['error' => 'Новость не найдена. Обновите список.'], 404);
        }
        reply(['deleted' => $id]);
    }
    reply(['error' => 'Неизвестная операция.'], 400);
} catch (Throwable $e) {
    error_log((string) $e);
    reply(['error' => 'Ошибка сервера. Проверьте журнал PHP.'], 500);
}
