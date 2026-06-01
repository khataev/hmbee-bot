import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Loads a JSON fixture from the preview fixtures directory.
 */
export function loadFixture(fileName: string): unknown {
  const filePath = resolve(process.cwd(), 'src', 'apply', 'preview', 'fixtures', fileName);
  if (!existsSync(filePath)) {
    throw new Error(`Fixture not found: ${filePath}`);
  }
  const fileContents = readFileSync(filePath, 'utf8');
  return JSON.parse(fileContents) as unknown;
}
