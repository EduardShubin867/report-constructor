import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export function createTempDir(prefix = 'constructor-tests-'): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

export function createTempDbPath(prefix = 'constructor-db-'): string {
  const dir = createTempDir(prefix);
  return path.join(dir, 'db.sqlite');
}
