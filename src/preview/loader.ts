import fs from 'node:fs';
import path from 'node:path';
import type { TochkaSyncRecord } from './tochka.js';

/**
 * Loads all JSON files from the sync directory for a given source.
 * Expects files to be at sync/<source>/*.json
 */
export function loadSyncFiles(source: string): TochkaSyncRecord[] {
  const syncDir = path.join(process.cwd(), 'sync', source);

  if (!fs.existsSync(syncDir)) {
    throw new Error(`Sync directory not found: ${syncDir}. Run 'sync' command first.`);
  }

  const files = fs.readdirSync(syncDir).filter((file) => file.endsWith('.json'));

  if (files.length === 0) {
    throw new Error(`No synchronized files found in ${syncDir}`);
  }

  if (files.length > 1) {
    throw new Error(`Multiple synchronized files found in ${syncDir}. Preview currently supports exactly one file.`);
  }

  const file = files[0];
  if (!file) {
    throw new Error(`Critical error: sync file was not found in ${syncDir}`);
  }
  const filePath = path.join(syncDir, file);
  const content = fs.readFileSync(filePath, 'utf-8');

  try {
    const data = JSON.parse(content);
    // Adapted format is already a flat array of records
    if (Array.isArray(data)) {
      return data;
    }

    throw new Error(`Unsupported file format in ${file}. Expected adapted format (flat array).`);
  } catch (error) {
    throw new Error(`Failed to process ${file}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
