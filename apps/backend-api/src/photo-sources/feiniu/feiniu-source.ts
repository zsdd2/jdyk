import type {
  AlbumDetailResponse,
  AlbumSummary,
  PlaylistItem,
} from '@wrjdyk/shared';
import type { PhotoSource } from '../photo-source';
import type { PhotoAssetVariant, PhotoSourceAsset } from '../photo-source';
import { FeiniuClient } from './feiniu-client';
import type { FeiniuAlbum, FeiniuGalleryPhoto } from './feiniu-client';

export class FeiniuSource implements PhotoSource {
  readonly id = 'feiniu';
  private readonly mediaUrlsByPhotoId = new Map<
    string,
    Record<PhotoAssetVariant, string>
  >();

  constructor(private readonly client: FeiniuClient) {}

  async getAlbum(albumId: string): Promise<AlbumDetailResponse | null> {
    const rawAlbums = await this.listAvailableAlbums();
    const rawAlbum = rawAlbums.find((album) => albumMatchesId(album, albumId));
    if (!rawAlbum) return null;

    const items = await this.listPlaylistItems(toFeiniuAlbumId(rawAlbum));
    return {
      ...this.mapAlbum(rawAlbum),
      coverPhotoId: items[0]?.photoId ?? `${toFeiniuAlbumId(rawAlbum)}-cover`,
      items,
      photoCount: items.length,
    };
  }

  async listAlbums(): Promise<AlbumSummary[]> {
    const albums = await this.listAvailableAlbums();
    return albums.map((album) => this.mapAlbum(album));
  }

  async listPlaylistItems(albumId?: string): Promise<PlaylistItem[]> {
    const albums = await this.listAvailableAlbums();
    const selectedAlbums = albumId
      ? albums.filter((album) => albumMatchesId(album, albumId))
      : albums;
    const nestedItems = await Promise.all(
      selectedAlbums.map(async (album) => {
        const photos = await this.client.listAlbumPhotos(album.albumId);
        return photos
          .filter((photo) => (photo.category ?? 'photo') === 'photo')
          .map((photo) => this.mapPhoto(album, photo));
      }),
    );

    return nestedItems.flat();
  }

  async getPhotoAsset(
    photoId: string,
    variant: PhotoAssetVariant = 'display',
  ): Promise<PhotoSourceAsset | null> {
    const mediaUrls = await this.findMediaUrls(photoId);
    const mediaUrl = mediaUrls?.[variant] || mediaUrls?.display || mediaUrls?.original;
    return mediaUrl ? this.client.fetchMedia(mediaUrl) : null;
  }

  private async listAvailableAlbums(): Promise<FeiniuAlbum[]> {
    const [ownedAlbums, sharedToMeAlbums, sharedByMeAlbums] = await Promise.all([
      this.client.listAlbums(),
      this.client.listSharedAlbumsToMe?.() ?? Promise.resolve([]),
      this.client.listSharedAlbumsMine?.() ?? Promise.resolve([]),
    ]);

    return [
      ...ownedAlbums,
      ...sharedToMeAlbums,
      ...sharedByMeAlbums,
    ];
  }

  private mapAlbum(album: FeiniuAlbum): AlbumSummary {
    const albumId = toFeiniuAlbumId(album);
    const coverPath = album.posterImgUrl || album.posterUrl || '';
    const coverPhotoId = `${albumId}-cover`;
    const latestTakenAt = normalizeFeiniuDate(album.endDateTime);
    if (coverPath) {
      const coverUrl = this.client.resolveMediaUrl(coverPath);
      this.mediaUrlsByPhotoId.set(coverPhotoId, {
        display: coverUrl,
        original: coverUrl,
        thumb: coverUrl,
      });
    }

    return {
      albumId,
      coverImageUrl: coverPath ? toBackendPhotoUrl(coverPhotoId, 'display') : '',
      coverPhotoId,
      description: describeAlbum(album),
      latestTakenAt,
      photoCount: album.photoCount ?? 0,
      thumbnailUrl: coverPath ? toBackendPhotoUrl(coverPhotoId, 'thumb') : '',
      title: album.albumName || '未命名飞牛相册',
      updatedAt: latestTakenAt ?? '1970-01-01',
    };
  }

  private mapPhoto(album: FeiniuAlbum, photo: FeiniuGalleryPhoto): PlaylistItem {
    const mediaUrls = resolvePhotoMediaUrls(this.client, photo);
    const photoId = toFeiniuPhotoId(photo.id);
    this.mediaUrlsByPhotoId.set(photoId, mediaUrls);
    return mapPhoto(album, photo, photoId);
  }

  private async findMediaUrls(
    photoId: string,
  ): Promise<Record<PhotoAssetVariant, string> | undefined> {
    const cached = this.mediaUrlsByPhotoId.get(photoId);
    if (cached) return cached;

    await this.listAlbums();
    const cachedCover = this.mediaUrlsByPhotoId.get(photoId);
    if (cachedCover) return cachedCover;

    await this.listPlaylistItems();
    return this.mediaUrlsByPhotoId.get(photoId);
  }
}

