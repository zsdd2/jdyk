import type { AddPlaybackAlbumPhotosResult } from '#/api/photo-library';

export interface PlaybackAlbumAssignmentInput {
  mode: 'create' | 'existing';
  newTitle?: string;
  photoIds: string[];
  playbackAlbumId?: string;
}

export function buildSelectedPhotoIds(rows: Array<{ photoId?: string }>): string[] {
  return [
    ...new Set(
      rows
        .map((row) => row.photoId?.trim() ?? '')
        .filter(Boolean),
    ),
  ];
}

export function validatePlaybackAlbumAssignment(
  input: PlaybackAlbumAssignmentInput,
): string | undefined {
  if (input.photoIds.length === 0) return '请选择要加入播放相册的照片';
  if (input.mode === 'existing' && !input.playbackAlbumId?.trim()) {
    return '请选择目标播放相册';
  }
  if (input.mode === 'create' && !input.newTitle?.trim()) {
    return '请输入新播放相册名称';
  }
  return undefined;
}

export function formatAddPlaybackAlbumResult(
  result: AddPlaybackAlbumPhotosResult,
): string {
  return `已加入 ${result.addedPhotoCount} 张，跳过 ${result.skippedPhotoCount} 张；目标播放相册现有 ${result.totalPhotoCount} 张照片`;
}
