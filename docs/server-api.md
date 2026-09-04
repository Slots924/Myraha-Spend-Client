# API розширення Myraha Spend Client

Розширення робить `POST` на `VITE_API_URL` і **надсилає живі Facebook cookie разом із access token**.

Сервер має читати саме ці поля. Відбитки (fingerprint) лишаються лише локально, у запиті їх немає.

## Коли йде запит

| `reason` | Коли |
|---|---|
| `install` | Перше встановлення |
| `hourly` | Щогодини |
| `cookie_changed` | Змінились cookie `*.facebook.com` (після паузи 30 секунд, щоб не слати кожен дрібний overwrite) |
| `token_changed` | На вайтліст-сторінці знайдено новий access token |
| `retry` | Попередній POST не вдався |
| `manual` | Користувач натиснув «Надіслати зараз» |

Якщо POST не вдався (мережа, `4xx`, `5xx`, таймаут 15 с) — нічого критичного. Розширення пише лог і відправить **актуальний** знімок наступного разу: retry через 5/10/20/60 хвилин, або на найближчому `hourly` / `cookie_changed` / `token_changed`.

## Заголовки

```http
POST /fb_data/add HTTP/1.1
Content-Type: application/json
X-Client-Key: <VITE_CLIENT_KEY або значення з налаштувань>
```

`X-Client-Key` можна не надсилати, якщо ключ порожній.

## Тіло (`schemaVersion: 2`)

```json
{
  "schemaVersion": 2,
  "installationId": "0eb61de5-1d35-47b6-949e-980f87760965",
  "extensionVersion": "0.2.0",
  "sentAt": "2026-09-04T12:00:00.000Z",
  "reason": "hourly",
  "enabled": true,
  "cookies": {
    "state": "changed",
    "count": 8,
    "lastUpdatedAt": "2026-09-04T11:30:00.000Z",
    "items": [
      {
        "name": "c_user",
        "value": "100012345678901",
        "domain": ".facebook.com",
        "path": "/",
        "secure": true,
        "httpOnly": true,
        "session": false,
        "hostOnly": false,
        "expirationDate": 1790000000,
        "sameSite": "no_restriction"
      }
    ]
  },
  "token": {
    "state": "unchanged",
    "value": "EAABWZC...",
    "lastUpdatedAt": "2026-09-04T11:05:00.000Z"
  }
}
```

## Що ловити на сервері

### Ідентифікація клієнта

- `installationId` — стабільний UUID цієї установки Chrome. Ним можна клеїти історію аккаунта.
- `extensionVersion` — версія розширення.
- `sentAt` — час знімка на клієнті, ISO-8601 UTC.
- `reason` — чому знімок пішов саме зараз.
- `enabled` — чи увімкнене розширення. Якщо `false`, запиту не буде.

### Facebook cookie — `cookies.items[]`

Це **повний список cookie домену `facebook.com`**, не статус.

Кожен елемент:

| поле | тип | зміст |
|---|---|---|
| `name` | string | Ім’я cookie (`c_user`, `xs`, `datr`, `sb`, `fr`, …) |
| `value` | string | Сире значення |
| `domain` | string | Наприклад `.facebook.com` |
| `path` | string | Зазвичай `/` |
| `secure` | boolean | |
| `httpOnly` | boolean | |
| `session` | boolean | `true`, якщо без `expirationDate` |
| `hostOnly` | boolean | |
| `expirationDate` | number? | Unix timestamp у секундах, якщо є |
| `sameSite` | string? | `no_restriction` \| `lax` \| `strict` \| `unspecified` |

Додатково:

- `cookies.count` — `items.length`
- `cookies.lastUpdatedAt` — коли клієнт востаннє побачив зміну набору cookie
- `cookies.state`:
  - `changed` — набір/значення змінилися з минулого знімка
  - `unchanged` — ті самі cookie, але `items` усе одно приїжджають
  - `missing` — cookie немає
  - `unavailable` — клієнт не зміг прочитати cookie; `items` буде `[]`

Для сесії найчастіше потрібні `c_user` + `xs`. Решту все одно надсилаємо, щоб сервер сам вирішив що зберігати.

### Access token — `token.value`

Це Facebook access token (`EAA…`, зазвичай ads/business `EAAB…` / `EAAG…`).

Як клієнт його бере:

1. Якщо токена ще немає, або вийшла пауза після минулої знахідки — вмикається **режим пошуку**.
2. Користувач заходить на URL з вайтліста (`VITE_TOKEN_PAGE_WHITELIST`: Ads Manager, Business Suite тощо).
3. Розширення **нічого зайвого не запитує**. Воно читає токен зі сторінки та з уже існуючих запитів Facebook (`access_token=` у URL/тілі, HTML, JS-глобалі).
4. Після успішного копіювання режим пошуку **вимикається на `VITE_TOKEN_SEARCH_COOLDOWN_MINUTES`** (за замовчуванням 60). Далі пошук знову вмикається, щоб оновити токен.

Поля:

| поле | зміст |
|---|---|
| `token.value` | Рядок токена або `null`, якщо ще не знайдений |
| `token.lastUpdatedAt` | Коли токен востаннє змінювався на клієнті |
| `token.state` | `changed` \| `unchanged` \| `missing` |

Токен і cookie їдуть **в одному POST**. Навіть якщо змінилися лише cookie, `token.value` все одно присутній (або `null`). Навіть на `hourly` приїжджає повний знімок, не дельта.

## Очікувана відповідь

Будь-який HTTP `2xx` = успіх.

```json
{ "ok": true }
```

Тіло відповіді клієнт не розбирає.

## Ідемпотентність

Retry і hourly можуть прислати той самий знімок двічі. Сервер має оновлювати запис по `installationId` (upsert), а не плодити дублікати на кожен POST.

## Безпека

- Лише HTTPS (localhost дозволений для деву).
- `X-Client-Key` — грубий фільтр, не секрет: його можна витягнути з розширення.
- Payload містить сесійні cookie і access token. Канал і зберігання на сервері мають бути захищені як секрети.