function mapPhoto(
  album: FeiniuAlbum,
  photo: FeiniuGalleryPhoto,
  photoId: string,
): PlaylistItem {
  const title = stripExtension(photo.fileName || `飞牛照片 ${photo.id}`);
  const animationTemplateId = 'cinematic_soft';
  const captionStyle = 'minimal';
  const layoutTemplateId = 'bottom_gradient';

  return {
    ai: {
      comment: '',
      commentStatus: 'pending',
      locked: false,
      score: null,
      scoreStatus: 'pending',
      tags: [],
    },
    albumId: toFeiniuAlbumId(album),
    albumName: album.albumName || '飞牛相册',
    animation: {
      imageTransition: 'ken_burns_fade',
      textEnter: 'fade_up',
      textExit: 'fade_out',
      textIdle: 'soft_float',
    },
    animationTemplateId,
    caption: {
      style: captionStyle,
      text: photo.description || '来自飞牛相册的照片。',
      title,
    },
    display: {
      animationTemplateId,
      captionStyle,
      layoutTemplateId,
      templateId: 'classic-memory-v1',
    },
    displayImageUrl: toBackendPhotoUrl(photoId, 'display'),
    dominantColor: '#6b7280',
    durationMs: 12_000,
    imageFitMode: 'cover_safe',
    imageUrl: toBackendPhotoUrl(photoId, 'original'),
    layout: {
      position: 'left_bottom',
      type: 'bottom_gradient',
    },
    layoutTemplateId,
    location: photo.geo ?? '',
    performanceHint: 'standard',
    photoId,
    takenAt: normalizeFeiniuDate(photo.photoDateTime ?? photo.dateTime),
    thumbnailUrl: toBackendPhotoUrl(photoId, 'thumb'),
  };
}

function albumMatchesId(album: FeiniuAlbum, albumId: string): boolean {
  return toFeiniuAlbumId(album) === albumId ||
    ((album.sourceKind ?? 'owned') === 'owned' && String(album.albumId) === albumId);
}

function describeAlbum(album: FeiniuAlbum): string {
  if (album.sourceKind === 'shared_to_me') {
    return album.ownerName
      ? `共享给我的飞牛相册，所有者：${album.ownerName}`
      : '共享给我的飞牛相册。';
  }
  if (album.sourceKind === 'shared_by_me') {
    return '我共享的飞牛相册。';
  }
  return album.ownerName
    ? `来自飞牛相册，所有者：${album.ownerName}`
    : '来自飞牛相册的照片。';
}

function resolveFirstMediaUrl(client: FeiniuClient, paths: Array<string | undefined>): string {
  const path = paths.find((candidate) => candidate && candidate.trim());
  return path ? client.resolveMediaUrl(path) : '';
}

function resolvePhotoMediaUrls(
  client: FeiniuClient,
  photo: FeiniuGalleryPhoto,
): Record<PhotoAssetVariant, string> {
  const thumbnail = photo.additional?.thumbnail;
  return {
    display: resolveFirstMediaUrl(client, [
      thumbnail?.mUrl,
      thumbnail?.sUrl,
      thumbnail?.xsUrl,
      thumbnail?.originalUrl,
    ]),
    original: resolveFirstMediaUrl(client, [
      thumbnail?.originalUrl,
      thumbnail?.mUrl,
      thumbnail?.sUrl,
    ]),
    thumb: resolveFirstMediaUrl(client, [
      thumbnail?.sUrl,
      thumbnail?.xsUrl,
      thumbnail?.mUrl,
    ]),
  };
}

function normalizeFeiniuDate(value?: string): string | undefined {
  if (!value) return undefined;
  const datePart = value.split(/\s+/, 1)[0] ?? value;
  const normalized = datePart.replace(/^(\d{4}):(\d{2}):(\d{2})$/, '$1-$2-$3');
  return normalized || undefined;
}

function stripExtension(filename: string): string {
  return filename.replace(/\.[^.]+$/, '');
}

function toFeiniuAlbumId(album: FeiniuAlbum): string {
  if (album.sourceKind === 'shared_to_me') {
    return `feiniu-shared-to-me-${album.albumId}`;
  }
  if (album.sourceKind === 'shared_by_me') {
    return `feiniu-shared-by-me-${album.albumId}`;
  }
  return `feiniu-${album.albumId}`;
}

function toFeiniuPhotoId(id: number | string, suffix?: string): string {
  return suffix ? `feiniu-${id}-${suffix}` : `feiniu-${id}`;
}

function toBackendPhotoUrl(photoId: string, variant: PhotoAssetVariant): string {
  return `/api/photos/${encodeURIComponent(photoId)}/${variant}`;
}
