## ADDED Requirements

### Requirement: Провайдер учётных данных отдаёт cookie-строку по имени источника
Система SHALL предоставлять шов `CredentialProvider` с методом `getSession(system)`, который возвращает готовую cookie-строку для указанного источника (например `tochka`), скрывая конкретный механизм получения cookie от адаптеров.

#### Scenario: Адаптер получает cookie через провайдер
- **WHEN** адаптер запрашивает cookie для источника `tochka` через `CredentialProvider.getSession('tochka')`
- **THEN** возвращается непустая cookie-строка вида `name=value; name=value`
- **AND** адаптер не обращается напрямую к браузеру, файлам sessionstore или переменным окружения

#### Scenario: Контракт адаптера Точки не меняется
- **WHEN** адаптер Точки получает cookie-строку от провайдера
- **THEN** он парсит её и извлекает `X-CSRF-TOKEN` тем же способом, что и ранее
- **AND** формат передаваемой строки остаётся `name=value; name=value`

### Requirement: Чтение session-cookie Точки из Firefox sessionstore
Система SHALL получать свежие session-cookie для источника `tochka` из Firefox sessionstore, поскольку эти cookie являются session-scoped и отсутствуют в `cookies.sqlite`.

#### Scenario: Извлечение живых session-токенов
- **WHEN** в активном Firefox-профиле есть залогиненная сессия Точки
- **THEN** провайдер извлекает из sessionstore session-cookie, включая `X-CSRF-TOKEN`, `RsRememberMeToken` и `JSESSIONID`
- **AND** собранная cookie-строка достаточна для запроса к `https://i.tochka.com/api/v1/timeline`

#### Scenario: Выбор профиля при нескольких записях в profiles.ini
- **WHEN** провайдер определяет путь профиля из `profiles.ini`, и там присутствует несколько профилей (например, пустой legacy-профиль наравне с реально используемым)
- **THEN** он выбирает по приоритету: install-lock `Default=` из `[InstallXXXXXXXX]`, затем легаси `[ProfileN].Default=1`, затем остальные профили по убыванию mtime директории
- **AND** если кандидат с более высоким приоритетом не содержит рабочего sessionstore, используется следующий по приоритету

#### Scenario: Выбор файла sessionstore при работающем Firefox
- **WHEN** провайдер ищет данные sessionstore в профиле
- **THEN** он использует `recovery.jsonlz4`, при его отсутствии или повреждении — `recovery.baklz4`
- **AND** читается копия файла, а не оригинал (файл может быть занят работающим Firefox)

#### Scenario: Firefox закрыт — понятная ошибка
- **WHEN** файлы `recovery.jsonlz4` и `recovery.baklz4` отсутствуют (Firefox не запущен)
- **THEN** браузерный бэкенд не возвращает cookie и сообщает, что нужно открыть Firefox с залогиненной Точкой
- **AND** срабатывает fallback на `TOCHKA_COOKIE`, если он задан

### Requirement: Декодирование формата mozLz4 без внешних зависимостей
Система SHALL декодировать файлы sessionstore формата mozLz4 собственной реализацией, не добавляя новых runtime-зависимостей.

#### Scenario: Валидный mozLz4-файл
- **WHEN** декодеру передаётся файл с сигнатурой `mozLz40\0`
- **THEN** он читает 4-байтный размер распакованных данных и декодирует raw LZ4-блок в JSON
- **AND** возвращает разобранный объект sessionstore

#### Scenario: Некорректная сигнатура
- **WHEN** переданный файл не начинается с сигнатуры `mozLz40\0`
- **THEN** декодер завершается ошибкой, идентифицирующей неверный формат

### Requirement: Доменная фильтрация и дедупликация cookie
Система SHALL отбирать cookie по правилу cookie-domain-matching для целевого хоста и удалять дубликаты, а не полагаться на захардкоженный список ключей.

#### Scenario: Отбор cookie для i.tochka.com
- **WHEN** провайдер собирает cookie для запроса к `i.tochka.com`
- **THEN** включаются cookie с хостами `i.tochka.com`, `.tochka.com`, `tochka.com`
- **AND** cookie, scoped на `id.tochka.com` (например `t_uid`, `TochkaID`, `ID-CSRF-TOKEN`), исключаются

#### Scenario: Схлопывание дубликатов
- **WHEN** sessionstore содержит одну и ту же cookie несколько раз (например при нескольких открытых окнах)
- **THEN** в итоговой строке каждая cookie присутствует один раз, дедуплицированная по паре `(host, name)`

### Requirement: Fallback на переменную окружения
Система SHALL использовать `TOCHKA_COOKIE` из окружения как запасной источник, когда браузерный бэкенд недоступен или не вернул cookie.

#### Scenario: Firefox недоступен или пуст
- **WHEN** Firefox не установлен, профиль не найден, файл sessionstore отсутствует или не содержит cookie Точки
- **AND** переменная `TOCHKA_COOKIE` задана в окружении
- **THEN** провайдер возвращает cookie-строку из `TOCHKA_COOKIE`

#### Scenario: Нет ни браузерного источника, ни env
- **WHEN** браузерный бэкенд не вернул cookie
- **AND** `TOCHKA_COOKIE` не задана
- **THEN** провайдер завершается ошибкой, поясняющей, что свежую cookie получить не удалось

### Requirement: Значения cookie не логируются
Система SHALL не выводить значения cookie в логи; диагностика оперирует только именами cookie.

#### Scenario: Диагностический вывод
- **WHEN** провайдер логирует информацию о найденных cookie
- **THEN** выводятся только имена (и при необходимости хосты) cookie
- **AND** значения cookie не попадают в вывод
