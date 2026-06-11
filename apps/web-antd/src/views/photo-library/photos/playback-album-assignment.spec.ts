import { describe, expect, it } from 'vitest';

import {
  buildSelectedPhotoIds,
  formatAddPlaybackAlbumResult,
  validatePlaybackAlbumAssignment,
} from './playback-album-assignment';

describe('playback album assignment helpers', () => {
  it('deduplicates selected photo ids while preserving selection order', () => {
    expect(
      buildSelectedPhotoIds([
        { photoId: 'scan_001' },
        { photoId: 'feiniu-95629' },
        { photoId: 'scan_001' },
        { photoId: '' },
      ]),
    ).toEqual(['scan_001', 'feiniu-95629']);
  });

  it('requires a target album when assigning to an existing playback album', () => {
    expect(
      validatePlaybackAlbumAssignment({
        mode: 'existing',
        photoIds: ['scan_001'],
      }),
    ).toEqual('请选择目标播放相册');
  });

  it('requires a new title when creating a playback album during assignment', () => {
    expect(
      validatePlaybackAlbumAssignment({
        mode: 'create',
        newTitle: '   ',
        photoIds: ['scan_001'],
      }),
    ).toEqual('请输入新播放相册名称');
  });

  it('formats the add result for operator feedback', () => {
    expect(
      formatAddPlaybackAlbumResult({
        addedPhotoCount: 2,
        requestedPhotoCount: 3,
        skippedPhotoCount: 1,
        totalPhotoCount: 8,
      }),
    ).toBe('已加入 2 张，跳过 1 张；目标播放相册现有 8 张照片');
  });
});
