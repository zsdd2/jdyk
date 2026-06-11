import { createHash } from 'node:crypto';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

function requireValue(value, name) {
  if (!value) throw new Error(`Missing required argument: ${name}`);
  return value;
}

export function parseAndroidVersion(buildGradle) {
  const versionCode = Number(buildGradle.match(/\bversionCode\s+(\d+)/)?.[1]);
  const versionName = buildGradle.match(/\bversionName\s+['"]([^'"]+)['"]/)?.[1];
  if (!Number.isInteger(versionCode) || versionCode <= 0 || !versionName) {
    throw new Error('Unable to read versionCode/versionName from app/build.gradle');
  }
  return { versionCode, versionName };
}

export async function createUpdateManifest(options) {
  const apk = await readFile(options.apkPath);
  const buildGradle = await readFile(options.buildGradlePath, 'utf8');
  const { versionCode, versionName } = parseAndroidVersion(buildGradle);
  const apkStat = await stat(options.apkPath);
  const manifest = {
    apkUrl: requireValue(options.apkUrl, '--apk-url'),
    forceUpdate: options.forceUpdate === true,
    publishedAt: options.publishedAt || new Date().toISOString(),
    releaseNotes: options.releaseNotes || '',
    sha256: createHash('sha256').update(apk).digest('hex'),
    sizeBytes: apkStat.size,
    versionCode,
    versionName,
  };
  await writeFile(options.outputPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return manifest;
}

function parseArgs(argv) {
  const args = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    args.set(argv[index], argv[index + 1]);
  }
  return {
    apkPath: requireValue(args.get('--apk'), '--apk'),
    apkUrl: requireValue(args.get('--apk-url'), '--apk-url'),
    buildGradlePath: requireValue(args.get('--build-gradle'), '--build-gradle'),
    forceUpdate: args.get('--force-update') === 'true',
    outputPath: requireValue(args.get('--output'), '--output'),
    publishedAt: args.get('--published-at'),
    releaseNotes: args.get('--release-notes'),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  createUpdateManifest(parseArgs(process.argv.slice(2)))
    .then((manifest) => process.stdout.write(`${JSON.stringify(manifest)}\n`))
    .catch((error) => {
      process.stderr.write(`${error instanceof Error ? error.message : error}\n`);
      process.exitCode = 1;
    });
}
