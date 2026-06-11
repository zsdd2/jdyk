import type {
  AlbumDetailResponse,
  AlbumSummary,
  PlaylistItem,
} from '@wrjdyk/shared';
import type { Readable } from 'stream';
import type { PhotoAsset as LocalPhotoAsset } from '../sqlite-photo.repository';

export type MaybePromise<T> = Promise<T> | T;
export type PhotoAssetVariant = 'display' | 'original' | 'thumb';

export interface RemotePhotoAsset {
  contentType: string;
  filename: string;
  kind: 'remote';
  stream: Readable;
}

export type PhotoSourceAsset = (LocalPhotoAsset & { kind?: 'local' }) | RemotePhotoAsset;

export interface PhotoSource {
  readonly id: string;
  close?(): void;
  getAlbum(albumId: string): MaybePromise<AlbumDetailResponse | null>;
  getPhotoAsset?(
    photoId: string,
    variant?: PhotoAssetVariant,
  ): MaybePromise<PhotoSourceAsset | null>;
  listAlbums(): MaybePromise<AlbumSummary[]>;
  listPlaylistItems(albumId?: string): MaybePromise<PlaylistItem[]>;
}

export function isPromiseLike<T>(value: MaybePromise<T>): value is Promise<T> {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'then' in value &&
      typeof (value as Promise<T>).then === 'function',
  );
}
