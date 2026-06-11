import type {
  AlbumDetailResponse,
  AlbumSummary,
  PlaylistItem,
} from '@wrjdyk/shared';
import type {
  MaybePromise,
  PhotoAssetVariant,
  PhotoSource,
  PhotoSourceAsset,
} from './photo-source';
import { isPromiseLike } from './photo-source';

export class CompositePhotoSource implements PhotoSource {
  readonly id: string;

  constructor(
    private readonly sources: PhotoSource[],
    id = 'mixed',
  ) {
    this.id = id;
  }

  close(): void {
    for (const source of this.sources) {
      source.close?.();
    }
  }

  getSourceById(id: string): PhotoSource | undefined {
    return this.sources.find((source) => source.id === id);
  }

  getAlbum(albumId: string): MaybePromise<AlbumDetailResponse | null> {
    return firstResolved(this.sources, (source) => source.getAlbum(albumId));
  }

  getPhotoAsset(
    photoId: string,
    variant?: PhotoAssetVariant,
  ): MaybePromise<PhotoSourceAsset | null> {
    return firstResolved(this.sources, (source) =>
      source.getPhotoAsset?.(photoId, variant) ?? null,
    );
  }

  listAlbums(): MaybePromise<AlbumSummary[]> {
    return collectResolved(this.sources, (source) => source.listAlbums());
  }

  listPlaylistItems(albumId?: string): MaybePromise<PlaylistItem[]> {
    return collectResolved(this.sources, (source) =>
      source.listPlaylistItems(albumId),
    );
  }
}

function firstResolved<T>(
  sources: PhotoSource[],
  getter: (source: PhotoSource) => MaybePromise<T | null>,
): MaybePromise<T | null> {
  const syncResults: Array<T | null> = [];
  for (const source of sources) {
    const result = getter(source);
    if (isPromiseLike(result)) {
      return resolveFirstAsync(sources, getter, syncResults, result);
    }
    if (result) return result;
    syncResults.push(result);
  }
  return null;
}

async function resolveFirstAsync<T>(
  sources: PhotoSource[],
  getter: (source: PhotoSource) => MaybePromise<T | null>,
  previousResults: Array<T | null>,
  current: Promise<T | null>,
): Promise<T | null> {
  const sourceIndex = previousResults.length;
  const resolved = await current;
  if (resolved) return resolved;

  for (const source of sources.slice(sourceIndex + 1)) {
    const result = await getter(source);
    if (result) return result;
  }
  return null;
}

function collectResolved<T>(
  sources: PhotoSource[],
  getter: (source: PhotoSource) => MaybePromise<T[]>,
): MaybePromise<T[]> {
  const collected: T[][] = [];
  for (const source of sources) {
    const result = getter(source);
    if (isPromiseLike(result)) {
      return collectResolvedAsync(sources, getter, collected, result);
    }
    collected.push(result);
  }
  return collected.flat();
}

async function collectResolvedAsync<T>(
  sources: PhotoSource[],
  getter: (source: PhotoSource) => MaybePromise<T[]>,
  previousResults: T[][],
  current: Promise<T[]>,
): Promise<T[]> {
  const sourceIndex = previousResults.length;
  const collected = [...previousResults, await current];
  for (const source of sources.slice(sourceIndex + 1)) {
    collected.push(await getter(source));
  }
  return collected.flat();
}
