// Usage: node scripts/build-html.cjs [path-to-marked-module]
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '..');
const htmlDir = path.join(root, 'html');
const escape = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
function fillExamples(markdown) {
    return markdown.replace(/<!-- example:([^ ]+) -->[\s\S]*?<!-- \/example -->/g, (_, spec) => {
        const [name, part] = spec.split('#');
        let code = fs.readFileSync(path.join(root, 'examples', 'auth', name), 'utf8').replace(/\r\n/g, '\n').trimEnd();
        if (part) {
            const separator = code.indexOf('?>\n');
            if (separator < 0) throw new Error('No PHP/HTML boundary: ' + spec);
            code = part === 'server' ? code.slice(0, separator + 2) : code.slice(separator + 3);
        }
        const lang = name.endsWith('.sql') ? 'sql' : name.endsWith('.js') ? 'javascript' : 'php';
        return '<!-- example:' + spec + ' -->\n\n```' + lang + '\n' + code + '\n```\n\n<!-- /example -->';
    });
}
function rewriteLinks(markdown) {
    return markdown.replace(/\]\(([^\s)]+)\)/g, (all, url) => {
        if (/^(?:https?:|mailto:|#)/.test(url)) return all;
        let target = url.replace(/\.md(?=#|$)/, '.html');
        if (target.startsWith('examples/')) target = '../' + target.replace(/\.html(?=#|$)/, '.md');
        // Only README is Markdown; standalone HTML examples keep their extension.
        if (url.startsWith('examples/') && !url.endsWith('.md')) target = '../' + url;
        return '](' + target + ')';
    });
}
const page = (title, body, nav = true) => `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)}</title>
<link rel="stylesheet" href="styles.css">
</head>
<body>
<main>
${nav ? '<nav><a href="index.html">← Все материалы курса</a></nav>\n' : ''}${body}
</main>
</body>
</html>
`;
(async () => {
    const modulePath = process.argv[2] || path.join(process.env.TEMP || '', 'md-html-converter-20261010', 'node_modules', 'marked', 'lib', 'marked.esm.js');
    const { marked } = await import(pathToFileURL(path.resolve(modulePath)).href);
    fs.mkdirSync(htmlDir, { recursive: true });
    const names = fs.readdirSync(root).filter(name => name.endsWith('.md')).sort((a, b) => a.localeCompare(b, 'ru', { numeric: true }));
    const entries = [];
    for (const name of names) {
        const source = fs.readFileSync(path.join(root, name), 'utf8');
        const markdown = fillExamples(source);
        if (markdown !== source) fs.writeFileSync(path.join(root, name), markdown);
        const title = markdown.match(/^# (.+)$/m)?.[1] || name;
        const topic = markdown.match(/^## Тема: (.+)$/m)?.[1] || markdown.match(/^## (.+)$/m)?.[1] || '';
        const filename = name.replace(/\.md$/, '.html');
        const body = marked.parse(rewriteLinks(markdown)).replaceAll('<table>', '<div class="table-scroll"><table>').replaceAll('</table>', '</table></div>');
        fs.writeFileSync(path.join(htmlDir, filename), page(title, body));
        entries.push({ name, title, topic, filename });
    }
    const list = predicate => '<ul>\n' + entries.filter(predicate).map(entry => `<li><a href="${encodeURI(entry.filename)}">${escape(entry.title)}${entry.topic && !entry.topic.startsWith('Дисциплина:') ? ' — ' + escape(entry.topic) : ''}</a></li>`).join('\n') + '\n</ul>';
    const body = '<h1>Web-программирование</h1>\n<p>Лекции и лабораторные работы</p>\n<h2>Лекции</h2>\n' + list(e => e.name.startsWith('Web-')) + '\n<h2>Лабораторные работы</h2>\n' + list(e => e.name.startsWith('Лабораторная'));
    fs.writeFileSync(path.join(htmlDir, 'index.html'), page('Web-программирование — учебные материалы', body, false));
    let links = 0;
    for (const filename of fs.readdirSync(htmlDir).filter(name => name.endsWith('.html'))) {
        const text = fs.readFileSync(path.join(htmlDir, filename), 'utf8');
        for (const match of text.matchAll(/(?:href|src)="([^"]+)"/g)) {
            const url = match[1];
            if (/^(?:https?:|mailto:|#)/.test(url)) continue;
            const target = path.resolve(htmlDir, decodeURIComponent(url.split('#')[0]));
            if (!fs.existsSync(target)) throw new Error('Broken link in ' + filename + ': ' + url);
            links++;
        }
    }
    console.log(`${entries.length + 1} HTML pages built; ${links} local links checked.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
