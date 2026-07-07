#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import { getDescription, getMcc, mapTochkaCategory } from "src/apply/preview/tochka.js";
import { createAccountRegistry, loadConfig } from "src/config.js";

const PROJECT_ROOT = process.cwd();
const DEFAULT_DIR = path.join(PROJECT_ROOT, "sync", "tochka");
const CONFIG_PATH = path.join(PROJECT_ROOT, "config", "sources.json");
const MCC_INPUT = "m";
const TITLE_INPUT = "t";
const RULE_INPUT = "r";

function normalizeCategory(raw) {
  const trimmed = raw.trim();
  const quotedDouble = trimmed.startsWith('"') && trimmed.endsWith('"');
  const quotedSingle = trimmed.startsWith("'") && trimmed.endsWith("'");

  if ((quotedDouble || quotedSingle) && trimmed.length >= 2) {
    return trimmed.slice(1, -1).trim();
  }

  return trimmed;
}

function parseInputLine(line) {
  const firstComma = line.indexOf(",");

  if (firstComma === -1) {
    return { error: 'Ожидается запятая: m|t, "Категория"[, Описание] или r, <field>, "Категория"[, Описание]' };
  }

  const mappingField = line.slice(0, firstComma).trim().toLowerCase();
  let rest = line.slice(firstComma + 1);

  if (mappingField !== MCC_INPUT && mappingField !== TITLE_INPUT && mappingField !== RULE_INPUT) {
    return { error: `Первое значение должно быть ${MCC_INPUT}, ${TITLE_INPUT} или ${RULE_INPUT}` };
  }

  let ruleField;
  if (mappingField === RULE_INPUT) {
    const fieldComma = rest.indexOf(",");

    if (fieldComma === -1) {
      return { error: 'Ожидается: r, <field>, "Категория"[, Описание]' };
    }

    ruleField = rest.slice(0, fieldComma).trim();

    if (!ruleField) {
      return { error: "Имя поля не должно быть пустым" };
    }

    rest = rest.slice(fieldComma + 1);
  }

  const secondComma = rest.indexOf(",");
  let categoryRaw, descriptionRaw;

  if (secondComma === -1) {
    categoryRaw = rest;
    descriptionRaw = undefined;
  } else {
    categoryRaw = rest.slice(0, secondComma);
    descriptionRaw = rest.slice(secondComma + 1).trim() || undefined;
  }

  const category = normalizeCategory(categoryRaw);

  if (!category) {
    return { error: "Название категории не должно быть пустым" };
  }

  return {
    mappingField,
    ruleField,
    category,
    description: descriptionRaw,
  };
}

async function loadJsonFile(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

async function saveJsonFile(filePath, data) {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2) + "\n", "utf8");
}

function getCategoryMapping(config) {
  if (!config.hmbee.categoryMapping) {
    config.hmbee.categoryMapping = { mcc: {}, title: {}, ignored: { mcc: [], title: [] } };
  }
  if (!config.hmbee.categoryMapping.mcc) config.hmbee.categoryMapping.mcc = {};
  if (!config.hmbee.categoryMapping.title) config.hmbee.categoryMapping.title = {};
  if (!config.hmbee.categoryMapping.ignored) config.hmbee.categoryMapping.ignored = { mcc: [], title: [] };
  if (!config.hmbee.categoryMapping.ignored.mcc) config.hmbee.categoryMapping.ignored.mcc = [];
  if (!config.hmbee.categoryMapping.ignored.title) config.hmbee.categoryMapping.ignored.title = [];
  if (!config.hmbee.categoryMapping.rules) config.hmbee.categoryMapping.rules = [];
  return config.hmbee.categoryMapping;
}

async function loadExistingMappings() {
  const config = await loadJsonFile(CONFIG_PATH);
  const mapping = getCategoryMapping(config);
  const ignoredMcc = new Set(mapping.ignored.mcc);
  const ignoredTitleRegexes = mapping.ignored.title.map((pat) => new RegExp(pat, "i"));
  return { ignoredMcc, ignoredTitleRegexes };
}

async function saveMappingEntry(mappingField, key, entry) {
  const config = await loadJsonFile(CONFIG_PATH);
  const mapping = getCategoryMapping(config);
  mapping[mappingField][key] = entry;
  await saveJsonFile(CONFIG_PATH, config);
}

async function saveRuleEntry(rule) {
  const config = await loadJsonFile(CONFIG_PATH);
  const mapping = getCategoryMapping(config);
  mapping.rules.push(rule);
  await saveJsonFile(CONFIG_PATH, config);
}

