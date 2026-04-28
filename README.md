# Cloudflare Worker Парсер с Puppeteer & D1 (Static Assets)

Привет! В ответ на твои проблемы с Cloudflare Pages: **Cloudflare Pages всё ещё плохо поддерживает Browser Rendering (в стадии беты, кнопки в интерфейсе просто нет!)**. 

Поэтому я **переделал проект в более надежный формат - Cloudflare Worker со статикой (Worker + Assets)**. Это новый стандарт Cloudflare, который объединяет фронтенд и бэкенд в одном месте, и здесь `Browser Rendering` работает 100% стабильно!

В этом проекте:
* `/public` - Фронтенд на чистом JS и Tailwind.
* `/src/index.js` и `/src/parse.js` - Бэкенд с рутингом и Puppeteer.
* `/wrangler.toml` - Главный конфиг. **В Cloudflare управлять проектом надо через него.**

## Инструкция по деплою (ОЧЕНЬ БЫСТРАЯ)

### Шаг 1. Бесплатный тариф: Browser Run (Лимиты)
> **ИНФОРМАЦИЯ:** Теперь инструмент называется **Browser Run**. Он доступен на **бесплатном тарифе (Workers Free)**! В вашем распоряжении **10 минут в день** (Browser time), до 3 параллельных сессий. Если вы исчерпаете 10 минут за день, скрипт ответит ошибкой 429 (Browser time limit exceeded) до следующего дня.

### Шаг 2. Создай базу D1
1. Зайди в панель Cloudflare -> **Storage & Databases** -> **D1 SQL Database**.
2. Создай базу `price_history`.
3. Открой вкладку **Console** у этой базы и выполни SQL код из файла `schema.sql`.
4. Скопируй **Database ID** из настроек базы.
5. Открой файл `wrangler.toml` в этом проекте и вставь скопированный ID в строку `database_id = "..."`.

### Шаг 3. Деплой через консоль (Самый надежный способ!)
Так как мы ушли от ограничений Pages, теперь всё загружается одной командой из терминала:
1. Открой терминал в папке проекта.
2. Введи команду (попросит авторизоваться в браузере):
   ```bash
   npx wrangler login
   ```
3. Выполни деплой:
   ```bash
   npm run deploy
   ```

**И ВСЁ!** 
Wrangler сам создаст Worker, загрузит фронтенд из папки `public`, подключит D1 и Browser Rendering! В конце он выдаст тебе готовую ссылку `https://parser.<твой-аккаунт>.workers.dev`.

### Почему не через GitHub-Pages UI?
Cloudflare Pages пока ограничены. Они пишут на сайте: "Browser Rendering API is currently only accessible by Workers, and cannot be run inside Pages Functions from the UI". Поэтому мы сделали полноценный Worker-проект. Управляй настройками только через `wrangler.toml` — это норма для Cloudflare.
