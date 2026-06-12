import type { PhotoSource } from './photo-source';
import { CompositePhotoSource } from './composite-photo-source';
import { FeiniuClient } from './feiniu/feiniu-client';
import { FeiniuSource } from './feiniu/feiniu-source';
import { SqlitePhotoSource } from './sqlite-photo-source';

export class PhotoSourceRegistry {
  private activeSource: PhotoSource;
  private sources: PhotoSource[];

  constructor(defaultSource: PhotoSource, sources: PhotoSource[] = [defaultSource]) {
    this.activeSource = defaultSource;
    this.sources = sources;
  }

  close(): void {
    this.activeSource.close?.();
  }

  getActiveSource(): PhotoSource {
    return this.activeSource;
  }

  getSourceById(id: string): PhotoSource | undefined {
    return this.sources.find((source) => source.id === id);
  }

  replaceActiveSource(source: PhotoSource): void {
    this.close();
    this.activeSource = source;
    this.sources = [source];
  }
}

export function createDefaultPhotoSourceRegistry(
  env: Record<string, string | undefined> = process.env,
  sqliteSource = new SqlitePhotoSource(),
): PhotoSourceRegistry {
  if (
    env.WRJDYK_PHOTO_SOURCE === 'feiniu' &&
    env.WRJDYK_FEINIU_BASE_URL &&
    env.WRJDYK_FEINIU_USERNAME &&
    env.WRJDYK_FEINIU_PASSWORD
  ) {
    const feiniuSource = new FeiniuSource(
      new FeiniuClient({
        baseUrl: env.WRJDYK_FEINIU_BASE_URL,
        password: env.WRJDYK_FEINIU_PASSWORD,
        username: env.WRJDYK_FEINIU_USERNAME,
      }),
    );
    return new PhotoSourceRegistry(
      new CompositePhotoSource([sqliteSource, feiniuSource]),
      [sqliteSource, feiniuSource],
    );
  }

  return new PhotoSourceRegistry(sqliteSource);
}
