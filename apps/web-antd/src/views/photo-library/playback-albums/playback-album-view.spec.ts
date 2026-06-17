import { describe, expect, it } from 'vitest';

import {
  buildPlaybackAlbumCoverPath,
  buildPlaybackMemberMetadataForm,
  formatPlaybackAlbumPhotoCount,
  getAuthorizedDeviceSummary,
  getDeviceAlbumAuthorizationSummary,
  getPlaybackAlbumReadiness,
  sortPlaybackAlbumsByUpdatedAt,
} from './playback-album-view';

describe('playback album view helpers', () => {
  it('uses signed thumbnail urls returned by the backend first', () => {
    expect(
      buildPlaybackAlbumCoverPath({
        coverPhotoId: 'feiniu cover/001',
        thumbnailUrl: '/api/photos/feiniu%20cover%2F001/thumb?assetToken=signed',
      }),
    ).toBe('/api/photos/feiniu%20cover%2F001/thumb?assetToken=signed');
  });

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

  it('builds the playback member metadata edit form with observed weather', () => {
    expect(
      buildPlaybackMemberMetadataForm({
        aiDetail: JSON.stringify({
          raw: {
            photo_analysis: {
              observed_meta: {
                weather: 'sunny',
              },
            },
          },
        }),
        albumName: 'fallback album',
        captionTitle: '',
        filename: '_DSC9448',
        importAlbumTitle: '',
        location: 'Hong Kong',
        photoId: 'scan_001',
        sourceAlbumKind: 'shared_to_me',
        sourceOwnerName: 'family',
        takenAt: '2023-10-02',
      }),
    ).toEqual({
      captionTitle: '_DSC9448',
      importAlbumTitle: 'fallback album',
      location: 'Hong Kong',
      photoId: 'scan_001',
      sourceAlbumKind: 'shared_to_me',
      sourceOwnerName: 'family',
      takenAt: '2023-10-02',
      weather: 'sunny',
    });
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

  it('treats an enabled device with no album restriction as authorized for all playback albums', () => {
    const summary = getAuthorizedDeviceSummary(
      { playbackAlbumId: 'play_family' },
      [
        {
          authorizedPlaybackAlbumIds: [],
          deviceId: 'device_living_room',
          deviceName: '客厅电视',
          enabled: true,
        },
      ],
    );

    expect(summary).toEqual({
      count: 1,
      label: '1 台设备',
      names: '全部启用设备可看',
    });
  });

  it('marks a playback album as not authorized when no enabled device can access it', () => {
    expect(
      getPlaybackAlbumReadiness(
        { aiEnabled: true, photoCount: 12, playbackAlbumId: 'play_family' },
        [
          {
            authorizedPlaybackAlbumIds: ['play_travel'],
            deviceId: 'device_living_room',
            deviceName: '客厅电视',
            enabled: true,
          },
        ],
      ),
    ).toMatchObject({
      color: 'warning',
      label: '未授权',
      status: 'no_devices',
    });
  });

  it('prioritizes missing photos before AI and authorization readiness warnings', () => {
    expect(
      getPlaybackAlbumReadiness(
        { aiEnabled: false, photoCount: 0, playbackAlbumId: 'play_empty' },
        [
          {
            authorizedPlaybackAlbumIds: [],
            deviceId: 'device_living_room',
            deviceName: '客厅电视',
            enabled: true,
          },
        ],
      ),
    ).toMatchObject({
      color: 'default',
      label: '无照片',
      status: 'no_photos',
    });
  });

  it('summarizes device album authorization with the all-albums policy', () => {
    expect(
      getDeviceAlbumAuthorizationSummary(
        {
          authorizedPlaybackAlbumIds: [],
          deviceId: 'device_living_room',
          deviceName: '客厅电视',
          enabled: true,
        },
        [
          { playbackAlbumId: 'play_family', title: '家庭回忆' },
          { playbackAlbumId: 'play_travel', title: '旅行' },
        ],
      ),
    ).toEqual({
      color: 'success',
      description: '2 个播放相册均可观看',
      label: '全部相册',
    });
  });
});
