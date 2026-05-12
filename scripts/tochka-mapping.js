#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const PROJECT_ROOT = process.cwd();
const DEFAULT_DIR = path.join(PROJECT_ROOT, "sync", "tochka");
const DEFAULT_OUT = path.join(PROJECT_ROOT, "tochka_mapping.txt");
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
  const commaIndex = line.indexOf(",");

  if (commaIndex === -1) {
    return { error: "Ожидается запятая: m|t, \"Категория\"" };
  }

  const mappingField = line.slice(0, commaIndex).trim().toLowerCase();
  const categoryPart = line.slice(commaIndex + 1);
  const category = normalizeCategory(categoryPart);

  if (mappingField !== MCC_INPUT && mappingField !== TITLE_INPUT) {
    return { error: `Первое значение должно быть ${MCC_INPUT} или ${TITLE_INPUT}` };
  }

  if (!category) {
    return { error: "Название категории не должно быть пустым" };
  }

  return {
    mappingField,
    category,
  };
}

async function loadExistingMappings(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const lines = raw.split(/\r?\n/);
    const existingMcc = new Set();
    const existingTitle = new Set();

    for (const line of lines) {
      const trimmed = line.trim();

      if (!trimmed) {
        continue;
      }

      let parsedLine;

      try {
        parsedLine = JSON.parse(trimmed);
      } catch {
        continue;
      }

      if (!parsedLine || typeof parsedLine !== "object") {
        continue;
      }

      if (typeof parsedLine.mcc === "string" && parsedLine.mcc) {
        existingMcc.add(parsedLine.mcc);
      }

      if (typeof parsedLine.title === "string" && parsedLine.title) {
        existingTitle.add(parsedLine.title);
      }
    }

    return { existingMcc, existingTitle };
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return {
        existingMcc: new Set(),
        existingTitle: new Set(),
      };
    }

    throw error;
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

async function main() {
  const inputArg = process.argv[2];
  const outputArg = process.argv[3];

  const inputPath = await resolveInputFile(inputArg);
  const outputPath = outputArg
    ? path.isAbsolute(outputArg)
      ? outputArg
      : path.join(PROJECT_ROOT, outputArg)
    : DEFAULT_OUT;

  const raw = await fs.readFile(inputPath, "utf8");
  const parsed = JSON.parse(raw);

  if (!Array.isArray(parsed)) {
    throw new Error("Ожидался массив записей в JSON-файле");
  }

  const { existingMcc, existingTitle } = await loadExistingMappings(outputPath);

  const rl = readline.createInterface({ input, output });

  try {
    console.log(`Файл: ${path.relative(PROJECT_ROOT, inputPath)}`);
    console.log(`Записываться будет в: ${path.relative(PROJECT_ROOT, outputPath)}`);
    console.log("Формат ввода: m(cc)|t(itle), \"Название категории\"");
    console.log("Формат записи: {\"mcc\":\"...\",\"category\":\"...\"} или {\"title\":\"...\",\"category\":\"...\"}");
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
        console.log("Пропущено автоматически: mcc или title уже есть в файле маппинга\n");
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

        const sourceValue =
          parsedLine.mappingField === MCC_INPUT
            ? mccKey
            : titleKey;

        const outObject =
          parsedLine.mappingField === MCC_INPUT
            ? { mcc: sourceValue, category: parsedLine.category }
            : { title: sourceValue, category: parsedLine.category };
        const outLine = `${JSON.stringify(outObject)}\n`;
        await fs.appendFile(outputPath, outLine, "utf8");

        if (parsedLine.mappingField === MCC_INPUT && sourceValue) {
          existingMcc.add(sourceValue);
        }

        if (parsedLine.mappingField === TITLE_INPUT && sourceValue) {
          existingTitle.add(sourceValue);
        }

        console.log(`Сохранено: ${outLine.trim()}\n`);
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
