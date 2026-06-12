import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

import { createUpdateManifest, parseAndroidVersion } from './generate-update-manifest.mjs';

test('parses Android version metadata', () => {
  assert.deepEqual(parseAndroidVersion("versionCode 7\nversionName '1.2.3'"), {
    versionCode: 7,
    versionName: '1.2.3',
  });
});

test('Android TV release metadata is version 1.0.1', async () => {
  const buildGradle = await readFile(
    resolve('apps/android-tv/app/build.gradle'),
    'utf8',
  );

  assert.deepEqual(parseAndroidVersion(buildGradle), {
    versionCode: 6,
    versionName: '1.0.1',
  });
});

test('writes an update manifest with APK integrity metadata', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'wrjdyk-update-'));
  const apkPath = join(directory, 'app.apk');
  const buildGradlePath = join(directory, 'build.gradle');
  const outputPath = join(directory, 'latest.json');
  await writeFile(apkPath, 'signed-apk-content');
  await writeFile(buildGradlePath, "versionCode 9\nversionName '2.0.1'\n");

  const manifest = await createUpdateManifest({
    apkPath,
    apkUrl: 'https://example.test/wangri-tv-2.0.1.apk',
    buildGradlePath,
    forceUpdate: true,
    outputPath,
    publishedAt: '2026-06-12T00:00:00.000Z',
    releaseNotes: 'TV update',
  });

  assert.equal(manifest.versionCode, 9);
  assert.equal(manifest.versionName, '2.0.1');
  assert.equal(manifest.forceUpdate, true);
  assert.equal(manifest.sizeBytes, 18);
  assert.match(manifest.sha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(JSON.parse(await readFile(outputPath, 'utf8')), manifest);
});
