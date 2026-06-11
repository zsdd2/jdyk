import {
  constants,
  createCipheriv,
  createHash,
  publicEncrypt,
  randomBytes,
  randomInt,
} from 'crypto';

const defaultApiKey = 'NDzZTVxnRKP8Z0jXg1VAMonaG8akvh';
const defaultApiSecret = 'EAECCF25-80A6-4666-A7C2-A76904A74AB6';

export interface FeiniuAuthXOptions {
  apiKey?: string;
  apiSecret?: string;
  nonce?: string;
  timestamp?: string;
}

export interface FeiniuSession {
  backId?: string;
  secret?: string;
  token: string;
}

export interface FeiniuLoginInput {
  deviceName?: string;
  deviceType?: string;
  password: string;
  url: string;
  username: string;
}

export interface EncryptedLoginPayloadInput {
  aesKey?: string;
  deviceName?: string;
  deviceType?: string;
  iv?: Buffer;
  password: string;
  publicKey: string;
  reqId?: string;
  si: string;
  username: string;
}

interface WebSocketLike {
  close(): void;
  send(data: string): void;
}

interface WebSocketConstructorLike {
  new (url: string): WebSocketLike;
}

export function generateFeiniuAuthX(
  path: string,
  method: string,
  data?: string | null,
  options: FeiniuAuthXOptions = {},
): string {
  const nonce = options.nonce ?? generateNonce();
  const timestamp = options.timestamp ?? String(Date.now());
  const body = data ?? '';
  const payloadHash =
    method.toUpperCase() === 'GET'
      ? md5(data == null ? '' : buildSortedQueryString(body))
      : md5(body);
  const signPayload = [
    options.apiKey ?? defaultApiKey,
    path,
    nonce,
    timestamp,
    payloadHash,
    options.apiSecret ?? defaultApiSecret,
  ].join('_');
  const sign = md5(signPayload);

  return `nonce=${nonce}&timestamp=${timestamp}&sign=${sign}`;
}

export function buildSortedQueryString(query: string): string {
  if (!query.trim()) return '';

  return query
    .split('&')
    .map((pair) => {
      const equalsIndex = pair.indexOf('=');
      if (equalsIndex <= 0) return null;
      return {
        key: pair.slice(0, equalsIndex),
        value: pair.slice(equalsIndex + 1),
      };
    })
    .filter((pair): pair is { key: string; value: string } =>
      Boolean(
        pair &&
          pair.value !== 'null' &&
          pair.value !== 'undefined',
      ),
    )
    .sort((left, right) => left.key.localeCompare(right.key))
    .map((pair) => `${pair.key}=${pair.value}`)
    .join('&');
}

export function normalizeFeiniuBaseUrl(url: string): string {
  const trimmed = url.trim().replace(/\/+$/, '');
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  return `http://${trimmed}`;
}

export function normalizeFeiniuWebSocketUrl(url: string): string {
  const baseUrl = normalizeFeiniuBaseUrl(url);
  const websocketBase = baseUrl
    .replace(/^http:\/\//, 'ws://')
    .replace(/^https:\/\//, 'wss://');
  return `${websocketBase}/websocket?type=main`;
}

export function createEncryptedLoginPayload(
  input: EncryptedLoginPayloadInput,
): string {
  const aesKey = input.aesKey ?? generateRandomString(32);
  const iv = input.iv ?? randomBytes(16);
  if (aesKey.length !== 32) {
    throw new Error(`Feiniu AES key must be 32 characters, got ${aesKey.length}`);
  }

  const rawLogin = {
    deviceName: input.deviceName ?? 'Android-TV-Box',
    deviceType: input.deviceType ?? 'AndroidTV',
    password: input.password,
    req: 'user.login',
    reqid: input.reqId ?? generateReqId(),
    si: input.si,
    stay: false,
    user: input.username,
  };
  const cipher = createCipheriv('aes-256-cbc', Buffer.from(aesKey, 'utf8'), iv);
  const aes = Buffer.concat([
    cipher.update(JSON.stringify(rawLogin), 'utf8'),
    cipher.final(),
  ]).toString('base64');
  const rsa = publicEncrypt(
    {
      key: input.publicKey,
      padding: constants.RSA_PKCS1_PADDING,
    },
    Buffer.from(aesKey, 'utf8'),
  ).toString('base64');

  return JSON.stringify({
    aes,
    iv: iv.toString('base64'),
    req: 'encrypted',
    rsa,
  });
}

export function loginToFeiniu(input: FeiniuLoginInput): Promise<FeiniuSession> {
  const WebSocketCtor = (globalThis as { WebSocket?: WebSocketConstructorLike }).WebSocket;
  if (!WebSocketCtor) {
    return Promise.reject(new Error('WebSocket is not available in this Node runtime'));
  }

  return new Promise((resolve, reject) => {
    const socket = new WebSocketCtor(normalizeFeiniuWebSocketUrl(input.url));
    let settled = false;
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      socket.close();
      reject(error);
    };
    const succeed = (session: FeiniuSession) => {
      if (settled) return;
      settled = true;
      socket.close();
      resolve(session);
    };

    (socket as unknown as {
      onclose?: () => void;
      onerror?: (event: { error?: Error; message?: string }) => void;
      onmessage?: (event: { data: unknown }) => void;
      onopen?: () => void;
    }).onopen = () => {
      socket.send(
        JSON.stringify({
          req: 'util.crypto.getRSAPub',
          reqid: generateReqId(),
        }),
      );
    };
    (socket as unknown as {
      onmessage?: (event: { data: unknown }) => void;
    }).onmessage = (event) => {
      try {
        const json = JSON.parse(String(event.data));
        if (json.res === 'pong') return;
        if (json.pub) {
          socket.send(
            createEncryptedLoginPayload({
              deviceName: input.deviceName,
              deviceType: input.deviceType,
              password: input.password,
              publicKey: json.pub,
              si: String(json.si),
              username: input.username,
            }),
          );
          return;
        }
        if (json.result === 'succ' && json.token) {
          succeed({
            backId: json.backId,
            secret: json.secret,
            token: json.token,
          });
          return;
        }
        if (json.errno != null) {
          fail(new Error(`Feiniu login failed: ${json.errno} ${json.result ?? ''}`.trim()));
        }
      } catch (error) {
        fail(error instanceof Error ? error : new Error(String(error)));
      }
    };
    (socket as unknown as {
      onerror?: (event: { error?: Error; message?: string }) => void;
    }).onerror = (event) => {
      fail(event.error ?? new Error(event.message ?? 'Feiniu websocket error'));
    };
    (socket as unknown as { onclose?: () => void }).onclose = () => {
      if (!settled) fail(new Error('Feiniu websocket closed before login completed'));
    };
  });
}

function generateNonce(): string {
  return String(randomInt(100_000, 1_000_000));
}

function generateReqId(): string {
  const seconds = Math.floor(Date.now() / 1000).toString(16).padStart(8, '0');
  const suffix = randomInt(1, 65_536).toString(16).padStart(4, '0');
  return `${seconds}0000000000000000${suffix}`;
}

function generateRandomString(length: number): string {
  const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let result = '';
  for (let index = 0; index < length; index += 1) {
    result += chars[randomInt(chars.length)];
  }
  return result;
}

function md5(input: string): string {
  return createHash('md5').update(input, 'utf8').digest('hex');
}
