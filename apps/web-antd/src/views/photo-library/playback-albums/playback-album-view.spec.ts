import { describe, expect, it } from 'vitest';

import {
  buildPlaybackAlbumCoverPath,
  formatPlaybackAlbumPhotoCount,
  sortPlaybackAlbumsByUpdatedAt,
} from './playback-album-view';

describe('playback album view helpers', () => {
  it('builds a backend thumbnail path from the cover photo id', () => {
    expect(
      buildPlaybackAlbumCoverPath({
        coverPhotoId: 'feiniu cover/001',
      }),
    ).toBe('/api/photos/feiniu%20cover%2F001/thumb');
  });

  it('returns an empty cover path when an album has no cover', () => {
    expect(buildPlaybackAlbumCoverPath({ coverPhotoId: '' })).toBe('');
  });

  it('formats the photo count for table display', () => {
    expect(formatPlaybackAlbumPhotoCount(8)).toBe('8 张');
  });

  it('sorts playback albums by latest update first', () => {
    const sorted = sortPlaybackAlbumsByUpdatedAt([
      {
        playbackAlbumId: 'older',
        updatedAt: '2026-06-08T10:00:00.000Z',
      },
      {
        playbackAlbumId: 'newer',
        updatedAt: '2026-06-09T10:00:00.000Z',
      },
    ]);

    expect(sorted.map((album) => album.playbackAlbumId)).toEqual([
      'newer',
      'older',
    ]);
  });
});
