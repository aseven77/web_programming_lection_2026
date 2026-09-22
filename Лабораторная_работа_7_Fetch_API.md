# Лабораторная работа №7

## Дисциплина: Web-программирование
## Тема: JavaScript, fetch и PHP API

---

## Цель работы

Создать интерфейс загрузки, добавления и удаления новостей без перезагрузки страницы. Научиться передавать JSON, проверять HTTP-ответы, обновлять DOM и показывать пользователю состояние операции.

## Необходимые инструменты

Используйте локальный сайт, базу `site`, таблицу `news` и `config.php` из лабораторной №6. Нужны PHP 8 с `pdo_mysql` и `mbstring`, MySQL, редактор и браузер с вкладками Console и Network. Если пропустили работу №6, сначала выполните её задание 1.

Оставьте `admin.php` как рабочую версию обычных форм. Рядом создайте три новых файла: `api-news.php`, `news-app.html`, `news-app.js`. Учебный API не содержит аутентификации и рассчитан на локальную работу.

## Задание 1. Создать API

### Шаг 1.1 — определить формат ответа

В `api-news.php` поместите следующий код. Файл должен начинаться с `<?php`, без вывода HTML и без закрывающего PHP-тега.

```php
<?php
ini_set('display_errors', '0');
header('Content-Type: application/json; charset=utf-8');

function reply(array $data, int $status = 200): void {
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    exit;
}

try {
    require __DIR__ . '/config.php';
    $method = $_SERVER['REQUEST_METHOD'];
    if ($method === 'GET') {
        $news = $pdo->query('SELECT id, title, content FROM news ORDER BY id DESC')
            ->fetchAll(PDO::FETCH_ASSOC);
        reply(['news' => $news]);
    }
    if ($method !== 'POST') {
        header('Allow: GET, POST');
        reply(['error' => 'Метод не поддерживается.'], 405);
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
```

**Что это делает:** GET читает новости; POST выбирает операцию по `action`. Ответы формируются одной функцией `reply()`. Ошибки базы записываются в журнал сервера, клиент получает JSON с общим сообщением. Для удаления нулевой `rowCount()` означает, что ни одна запись не была удалена.

### Шаг 1.2 — проверить чтение

Откройте `api-news.php` через локальный сервер. Ожидайте объект с массивом `news`; для пустой таблицы — `{"news":[]}`. Если видите 500, сначала проверьте подключение и журнал PHP.

## Задание 2. Подготовить страницу

Создайте `news-app.html`:

```html
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Новости без перезагрузки</title>
    <script src="news-app.js" defer></script>
</head>
<body>
<h1>Новости</h1>
<form id="news-form">
    <p><label>Заголовок <input name="title" maxlength="255" required></label></p>
    <p><label>Текст <textarea name="content" maxlength="10000" required></textarea></label></p>
    <button type="submit">Добавить</button>
</form>
<p id="message" role="status" aria-live="polite"></p>
<button id="reload" type="button">Обновить список</button>
<ul id="news-list"></ul>
</body>
</html>
```

`defer` откладывает выполнение скрипта до разбора HTML. Область `role="status"` сообщает об изменении состояния, в том числе пользователям программ экранного доступа.

## Задание 3. Написать JavaScript

Следующие три фрагмента добавляйте **подряд в `news-app.js`**.

### Шаг 3.1 — состояние и запросы

```javascript
const form = document.querySelector('#news-form');
const list = document.querySelector('#news-list');
const message = document.querySelector('#message');
const reload = document.querySelector('#reload');
let news = [];
let busy = false;

function setBusy(value) {
    busy = value;
    document.querySelectorAll('button').forEach(button => {
        button.disabled = value;
    });
    form.querySelectorAll('input, textarea').forEach(field => {
        field.disabled = value;
    });
    list.setAttribute('aria-busy', String(value));
}

async function request(payload) {
    const options = payload === undefined ? {} : {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    };
    let response;
    try {
        response = await fetch('api-news.php', options);
    } catch {
        throw new Error('Нет связи с сервером. Перед повтором обновите список.');
    }
    let data;
    try {
        data = await response.json();
    } catch {
        throw new Error('Сервер вернул не JSON. Проверьте ответ во вкладке Network.');
    }
    if (!response.ok) {
        throw new Error(data.error || `Ошибка HTTP ${response.status}`);
    }
    return data;
}

async function run(task) {
    if (busy) return;
    setBusy(true);
    message.textContent = 'Выполняется запрос…';
    try {
        await task();
    } catch (error) {
        message.textContent = error.message;
    } finally {
        setBusy(false);
    }
}
```

**Что это делает:** `request()` объединяет отправку, чтение JSON и проверку HTTP-статуса. `run()` управляет состоянием интерфейса и гарантирует снятие блокировки. Флаг `busy` предотвращает запуск второй операции до завершения первой. Поля тоже блокируются, чтобы пользователь не потерял текст, изменённый во время сохранения.

### Шаг 3.2 — отрисовка и удаление

