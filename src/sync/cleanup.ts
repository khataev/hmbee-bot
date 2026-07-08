import { existsSync, readdirSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { writeOutput } from 'src/output.js';

/**
 * Removes all *.json files in sync/<source>/ so that a subsequent write leaves exactly one.
 * Scoped strictly to the source's own subdirectory; never touches sync/hmbee/ (the cache dir).
 */
export function clearPreviousSyncFiles(source: string): void {
  const syncDir = path.join(process.cwd(), 'sync', source);
  if (!existsSync(syncDir)) return;

  for (const file of readdirSync(syncDir)) {
    if (file.endsWith('.json')) {
      unlinkSync(path.join(syncDir, file));
    }
  }
}

/**
 * Writes sync output, clearing any previous sync file first. In --stdout mode (outputPath
 * undefined) the sync/<source>/ directory is left untouched entirely.
 */
export function writeSyncOutput(source: string, data: unknown, outputPath: string | undefined): void {
  if (outputPath) {
    clearPreviousSyncFiles(source);
  }
  writeOutput(data, outputPath);
}
