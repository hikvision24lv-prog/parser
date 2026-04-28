# Cloudflare Pages Парсер с Puppeteer & D1

Привет! Так как у нас проект собирается черед Cloudflare Pages, я вернул структуру проекта к стандарту Cloudflare Pages 🎉

В этом проекте:
* `/public` - Фронтенд на чистом JS и Tailwind.
* `/functions/api/parse.js` - Серверная часть (Pages Functions), которая сама запускает Chrome (Puppeteer API).
* Логирование каждого микро-действия для легкой отладки.
* `wrangler.toml` - конфиг-файл, в котором прописаны биндинги базы `DB` и браузера `MYBROWSER`. Cloudflare Pages теперь умеет читать этот файл!

## Почему была ошибка 405 (Method Not Allowed)
Прошлый раз я переделал бэкенд на формат Cloudflare Workers. Из-за этого папка `/functions` была удалена. А так как ваш проект в Cloudflare является **Cloudflare Pages**, то без папки `functions` Cloudflare просто служил статические файлы (в частности отдавая `405` ошибку на попытку использовать метод `POST` поверх статики).

Теперь всё возвращено в Pages структуру: папка `/functions` снова на месте! `POST /api/parse` будет ловиться функцией `/functions/api/parse.js`.

## Важно про Browser Run (Browser Rendering)
Убедитесь, что ваш скрипт ловит ошибку 429. В рамках **Workers Free Plan** доступно 10 минут времени работы браузера в день. Если биндинг почему-то отваливается, проверьте что в `wrangler.toml` есть:
```toml
browser = { binding = "MYBROWSER" }
```
Cloudflare Pages прочитает его при следующем деплое через GitHub!
