import { describe, expect, it } from 'vitest';

import { resolvePhotoAssetUrl } from './resolve-photo-url';

describe('resolvePhotoAssetUrl', () => {
  it('uses the API origin for backend photo asset paths', () => {
    expect(
      resolvePhotoAssetUrl(
        '/api/photos/scan_001/thumb?source=ceshi',
        'http://localhost:3999/api',
      ),
    ).toBe('http://localhost:3999/api/photos/scan_001/thumb?source=ceshi');
  });

  it('keeps dev proxy paths relative when the API base is relative', () => {
    expect(
      resolvePhotoAssetUrl('/api/photos/scan_001/thumb?source=ceshi', '/api'),
    ).toBe('/api/photos/scan_001/thumb?source=ceshi');
  });

  it('keeps absolute media URLs unchanged', () => {
    expect(
      resolvePhotoAssetUrl(
        'http://192.168.10.166:60000/media/photo.jpg',
        'http://localhost:3999/api',
      ),
    ).toBe('http://192.168.10.166:60000/media/photo.jpg');
  });
});
