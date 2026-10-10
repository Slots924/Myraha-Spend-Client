# API розширення Myraha Spend Client

Розширення робить POST на налаштований API URL. Поточний формат — **schemaVersion: 4**.
В одному запиті надсилаються ID профілю AdsPower, додаткова інформація профілю,
повний знімок Facebook cookie, access token і User-Agent.

## Заголовки

```http
POST /fb_data/add HTTP/1.1
Content-Type: application/json
X-Client-Key: <ключ клієнта>
```

Якщо ключ порожній, заголовок `X-Client-Key` відсутній.

## Приклад тіла запиту

```json
{
  "schemaVersion": 4,
  "profileId": "example123",
  "profileInfo": {
    "serialNumber": "2280",
    "name": "Example profile",
    "groupName": "Example group"
  },
  "installationId": "0eb61de5-1d35-47b6-949e-980f87760965",
  "extensionVersion": "0.40.0",
  "sentAt": "2026-10-10T12:00:00.000Z",
  "reason": "hourly",
  "enabled": true,
  "cookies": {
    "state": "changed",
    "count": 1,
    "lastUpdatedAt": "2026-10-10T11:30:00.000Z",
    "items": [
      {
        "name": "c_user",
        "value": "100000000000001",
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
    "value": "EAA_example_token",
    "lastUpdatedAt": "2026-10-10T11:05:00.000Z"
  },
  "userAgent": {
    "state": "unchanged",
    "value": "Mozilla/5.0 ...",
    "lastUpdatedAt": "2026-10-10T11:00:00.000Z"
  }
}
```

## Поля профілю

| Поле | Тип | Значення |
|---|---|---|
| `profileId` | string; null лише для Debug | Унікальний AdsPower `user_id` |
| `profileInfo.serialNumber` | string або null | AdsPower `serial_number`; номер як рядок |
| `profileInfo.name` | string або null | Ім’я профілю |
| `profileInfo.groupName` | string або null | Назва групи, включно з Unicode/emoji |
| `installationId` | string UUID | Ідентифікатор установки розширення |

`profileInfo` завжди присутній. Кожне невідоме поле передається явно як `null`:

```json
{
  "profileId": "example123",
  "profileInfo": { "serialNumber": null, "name": null, "groupName": null }
}
```

Пошук ID та оновлення інформації працюють незалежно від відправки.
Збережений ID одразу дозволяє звичайне відправлення; підтвердження при запуску не потрібне.
Без ID автоматичні запити заблоковані. **Debug (`reason: "manual"`) надсилає
знімок навіть без ID (`profileId: null`) і навіть коли розширення вимкнене.**
Для відправки все одно потрібні API URL і доступ Chrome до його адреси.

Інформація береться з AdsPower Local API після визначення ID або зі збереженого
ID при наступному запуску. Перший запит — через 2 с, максимум 5 спроб,
пауза після помилки — 5 с. При призупиненні фонового процесу спроба може відбутися пізніше.
У разі помилки попередня інформація того самого профілю зберігається.
При зміні ID інформація старого профілю очищається до `null`.
Оновлення ID чи інформації **не створює додаткового POST**: нові значення
передаються при наступному звичайному або Debug-відправленні.

Поля group_id, паролі, логіни, проксі, IP і remark із відповіді AdsPower
не зберігаються розширенням і не передаються на сервер.

## Інші поля

- `extensionVersion` — версія розширення.
- `sentAt` — час формування знімка, ISO 8601 UTC.
- `enabled` — чи ввімкнене розширення.
- `cookies.items` — повний список Facebook cookie, не дельта.
- `cookies.count` — кількість cookie в знімку.
- `token.value` — access token або `null`.
- `userAgent.value` — UA зі сторінки браузерного профілю або `null`.
- `lastUpdatedAt` у cookie/token/UA — час останньої локальної зміни або `null`.
- `state` — changed, unchanged, missing або unavailable. Це локальна підказка;
  unchanged не гарантує, що сервер вже отримував значення.

Fingerprint, дата оновлення інформації AdsPower, помилки й логи залишаються локально.

## Типи полів запиту

У поточному форматі всі поля верхнього рівня та вкладені поля з таблиць
присутні в кожному запиті. Виняток — `expirationDate` і `sameSite` у cookie:
вони можуть бути відсутніми. Значення `null` передається явно, а не як рядок.

