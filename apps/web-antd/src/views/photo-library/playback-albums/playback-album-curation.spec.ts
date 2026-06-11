import { describe, expect, it } from 'vitest';

import {
  buildPlaybackAlbumCreateInput,
  validatePlaybackAlbumCreateForm,
} from './playback-album-curation';

describe('playback album curation helpers', () => {
  it('builds a Feiniu-mounted playback album input with AI and push policy', () => {
    const input = buildPlaybackAlbumCreateInput({
      aiDailyLimit: 0,
      aiEnabled: true,
      aiPriorityTags: ['人物', '开心', '人物'],
      aiRepeatIntervalMinutes: 720,
      aiScoreThreshold: 83,
      description: '  客厅展示  ',
      pushEnabled: true,
      pushBeautyScoreThreshold: 73,
      pushMemoryScoreThreshold: 86,
      pushPriorityTags: ['场景'],
      pushScoreThreshold: 91,
      sourceAlbumId: 'feiniu-shared-to-me-47',
      sourceAlbumTitle: '阿乎精修图',
      sourceType: 'feiniu_album',
      title: '',
    });

    expect(input).toEqual({
      aiDailyLimit: 0,
      aiEnabled: true,
      aiPriorityTags: ['人物', '开心'],
      aiRepeatIntervalMinutes: 720,
      aiScoreThreshold: 83,
      description: '客厅展示',
      pushEnabled: true,
      pushBeautyScoreThreshold: 73,
      pushMemoryScoreThreshold: 86,
      pushPriorityTags: ['场景'],
      pushScoreThreshold: 91,
      sourceAlbumId: 'feiniu-shared-to-me-47',
      sourceAlbumTitle: '阿乎精修图',
      sourceType: 'feiniu_album',
      title: '阿乎精修图',
    });
  });

  it('requires a target title for manually curated albums', () => {
    expect(
      validatePlaybackAlbumCreateForm({
        aiDailyLimit: 0,
        aiEnabled: false,
        aiPriorityTags: [],
        aiRepeatIntervalMinutes: 1440,
        aiScoreThreshold: 80,
        description: '',
        pushEnabled: true,
        pushBeautyScoreThreshold: 70,
        pushMemoryScoreThreshold: 80,
        pushPriorityTags: [],
        pushScoreThreshold: 80,
        sourceAlbumId: '',
        sourceAlbumTitle: '',
        sourceType: 'manual',
        title: '',
      }),
    ).toBe('请输入播放相册名称');
  });
});
