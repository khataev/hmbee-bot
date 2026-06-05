#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const PROJECT_ROOT = process.cwd();
const DEFAULT_DIR = path.join(PROJECT_ROOT, "sync", "tochka");
const CONFIG_PATH = path.join(PROJECT_ROOT, "config", "sources.json");
const CONFIG_EXAMPLE_PATH = path.join(PROJECT_ROOT, "config", "sources.example.json");
const MCC_INPUT = "m";
const TITLE_INPUT = "t";

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
    return { error: 'Ожидается запятая: m|t, "Категория"' };
  }

  const mappingField = line.slice(0, firstComma).trim().toLowerCase();
  const rest = line.slice(firstComma + 1);

  if (mappingField !== MCC_INPUT && mappingField !== TITLE_INPUT) {
    return { error: `Первое значение должно быть ${MCC_INPUT} или ${TITLE_INPUT}` };
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
    config.hmbee.categoryMapping = { mcc: {}, title: {} };
  }
  if (!config.hmbee.categoryMapping.mcc) config.hmbee.categoryMapping.mcc = {};
  if (!config.hmbee.categoryMapping.title) config.hmbee.categoryMapping.title = {};
  return config.hmbee.categoryMapping;
}

async function loadExistingMappings() {
  const config = await loadJsonFile(CONFIG_PATH);
  const mapping = getCategoryMapping(config);
  return {
    existingMcc: new Set(Object.keys(mapping.mcc)),
    existingTitle: new Set(Object.keys(mapping.title)),
  };
}

async function saveMappingEntry(mappingField, key, entry) {
  for (const filePath of [CONFIG_PATH, CONFIG_EXAMPLE_PATH]) {
    const config = await loadJsonFile(filePath);
    const mapping = getCategoryMapping(config);
    mapping[mappingField][key] = entry;
    await saveJsonFile(filePath, config);
  }
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
  let selfMatches = false;
  try {
    selfMatches = new RegExp(titleValue, "i").test(titleValue);
  } catch {
    selfMatches = false;
  }

  if (selfMatches) {
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

  const { existingMcc, existingTitle } = await loadExistingMappings();

  const rl = readline.createInterface({ input, output });

  try {
    console.log(`Файл: ${path.relative(PROJECT_ROOT, inputPath)}`);
    console.log(`Записываться будет в: config/sources.json и config/sources.example.json`);
    console.log('Формат ввода: m(cc)|t(itle), "Название категории"[, Описание]');
    console.log("Нажмите Enter для пропуска записи. Введите q для остановки.\n");

    for (let index = 0; index < parsed.length; index += 1) {
      const entry = parsed[index];
      const mccValue = entry?.data?.mcc ?? "";
      const titleValue = entry?.data?.title ?? "";
      const mccKey = String(mccValue ?? "");
      const titleKey = String(titleValue ?? "");

      if ((mccKey && existingMcc.has(mccKey)) || (titleKey && existingTitle.has(titleKey))) {
        console.log(
          `[${index + 1}/${parsed.length}] mcc: ${mccKey || "-"}, title: ${titleKey || "-"}`,
        );
        console.log("Пропущено автоматически: mcc или title уже есть в маппинге\n");
        continue;
      }

      console.log(`[${index + 1}/${parsed.length}] mcc: ${mccKey || "-"}, title: ${titleKey || "-"}`);

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

        const parsedLine = parseInputLine(answer);

        if ("error" in parsedLine) {
          console.log(`Ошибка: ${parsedLine.error}`);
          console.log("Повторите ввод или нажмите Enter для пропуска.");
          continue;
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
          existingMcc.add(sourceKey);
        }

        if (parsedLine.mappingField === TITLE_INPUT && sourceKey) {
          existingTitle.add(sourceKey);
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
