import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { loadRuntimeEnv } from './runtime-env';

describe('loadRuntimeEnv', () => {
  const tempRoots: string[] = [];

  afterEach(() => {
    for (const root of tempRoots.splice(0)) {
      if (existsSync(root)) rmSync(root, { force: true, recursive: true });
    }
  });

  it('loads .env.feiniu.local from an ancestor directory without overriding existing env', () => {
    const root = mkdtempSync(join(tmpdir(), 'wrjdyk-env-'));
    tempRoots.push(root);
    const appDir = join(root, 'apps', 'backend-api');
    mkdirSync(appDir, { recursive: true });
    writeFileSync(
      join(root, '.env.feiniu.local'),
      [
        'WRJDYK_PHOTO_SOURCE=feiniu',
        'WRJDYK_FEINIU_BASE_URL=http://nas.local:60000/',
        'WRJDYK_FEINIU_USERNAME=alice',
        'WRJDYK_FEINIU_PASSWORD=from-file',
      ].join('\n'),
      'utf8',
    );

    const env: Record<string, string | undefined> = {
      WRJDYK_FEINIU_PASSWORD: 'from-process',
    };

    const loadedFiles = loadRuntimeEnv({ cwd: appDir, env });

    expect(loadedFiles).toEqual([join(root, '.env.feiniu.local')]);
    expect(env).toMatchObject({
      WRJDYK_FEINIU_BASE_URL: 'http://nas.local:60000/',
      WRJDYK_FEINIU_PASSWORD: 'from-process',
      WRJDYK_FEINIU_USERNAME: 'alice',
      WRJDYK_PHOTO_SOURCE: 'feiniu',
    });
  });
});
