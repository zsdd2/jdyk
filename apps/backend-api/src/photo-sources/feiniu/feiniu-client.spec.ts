import { FeiniuClient } from './feiniu-client';

describe('FeiniuClient', () => {
  it('calls Feiniu album APIs with accesstoken and authx headers', async () => {
    const fetchCalls: Array<{ headers: Headers; url: string }> = [];
    const fetchMock = jest.fn(async (url: string, init?: RequestInit) => {
      fetchCalls.push({
        headers: init?.headers as Headers,
        url,
      });
      return jsonResponse({
        code: 0,
        data: {
          list: [
            {
              albumId: 12,
              albumName: '飞牛相册',
              photoCount: 2,
            },
          ],
        },
      });
    });

    const client = new FeiniuClient(
      {
        baseUrl: 'nas.local',
        password: 'secret',
        username: 'alice',
      },
      {
        fetch: fetchMock,
        login: async () => ({
          secret: 'session-secret',
          token: 'session-token',
        }),
      },
    );

    const albums = await client.listAlbums();

    expect(albums).toHaveLength(1);
    expect(fetchCalls[0]?.url).toBe(
      'http://nas.local/p/api/v1/album/list?sort_direction=desc&sort_by=date_time&offset=0&limit=50',
    );
    expect(fetchCalls[0]?.headers.get('accesstoken')).toBe('session-token');
    expect(fetchCalls[0]?.headers.get('authx')).toMatch(
      /^nonce=\d{6}&timestamp=\d+&sign=[a-f0-9]{32}$/,
    );
  });

  it('re-logins once and retries when Feiniu returns 401', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 401 }))
      .mockResolvedValueOnce(
        jsonResponse({
          code: 0,
          data: {
            list: [],
          },
        }),
      );
    const loginMock = jest
      .fn()
      .mockResolvedValueOnce({ token: 'first-token' })
      .mockResolvedValueOnce({ token: 'second-token' });
    const client = new FeiniuClient(
      {
        baseUrl: 'http://nas.local',
        password: 'secret',
        username: 'alice',
      },
      {
        fetch: fetchMock,
        login: loginMock,
      },
    );

    await expect(client.listAlbums()).resolves.toEqual([]);

    expect(loginMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect((fetchMock.mock.calls[1][1]?.headers as Headers).get('accesstoken')).toBe(
      'second-token',
    );
  });

  it('loads shared albums with the same auth headers and normalizes flexible data shapes', async () => {
    const fetchCalls: string[] = [];
    const fetchMock = jest
      .fn(async (url: string) => {
        fetchCalls.push(url);
        if (url.includes('/album_grant/list_to_me')) {
          return jsonResponse({
            code: 0,
            data: {
              list: [
                {
                  albumId: 47,
                  albumName: '共享给我',
                  ownerName: 'zsdd',
                  photoCount: 4,
                },
              ],
            },
          });
        }

        return jsonResponse({
          code: 0,
          data: [
            {
              albumId: 48,
              albumName: '我共享的',
              photoCount: 5,
            },
          ],
        });
      });
    const client = new FeiniuClient(
      {
        baseUrl: 'http://nas.local',
        password: 'secret',
        username: 'alice',
      },
      {
        fetch: fetchMock,
        login: async () => ({ token: 'session-token' }),
      },
    );

    const sharedToMe = await client.listSharedAlbumsToMe();
    const sharedByMe = await client.listSharedAlbumsMine();

    expect(fetchCalls).toEqual([
      'http://nas.local/p/api/v1/album_grant/list_to_me?offset=0&limit=1000&sort_by=share_mod_time&sort_direction=desc',
      'http://nas.local/p/api/v1/album_grant/list_mine?offset=0&limit=1000&sort_by=share_mod_time&sort_direction=desc',
    ]);
    expect(sharedToMe).toEqual([
      expect.objectContaining({
        albumId: 47,
        albumName: '共享给我',
        sourceKind: 'shared_to_me',
      }),
    ]);
    expect(sharedByMe).toEqual([
      expect.objectContaining({
        albumId: 48,
        albumName: '我共享的',
        sourceKind: 'shared_by_me',
      }),
    ]);
  });

  it('fetches media streams with Feiniu auth headers', async () => {
    const fetchCalls: Array<{ headers: Headers; url: string }> = [];
    const fetchMock = jest.fn(async (url: string, init?: RequestInit) => {
      fetchCalls.push({
        headers: init?.headers as Headers,
        url,
      });
      return new Response('image-bytes', {
        headers: {
          'content-type': 'image/jpeg',
        },
        status: 200,
      });
    });
    const client = new FeiniuClient(
      {
        baseUrl: 'http://nas.local',
        password: 'secret',
        username: 'alice',
      },
      {
        fetch: fetchMock,
        login: async () => ({ token: 'session-token' }),
      },
    );

    const asset = await client.fetchMedia('/p/api/v1/stream/p/t/41001/m/photo-uuid');

    expect(fetchCalls[0]?.url).toBe(
      'http://nas.local/p/api/v1/stream/p/t/41001/m/photo-uuid',
    );
    expect(fetchCalls[0]?.headers.get('accesstoken')).toBe('session-token');
    expect(fetchCalls[0]?.headers.get('authx')).toMatch(
      /^nonce=\d{6}&timestamp=\d+&sign=[a-f0-9]{32}$/,
    );
    expect(asset).toMatchObject({
      contentType: 'image/jpeg',
      filename: 'photo-uuid',
      kind: 'remote',
    });
  });
});

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: {
      'content-type': 'application/json',
    },
    status: 200,
  });
}
