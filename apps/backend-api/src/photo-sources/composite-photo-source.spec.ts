import type {
  AlbumDetailResponse,
  AlbumSummary,
  PlaylistItem,
} from '@wrjdyk/shared';
import { CompositePhotoSource } from './composite-photo-source';
import type { PhotoSource } from './photo-source';

describe('CompositePhotoSource', () => {
  const localAlbum: AlbumSummary = {
    albumId: 'local-scan',
    coverImageUrl: '/api/photos/p_001/display',
    coverPhotoId: 'p_001',
    description: '本地照片',
    photoCount: 1,
    thumbnailUrl: '/api/photos/p_001/thumb',
    title: '本地扫描',
    updatedAt: '2026-06-06',
  };
  const feiniuAlbum: AlbumSummary = {
    albumId: 'feiniu-shared-to-me-47',
    coverImageUrl: '/api/photos/feiniu-shared-to-me-47-cover/display',
    coverPhotoId: 'feiniu-shared-to-me-47-cover',
    description: '共享给我的飞牛相册',
    photoCount: 1,
    thumbnailUrl: '/api/photos/feiniu-shared-to-me-47-cover/thumb',
    title: '阿乎精修图',
    updatedAt: '2026-06-06',
  };
  const localItem = playlistItem('local-scan', 'p_001');
  const feiniuItem = playlistItem('feiniu-shared-to-me-47', 'feiniu-95629');

  it('lists local and Feiniu albums in the same TV album collection', async () => {
    const source = new CompositePhotoSource([
      fakeSource('sqlite', localAlbum, localItem),
      fakeSource('feiniu', feiniuAlbum, feiniuItem),
    ]);

    await expect(source.listAlbums()).resolves.toEqual([
      localAlbum,
      feiniuAlbum,
    ]);
    await expect(source.listPlaylistItems()).resolves.toEqual([
      localItem,
      feiniuItem,
    ]);
  });

  it('routes album details and media assets to the source that owns the id', async () => {
    const source = new CompositePhotoSource([
      fakeSource('sqlite', localAlbum, localItem),
      fakeSource('feiniu', feiniuAlbum, feiniuItem),
    ]);

    await expect(source.getAlbum('feiniu-shared-to-me-47')).resolves.toMatchObject({
      albumId: 'feiniu-shared-to-me-47',
      items: [feiniuItem],
    });
    await expect(source.getPhotoAsset('p_001')).resolves.toMatchObject({
      filename: 'p_001.jpg',
    });
    await expect(source.getPhotoAsset('feiniu-95629')).resolves.toMatchObject({
      filename: 'feiniu-95629.jpg',
    });
  });
});

function fakeSource(
  id: string,
  album: AlbumSummary,
  item: PlaylistItem,
): PhotoSource {
  return {
    getAlbum: async (albumId: string): Promise<AlbumDetailResponse | null> =>
      album.albumId === albumId ? { ...album, items: [item] } : null,
    getPhotoAsset: async (photoId: string) =>
      item.photoId === photoId
        ? {
            contentType: 'image/jpeg',
            filename: `${photoId}.jpg`,
            kind: 'local',
            path: `C:/tmp/${photoId}.jpg`,
          }
        : null,
    id,
    listAlbums: async () => [album],
    listPlaylistItems: async (albumId?: string) =>
      !albumId || albumId === album.albumId ? [item] : [],
  };
}

function playlistItem(albumId: string, photoId: string): PlaylistItem {
  return {
    ai: {
      comment: '',
      commentStatus: 'pending',
      locked: false,
      score: null,
      scoreStatus: 'pending',
      tags: [],
    },
    albumId,
    albumName: albumId,
    animation: {
      imageTransition: 'fade',
      textEnter: 'fade',
      textExit: 'fade',
      textIdle: 'none',
    },
    animationTemplateId: 'basic',
    caption: {
      style: 'minimal',
      text: '照片',
      title: photoId,
    },
    display: {
      animationTemplateId: 'basic',
      captionStyle: 'minimal',
      layoutTemplateId: 'bottom_gradient',
      templateId: 'classic-memory-v1',
    },
    displayImageUrl: `/api/photos/${photoId}/display`,
    dominantColor: '#000000',
    durationMs: 12_000,
    imageFitMode: 'cover_safe',
    imageUrl: `/api/photos/${photoId}/original`,
    layout: {
      position: 'left_bottom',
      type: 'bottom_gradient',
    },
    layoutTemplateId: 'bottom_gradient',
    performanceHint: 'standard',
    photoId,
    thumbnailUrl: `/api/photos/${photoId}/thumb`,
  };
}
