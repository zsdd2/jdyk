export interface PlaybackAlbumViewItem {
  coverImageUrl?: string;
  coverPhotoId?: string;
  playbackAlbumId: string;
  thumbnailUrl?: string;
  updatedAt: string;
}

export interface PlaybackAlbumReadinessItem {
  aiEnabled: boolean;
  photoCount: number;
  playbackAlbumId: string;
}

export interface PlaybackAlbumDeviceItem {
  authorizedPlaybackAlbumIds: string[];
  deviceId: string;
  deviceName: string;
  enabled: boolean;
}

export interface DeviceAlbumAuthorizationItem {
  playbackAlbumId: string;
  title: string;
}

export type PlaybackAlbumReadinessStatus =
  | 'ai_paused'
  | 'no_devices'
  | 'no_photos'
  | 'ready';

export interface PlaybackAlbumReadinessSummary {
  color: 'default' | 'processing' | 'success' | 'warning';
  description: string;
  label: string;
  status: PlaybackAlbumReadinessStatus;
}

export interface AuthorizedDeviceSummary {
  count: number;
  label: string;
  names: string;
}

export interface DeviceAlbumAuthorizationSummary {
  color: 'default' | 'success' | 'warning';
  description: string;
  label: string;
}

export function buildPlaybackAlbumCoverPath(album: {
  coverImageUrl?: string;
  coverPhotoId?: string;
  thumbnailUrl?: string;
}) {
  const signedThumbnailUrl = album.thumbnailUrl?.trim();
  if (signedThumbnailUrl) return signedThumbnailUrl;
  const signedCoverImageUrl = album.coverImageUrl?.trim();
  if (signedCoverImageUrl) return signedCoverImageUrl;
  const coverPhotoId = album.coverPhotoId?.trim();
  return coverPhotoId ? `/api/photos/${encodeURIComponent(coverPhotoId)}/thumb` : '';
}

export function formatPlaybackAlbumPhotoCount(photoCount: number) {
  return `${photoCount} 张`;
}

function enabledDeviceCanAccessAlbum(
  album: { playbackAlbumId: string },
  device: PlaybackAlbumDeviceItem,
) {
  if (!device.enabled) return false;
  if (device.authorizedPlaybackAlbumIds.length === 0) return true;
  return device.authorizedPlaybackAlbumIds.includes(album.playbackAlbumId);
}

function summarizeNames(names: string[], emptyText: string) {
  if (names.length === 0) return emptyText;
  if (names.length <= 2) return names.join('、');
  return `${names.slice(0, 2).join('、')} 等 ${names.length} 台`;
}

export function getAuthorizedDeviceSummary(
  album: { playbackAlbumId: string },
  devices: PlaybackAlbumDeviceItem[],
): AuthorizedDeviceSummary {
  const enabledDevices = devices.filter((device) => device.enabled);
  const authorizedDevices = enabledDevices.filter((device) =>
    enabledDeviceCanAccessAlbum(album, device),
  );
  const allEnabledDevicesCanAccess =
    enabledDevices.length > 0 && authorizedDevices.length === enabledDevices.length;
  const allEnabledDevicesUseAllAlbumsPolicy =
    allEnabledDevicesCanAccess &&
    enabledDevices.every((device) => device.authorizedPlaybackAlbumIds.length === 0);

  return {
    count: authorizedDevices.length,
    label: `${authorizedDevices.length} 台设备`,
    names: allEnabledDevicesUseAllAlbumsPolicy
      ? '全部启用设备可看'
      : summarizeNames(
          authorizedDevices.map((device) => device.deviceName || device.deviceId),
          '未授权给启用设备',
        ),
  };
}

export function getPlaybackAlbumReadiness(
  album: PlaybackAlbumReadinessItem,
  devices: PlaybackAlbumDeviceItem[],
): PlaybackAlbumReadinessSummary {
  if (album.photoCount <= 0) {
    return {
      color: 'default',
      description: '还没有可播放照片',
      label: '无照片',
      status: 'no_photos',
    };
  }

  const authorizedDeviceSummary = getAuthorizedDeviceSummary(album, devices);
  if (authorizedDeviceSummary.count === 0) {
    return {
      color: 'warning',
      description: '没有启用设备获得该相册授权',
      label: '未授权',
      status: 'no_devices',
    };
  }

  if (!album.aiEnabled) {
    return {
      color: 'processing',
      description: '可播放，但不会自动补全 AI',
      label: 'AI 停用',
      status: 'ai_paused',
    };
  }

  return {
    color: 'success',
    description: '照片、AI 策略和设备授权已就绪',
    label: '可播放',
    status: 'ready',
  };
}

export function getDeviceAlbumAuthorizationSummary(
  device: PlaybackAlbumDeviceItem,
  albums: DeviceAlbumAuthorizationItem[],
): DeviceAlbumAuthorizationSummary {
  if (!device.enabled) {
    return {
      color: 'default',
      description: '停用设备不会拉取播放相册',
      label: '停用中',
    };
  }

  if (device.authorizedPlaybackAlbumIds.length === 0) {
    return {
      color: 'success',
      description: `${albums.length} 个播放相册均可观看`,
      label: '全部相册',
    };
  }

  const authorizedAlbumIdSet = new Set(device.authorizedPlaybackAlbumIds);
  const matchedAlbums = albums.filter((album) =>
    authorizedAlbumIdSet.has(album.playbackAlbumId),
  );
  const missingCount = device.authorizedPlaybackAlbumIds.length - matchedAlbums.length;
  const matchedNames = matchedAlbums.map((album) => album.title || album.playbackAlbumId);
  const names = matchedNames.length > 0 ? matchedNames.slice(0, 2).join('、') : '未匹配到相册';
  const suffix =
    matchedAlbums.length > 2
      ? ` 等 ${matchedAlbums.length} 个`
      : missingCount > 0
        ? `，${missingCount} 个已失效`
        : '';

  return {
    color: matchedAlbums.length > 0 ? 'warning' : 'default',
    description: `${names}${suffix}`,
    label: `${matchedAlbums.length} 个相册`,
  };
}

export function sortPlaybackAlbumsByUpdatedAt<T extends PlaybackAlbumViewItem>(
  albums: T[],
) {
  return [...albums].sort(
    (left, right) =>
      new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
  );
}
