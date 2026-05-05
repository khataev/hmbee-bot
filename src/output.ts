import { writeFileSync } from 'node:fs';

export function writeOutput(data: unknown, path?: string) {
  const content = JSON.stringify(data, null, 2);
  if (path) {
    writeFileSync(path, content);
    console.log(`Output written to ${path}`);
  } else {
    console.log(content);
  }
}
