## Context

См. `proposal.md` — Why. Классификатор Точки уже умеет матчить `CashOutAtm` как transfer через чисто конфигурационное `included`-условие в `sources.json` (JSON Logic), без специального кода: `getNormalizedType` и `getCounterpartyAccount` в `src/apply/preview/tochka.ts` реагируют на `tranCode = CashOutAtm` независимо от `status`, а сам `status` фильтруется только на уровне `included`/`excluded` в `sources.json`. Для `Purchase` в том же типе (`CardTransactionInfo`) уже есть прецедент: оба статуса `InProgress` и `Withdraw` включены в `included` одной OR-веткой.

## Goals / Non-Goals

**Goals:**
- Матчить `CashOutAtm` в `included` по `status = Withdraw` ИЛИ `status = InProgress`, полностью через `sources.json`, без изменений в `src/apply/preview/tochka.ts`.
- Задокументировать остаточный риск дублирования (см. `proposal.md` — Impact) в `TRANSACTION-RULES.md`, чтобы он не потерялся.

**Non-Goals:**
- Решение риска дублирования (например, дедуп по `tranId`, апдейт существующей записи вместо создания новой) — недостаточно данных, чтобы спроектировать это сейчас. Оставлено как известный риск для наблюдения на следующих синках.
- Изменение поведения других `tranCode` (`Purchase`, `ReverseByCard` и т.д.) — не затрагиваются.
- Изменение способа резолюции `cash:<currency>` в `accountMappings` — уже работает независимо от статуса.

## Decisions

**Расширить `included` через OR по `status`, а не через отдельную JSON Logic-ветку `NOT excluded`.**
Rationale: симметрично уже существующему паттерну для `Purchase` (`{"or":[...]}` по обоим статусам), минимальный и предсказуемый диф в `sources.json`. Альтернатива — оставить `included` как есть и добавить `InProgress` в отдельную ветку — усложнила бы диф без выигрыша, т.к. итоговая семантика («и то, и то — save-ready transfer») одинаковая для обоих статусов.

**Не трогать код `tochka.ts`.**
Rationale: `getNormalizedType`/`getCounterpartyAccount`/`getTransactionId` уже реагируют на `tranCode = CashOutAtm`, не на `status` — вся branching-логика по статусу целиком в `included`/`excluded` JSON Logic. Значит, это чисто конфигурационное изменение (`sources.json` + `sources.example.json`) плюс тест/фикстура/документация.

**Не пытаться закрыть риск дублирования в этом изменении.**
Rationale: неизвестно, действительно ли Точка присылает второе событие с тем же `tranId` при переходе `InProgress → Withdraw`, и совпадает ли при этом `event_date`/`sum`. Проектировать защиту на этом этапе — гадание; правильный следующий шаг — понаблюдать за реальными синками (в частности, за `tranId 4578588294`) и завести отдельное изменение, если дубли действительно случаются.

## Risks / Trade-offs

- [Риск] Если холд (`InProgress`) и подтверждение (`Withdraw`) для одного и того же `tranId` — это два разных события с расходящимися `event_date`/`sum`, и оба теперь `included`, то оба создадут отдельные save-ready transfer-записи. Существующий дедуп (`src/hmbee/skipIndex.ts`) сопоставляет по `(account_id, date, real_amount, subtype, category, currency)`, а не по `tranId`, поэтому не гарантированно поймает такую пару.
  → Mitigation (в рамках этого изменения — только наблюдение, не код): явно задокументировать риск в `TRANSACTION-RULES.md`; следить за следующими синками, есть ли повторное событие для `tranId 4578588294` или аналогичных; если дубль подтвердится — заводить отдельное изменение на дедуп по `tranId`.
- [Риск] Холд может быть впоследствии отменён банком (снятие не состоялось), а не перейти в `Withdraw`. Тогда в HM останется transfer-запись без реального списания.
  → Mitigation: тот же путь наблюдения; при подтверждении такого сценария — отдельное изменение (например, различать отменённый холд через дополнительное поле, если оно появится в данных).

## Engineering Constraints

- Изменение полностью декларативное (`config/sources.json`, `config/sources.example.json`) — TypeScript strict mode и Biome не затрагиваются, новых модулей/паттернов не вводится.
- Новый тест-кейс в `src/apply/preview-CardTransactionInfo.test.ts` должен использовать существующий стиль фикстур (`src/apply/preview/fixtures/*.json`) и утверждать `identified`, `save`, `reason`, `normalized.type`, `counterpartyAccountId` — по аналогии с существующим `Withdraw`-кейсом (см. `card-transaction-cash-out-atm.json`).
- `npm run check` (lint + typecheck + тесты) обязателен перед завершением задачи.
