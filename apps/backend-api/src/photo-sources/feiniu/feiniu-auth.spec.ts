import {
  constants,
  createDecipheriv,
  generateKeyPairSync,
  privateDecrypt,
} from 'crypto';
import {
  buildSortedQueryString,
  createEncryptedLoginPayload,
  generateFeiniuAuthX,
  normalizeFeiniuWebSocketUrl,
} from './feiniu-auth';

describe('feiniu auth', () => {
  it('generates authx with sorted GET params and the fnphoto-tv-main MD5 rule', () => {
    const query =
      'sort_direction=desc&offset=0&limit=35&album_id=123&ignored=undefined&sort_by=date_time';

    expect(buildSortedQueryString(query)).toBe(
      'album_id=123&limit=35&offset=0&sort_by=date_time&sort_direction=desc',
    );
    expect(
      generateFeiniuAuthX('/p/api/v1/album/photos', 'GET', query, {
        nonce: '123456',
        timestamp: '1700000000000',
      }),
    ).toBe(
      'nonce=123456&timestamp=1700000000000&sign=29b75e136652fc4a22280b28a172fb34',
    );
  });

  it('creates an encrypted websocket login payload compatible with the reference flow', () => {
    const { privateKey, publicKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
    });
    const aesKey = '0123456789abcdefghijklmnopqrstuv';
    const iv = Buffer.alloc(16, 7);

    const payload = createEncryptedLoginPayload({
      aesKey,
      deviceName: 'Android-TV-Box',
      deviceType: 'AndroidTV',
      iv,
      password: 'secret',
      publicKey: publicKey.export({ format: 'pem', type: 'spki' }).toString(),
      reqId: '65aa000000000000000000000001',
      si: '1234567890',
      username: 'alice',
    });
    const json = JSON.parse(payload);
    const decryptedAesKey = privateDecrypt(
      {
        key: privateKey,
        padding: constants.RSA_PKCS1_PADDING,
      },
      Buffer.from(json.rsa, 'base64'),
    ).toString('utf8');
    const decipher = createDecipheriv('aes-256-cbc', decryptedAesKey, iv);
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(json.aes, 'base64')),
      decipher.final(),
    ]).toString('utf8');

    expect(json.req).toBe('encrypted');
    expect(Buffer.from(json.iv, 'base64')).toEqual(iv);
    expect(JSON.parse(plaintext)).toMatchObject({
      deviceName: 'Android-TV-Box',
      deviceType: 'AndroidTV',
      password: 'secret',
      req: 'user.login',
      reqid: '65aa000000000000000000000001',
      si: '1234567890',
      stay: false,
      user: 'alice',
    });
  });

  it('normalizes Feiniu NAS URLs for the main websocket login channel', () => {
    expect(normalizeFeiniuWebSocketUrl('http://nas.local')).toBe(
      'ws://nas.local/websocket?type=main',
    );
    expect(normalizeFeiniuWebSocketUrl('https://nas.local/')).toBe(
      'wss://nas.local/websocket?type=main',
    );
    expect(normalizeFeiniuWebSocketUrl('nas.local')).toBe(
      'ws://nas.local/websocket?type=main',
    );
  });
});
