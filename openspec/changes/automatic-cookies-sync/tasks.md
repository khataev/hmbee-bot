## 1. mozLz4-декодер

- [x] 1.1 Реализовать zero-dependency декодер mozLz4: проверка сигнатуры `mozLz40\0`, чтение `uint32 LE` размера, декомпрессия raw LZ4-блока
- [x] 1.2 Ошибка с понятным сообщением при неверной сигнатуре
- [x] 1.3 Юнит-тесты декодера (валидный mozLz4 → JSON; битая сигнатура → ошибка)

## 2. Чтение Firefox sessionstore

- [x] 2.1 Определить путь профиля из `profiles.ini`: приоритет install-lock (`[InstallXXXXXXXX].Default`) → легаси `[ProfileN].Default=1` → остальные профили по убыванию mtime
- [x] 2.2 Выбрать файл `recovery.jsonlz4`, при отсутствии/повреждении — `recovery.baklz4`; читать копию файла, не оригинал; при отсутствии обоих — ошибка «открой Firefox с залогиненной Точкой»
- [x] 2.3 Декодировать через модуль из группы 1 и распарсить JSON sessionstore
- [x] 2.4 Рекурсивно собрать cookie-объекты (по наличию полей `host`/`name`/`value`), устойчиво к структуре
- [x] 2.5 Юнит-тесты на зафиксированном (санитизированном) фрагменте sessionstore

## 3. Доменная фильтрация и сборка cookie-строки

- [ ] 3.1 Отфильтровать cookie по cookie-domain-matching для `i.tochka.com` (хосты `i.tochka.com`, `.tochka.com`, `tochka.com`); исключить `id.tochka.com`-scoped
- [ ] 3.2 Дедуплицировать по паре `(host, name)`
- [ ] 3.3 Собрать строку `name=value; name=value`
- [ ] 3.4 Юнит-тесты: правильный отбор доменов, исключение `id.tochka.com`, схлопывание дублей

## 4. Шов CredentialProvider

- [ ] 4.1 Определить интерфейс `CredentialProvider` с `getSession(system)` → cookie-строка
- [ ] 4.2 Реализовать Firefox-sessionstore-бэкенд для `tochka` поверх групп 2–3
- [ ] 4.3 Fallback на `TOCHKA_COOKIE` из окружения, если бэкенд недоступен/пуст
- [ ] 4.4 Ошибка, если нет ни браузерного источника, ни `TOCHKA_COOKIE`
- [ ] 4.5 Логировать только имена cookie, никогда значения
- [ ] 4.6 Юнит-тесты: успех из sessionstore, fallback на env, ошибка при отсутствии обоих

## 5. Подключение к адаптеру Точки

- [ ] 5.1 Переключить получение cookie в `src/adapters/tochka.ts` на `CredentialProvider.getSession('tochka')` без изменения парсинга cookie-строки и извлечения `X-CSRF-TOKEN`
- [ ] 5.2 Проверить, что существующие тесты адаптера проходят (контракт строки не изменился)

## 6. Окружение и документация

- [ ] 6.1 Сделать `TOCHKA_COOKIE` опциональным в `src/env.ts` (fallback, не обязательный секрет)
- [ ] 6.2 Обновить `.env.example` и `README.md`: описать автоматический забор cookie из Firefox и режим fallback

## 7. Проверка

- [ ] 7.1 Ручная проверка end-to-end: синк Точки берёт свежую cookie из работающего Firefox без правки `.env`
- [ ] 7.2 `npm run check` (Biome + TypeScript strict) проходит

## 8. Очистка HM-cookie (последним)

- [ ] 8.1 Убрать заголовок `cookie` из HM-запросов в `src/hmbee/client.ts` (`createTransaction`, `confirmPlannedTransaction`, чтение `all_json`)
- [ ] 8.2 Убрать `HM_COOKIE` из обязательной схемы в `src/env.ts` и из `.env.example`
- [ ] 8.3 Обновить/поправить тесты HM-клиента под отсутствие cookie; `npm run check` проходит
