# Myraha Spend Client

Chrome-розширення (TypeScript, Manifest V3). Воно читає Facebook cookie, у режимі пошуку знімає access token зі сторінок вайтліста і надсилає **обидва** на ваш сервер.

Детальний контракт: [docs/server-api.md](docs/server-api.md).

## Запуск

1. Node.js 20+.
2. `npm install`
3. Скопіюйте `.env.example` → `.env` і заповніть.
4. `npm run build`
5. `chrome://extensions` → Developer mode → **Load unpacked** → папка `dist`

Для розробки: `npm run dev`, після перебудови Reload на сторінці розширень.

## `.env`

```env
VITE_API_URL=https://api.example.com/fb_data/add
VITE_CLIENT_KEY=
VITE_TOKEN_SEARCH_COOLDOWN_MINUTES=60
VITE_TOKEN_PAGE_WHITELIST=https://www.facebook.com/adsmanager,https://www.facebook.com/advertising,https://www.facebook.com/ad_center,https://adsmanager.facebook.com,https://business.facebook.com
```

- `VITE_TOKEN_SEARCH_COOLDOWN_MINUTES` — на скільки хвилин вимкнути пошук після того, як токен скопійовано. За замовчуванням `60`.
- `VITE_TOKEN_PAGE_WHITELIST` — префікси URL через кому. Токен шукається лише якщо вкладка починається з одного з них.

## Як працює токен

Токен більше не вводиться вручну.

1. Потрібен токен → режим пошуку увімкнений.
2. Користувач відкриває сторінку з вайтліста (Ads Manager / Business).
3. Розширення спокійно читає access token зі сторінки та з мережевих запитів Facebook. Окремих підозрілих запитів воно не робить.
4. Токен збережено локально → пошук вимикається на час з `.env`.
5. Після паузи пошук знову вмикається, щоб оновити токен.

## Як працює відправка

Щогодини **або** коли змінюються Facebook cookie, на сервер іде JSON:

- повний масив cookie (`name`, `value`, `domain`, `path`, flags, `expirationDate`)
- поточний access token (`token.value`)

Якщо POST впав — ігноруємо і шлемо актуальний знімок наступного разу.

Локальні логи (до 200 рядків) не містять cookie і токена.

## Дозволи

- `cookies` + `https://*.facebook.com/*` — читання Facebook cookie
- `webRequest` + `https://graph.facebook.com/*` — підхопити `access_token` з уже існуючих запитів на вайтліст-сторінках
- content scripts на `*.facebook.com` — зчитати токен зі сторінки
- `storage` — стан, токен, логи
- `alarms` — година, debounce cookie, retry, пауза пошуку
- URL API — optional host permission у момент збереження налаштувань