```javascript
function render() {
    list.replaceChildren();
    if (news.length === 0) {
        const empty = document.createElement('li');
        empty.textContent = 'Новостей пока нет.';
        list.append(empty);
        return;
    }
    for (const item of news) {
        const li = document.createElement('li');
        const title = document.createElement('strong');
        const content = document.createElement('p');
        const button = document.createElement('button');
        title.textContent = item.title;
        content.textContent = item.content;
        button.type = 'button';
        button.textContent = 'Удалить';
        button.disabled = busy;
        button.addEventListener('click', () => {
            if (busy || !confirm('Удалить эту новость?')) return;
            run(async () => {
                const data = await request({ action: 'delete', id: item.id });
                news = news.filter(row => String(row.id) !== String(data.deleted));
                render();
                message.textContent = 'Новость удалена.';
            });
        });
        li.append(title, content, button);
        list.append(li);
    }
}
```

**Что это делает:** функция создаёт DOM-элементы и вставляет пользовательские данные через `textContent`. Запись исчезает из локального массива только после успешного ответа. Приведение id к строкам учитывает, что PDO может вернуть идентификатор строкой, а API удаления — числом.

### Шаг 3.3 — загрузка и добавление

```javascript
function loadNews() {
    return run(async () => {
        const data = await request();
        news = data.news;
        render();
        message.textContent = 'Список загружен.';
    });
}

form.addEventListener('submit', event => {
    event.preventDefault();
    if (busy) return;
    const fields = new FormData(form);
    const payload = {
        action: 'create',
        title: fields.get('title'),
        content: fields.get('content')
    };
    run(async () => {
        const data = await request(payload);
        news.unshift(data.item);
        render();
        form.reset();
        message.textContent = 'Новость добавлена.';
    });
});

reload.addEventListener('click', loadNews);
loadNews();
```

Значения `FormData` считываются до блокировки полей: отключённые поля в неё не включаются. При неудаче `form.reset()` не выполняется, и пользователь может исправить данные. Успешный ответ содержит созданную запись, поэтому дополнительный запрос списка не нужен.

## Задание 4. Проверить приложение

Откройте `news-app.html` через тот же локальный сайт, что и `api-news.php`, например `http://site.local/news-app.html`. Откройте Network и включите фильтр Fetch/XHR.

1. При открытии страницы проверьте GET и ответ 200 со списком.
2. Добавьте новость. Ожидайте POST, JSON в теле, ответ 201 и новую запись без загрузки HTML-документа.
3. Проверьте запись через `admin.php` или phpMyAdmin: данные должны сохраниться в MySQL.
4. Отправьте заголовок из пробелов. Ожидайте 422, сообщение на странице и сохранение текста формы.
5. Добавьте текст `<b>Пример</b>`. Он должен показаться буквально, а не стать HTML-разметкой.
6. Отмените подтверждение удаления: запроса быть не должно. Затем подтвердите — ожидайте 200 и исчезновение выбранной новости.
7. Включите замедление сети в DevTools и отправьте форму. Кнопки и поля должны блокироваться до окончания запроса; повторного добавления быть не должно.
8. Переключите сеть в Offline и нажмите «Обновить список». Ожидайте сообщение об ошибке, сохранение старого списка и восстановление кнопок. Верните обычный режим и повторите загрузку.
9. Удалите последнюю учебную новость. Ожидайте надпись «Новостей пока нет».

### Проверка ошибок API напрямую

Выполните в Console на странице приложения:

```javascript
fetch('api-news.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{broken'
}).then(async response => console.log(response.status, await response.json()));
```

Ожидайте 400 и JSON с описанием ошибки. Повторите с телом `JSON.stringify({action: 'delete', id: -1})` — ожидайте 422; с заведомо отсутствующим положительным id — 404. Убедитесь, что эти запросы не меняют существующие записи.

## Задание 5. Самостоятельная работа

1. Добавьте рядом со списком число отображаемых новостей.
2. Добавьте фильтрацию заголовков на клиенте без запроса к серверу. Сохраняйте исходный массив, чтобы очищение поиска восстанавливало весь список.
3. Дополнительное задание: реализуйте редактирование через `action: 'update'`. Проверьте id, существование новости и поля на сервере; возвращайте обновлённую запись. Используйте знания из лабораторной №6.

## Что сдать

- `api-news.php`, `news-app.html`, `news-app.js` и конфигурацию подключения без реальных внешних секретов.
- Скриншоты интерфейса и Network для успешного POST и ошибки 422.
- Краткий протокол проверок, включая отсутствие сети и некорректный JSON.
- Пояснение, где выполняется серверная проверка и почему нельзя заменить её проверкой в браузере.

## Критерии выполнения

Список загружается, новости добавляются и удаляются без перезагрузки; данные сохраняются в базе; API возвращает JSON и подходящие статусы; ошибки видны пользователю; поля не очищаются при ошибке; повторные действия блокируются на время запроса; пользовательский текст не интерпретируется как HTML.

## Контрольные вопросы

1. Почему JSON читается из `php://input`?
2. Почему HTTP 422 не перехватывается автоматически как сетевая ошибка?
3. Для чего нужен `finally`?
4. Когда безопасно удалять запись из локального массива?
5. Что произойдёт, если сервер сохранил запись, но ответ потерялся?
