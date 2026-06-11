import { FeiniuSource } from './feiniu-source';
import type { FeiniuClient } from './feiniu-client';

describe('FeiniuSource', () => {
  it('maps Feiniu albums and photos to the TV album and playlist contract', async () => {
    const client = {
      listAlbumPhotos: jest.fn(async () => [
        {
          additional: {
            thumbnail: {
              mUrl: '/p/api/v1/stream/p/t/31970/m/photo-uuid',
              originalUrl: '/p/api/v1/stream/p/t/31970/o/photo-uuid',
              sUrl: '/p/api/v1/stream/p/t/31970/s/photo-uuid',
            },
          },
          category: 'photo',
          description: '照片说明',
          fileName: 'IMG_20260130_174504.jpg',
          geo: '杭州',
          id: 31970,
          photoDateTime: '2026:01:30 17:45:04',
        },
        {
          category: 'video',
          fileName: 'clip.mp4',
          id: 31971,
        },
      ]),
      listAlbums: jest.fn(async () => [
        {
          albumId: 12,
          albumName: '飞牛相册',
          endDateTime: '2026:01:30 17:45:04',
          photoCount: 1,
          posterImgUrl: '/p/api/v1/stream/p/t/31970/m/photo-uuid',
        },
      ]),
      fetchMedia: jest.fn(async () => ({
        contentType: 'image/jpeg',
        filename: 'photo-uuid',
        kind: 'remote',
        stream: {},
      })),
      resolveMediaUrl: (path: string) => `http://nas.local${path}`,
    } as unknown as FeiniuClient;
    const source = new FeiniuSource(client);

    const albums = await source.listAlbums();
    const detail = await source.getAlbum('feiniu-12');
    const asset = await source.getPhotoAsset('feiniu-31970', 'display');

    expect(albums[0]).toMatchObject({
      albumId: 'feiniu-12',
      coverImageUrl: '/api/photos/feiniu-12-cover/display',
      photoCount: 1,
      title: '飞牛相册',
    });
    expect(detail).toMatchObject({
      albumId: 'feiniu-12',
      items: [
        expect.objectContaining({
          albumId: 'feiniu-12',
          albumName: '飞牛相册',
          displayImageUrl: '/api/photos/feiniu-31970/display',
          imageUrl: '/api/photos/feiniu-31970/original',
          location: '杭州',
          photoId: 'feiniu-31970',
          takenAt: '2026-01-30',
          thumbnailUrl: '/api/photos/feiniu-31970/thumb',
        }),
      ],
      photoCount: 1,
    });
    expect(detail?.items).toHaveLength(1);
    expect(asset).toMatchObject({
      contentType: 'image/jpeg',
      kind: 'remote',
    });
    expect(client.fetchMedia).toHaveBeenCalledWith(
      'http://nas.local/p/api/v1/stream/p/t/31970/m/photo-uuid',
    );
  });

  it('includes shared albums in the TV contract and loads their photos by album id', async () => {
    const client = {
      listAlbumPhotos: jest.fn(async () => [
        {
          additional: {
            thumbnail: {
              mUrl: '/p/api/v1/stream/p/t/41001/m/shared-photo-uuid',
              originalUrl: '/p/api/v1/stream/p/t/41001/o/shared-photo-uuid',
              sUrl: '/p/api/v1/stream/p/t/41001/s/shared-photo-uuid',
            },
          },
          category: 'photo',
          fileName: 'SHARED_001.jpg',
          geo: '上海',
          id: 41001,
          photoDateTime: '2026:06:06 11:22:33',
        },
      ]),
      listAlbums: jest.fn(async () => []),
      listSharedAlbumsMine: jest.fn(async () => []),
      listSharedAlbumsToMe: jest.fn(async () => [
        {
          albumId: 47,
          albumName: '阿乎精修图',
          ownerName: 'zsdd',
          photoCount: 4,
          posterUrl: '/p/api/v1/stream/p/t/41001/m/shared-photo-uuid',
          sourceKind: 'shared_to_me',
        },
      ]),
      fetchMedia: jest.fn(async () => ({
        contentType: 'image/jpeg',
        filename: 'shared-photo-uuid',
        kind: 'remote',
        stream: {},
      })),
      resolveMediaUrl: (path: string) => `http://nas.local${path}`,
    } as unknown as FeiniuClient;
    const source = new FeiniuSource(client);

    const albums = await source.listAlbums();
    const detail = await source.getAlbum('feiniu-shared-to-me-47');
    const playlistItems = await source.listPlaylistItems('feiniu-shared-to-me-47');

    expect(albums).toEqual([
      expect.objectContaining({
        albumId: 'feiniu-shared-to-me-47',
        coverImageUrl: '/api/photos/feiniu-shared-to-me-47-cover/display',
        description: '共享给我的飞牛相册，所有者：zsdd',
        photoCount: 4,
        title: '阿乎精修图',
      }),
    ]);
    expect(detail).toMatchObject({
      albumId: 'feiniu-shared-to-me-47',
      items: [
        expect.objectContaining({
          albumId: 'feiniu-shared-to-me-47',
          displayImageUrl: '/api/photos/feiniu-41001/display',
          photoId: 'feiniu-41001',
        }),
      ],
      photoCount: 1,
    });
    expect(playlistItems).toHaveLength(1);
    expect(client.listAlbumPhotos).toHaveBeenCalledWith(47);
  });
});