| Поле | Тип |
|---|---|
| `schemaVersion` | number, поточне значення `4` |
| `profileId` | string або null, умови описані вище |
| `profileInfo` | object із `serialNumber`, `name`, `groupName` |
| `installationId` | string UUID |
| `extensionVersion` | string |
| `sentAt` | string, ISO 8601 UTC |
| `reason` | string, значення з таблиці подій нижче |
| `enabled` | boolean |
| `cookies` | object із `state`, `count`, `lastUpdatedAt`, `items` |
| `token` | object із `state`, `value`, `lastUpdatedAt` |
| `userAgent` | object із `state`, `value`, `lastUpdatedAt` |
| `cookies.state`, `token.state`, `userAgent.state` | string: `changed`, `unchanged`, `missing`, `unavailable` |
| `cookies.count` | number, кількість елементів у `cookies.items` |
| `cookies.lastUpdatedAt`, `token.lastUpdatedAt`, `userAgent.lastUpdatedAt` | string ISO 8601 UTC або null |
| `cookies.items` | array об’єктів cookie; може бути порожнім |
| `token.value`, `userAgent.value` | string або null |

### Об’єкт cookie

| Поле | Тип | Значення |
|---|---|---|
| `name` | string | Назва cookie |
| `value` | string | Поточне значення cookie |
| `domain` | string | Домен cookie |
| `path` | string | Шлях cookie |
| `secure` | boolean | Cookie передається через захищене з’єднання |
| `httpOnly` | boolean | Cookie недоступна JavaScript сторінки |
| `session` | boolean | Cookie належить до поточної сесії |
| `hostOnly` | boolean | Cookie прив’язана до конкретного хоста |
| `expirationDate` | number, необов’язкове | Час завершення дії в секундах Unix; може містити дробову частину |
| `sameSite` | string, необов’язкове | `no_restriction`, `lax`, `strict` або `unspecified` |

### Значення state

| Значення | Зміст |
|---|---|
| `changed` | Клієнт зафіксував нове або змінене значення |
| `unchanged` | Значення збігається з останнім локально збереженим відбитком |
| `missing` | Значення відсутнє |
| `unavailable` | Значення не вдалося прочитати; зараз використовується для помилки читання cookie |

Токен і UA можуть мати `state: "unchanged"` уже в першому запиті після їх
оновлення: клієнт зберігає локальний відбиток під час отримання значення.
Фактичні дані містяться в `items` та `value` незалежно від `state`.
При помилці читання cookie надсилаються `state: "unavailable"`, `count: 0`,
`items: []`; це відрізняється від успішного читання порожнього списку.

## Коли надсилається запит

| `reason` | Подія |
|---|---|
| `install` | Перше встановлення, якщо ID вже є |
| `hourly` | Щогодинна перевірка |
| `cookie_changed` | Зміна Facebook cookie, debounce 30 с |
| `token_changed` | Знайдено новий токен |
| `retry` | Повтор після невдалого POST |
| `manual` | Debug-кнопка; дозволено без ID |

Після невдалого POST повтори: 5, 10, 20, 40, потім 60 хв.
Повтор надсилає актуальний знімок. Повтор без ID автоматично заблокований,
навіть якщо початкове відправлення було Debug.

## Відповідь сервера

Клієнт визначає результат за HTTP-статусом. Будь-який статус **200–299**
означає успішне відправлення. Тіло відповіді не читається: обов’язкових
JSON-полів відповіді немає, порожнє тіло також підтримується.

Приклад успішної відповіді:

```http
HTTP/1.1 200 OK
Content-Type: application/json

{"ok": true}
```

Відповідь `204 No Content` також вважається успішною.
Статуси поза діапазоном 2xx, мережева помилка або тайм-аут запиту **15 секунд**
вважаються невдалим відправленням і запускають описаний вище механізм повторів.
Це стосується також 400, 401, 403, 429 і 5xx: окремої обробки цих кодів немає.
Тіло помилки та заголовок `Retry-After` клієнт не використовує.

## Попередні формати

Поточна збірка надсилає лише v4. У попередньому v3 були cookie, token та
userAgent, але не було profileId/profileInfo. У v2 також не було userAgent.
