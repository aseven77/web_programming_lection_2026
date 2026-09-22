# Лабораторная работа №6

## Дисциплина: Web-программирование
## Тема: Формы и CRUD на PHP и MySQL

---

## Цель работы

Дополнить сайт из лабораторной №4 страницей управления новостями: создавать, просматривать, редактировать и удалять записи. Научиться проверять ввод, использовать параметры PDO и сохранять введённые значения при ошибках.

## Необходимые инструменты

- Локальный сервер с PHP 8 и MySQL; расширения PHP `pdo_mysql` и `mbstring`.
- Редактор кода и браузер.
- База `site` с таблицей `news` из лабораторной №4.

Работа предназначена для локального учебного сайта. Страница не содержит входа пользователя и разграничения прав. Не размещайте её в открытом доступе как готовую административную панель.

## Задание 1. Подготовить проект

### Шаг 1.1 — проверить таблицу

Сохраните копию учебной базы перед экспериментами. Если таблица `news` уже существует, используйте её. Если начинаете заново, создайте базу `site` в phpMyAdmin, выберите её и выполните:

```sql
CREATE TABLE IF NOT EXISTS news (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

`IF NOT EXISTS` не изменяет структуру существующей таблицы. Проверьте наличие всех четырёх полей вручную.

### Шаг 1.2 — подключить базу

Используйте рабочий `config.php` из лабораторной №4. При создании проекта с нуля поместите в него:

```php
<?php
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
```

Укажите свои хост, имя пользователя и пароль MySQL. Пустой пароль здесь — пример локальной настройки, а не обязательное значение. Не добавляйте закрывающий `?>` в этот файл: случайный вывод после него помешает отправке HTTP-заголовков.

## Задание 2. Написать обработчик

### Шаг 2.1 — создать admin.php

Следующие три фрагмента относятся к **одному файлу `admin.php`**. Добавляйте их подряд. Первый фрагмент подключает базу, объявляет вспомогательные функции и готовит состояние формы:

```php
<?php
require __DIR__ . '/config.php';

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
```

`__DIR__` обозначает папку текущего файла. `positiveId()` возвращает 0 при неправильном идентификаторе. Переменная `$editing` определяет, создаёт форма новость или редактирует существующую.

### Шаг 2.2 — обработать POST и открытие формы

Добавьте ниже, не открывая PHP повторно:

```php
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
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
```

**Что это делает:** обработчик сначала проверяет операцию, идентификатор и текст. Только если массив ошибок пуст, он изменяет базу. После успеха браузер получает перенаправление 303. При ошибке значения остаются в переменных и снова попадают в форму.

Ограничение текста в 10000 символов — правило нашего приложения. Сортировка по `id DESC` располагает последние добавленные записи сверху.

### Шаг 2.3 — добавить HTML

Продолжите тот же файл после закрывающего `?>`:

```php
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
            <input type="hidden" name="action" value="delete">
            <input type="hidden" name="id" value="<?= (int) $item['id'] ?>">
            <button type="submit">Удалить</button>
        </form>
    </article>
<?php endforeach; ?>
</body>
</html>
```

**Что это делает:** одна форма обслуживает добавление и редактирование. Для удаления у каждой новости своя форма. `nl2br()` превращает переносы строк в HTML-переносы после экранирования текста.

## Задание 3. Проверить полный цикл

Откройте `admin.php` через адрес своего локального сайта, например `http://site.local/admin.php`. Имя домена зависит от настройки вашего сервера.

1. Добавьте две новости. Проверьте их появление и в браузере, и в таблице MySQL.
2. Измените заголовок первой новости. Убедитесь, что вторая не изменилась.
3. Сохраните новость без изменений: это допустимая операция.
4. Удалите одну новость. Убедитесь, что удалена только выбранная строка.
5. Обновите страницу после добавления: дубликат не должен появиться.
6. Отправьте заголовок из пробелов. Ожидайте сообщение об ошибке и сохранение введённого текста.
7. Введите заголовок `<b>Проверка</b>` и кавычки. Они должны отобразиться как текст, без жирного начертания от тега.
8. Откройте `admin.php?edit=999999`, выбрав заведомо отсутствующий id. Ожидайте сообщение и HTTP 404 во вкладке Network.

## Задание 4. Самостоятельная работа

1. Добавьте отображение даты `created_at` в списке.
2. Добавьте подтверждение удаления средствами JavaScript. Отмена должна предотвращать отправку формы, а само удаление по-прежнему должно выполняться через POST.
3. Добавьте сообщение об успешном сохранении после перенаправления. Для параметра URL используйте заранее определённый текст сообщения, а не прямой вывод произвольного значения.

## Что сдать

- Файлы `config.php` и `admin.php` без реальных секретов от внешних сервисов.
- SQL-структуру таблицы и несколько учебных записей.
- Скриншоты списка, заполненной формы редактирования и ошибки проверки.
- Результаты восьми проверок из задания 3: действие, ожидаемый и фактический результат.

## Критерии выполнения

Работа выполнена, если действуют все четыре операции CRUD, запросы используют параметры, ввод проверяется сервером, вывод экранируется, ошибочная форма сохраняет значения, а обновление страницы после POST не создаёт дубликат.

## Контрольные вопросы

1. Как PHP различает добавление и редактирование?
2. Почему значение скрытого `id` тоже проверяется?
3. Когда вызываются `prepare()` и `execute()`?
4. Почему `header()` находится выше HTML?
5. Какие средства защиты понадобятся перед публикацией административной страницы?