async function saveIgnoredEntry(field, key) {
  const config = await loadJsonFile(CONFIG_PATH);
  const mapping = getCategoryMapping(config);
  if (!mapping.ignored[field].includes(key)) {
    mapping.ignored[field].push(key);
  }
  await saveJsonFile(CONFIG_PATH, config);
}

function isSelfMatchingRegex(value) {
  try {
    return new RegExp(value, "i").test(value);
  } catch {
    return false;
  }
}

function buildRule(typeCode, ruleField, fieldValue, category, description, useMatches) {
  const value = String(fieldValue);
  const fieldVar = { var: `record.data.${ruleField}` };
  const rule = {
    when: {
      and: [
        { "==": [{ var: "record.meta_data.system_data.type_code" }, typeCode] },
        useMatches ? { matches: [value, fieldVar] } : { "==": [fieldVar, value] },
      ],
    },
    category,
  };

  if (description) {
    rule.description = description;
  }

  return rule;
}

async function handleRuleCommand(entry, typeCode, parsedLine, categoryMapping) {
  const { ruleField, category, description } = parsedLine;
  const fieldValue = entry?.data?.[ruleField];

  if (fieldValue === undefined || fieldValue === null || String(fieldValue).trim() === "") {
    console.log(`⚠ Поле data.${ruleField} отсутствует или пустое — правило не создано`);
    return false;
  }

  if (!typeCode) {
    console.log("⚠ У записи нет meta_data.system_data.type_code — правило не создано");
    return false;
  }

  const useMatches = isSelfMatchingRegex(String(fieldValue));

  if (!useMatches) {
    console.log(
      `⚠ Значение «${fieldValue}» не является валидным self-matching regex — используется точное сравнение (==) вместо matches`
    );
  }

  const rule = buildRule(typeCode, ruleField, fieldValue, category, description, useMatches);
  await saveRuleEntry(rule);
  categoryMapping.rules.push(rule);
  console.log(`Сохранено правило: ${JSON.stringify(rule)}\n`);
  return true;
}

async function resolveInputFile(inputArg) {
  if (inputArg) {
    return path.isAbsolute(inputArg)
      ? inputArg
      : path.join(PROJECT_ROOT, inputArg);
  }

  const items = await fs.readdir(DEFAULT_DIR, { withFileTypes: true });
  const jsonFiles = items
    .filter((item) => item.isFile() && item.name.endsWith(".json"))
    .map((item) => item.name)
    .sort((a, b) => a.localeCompare(b));

  if (jsonFiles.length === 0) {
    throw new Error("В папке sync/tochka не найдено JSON-файлов");
  }

  return path.join(DEFAULT_DIR, jsonFiles[jsonFiles.length - 1]);
}

async function validateAndGetPattern(rl, titleValue) {
  if (isSelfMatchingRegex(titleValue)) {
    return titleValue;
  }

  console.log(`⚠ Паттерн «${titleValue}» не матчится с title как regex.`);
  console.log("  Введите паттерн вручную (или Enter чтобы сохранить строку as-is):");
  const custom = (await rl.question("  > ")).trim();
  return custom || titleValue;
}

