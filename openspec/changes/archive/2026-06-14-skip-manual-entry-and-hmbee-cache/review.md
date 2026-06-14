# Code Review: skip-manual-entry-and-hmbee-cache

**Reviewed:** 2026-06-14  
**Reviewer:** opsx:review  
**Branch:** HMB-24-skip-manual-entry-and-hmbee-cache  
**Status:** Complete (23/23 tasks)

---

## Overview

Реализация структурно чистая. Логика кеша изолирована в `src/hmbee/`, жадный 1:1 индекс работает корректно, проводка в `src/index.ts` прозрачна. Открытых блокирующих вопросов нет.

---

## 🔴 CRITICAL

### C1 — `npm audit`: `esbuild` HIGH severity vulnerability

```
esbuild >=0.17.0 <0.28.1
  - GHSA-gv7w-rqvm-qjhr: Missing binary integrity verification (CVSS 8.1)
  - GHSA-g7r4-m6w7-qqqr: Arbitrary file read on Windows dev server
```

**Замечание:** Pre-existing, не привнесена этим change-ом. `esbuild` — dev-зависимость (сборщик), production-риск минимален. Зафиксировать в TECH-DEBT.md, обновить отдельным PR.

**Fix:** `npm install esbuild@^0.28.1 --save-dev`

---

## 🟡 WARNING

### W1 — `statSync(CACHE_PATH)` в verbose-ветке apply — потенциальный TOCTOU

**File:** [src/index.ts:139](src/index.ts#L139)

```ts
const cacheDate = statSync(CACHE_PATH).mtime.toISOString().slice(0, 10);
```

`loadCache()` проверяет наличие файла через `existsSync`, но `statSync` вызывается позже — после нормализации всех записей. Если файл будет удалён между этими двумя вызовами, `statSync` бросит `ENOENT`, что будет поймано верхним `catch` как "Apply failed: ENOENT...". Маловероятно в реальном использовании, но создаёт неожиданный способ падения verbose-пути.

**Fix:** получить mtime сразу после `loadCache()` и передать вниз, либо обернуть `statSync` в try/catch с fallback-значением.

---

## 🟢 SUGGESTION

### S1 — `Math.abs` в ключе: потеря знака не очевидна

**File:** [src/hmbee/skipIndex.ts:77](src/hmbee/skipIndex.ts#L77)

```ts
const amount = Math.abs(Math.round(realAmount));
```

Сумма `-1000` (expense) и `+1000` (income) дают одинаковый компонент ключа `1000`. Это корректно — направление кодирует `subtype`. Но без комментария это выглядит как потенциальный баг. Стоит добавить однострочный комментарий.

---

### S2 — Подсказка в ошибке `loadCache` использует литеральный `<source>`

**File:** [src/hmbee/skipIndex.ts:18](src/hmbee/skipIndex.ts#L18)

```ts
throw new Error(`Honey Money cache not found at ${path}. Run 'sync <source> --update-hmbee-cache' first.`);
```

`<source>` — буквальная строка-заглушка. Пользователь видит: "Apply failed: Honey Money cache not found at sync/hmbee/all_json_cache.json. Run 'sync <source> --update-hmbee-cache' first." — слово `<source>` может смутить нового оператора. Можно передавать имя source в `loadCache` или формировать сообщение на стороне call-site в `index.ts`.

---

## Summary

| Severity | # | Блокирует мерж? |
|---|---|---|
| 🔴 CRITICAL | 1 | Нет (pre-existing, dev dep) |
| 🟡 WARNING | 1 | Желательно исправить до мержа |
| 🟢 SUGGESTION | 2 | Нет |

**Рекомендация:** исправить W1 (TOCTOU в verbose-пути) до мержа. C1 зафиксировать в TECH-DEBT.md и закрыть отдельным PR.
