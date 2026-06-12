import {
  getFeiniuRuntimeConfig,
  testFeiniuConnectivity,
} from './feiniu-config';

describe('feiniu config', () => {
  it('returns safe runtime config without exposing the password', () => {
    expect(
      getFeiniuRuntimeConfig({
        WRJDYK_FEINIU_BASE_URL: 'http://nas.local',
        WRJDYK_FEINIU_PASSWORD: 'secret',
        WRJDYK_FEINIU_USERNAME: 'alice',
        WRJDYK_PHOTO_SOURCE: 'feiniu',
      }),
    ).toEqual({
      baseUrl: 'http://nas.local',
      enabled: true,
      missingFields: [],
      passwordConfigured: true,
      sourceMode: 'feiniu',
      username: 'alice',
    });
  });

  it('tests connectivity and summarizes owned and shared albums', async () => {
    const result = await testFeiniuConnectivity(
      {
        baseUrl: 'http://nas.local',
        password: 'secret',
        username: 'alice',
      },
      {},
      {
        createClient: () => ({
          listAlbums: async () => [{ albumId: 1 }],
          listSharedAlbumsMine: async () => [{ albumId: 2 }],
          listSharedAlbumsToMe: async () => [{ albumId: 3 }, { albumId: 4 }],
        }),
      },
    );

    expect(result).toMatchObject({
      albumCount: 1,
      baseUrl: 'http://nas.local',
      ok: true,
      sharedByMeCount: 1,
      sharedToMeCount: 2,
      totalAlbumCount: 4,
      username: 'alice',
    });
  });

  it('returns a clear missing-config result without trying to login', async () => {
    const result = await testFeiniuConnectivity({}, {});

    expect(result).toMatchObject({
      missingFields: ['baseUrl', 'username', 'password'],
      ok: false,
    });
  });

  it('does not fall back to runtime Feiniu values when the test form is blank', async () => {
    const result = await testFeiniuConnectivity(
      {
        baseUrl: '',
        password: '',
        useConfiguredPassword: false,
        username: '',
      },
      {
        WRJDYK_FEINIU_BASE_URL: 'http://nas.local',
        WRJDYK_FEINIU_PASSWORD: 'secret',
        WRJDYK_FEINIU_USERNAME: 'alice',
      },
    );

    expect(result).toMatchObject({
      missingFields: ['baseUrl', 'username', 'password'],
      ok: false,
    });
  });
});
