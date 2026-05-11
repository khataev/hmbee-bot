import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export function writeOutput(data: unknown, path?: string) {
  const content = JSON.stringify(data, null, 2);
  if (path) {
    const dir = dirname(path);
    mkdirSync(dir, { recursive: true });
    writeFileSync(path, content);
    console.log(`Output written to ${path}`);
  } else {
    console.log(content);
  }
}
