// Isolated integration checks. Uses temporary data and never connects to site DB.
// Node 22+; Windows OpenServer paths can be overridden through environment vars.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawn, spawnSync } = require('node:child_process');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const php = process.env.COURSE_PHP || 'G:/OpenServer/modules/php/PHP_8.0/php.exe';
const maria = process.env.COURSE_MARIADB || 'G:/OpenServer/modules/database/MariaDB-10.4/bin';
const phpArgs = ['-n', '-d', 'extension_dir=' + path.join(path.dirname(php), 'ext'), '-d', 'extension=php_pdo_mysql.dll', '-d', 'extension=php_mbstring.dll'];
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'course-auth-check-'));
const webroot = path.join(temp, 'web');
const sessions = path.join(temp, 'sessions');
fs.mkdirSync(sessions);
fs.cpSync(path.join(root, 'examples/auth'), webroot, { recursive: true });
let dbProcess, phpProcess, dbPort, webPort, passed = 0;
const processes = [];
function run(exe, args, input) {
    const result = spawnSync(exe, args, { input, encoding: 'utf8', windowsHide: true, timeout: 120000 });
    if (result.status !== 0) throw new Error(`${path.basename(exe)} failed: ${result.error || result.stderr || result.stdout}`);
    return result.stdout.trim();
}
function start(exe, args, label) {
    const child = spawn(exe, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    const log = fs.createWriteStream(path.join(temp, label + '.log'));
    child.stdout.pipe(log);
    child.stderr.pipe(log);
    child.on('error', error => log.write(String(error)));
    processes.push(child);
    return child;
}
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function freePort() {
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        server.on('error', reject);
        server.listen(0, '127.0.0.1', () => {
            const port = server.address().port;
            server.close(() => resolve(port));
        });
    });
}
async function waitPort(port, child) {
    for (let n = 0; n < 120; n++) {
        if (child.exitCode !== null) throw new Error('Server exited; see logs at ' + temp);
        const ready = await new Promise(resolve => {
            const socket = net.connect(port, '127.0.0.1');
            socket.on('connect', () => { socket.destroy(); resolve(true); });
            socket.on('error', () => resolve(false));
        });
        if (ready) return;
        await delay(250);
    }
    throw new Error('Server timeout');
}
function sql(query) {
    return run(path.join(maria, 'mysql.exe'), ['--no-defaults', '-h127.0.0.1', '-P' + dbPort, '-uroot', '--default-character-set=utf8mb4', '--batch', '--skip-column-names'], query);
}
function check(label, value) {
    assert.ok(value, label);
    passed++;
    console.log('PASS ' + label);
}
class Client {
    constructor() { this.cookies = new Map(); }
    async request(file, options = {}) {
        const headers = { ...(options.headers || {}) };
        if (this.cookies.size) headers.Cookie = [...this.cookies].map(([key, value]) => `${key}=${value}`).join('; ');
        const response = await fetch(`http://127.0.0.1:${webPort}/${file}`, { ...options, headers, redirect: 'manual' });
        for (const cookie of response.headers.getSetCookie()) {
            const first = cookie.split(';')[0];
            const at = first.indexOf('=');
            this.cookies.set(first.slice(0, at), first.slice(at + 1));
        }
        const body = await response.text();
        return { status: response.status, headers: response.headers, body, json: () => JSON.parse(body) };
    }
    post(file, fields) {
        return this.request(file, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(fields).toString() });
    }
    api(fields, token) {
        return this.request('api-news.php', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { 'X-CSRF-Token': token } : {}) }, body: JSON.stringify(fields) });
    }
}
function token(response) {
    const match = response.body.match(/name="csrf" value="([a-f0-9]+)"/);
    assert.ok(match, 'CSRF present in form');
    return match[1];
}
const password = 'StudyPass12345';
(async () => {
    const version = run(php, [...phpArgs, '-r', 'echo PHP_VERSION;']);
    check('PHP 8.0 runtime: ' + version, version.startsWith('8.0.'));
    for (const name of fs.readdirSync(webroot).filter(name => name.endsWith('.php'))) {
        run(php, [...phpArgs, '-l', path.join(webroot, name)]);
    }
    check('All PHP examples pass syntax check', true);
    run(process.execPath, ['--check', path.join(webroot, 'news-app.js')]);
    check('API client JavaScript passes syntax check', true);
    dbPort = await freePort();
    webPort = await freePort();
    const dataDir = path.join(temp, 'database');
    run(path.join(maria, 'mysql_install_db.exe'), ['--datadir=' + dataDir, '--port=' + dbPort]);
    dbProcess = start(path.join(maria, 'mysqld.exe'), ['--no-defaults', '--basedir=' + path.dirname(maria), '--datadir=' + dataDir, '--port=' + dbPort, '--bind-address=127.0.0.1', '--console'], 'mariadb');
    await waitPort(dbPort, dbProcess);
    sql('CREATE DATABASE course_auth_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; USE course_auth_test;\n' + fs.readFileSync(path.join(webroot, 'schema.sql'), 'utf8') + '\n' + fs.readFileSync(path.join(webroot, 'news.sql'), 'utf8'));
    fs.writeFileSync(path.join(webroot, 'config.php'), `<?php\n$pdo = new PDO('mysql:host=127.0.0.1;port=${dbPort};dbname=course_auth_test;charset=utf8mb4', 'root', '', [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC, PDO::ATTR_EMULATE_PREPARES => false]);\n`);
    phpProcess = start(php, [...phpArgs, '-d', 'session.save_path=' + sessions, '-S', '127.0.0.1:' + webPort, '-t', webroot], 'php');
    await waitPort(webPort, phpProcess);
    const guest = new Client();
    check('Guest profile redirects to login', (await guest.request('profile.php')).headers.get('location') === 'login.php');
    check('Guest admin redirects to login', (await guest.request('admin.php')).status === 303);
    check('Guest public API has no admin token', (await guest.request('api-news.php')).json().csrf === null);
    check('Guest API mutation denied', (await guest.api({ action: 'create', title: 'blocked', content: 'blocked' })).status === 401);
    const user = new Client();
    let csrf = token(await user.request('register.php'));
    const fields = { name: '<b>Анна</b>', email: 'reader@example.test', password, confirmation: password, csrf, role: 'admin' };
    check('Registration missing CSRF rejected', (await user.post('register.php', { ...fields, csrf: '' })).status === 403);
    for (const [label, data, text] of [
        ['Blank name', { name: '   ' }, 'Имя должно'],
        ['Malformed email', { email: 'invalid' }, 'корректный email'],
        ['Short password', { password: 'short', confirmation: 'short' }, 'от 12 до 72'],
        ['Overlong bcrypt password', { password: 'a'.repeat(73), confirmation: 'a'.repeat(73) }, 'от 12 до 72'],
        ['NUL password', { password: 'StudyPass12345\0', confirmation: 'StudyPass12345\0' }, 'от 12 до 72'],
        ['Confirmation mismatch', { confirmation: 'different' }, 'не совпадают']
    ]) {
        const response = await user.post('register.php', { ...fields, ...data });
        check(label + ' rejected', response.status === 200 && response.body.includes(text));
    }
    const arrayEmail = { ...fields };
    delete arrayEmail.email;
    arrayEmail['email[]'] = 'reader@example.test';
    check('Array email rejected without PHP error', (await user.post('register.php', arrayEmail)).body.includes('корректный email'));
    check('Invalid registrations left DB empty', sql('SELECT COUNT(*) FROM course_auth_test.users') === '0');
    const registration = await user.post('register.php', fields);
    check('Successful registration uses 303 PRG', registration.status === 303 && registration.headers.get('location') === 'register.php?done=1');
    check('Client cannot assign admin role', sql("SELECT role FROM course_auth_test.users WHERE email='reader@example.test'") === 'user');
    check('DB stores bcrypt hash, not password', /^\$2y\$/.test(sql("SELECT password_hash FROM course_auth_test.users WHERE email='reader@example.test'")));
    const duplicate = await user.post('register.php', { ...fields, email: 'READER@example.test' });
    check('Duplicate normalized email rejected', duplicate.body.includes('уже зарегистрирован') && sql('SELECT COUNT(*) FROM course_auth_test.users') === '1');
    await user.request('register.php?done=1');
    await user.request('register.php?done=1');
    check('Refresh after registration does not insert', sql('SELECT COUNT(*) FROM course_auth_test.users') === '1');
    const formError = await user.post('register.php', { ...fields, confirmation: 'wrong' });
    check('Form escapes name and never echoes password', formError.body.includes('&lt;b&gt;Анна&lt;/b&gt;') && !formError.body.includes('value="' + password));
    let loginCsrf = token(await user.request('login.php'));
    const wrong = await user.post('login.php', { email: fields.email, password: 'WrongPassword123', csrf: loginCsrf });
    const unknown = await user.post('login.php', { email: 'unknown@example.test', password, csrf: loginCsrf });
    check('Unknown email and wrong password have same message', wrong.body.includes('Неверный email или пароль.') && unknown.body.includes('Неверный email или пароль.'));
    check('Failed login leaves profile inaccessible', (await user.request('profile.php')).status === 303);
    check('Login without token rejected', (await user.post('login.php', { email: fields.email, password })).status === 403);
    const oldSession = user.cookies.get('PHPSESSID');
    const login = await user.post('login.php', { email: fields.email, password, csrf: loginCsrf });
    check('Successful login redirects to profile', login.status === 303 && login.headers.get('location') === 'profile.php');
    check('Session id rotated after login', user.cookies.get('PHPSESSID') !== oldSession);
    const stale = new Client();
    stale.cookies.set('PHPSESSID', oldSession);
    check('Old session cannot access profile', (await stale.request('profile.php')).status === 303);
    const profile = await user.request('profile.php?user_id=999');
    csrf = token(profile);
    check('Profile shows escaped current user only', profile.status === 200 && profile.body.includes('&lt;b&gt;Анна&lt;/b&gt;') && profile.body.includes(fields.email));
    check('Profile is not cacheable', profile.headers.get('cache-control') === 'no-store');
    check('CSRF rotates after login', csrf !== loginCsrf);
    check('Old pre-login form token rejected', (await user.post('register.php', { ...fields, csrf: loginCsrf })).status === 403);
    check('Regular user denied admin page', (await user.request('admin.php')).status === 403);
    check('Regular user cannot mutate API with own valid token', (await user.api({ action: 'create', title: 'blocked', content: 'blocked' }, csrf)).status === 403);
    check('Independent guest stays unauthenticated', (await guest.request('profile.php')).status === 303);
    const admin = new Client();
    const adminCsrf = token(await admin.request('register.php'));
    await admin.post('register.php', { ...fields, name: 'Editor', email: 'editor@example.test', csrf: adminCsrf });
    sql("UPDATE course_auth_test.users SET role='admin' WHERE email='editor@example.test'");
    await admin.post('login.php', { email: 'editor@example.test', password, csrf: token(await admin.request('login.php')) });
    let adminForm = await admin.request('admin.php');
    const adminToken = token(adminForm);
    check('Admin page accessible after role grant', adminForm.status === 200);
    check('Admin form mutation without token denied', (await admin.post('admin.php', { action: 'create', title: 'blocked', content: 'blocked' })).status === 403);
    check('Denied mutations left news unchanged', sql('SELECT COUNT(*) FROM course_auth_test.news') === '0');
    check('Admin can create through form', (await admin.post('admin.php', { action: 'create', title: 'Form title', content: 'Body', csrf: adminToken })).status === 303);
    let id = sql('SELECT id FROM course_auth_test.news LIMIT 1');
    check('Admin can edit through form', (await admin.post('admin.php', { action: 'update', id, title: 'Edited title', content: 'Edited body', csrf: adminToken })).status === 303 && sql('SELECT title FROM course_auth_test.news LIMIT 1') === 'Edited title');
    adminForm = await admin.request('admin.php');
    check('Both create and delete forms contain CSRF', (adminForm.body.match(/name="csrf"/g) || []).length === 2);
    check('Admin can delete through form', (await admin.post('admin.php', { action: 'delete', id, csrf: adminToken })).status === 303 && sql('SELECT COUNT(*) FROM course_auth_test.news') === '0');
    const apiGet = await admin.request('api-news.php');
    const apiToken = apiGet.json().csrf;
    check('Admin GET API returns session CSRF and no-store', apiToken === adminToken && apiGet.headers.get('cache-control') === 'no-store');
    check('Admin API missing token denied', (await admin.api({ action: 'create', title: 'blocked', content: 'blocked' })).status === 403);
    check('Admin API wrong token denied', (await admin.api({ action: 'create', title: 'blocked', content: 'blocked' }, 'wrong')).status === 403);
    check('API rejects unsupported method', (await admin.request('api-news.php', { method: 'PUT' })).status === 405);
    check('API requires JSON media type', (await admin.request('api-news.php', { method: 'POST', headers: { 'X-CSRF-Token': apiToken }, body: '{}' })).status === 415);
    check('API rejects broken JSON', (await admin.request('api-news.php', { method: 'POST', headers: { 'X-CSRF-Token': apiToken, 'Content-Type': 'application/json' }, body: '{' })).status === 400);
    check('API retains field validation', (await admin.api({ action: 'create', title: '', content: '' }, apiToken)).status === 422);
    const created = await admin.api({ action: 'create', title: 'API title', content: 'API body' }, apiToken);
    check('Admin API can create', created.status === 201 && created.json().item.title === 'API title');
    id = created.json().item.id;
    check('Regular user cannot delete via API', (await user.api({ action: 'delete', id }, csrf)).status === 403 && sql('SELECT COUNT(*) FROM course_auth_test.news') === '1');
    sql("UPDATE course_auth_test.users SET role='user' WHERE email='editor@example.test'");
    check('Role revocation blocks next admin page', (await admin.request('admin.php')).status === 403);
    check('Role revocation blocks stale API token', (await admin.api({ action: 'delete', id }, apiToken)).status === 403 && sql('SELECT COUNT(*) FROM course_auth_test.news') === '1');
    sql("UPDATE course_auth_test.users SET role='admin' WHERE email='editor@example.test'");
    check('Admin API can delete after role restoration', (await admin.api({ action: 'delete', id }, apiToken)).status === 200 && sql('SELECT COUNT(*) FROM course_auth_test.news') === '0');
    check('API missing record returns 404', (await admin.api({ action: 'delete', id }, apiToken)).status === 404);
    check('GET logout denied', (await user.request('logout.php')).status === 405 && (await user.request('profile.php')).status === 200);
    check('Logout without CSRF denied', (await user.post('logout.php', {})).status === 403 && (await user.request('profile.php')).status === 200);
    check('POST logout succeeds', (await user.post('logout.php', { csrf })).status === 303);
    check('Logged-out user cannot access profile', (await user.request('profile.php')).status === 303);
    check('Logout does not affect independent admin session', (await admin.request('admin.php')).status === 200);
    sql("DELETE FROM course_auth_test.users WHERE email='editor@example.test'");
    check('Deleted user session no longer authenticates', (await admin.request('profile.php')).status === 303);
    console.log(`\n${passed} checks passed. Isolated data/logs: ${temp}`);
})().catch(error => {
    console.error(error);
    console.error('Logs: ' + temp);
    process.exitCode = 1;
}).finally(async () => {
    for (const child of processes.reverse()) {
        if (child.exitCode === null) {
            const exited = new Promise(resolve => child.once('exit', resolve));
            child.kill();
            await Promise.race([exited, delay(3000)]);
        }
    }
});
