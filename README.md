# Myraha Spend Client

Chrome-розширення (TypeScript, Manifest V3). Читає Facebook cookie, знімає access token зі сторінок вайтліста і шле **обидва** на ваш сервер.

Контракт API: [docs/server-api.md](docs/server-api.md).

## Як зібрати

Потрібен **Node.js 20+**.

```bat
cd "C:\Users\Darkness\Documents\Myraha Spend Client"
npm install
```

У `.env` має бути ваш сервер:

```env
VITE_API_URL=https://myraha.xyz/fb_data/add
VITE_CLIENT_KEY=ваш_ключ
VITE_TOKEN_SEARCH_COOLDOWN_MINUTES=60
VITE_TOKEN_PAGE_WHITELIST=https://www.facebook.com/adsmanager,https://www.facebook.com/advertising,https://www.facebook.com/ad_center,https://adsmanager.facebook.com,https://business.facebook.com
```

Збірка:

```bat
npm run build
```

Після зміни `.env` завжди робіть `npm run build` ще раз. Адреса API і ключ зашиваються в JS, хост API додається в `host_permissions`, тож Chrome **не питає дозвіл** під час відправки.

Готове розширення лежить у папці `dist`.

Перевірка в Chrome:

1. `chrome://extensions`
2. Developer mode
3. **Load unpacked** → папка `dist` (не корінь репо)

Для розробки: `npm run dev`, потім Reload на картці розширення.

## Zip для AdsPower

```bat
npm run pack
```

З’явиться файл `myraha-spend-client.zip` у корені репо.

У AdsPower: профіль → **Extensions** → додати розширення → завантажити цей zip.

### Що має бути в zip (корінь архіву)

Саме **вміст** `dist`, без обгортки `dist/`. `manifest.json` має лежати в корені zip.

```
manifest.json
popup.html
options.html
assets/
  background.js
  content.js
  page.js
  popup.js
  options.js
  ...
icons/
  icon-16.png
  icon-32.png
  icon-48.png
  icon-128.png
```

### Чого не класти

- `src/`
- `node_modules/`
- `.env`
- `package.json`
- `README.md`
- папку `dist` як вкладену (щоб не вийшло `dist/manifest.json`)

Якщо зібрати zip руками: виділіть **усі файли всередині** `dist` → Send to → Compressed folder.

## `.env`

- `VITE_API_URL` — POST-адреса. Має бути `https://`.
- `VITE_CLIENT_KEY` — заголовок `X-Client-Key`, можна порожній.
- `VITE_TOKEN_SEARCH_COOLDOWN_MINUTES` — пауза пошуку токена після знахідки. За замовчуванням `60`.
- `VITE_TOKEN_PAGE_WHITELIST` — префікси URL через кому.

Інший домен API: змініть `VITE_API_URL` і знову `npm run build` / `npm run pack`. Не змінюйте адресу лише в options, якщо не хочете попап Chrome на новий хост.

## Як працює токен

1. Режим пошуку увімкнений.
2. Користувач відкриває сторінку з вайтліста (Ads Manager / Business).
3. Розширення читає access token зі сторінки та з уже існуючих запитів Facebook.
4. Токен збережено → пошук пауза на час з `.env`.
5. Після паузи пошук знову вмикається.

## Як працює відправка

Щогодини **або** коли змінюються Facebook cookie, на сервер іде JSON: cookie, token, userAgent.

Debug-кнопка шле той самий знімок з `reason: "manual"`.

Якщо POST впав — актуальний знімок поїде наступного разу.

## Дозволи

- `cookies` + `https://*.facebook.com/*` — Facebook cookie
- `webRequest` + `https://graph.facebook.com/*` — токен з існуючих запитів
- content scripts на `*.facebook.com`
- хост з `VITE_API_URL` — у `host_permissions` після білду, без попапу на відправку
- `storage`, `alarms`
