## 1. Конфигурация

- [x] 1.1 Добавить поле `time_zone: z.string()` (required) в `AppConfigSchema` в `src/config.ts`
- [x] 1.2 Добавить поле `time_zone: string` в `ResolvedAppConfigSchema` в `src/config.ts`
- [x] 1.3 Убедиться, что `npm run check` проходит после изменений в `src/config.ts`

## 2. Хелпер конвертации даты

- [x] 2.1 Реализовать функцию `toDateInTimezone(isoString: string, tz: string): string` в `src/apply/preview/tochka.ts` с использованием `Intl.DateTimeFormat` и локали `en-CA`
- [x] 2.2 Добавить unit-тест для `toDateInTimezone`: проверить что транзакция `00:30:00+05:00` возвращает предыдущий день по `Europe/Moscow`

## 3. Нормализация

- [x] 3.1 Добавить поле `timeZone: string` в интерфейс `TochkaNormalizationOptions` в `src/apply/preview/tochka.ts`
- [x] 3.2 Заменить `date: timeData.event_date` на `date: toDateInTimezone(timeData.event_date, options.timeZone)` в функции `normalizeTochkaRecord`
- [x] 3.3 В `src/index.ts` передать `timeZone: config.time_zone` в объект options при вызове `normalizeTochkaRecord`

## 4. Качество

- [x] 4.1 Запустить `npm run check` и убедиться в отсутствии ошибок typecheck, lint и тестов
