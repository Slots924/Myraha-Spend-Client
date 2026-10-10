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
  "extensionVersion": "0.3.0",
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
| `profileId` | string; null лише для Debug | Унікальний AdsPower `user_id`, основний ключ профілю |
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

## Обробка на сервері

Для звичайних запитів v4 вимагати непорожній profileId і робити upsert за ним.
installationId зберігати як додатковий ідентифікатор установки.
Debug без ID приймати як тестовий запис за installationId окремо від записів профілів.
Якщо ID є, навіть Debug оновлює запис цього профілю.

При кожному запиті оновлювати актуальні значення незалежно від state:

- profileInfo.serialNumber/name/groupName: записувати рядок або null.
- cookies.items: замінювати список повністю, включно з порожнім списком.
  При cookies.state: unavailable зберігати попередні cookie: знімок не вдалося прочитати.
- token.value і userAgent.value: записувати непорожнє значення; при null
  зберігати попереднє, якщо воно є.
- sentAt, reason, extensionVersion, enabled, installationId та часові поля.

Будь-який HTTP 2xx означає успіх. Клієнт не розбирає тіло відповіді.
Наприклад: `200 {"ok": true}`. Повторні запити мають бути ідемпотентними.

Якщо підтримуються старі клієнти v2/v3, вони не мають AdsPower-полів:
обробляти за installationId, не очищати нові поля через їх відсутність.

## Готове завдання для LLM на сервері

```text
Онови приймач POST /fb_data/add для Myraha Spend Client, schemaVersion 4.
JSON має profileId, profileInfo {serialNumber, name, groupName}, installationId,
extensionVersion, sentAt, reason, enabled, cookies {state, count, lastUpdatedAt,
items[]}, token {state, value, lastUpdatedAt}, userAgent {state, value, lastUpdatedAt}.

Для v4 profileId — непорожній рядок, обов'язковий для всіх reason, крім manual.
manual дозволяє profileId: null: це Debug-тест, зберігай окремо за installationId.
За наявності profileId роби upsert за profileId для будь-якого reason.
installationId — додатковий ідентифікатор установки, не ключ профілю AdsPower.
profileInfo завжди містить три поля string|null. serialNumber — рядок,
groupName — назва групи, підтримуй Unicode/emoji. Записуй значення, включно з null.
Метадані можуть приходити із затримкою; їх оновлення не запускає окремий POST.

cookies.items — повний знімок: заміни попередній список, навіть якщо порожній.
Якщо cookies.state == unavailable, збережи попередній список.
Поля cookie: name, value, domain, path, secure, httpOnly, session, hostOnly,
expirationDate? (число), sameSite? (рядок).
token.value і userAgent.value — string|null; при null зберігай попереднє значення.
Оновлюй дані навіть при state == unchanged: state відображає локальні зміни,
а не факт успішного відправлення на сервер.
Зберігай sentAt, reason, extensionVersion, enabled, installationId та часові поля.

Якщо налаштований секрет, перевіряй X-Client-Key, при невідповідності — 401.
Валідуй типи, ігноруй невідомі поля. Успіх — HTTP 200 {"ok":true}.
Помилка валідації — HTTP 400 {"ok":false,"error":"..."}.
Повторний POST не повинен створювати дублікати.
Не логуй сирі токени та cookie.
Якщо потрібна сумісність із v2/v3: вони ідентифікуються за installationId,
у v2 немає userAgent, у v2/v3 немає profileId/profileInfo. Відсутність цих полів
у старому форматі не повинна очищати значення, отримані раніше від v4.
```
