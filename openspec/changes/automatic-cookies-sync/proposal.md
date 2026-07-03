## Why

Сейчас свежие session-cookie для Точки добываются вручную: оператор открывает `i.tochka.com` в браузере, лезет в DevTools, копирует cookie и вставляет в `TOCHKA_COOKIE` в `.env`. Session-токены Точки (`X-CSRF-TOKEN`, `RsRememberMeToken`, `JSESSIONID`) протухают быстро, поэтому копипаст повторяется постоянно. Нужно убрать ручной перенос: инструмент должен сам забирать живую cookie из браузера.

Экспериментально установлено (см. `design.md`), что нужные токены — **session-cookie**, поэтому в `cookies.sqlite` их нет, но они присутствуют в Firefox sessionstore (`recovery.jsonlz4`). Оттуда их и будем читать.

## What Changes

- Вводится шов `CredentialProvider` с методом `getSession(system)`, отдающим cookie-строку для адаптера. Источник cookie скрыт за интерфейсом — адаптеры о нём не знают.
- Добавляется Firefox-sessionstore-бэкенд для `tochka`: читает `recovery.jsonlz4` (формат mozLz4), декодирует, фильтрует cookie по доменному правилу для `i.tochka.com`, дедуплицирует и собирает cookie-строку.
- mozLz4-декодер реализуется как zero-dependency утилита (без новых npm-пакетов).
- Ручная вставка `TOCHKA_COOKIE` в `.env` сохраняется как fallback: если браузерный бэкенд недоступен/пуст, используется значение из env.
- `src/adapters/tochka.ts` **не меняется** по контракту — он уже принимает cookie-строку и извлекает `X-CSRF-TOKEN`; меняется только источник этой строки.
- **Последней задачей** из HM-запроса убирается неавторизующий заголовок `cookie` (HM авторизуется заголовком `user-token`; экспериментально подтверждено, что cookie не несёт авторизации), а `HM_COOKIE` перестаёт быть требуемым секретом.

Нефункциональные ограничения:
- Код проходит `npm run check` (Biome lint+format, TypeScript strict) — это Definition of Done.
- Никаких новых runtime-зависимостей: mozLz4-декодер пишется вручную.
- Чтение sessionstore выполняется в read-only режиме (работа с копией файла), значения cookie не логируются.

## Capabilities

### New Capabilities
- `browser-cookie-source`: автоматическое получение свежих session-cookie для банковских адаптеров из локального браузера (Firefox sessionstore) через шов `CredentialProvider`, с доменной фильтрацией, дедупликацией и fallback на `.env`.

### Modified Capabilities
- `secure-config-management`: `HM_COOKIE` больше не является используемым/требуемым секретом — заголовок `cookie` удаляется из HM-запросов, валидация HM-окружения перестаёт требовать `HM_COOKIE`.

## Impact

- Новый код: модуль `CredentialProvider` + Firefox-sessionstore-бэкенд + mozLz4-декодер.
- `src/adapters/tochka.ts`: точка получения cookie переключается на `CredentialProvider` (контракт функции не меняется).
- `src/hmbee/client.ts`: удаление заголовка `cookie` из запросов (`createTransaction`, `confirmPlannedTransaction`, `all_json`).
- `src/env.ts`: `HM_COOKIE` убирается из обязательной схемы; `TOCHKA_COOKIE` становится опциональным fallback.
- `.env.example` / `README.md`: обновление документации по получению cookie.
- Зависимость от Firefox-специфичного формата sessionstore (задокументировать в `design.md`).
