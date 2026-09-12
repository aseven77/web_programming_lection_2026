# Web-программирование. Лекция 5

## Основы JavaScript

---

## 1. Зачем нужен JavaScript

В отличие от PHP, который выполняется **на сервере** и клиенту отправляет уже готовый результат, **JavaScript** — это язык, который выполняется **прямо в браузере пользователя**. Именно JavaScript отвечает за интерактивность страницы: реакцию на клики, изменение содержимого без перезагрузки, отправку запросов к серверу в фоне.

Три языка, которые вместе составляют классический фронтенд:

| Технология | Отвечает за |
|---|---|
| **HTML** | Структуру и содержимое страницы |
| **CSS** | Внешний вид: цвета, шрифты, расположение элементов |
| **JavaScript** | Поведение: реакцию на действия пользователя, динамику |

Сегодня JavaScript — не только язык браузера: на нём же пишут серверную часть приложений (**Node.js**), мобильные приложения (React Native) и настольные программы (Electron). Но в этой лекции мы сосредоточимся на его классическом применении — работе в браузере.

---

## 2. Подключение JavaScript к странице

```html
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <title>Пример JS-страницы</title>
</head>
<body>
    <h1 id="title">Привет!</h1>

    <script>
        console.log("Скрипт загрузился");
    </script>

    <!-- Или подключение внешнего файла -->
    <script src="script.js"></script>
</body>
</html>
```

Тег `<script>` с подключением внешнего файла принято размещать перед закрывающим тегом `</body>`, чтобы скрипт выполнялся уже после того, как браузер построил всю разметку страницы.

---

## 3. Переменные и типы данных

Современный JavaScript использует ключевые слова `let` и `const` для объявления переменных (устаревшее `var` в новом коде использовать не рекомендуется):

```javascript
let age = 25;          // переменная, значение можно изменить
const name = "Азамат"; // константа, значение менять нельзя

age = 26; // допустимо
// name = "Иван"; // ошибка!
```

### Основные типы данных

| Тип | Пример |
|---|---|
| `Number` | `42`, `3.14` |
| `String` | `"Привет"`, `` `шаблонная строка` `` |
| `Boolean` | `true`, `false` |
| `Array` | `[1, 2, 3]` |
| `Object` | `{ name: "Азамат", age: 30 }` |
| `null` / `undefined` | отсутствие значения |

Проверить тип значения можно оператором `typeof`:

```javascript
console.log(typeof 42);        // "number"
console.log(typeof "текст");   // "string"
console.log(typeof true);      // "boolean"
```

### Шаблонные строки

Вместо конкатенации через `+` современный JavaScript использует **шаблонные строки** (template literals) с обратными кавычками:

```javascript
const name = "Азамат";
const age = 30;

console.log(`Меня зовут ${name}, мне ${age} лет`);
```

---

## 4. Операторы, условия, циклы

```javascript
// Сравнение: используйте строгое сравнение ===
console.log(5 === "5");   // false — сравнивает и тип, и значение
console.log(5 == "5");    // true  — сравнивает только значение

// Условие
const age = 20;

if (age >= 18) {
    console.log("Совершеннолетний");
} else if (age >= 14) {
    console.log("Подросток");
} else {
    console.log("Ребёнок");
}

// Цикл for
for (let i = 0; i < 5; i++) {
    console.log(i);
}

// Цикл for...of — удобен для перебора массивов
const fruits = ["яблоко", "банан", "груша"];
for (const fruit of fruits) {
    console.log(fruit);
}
```

---

## 5. Функции

```javascript
// Классическое объявление функции
function greet(name) {
    return `Здравствуйте, ${name}!`;
}

// Стрелочная функция (arrow function) — современный, короткий синтаксис
const greetArrow = (name) => {
    return `Здравствуйте, ${name}!`;
};

// Если тело функции — одно выражение, можно опустить {} и return
const greetShort = (name) => `Здравствуйте, ${name}!`;

console.log(greet("Мир"));
```

Стрелочные функции особенно часто используются как аргументы других функций — например, при обработке массивов.

---

## 6. Массивы и методы работы с ними

```javascript
const numbers = [1, 2, 3, 4, 5];

// map — создаёт новый массив, применяя функцию к каждому элементу
const doubled = numbers.map(n => n * 2);
console.log(doubled); // [2, 4, 6, 8, 10]

// filter — создаёт новый массив только с элементами, прошедшими проверку
const even = numbers.filter(n => n % 2 === 0);
console.log(even); // [2, 4]

// reduce — сводит массив к одному значению
const sum = numbers.reduce((total, n) => total + n, 0);
console.log(sum); // 15

// find — находит первый подходящий элемент
const found = numbers.find(n => n > 3);
console.log(found); // 4
```

