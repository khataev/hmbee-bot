## Context

API Точки возвращает поле `meta_data.time_data.event_date` в часовом поясе UTC+5. Текущий код берёт первые 10 символов строки (`YYYY-MM-DD`) как дату транзакции. Это корректно работает для транзакций в дневное время, но для транзакций после полуночи по UTC+5 (до 03:00 по Москве) дата оказывается на день раньше, чем фактическая дата по московскому времени.

Вся обработка транзакций сосредоточена в `src/apply/preview/tochka.ts`, конфигурация источников — в `src/config.ts`, вызов нормализации — в `src/index.ts`.

## Goals / Non-Goals

**Goals:**
- Привести дату транзакции к настроенному часовому поясу (по умолчанию `Europe/Moscow`) перед сохранением
- Сделать часовой пояс конфигурируемым через `config/sources.json`
- Не добавлять внешние зависимости (использовать нативный `Intl.DateTimeFormat`)

**Non-Goals:**
- Конвертация времени для других источников (Sber, Tinkoff)
- Отображение времени транзакции пользователю — нужна только дата
- Изменение формата хранения `event_date` в sync-файлах

## Decisions

### 1. Место хранения конфигурации: корневой уровень `AppConfigSchema`

Поле `time_zone` добавляется на корневой уровень схемы конфигурации приложения как обязательное (`z.string()`). Часовой пояс — глобальная операционная настройка приложения: он не относится ни к Honey Money (`hmbee`), ни к конкретному банковскому источнику.

Альтернативы:
- `HmbeeConfigSchema.timezone` — отклонена: timezone не связан с Honey Money
- `BankConfigSchema.timezone` (per-source) — отклонена: разные timezone для разных источников усложнят код без реальной необходимости
- опциональное поле с дефолтом — отклонено: явная конфигурация надёжнее скрытых дефолтов; отсутствие `time_zone` — ошибка конфигурации, а не норма

### 2. Передача timezone в нормализатор: через `TochkaNormalizationOptions`

Добавляем поле `timeZone: string` в интерфейс `TochkaNormalizationOptions`. Это согласуется с тем, как уже передаются `accountMappings`, `typeCodeRules` и т.д.

В `src/index.ts` при сборке options: `timeZone: config.time_zone`.

### 3. Конвертация даты: `Intl.DateTimeFormat` с локалью `sv-SE`

```typescript
function toDateInTimezone(isoString: string, tz: string): string {
  const date = new Date(isoString);
  const localDt = new Intl.DateTimeFormat('sv-SE', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  }).format(date);
  const tzName =
    new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'longOffset' })
      .formatToParts(date)
      .find((p) => p.type === 'timeZoneName')?.value ?? 'GMT';
  const offset = tzName === 'GMT' ? '+00:00' : tzName.slice(3);
  const ms = String(date.getUTCMilliseconds()).padStart(3, '0');
  return `${localDt.replace(' ', 'T')}.${ms}${offset}`;
}
```

Функция возвращает полную datetime-строку в целевом часовом поясе формата `"YYYY-MM-DDTHH:mm:ss.mmm±HH:MM"`. Это позволяет сохранить точное время транзакции для будущего использования и упрощает переход на `Temporal` (Node.js 26+), который станет идиоматичным решением.

`sv-SE` — локаль, дающая ISO-совместимый вывод даты и времени через `Intl.DateTimeFormat` без внешних зависимостей.

Альтернатива `en-CA` (возвращает только `YYYY-MM-DD`) — отклонена в пользу сохранения полного datetime: потребители извлекают дату через `.slice(0, 10)`, а само поле остаётся информативным.

Альтернатива `luxon` / `date-fns` — отклонена, внешняя зависимость избыточна для одной операции.

### 4. Точка применения: при построении `NormalizedRecord`

Конвертация применяется в `normalizeTochkaRecord` при установке `normalized.date`:

```typescript
date: toDateInTimezone(timeData.event_date, options.timeZone)
```

`NormalizedRecord.date` теперь содержит полную datetime-строку в целевом часовом поясе (`"YYYY-MM-DDTHH:mm:ss.mmm±HH:MM"`). Вызовы `.slice(0, 10)` в builder-ах по-прежнему корректны и необходимы для извлечения части `YYYY-MM-DD` для `HoneyMoneyTransaction.date`.

## Engineering Constraints

- Строгая типизация: новое поле `timeZone: string` в `TochkaNormalizationOptions` — required, не optional. Дефолт применяется только в `index.ts` при вызове
- Zod-схема: `time_zone: z.string()` (required) в `AppConfigSchema`; нет валидации IANA-имени часового пояса (невалидный tz приведёт к runtime-ошибке `RangeError` из `Intl.DateTimeFormat` — приемлемо; существующие конфиги без `time_zone` упадут с ошибкой Zod при загрузке)
- `npm run check` (`typecheck` + `lint` + `test`) должен проходить после изменений
- `toDateInTimezone` размещается в `src/apply/preview/tochka.ts` как module-private функция (не экспортируется, пока нет других потребителей)

## Risks / Trade-offs

- **[Риск] `en-CA` может вернуть не ISO-формат на некоторых платформах** → Mitigation: добавить unit-тест, верифицирующий формат вывода
- **[Риск] Невалидный IANA timezone в конфиге (`"timezone": "Moscow/Europe"`)** → Mitigation: `Intl.DateTimeFormat` бросает `RangeError` с понятным сообщением; считаем достаточным
- **[Breaking] Существующие `config/sources.json` без поля `time_zone` перестанут загружаться** → Mitigation: поле обязательное намеренно; пользователь должен добавить `"time_zone": "Europe/Moscow"` на корневой уровень при обновлении
