let csrfToken = "";
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
        headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken
        },
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

function loadNews() {
    return run(async () => {
        const data = await request();
        csrfToken = typeof data.csrf === 'string' ? data.csrf : '';
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

fetch('api-news.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{broken'
}).then(async response => console.log(response.status, await response.json()));