Методы `map`, `filter`, `reduce` — одни из самых часто используемых инструментов современного JavaScript, в том числе во фронтенд-фреймворках вроде Vue и React при выводе списков.

---

## 7. Объекты

```javascript
const student = {
    name: "Азамат",
    group: "41-ПИ",
    grades: [4, 5, 5, 3],

    // метод объекта
    getAverageGrade() {
        const sum = this.grades.reduce((a, b) => a + b, 0);
        return sum / this.grades.length;
    }
};

console.log(student.name);            // Азамат
console.log(student.getAverageGrade()); // 4.25
```

---

## 8. Работа с DOM

**DOM (Document Object Model)** — представление HTML-страницы в виде дерева объектов, с которым JavaScript может работать: находить элементы, менять их содержимое, стили, реагировать на события.

```html
<button id="myButton">Нажми меня</button>
<p id="output"></p>

<script>
    const button = document.getElementById("myButton");
    const output = document.getElementById("output");

    button.addEventListener("click", () => {
        output.textContent = "Кнопка нажата!";
    });
</script>
```

### Основные методы поиска элементов

| Метод | Назначение |
|---|---|
| `document.getElementById("id")` | Поиск по id |
| `document.querySelector("селектор")` | Поиск первого элемента по CSS-селектору |
| `document.querySelectorAll("селектор")` | Поиск всех подходящих элементов |

### Изменение содержимого и стилей

```javascript
const el = document.querySelector(".title");

el.textContent = "Новый текст";
el.style.color = "blue";
el.classList.add("highlight");
```

---

## 9. Запросы к серверу: `fetch`

В первой лекции говорилось, что клиент обменивается данными с сервером по HTTP. В JavaScript для отправки запросов используется встроенная функция **`fetch`**, работающая с **промисами (Promise)** — объектами, представляющими результат асинхронной операции.

```javascript
fetch("https://jsonplaceholder.typicode.com/posts/1")
    .then(response => response.json())
    .then(data => console.log(data))
    .catch(error => console.error("Ошибка:", error));
```

Более современный и читаемый способ — синтаксис `async/await`:

```javascript
async function loadPost() {
    try {
        const response = await fetch("https://jsonplaceholder.typicode.com/posts/1");
        const data = await response.json();
        console.log(data);
    } catch (error) {
        console.error("Ошибка:", error);
    }
}

loadPost();
```

Отправка данных на сервер (POST-запрос) с телом в формате JSON:

```javascript
async function createPost() {
    const response = await fetch("https://jsonplaceholder.typicode.com/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Новый пост", body: "Текст", userId: 1 })
    });

    const data = await response.json();
    console.log(data);
}
```

Именно так устроено взаимодействие SPA-приложений (на Vue, React) с backend-частью на PHP или Node.js: фронтенд отправляет `fetch`-запрос к API, backend возвращает JSON, а JavaScript обновляет содержимое страницы без перезагрузки.

---

## 10. От чистого JavaScript к фреймворкам

Всё, что мы разобрали, — «чистый» или **Vanilla JavaScript**, без каких-либо дополнительных библиотек. При росте приложения вручную искать элементы через `querySelector` и обновлять их содержимое становится неудобно и подвержено ошибкам. Для решения этой проблемы появились фреймворки:

- **Vue**, **React**, **Svelte** — описывают интерфейс декларативно: разработчик описывает, *как должен выглядеть* интерфейс при определённых данных, а фреймворк сам обновляет DOM при изменении этих данных.
- Такой подход называется **реактивностью** и станет темой одной из следующих лекций курса.

---

## 11. Итоги

1. **JavaScript** выполняется в браузере пользователя и отвечает за интерактивность страницы, в отличие от PHP, который выполняется на сервере.
2. Современный JavaScript использует `let`/`const` вместо `var`, строгое сравнение `===`, шаблонные строки и стрелочные функции.
3. Методы массивов `map`, `filter`, `reduce` — базовый инструментарий для работы с данными в JS.
4. **DOM** — представление страницы в виде дерева объектов; через `document.querySelector` и `addEventListener` JavaScript находит элементы и реагирует на действия пользователя.
5. Функция **`fetch`** (с `async/await`) — стандартный способ обращения к backend-API из браузера; именно на этом механизме строится взаимодействие SPA-приложений с сервером.
6. Ручная работа с DOM — основа для понимания того, как устроены современные фреймворки (Vue, React), которые автоматизируют обновление интерфейса.
