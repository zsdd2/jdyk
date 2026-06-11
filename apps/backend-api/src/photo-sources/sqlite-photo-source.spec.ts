import { mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { SqlitePhotoRepository } from '../sqlite-photo.repository';
import { PhotoSourceRegistry } from './photo-source-registry';
import { SqlitePhotoSource } from './sqlite-photo-source';

describe('SqlitePhotoSource', () => {
  const testDataDir = join(process.cwd(), '.test-data', 'sqlite-photo-source');
  const databasePath = join(testDataDir, 'wrjdyk-source-test.sqlite');
  const photoRoot = join(process.cwd(), '..', '..', 'ceshi');
  let repository: SqlitePhotoRepository | undefined;

  beforeEach(() => {
    mkdirSync(testDataDir, { recursive: true });
    rmSync(databasePath, { force: true });
  });

  afterEach(() => {
    repository?.close();
    repository = undefined;
    rmSync(databasePath, { force: true });
  });

  it('exposes the existing sqlite library through the photo source contract', () => {
    repository = new SqlitePhotoRepository({
      databasePath,
      photoRoot,
    });
    const source = new SqlitePhotoSource(repository);
    const registry = new PhotoSourceRegistry(source);

    const albums = registry.getActiveSource().listAlbums();
    const playlist = registry.getActiveSource().listPlaylistItems('family-travel');
    const asset = registry.getActiveSource().getPhotoAsset?.('p_001');

    expect(source.id).toBe('sqlite');
    expect(albums).toHaveLength(3);
    expect(albums[0]).toMatchObject({
      albumId: 'family-travel',
      coverPhotoId: 'p_001',
      photoCount: 3,
      title: '家庭旅行',
    });
    expect(playlist.map((item) => item.photoId)).toEqual([
      'p_001',
      'p_002',
      'p_003',
    ]);
    expect(asset).toMatchObject({
      contentType: 'image/jpeg',
      filename: '_DSC6456.jpg',
    });
  });
});
