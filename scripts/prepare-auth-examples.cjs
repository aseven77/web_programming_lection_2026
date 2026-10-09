// Rebuild the extended CRUD/API examples from the original labs 6 and 7.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'examples', 'auth');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const blocks = (text, language) => [...text.matchAll(new RegExp('```' + language + '\\r?\\n([\\s\\S]*?)```', 'g'))].map(match => match[1].replace(/\r\n/g, '\n').trimEnd());
const save = (name, value) => fs.writeFileSync(path.join(out, name), value + '\n');
function replaceOnce(text, from, to) {
    if (!text.includes(from)) throw new Error('Source fragment not found: ' + from);
    return text.replace(from, to);
}
const lab6 = read('Лабораторная_работа_6_CRUD.md');
save('news.sql', blocks(lab6, 'sql')[0]);
const php6 = blocks(lab6, 'php');
let admin = php6.slice(1).join('\n\n');
admin = replaceOnce(admin, "require __DIR__ . '/config.php';", "require_once __DIR__ . '/access.php';\nauth_require_admin();");
admin = replaceOnce(admin, "if ($_SERVER['REQUEST_METHOD'] === 'POST') {", "if ($_SERVER['REQUEST_METHOD'] === 'POST') {\n    auth_check_post();");
admin = admin.replaceAll('<form method="post" action="admin.php">', '<form method="post" action="admin.php">\n    <input type="hidden" name="csrf" value="<?= auth_e(auth_csrf()) ?>">');
save('admin.php', admin);
const lab7 = read('Лабораторная_работа_7_Fetch_API.md');
let api = blocks(lab7, 'php')[0];
api = replaceOnce(api, "require __DIR__ . '/config.php';", "require_once __DIR__ . '/auth.php';\n    header('Cache-Control: no-store');\n    $currentUser = auth_user();");
api = replaceOnce(api, "reply(['news' => $news]);", "reply([\n            'news' => $news,\n            'csrf' => $currentUser !== null && $currentUser['role'] === 'admin'\n                ? auth_csrf() : null,\n        ]);");
api = replaceOnce(api, "    $type = strtolower", `    if ($currentUser === null) {
        reply(['error' => 'Сначала войдите в систему.'], 401);
    }
    if ($currentUser['role'] !== 'admin') {
        reply(['error' => 'Недостаточно прав.'], 403);
    }
    if (!auth_valid_csrf($_SERVER['HTTP_X_CSRF_TOKEN'] ?? null)) {
        reply(['error' => 'Обновите список и повторите действие: неверный токен.'], 403);
    }
    $type = strtolower`);
save('api-news.php', api);
let js = blocks(lab7, 'javascript').join('\n\n');
js = 'let csrfToken = "";\n' + js;
js = replaceOnce(js, "headers: { 'Content-Type': 'application/json' },", "headers: {\n            'Content-Type': 'application/json',\n            'X-CSRF-Token': csrfToken\n        },");
js = replaceOnce(js, 'const data = await request();', "const data = await request();\n        csrfToken = typeof data.csrf === 'string' ? data.csrf : '';");
save('news-app.js', js);
let html = blocks(lab7, 'html')[0];
html = html.replace(/(<h1>.*?<\/h1>)/, '$1\n<p><a href="login.php">Войти</a> · <a href="profile.php">Мой профиль</a></p>\n<p>Читать новости могут все. Добавление и удаление доступны администратору. После входа обновите список.</p>');
save('news-app.html', html);
console.log('Generated admin.php, api-news.php, news-app.js, news-app.html, news.sql');
