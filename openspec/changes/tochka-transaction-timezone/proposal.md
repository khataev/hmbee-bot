## Why

Поле `meta_data.time_data.event_date` в API Точки содержит дату и время в часовом поясе UTC+5, а не UTC+3 (Москва). При наивном извлечении первых 10 символов (`YYYY-MM-DD`) дата транзакции, совершённой после полуночи по UTC+5, может оказаться на день раньше по московскому времени, что нарушает корректность записей в Honey Money.

## What Changes

- Добавить обязательное поле `time_zone` на корневом уровне `config/sources.json` — единое значение для всего приложения, не привязанное ни к Honey Money, ни к конкретному источнику
- При нормализации записей Точки приводить `event_date` к настроенному часовому поясу перед извлечением даты (`YYYY-MM-DD`)
- Реализовать хелпер `toDateInTimezone(isoString, tz)` с использованием нативного `Intl.DateTimeFormat`

## Capabilities

### New Capabilities
- `tochka-event-date-timezone`: Нормализация даты транзакции Точки с учётом часового пояса из корневой конфигурации

### Modified Capabilities
- `secure-config-management`: Добавляется новое обязательное поле `time_zone` на корневой уровень конфигурации приложения

## Impact

- `src/config.ts` — добавление `time_zone: z.string()` в `AppConfigSchema` и `ResolvedAppConfigSchema`
- `src/apply/preview/tochka.ts` — замена `timeData.event_date` на приведённую к timezone дату; добавление `timezone` в `TochkaNormalizationOptions`
- `src/index.ts` — передача `config.time_zone` в options нормализатора
- `config/sources.json` (пользовательский файл) — добавление `"time_zone": "Europe/Moscow"` на корневой уровень
- Нет новых зависимостей: используется встроенный `Intl.DateTimeFormat`
- `npm run check` должен проходить без ошибок после изменений
