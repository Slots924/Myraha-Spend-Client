# API статусів розширення

Розширення виконує `POST` на адресу `VITE_API_URL`. Воно **ніколи не надсилає значення Facebook cookie або токена**, їхні хеші, назви cookie чи тіло відповіді Facebook.

## Запит

Заголовки:

```http
Content-Type: application/json
X-Client-Key: <VITE_CLIENT_KEY або локальне налаштування>
```

Тіло:

```json
{
  "schemaVersion": 1,
  "installationId": "0eb61de5-1d35-47b6-949e-980f87760965",
  "extensionVersion": "0.1.0",
  "sentAt": "2026-09-04T12:00:00.000Z",
  "reason": "hourly",
  "enabled": true,
  "cookies": {
    "state": "unchanged",
    "count": 8,
    "lastUpdatedAt": "2026-09-04T10:30:00.000Z"
  },
  "token": {
    "state": "changed",
    "lastUpdatedAt": "2026-09-04T12:00:00.000Z"
  }
}
```

`reason`: `install | hourly | cookie_changed | token_changed | retry | manual`.

`state`: `changed | unchanged | missing | unavailable`.

## Очікувана відповідь

Будь-який HTTP `2xx` означає успіх. Рекомендована відповідь:

```json
{ "ok": true }
```

При `4xx`, `5xx`, мережевій помилці або таймауті 15 секунд розширення записує санітизовану помилку та повторює спробу через 5, 10, 20, максимум 60 хвилин. Сервер має ідемпотентно приймати можливі дублікати.

## Безпека

Використовуйте HTTPS. `X-Client-Key` усередині розширення можна витягнути, тому це лише ідентифікатор/перша лінія фільтрації, не повноцінний секрет. Для серйозної автентифікації сервер повинен видавати окремий короткоживучий ключ кожній інсталяції після входу користувача.
