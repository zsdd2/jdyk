import { FeiniuClient } from './feiniu-client';
import type { FeiniuAlbum, FeiniuClientConfig } from './feiniu-client';

export interface FeiniuRuntimeConfig {
  baseUrl?: string;
  enabled: boolean;
  missingFields: string[];
  passwordConfigured: boolean;
  sourceMode: string;
  username?: string;
}

export interface FeiniuConnectivityInput {
  baseUrl?: string;
  password?: string;
  useConfiguredPassword?: boolean;
  username?: string;
}

export interface FeiniuConnectivityResult {
  albumCount?: number;
  baseUrl?: string;
  checkedAt: string;
  error?: string;
  missingFields?: string[];
  ok: boolean;
  sharedByMeCount?: number;
  sharedToMeCount?: number;
  totalAlbumCount?: number;
  username?: string;
}

interface FeiniuConnectivityClient {
  listAlbums(): Promise<FeiniuAlbum[]>;
  listSharedAlbumsMine(): Promise<FeiniuAlbum[]>;
  listSharedAlbumsToMe(): Promise<FeiniuAlbum[]>;
}

interface FeiniuConnectivityDependencies {
  createClient?: (config: FeiniuClientConfig) => FeiniuConnectivityClient;
}

export function getFeiniuRuntimeConfig(
  env: Record<string, string | undefined> = process.env,
): FeiniuRuntimeConfig {
  const baseUrl = env.WRJDYK_FEINIU_BASE_URL?.trim();
  const username = env.WRJDYK_FEINIU_USERNAME?.trim();
  const passwordConfigured = Boolean(env.WRJDYK_FEINIU_PASSWORD?.trim());
  const missingFields = missingFeiniuFields({
    baseUrl,
    password: passwordConfigured ? 'configured' : '',
    username,
  });

  return {
    baseUrl: baseUrl || undefined,
    enabled: missingFields.length === 0,
    missingFields,
    passwordConfigured,
    sourceMode: env.WRJDYK_PHOTO_SOURCE?.trim() || 'sqlite',
    username: username || undefined,
  };
}

export async function testFeiniuConnectivity(
  input: FeiniuConnectivityInput = {},
  env: Record<string, string | undefined> = process.env,
  dependencies: FeiniuConnectivityDependencies = {},
): Promise<FeiniuConnectivityResult> {
  const inputHasBaseUrl = Object.prototype.hasOwnProperty.call(input, 'baseUrl');
  const inputHasUsername = Object.prototype.hasOwnProperty.call(input, 'username');
  const baseUrl = inputHasBaseUrl
    ? input.baseUrl?.trim()
    : env.WRJDYK_FEINIU_BASE_URL?.trim();
  const username = inputHasUsername
    ? input.username?.trim()
    : env.WRJDYK_FEINIU_USERNAME?.trim();
  const password = resolveConnectivityPassword(input, env);
  const checkedAt = new Date().toISOString();
  const missingFields = missingFeiniuFields({ baseUrl, password, username });

  if (missingFields.length > 0) {
    return {
      baseUrl: baseUrl || undefined,
      checkedAt,
      missingFields,
      ok: false,
      username: username || undefined,
    };
  }

  try {
    const client = (dependencies.createClient ?? createDefaultFeiniuClient)({
      baseUrl: baseUrl!,
      password: password!,
      username: username!,
    });
    const [ownedAlbums, sharedToMeAlbums, sharedByMeAlbums] = await Promise.all([
      client.listAlbums(),
      client.listSharedAlbumsToMe(),
      client.listSharedAlbumsMine(),
    ]);

    return {
      albumCount: ownedAlbums.length,
      baseUrl,
      checkedAt,
      ok: true,
      sharedByMeCount: sharedByMeAlbums.length,
      sharedToMeCount: sharedToMeAlbums.length,
      totalAlbumCount:
        ownedAlbums.length + sharedToMeAlbums.length + sharedByMeAlbums.length,
      username,
    };
  } catch (error) {
    return {
      baseUrl,
      checkedAt,
      error: error instanceof Error ? error.message : String(error),
      ok: false,
      username,
    };
  }
}

function createDefaultFeiniuClient(
  config: FeiniuClientConfig,
): FeiniuConnectivityClient {
  return new FeiniuClient(config);
}

function resolveConnectivityPassword(
  input: FeiniuConnectivityInput,
  env: Record<string, string | undefined>,
): string | undefined {
  const explicitPassword = input.password?.trim();
  if (explicitPassword) return explicitPassword;
  if (input.useConfiguredPassword === false) return undefined;
  return env.WRJDYK_FEINIU_PASSWORD?.trim();
}

function missingFeiniuFields(config: {
  baseUrl?: string;
  password?: string;
  username?: string;
}): string[] {
  const fields: Array<[string, string | undefined]> = [
    ['baseUrl', config.baseUrl],
    ['username', config.username],
    ['password', config.password],
  ];

  return fields.filter(([, value]) => !value).map(([field]) => field);
}