async function main() {
  const inputArg = process.argv[2];

  const inputPath = await resolveInputFile(inputArg);

  const raw = await fs.readFile(inputPath, "utf8");
  const parsed = JSON.parse(raw);

  if (!Array.isArray(parsed)) {
    throw new Error("Ожидался массив записей в JSON-файле");
  }

  const { ignoredMcc, ignoredTitleRegexes } = await loadExistingMappings();

  // Резолвнутый конфиг — только для решения «покрыта ли запись»; запись правок идёт в сырой JSON.
  const appConfig = loadConfig();
  const categoryMapping = appConfig.hmbee.categoryMapping;
  const accountRegistry = createAccountRegistry(appConfig);

  const rl = readline.createInterface({ input, output });

  try {
    console.log(`Файл: ${path.relative(PROJECT_ROOT, inputPath)}`);
    console.log(`Записываться будет в: config/sources.json`);
    console.log('Формат ввода: m(cc)|t(itle), "Название категории"[, Описание]');
    console.log('Правило (rule): r, <field>, "Название категории"[, Описание] — matches по полному значению record.data.<field> (или ==, если значение не валидный regex) с guard по type_code');
    console.log("Нажмите Enter для пропуска записи. Введите i(gnore)/im/it для игнорирования. Введите q для остановки.\n");

    for (let index = 0; index < parsed.length; index += 1) {
      const entry = parsed[index];
      const mccValue = entry?.data?.mcc ?? "";
      const titleValue = entry?.data?.title ?? "";
      const mccKey = String(mccValue ?? "");
      const titleKey = String(titleValue ?? "");
      const typeCode = entry?.meta_data?.system_data?.type_code ?? "";
      const eventDate = entry?.meta_data?.time_data?.event_date ?? "";
      const infoLine = `[${index + 1}/${parsed.length}] mcc: ${mccKey || "-"}, title: ${titleKey || "-"}, type_code: ${typeCode || "-"}, event_date: ${eventDate || "-"}`;

      const alreadyMapped =
        mapTochkaCategory(entry, getDescription(entry) ?? "", getMcc(entry), categoryMapping, accountRegistry) !== null;
      const ignored =
        (mccKey && ignoredMcc.has(mccKey)) ||
        (titleKey && ignoredTitleRegexes.some((rx) => rx.test(titleKey)));

      if (alreadyMapped || ignored) {
        console.log(infoLine);
        const reason = ignored
          ? "mcc или title в списке игнорирования"
          : "уже покрыто категорией (rules/title/mcc)";
        console.log(`Пропущено автоматически: ${reason}\n`);
        continue;
      }

      console.log(infoLine);

      while (true) {
        const answer = (await rl.question("> ")).trim();

        if (!answer) {
          console.log("Пропущено\n");
          break;
        }

        if (/^(q|quit|exit)$/i.test(answer)) {
          console.log("Остановка по команде пользователя");
          return;
        }

        if (/^(i|im|it)$/i.test(answer)) {
          const command = answer.toLowerCase();
          const hasMcc = Boolean(mccKey);
          const hasTitle = Boolean(titleKey);

          let ignoreField;
          if (command === "im") {
            ignoreField = "mcc";
          } else if (command === "it") {
            ignoreField = "title";
          } else {
            if (hasMcc && hasTitle) {
              console.log("Неверный ввод. Введите im или it");
              continue;
            }
            ignoreField = hasMcc ? "mcc" : "title";
          }

          const ignoreKey =
            ignoreField === "title"
              ? await validateAndGetPattern(rl, titleKey)
              : mccKey;

          await saveIgnoredEntry(ignoreField, ignoreKey);

          if (ignoreField === "mcc") {
            ignoredMcc.add(ignoreKey);
          } else {
            ignoredTitleRegexes.push(new RegExp(ignoreKey, "i"));
          }

          console.log(`Добавлено в ignore: ${ignoreField}="${ignoreKey}"\n`);
          break;
        }

        const parsedLine = parseInputLine(answer);

        if ("error" in parsedLine) {
          console.log(`Ошибка: ${parsedLine.error}`);
          console.log("Повторите ввод или нажмите Enter для пропуска.");
          continue;
        }

        if (parsedLine.mappingField === RULE_INPUT) {
          const created = await handleRuleCommand(entry, typeCode, parsedLine, categoryMapping);

          if (!created) {
            console.log("Повторите ввод или нажмите Enter для пропуска.");
            continue;
          }

          break;
        }

        let sourceKey =
          parsedLine.mappingField === MCC_INPUT ? mccKey : titleKey;

        if (parsedLine.mappingField === TITLE_INPUT) {
          sourceKey = await validateAndGetPattern(rl, titleKey);
        }

        const mappingEntry = { category: parsedLine.category };
        if (parsedLine.description) {
          mappingEntry.description = parsedLine.description;
        }

        const mappingKey = parsedLine.mappingField === MCC_INPUT ? "mcc" : "title";
        await saveMappingEntry(mappingKey, sourceKey, mappingEntry);

        if (parsedLine.mappingField === MCC_INPUT && sourceKey) {
          categoryMapping.mcc[sourceKey] = mappingEntry;
        }

        if (parsedLine.mappingField === TITLE_INPUT && sourceKey) {
          categoryMapping.title.push({ pattern: new RegExp(sourceKey, "i"), entry: mappingEntry });
        }

        const entryJson = JSON.stringify({ [mappingKey]: sourceKey, ...mappingEntry });
        console.log(`Сохранено: ${entryJson}\n`);
        break;
      }
    }

    console.log("Готово");
  } finally {
    rl.close();
  }
}

main().catch((error) => {
  console.error("Ошибка:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
