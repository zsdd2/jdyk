import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const defaultRuntimeEnvFiles = ['.env', '.env.local', '.env.feiniu.local'];

interface LoadRuntimeEnvOptions {
  cwd?: string;
  env?: Record<string, string | undefined>;
  fileNames?: string[];
  override?: boolean;
}

export function loadRuntimeEnv(options: LoadRuntimeEnvOptions = {}): string[] {
  const env = options.env ?? process.env;
  const fileNames = options.fileNames ?? defaultRuntimeEnvFiles;
  const loadedFiles: string[] = [];

  for (const filePath of findRuntimeEnvFiles(options.cwd ?? process.cwd(), fileNames)) {
    const parsed = parseRuntimeEnvFile(filePath);
    let applied = false;

    for (const [key, value] of Object.entries(parsed)) {
      if (!options.override && env[key]) continue;
      env[key] = value;
      applied = true;
    }

    if (applied) loadedFiles.push(filePath);
  }

  return loadedFiles;
}

function findRuntimeEnvFiles(cwd: string, fileNames: string[]): string[] {
  const files: string[] = [];
  let currentDir = resolve(cwd);

  while (true) {
    for (const fileName of fileNames) {
      const filePath = join(currentDir, fileName);
      if (existsSync(filePath)) files.push(filePath);
    }

    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) return files;
    currentDir = parentDir;
  }
}

function parseRuntimeEnvFile(filePath: string): Record<string, string> {
  const values: Record<string, string> = {};

  for (const rawLine of readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const normalizedLine = line.startsWith('export ') ? line.slice(7).trim() : line;
    const separatorIndex = normalizedLine.indexOf('=');
    if (separatorIndex <= 0) continue;

    const key = normalizedLine.slice(0, separatorIndex).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;

    values[key] = normalizeRuntimeEnvValue(
      normalizedLine.slice(separatorIndex + 1).trim(),
    );
  }

  return values;
}

function normalizeRuntimeEnvValue(value: string): string {
  if (value.length < 2) return value;
  const quote = value[0];
  if ((quote !== '"' && quote !== "'") || value[value.length - 1] !== quote) {
    return value;
  }
  return value.slice(1, -1);
}
