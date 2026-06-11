import type { AlbumDetailResponse } from '@wrjdyk/shared';
import { SqlitePhotoRepository } from '../sqlite-photo.repository';
import type { PhotoSource } from './photo-source';

export class SqlitePhotoSource implements PhotoSource {
  readonly id = 'sqlite';

  constructor(readonly repository = new SqlitePhotoRepository()) {}

  close(): void {
    this.repository.close();
  }

  getAlbum(albumId: string): AlbumDetailResponse | null {
    const items = this.repository.listPlaylistItems(albumId);
    if (items.length === 0) return null;

    const album = this.repository
      .listAlbums()
      .find((candidate) => candidate.albumId === albumId);

    if (!album) return null;
    return {
      ...album,
      items,
    };
  }

  getPhotoAsset(photoId: string) {
    return this.repository.getPhotoAsset(photoId);
  }

  listAlbums() {
    return this.repository.listAlbums();
  }

  listPlaylistItems(albumId?: string) {
    return this.repository.listPlaylistItems(albumId);
  }
}
