export interface PlaybackAlbumViewItem {
  coverPhotoId?: string;
  playbackAlbumId: string;
  updatedAt: string;
}

export function buildPlaybackAlbumCoverPath(album: { coverPhotoId?: string }) {
  const coverPhotoId = album.coverPhotoId?.trim();
  return coverPhotoId ? `/api/photos/${encodeURIComponent(coverPhotoId)}/thumb` : '';
}

export function formatPlaybackAlbumPhotoCount(photoCount: number) {
  return `${photoCount} 张`;
}

export function sortPlaybackAlbumsByUpdatedAt<T extends PlaybackAlbumViewItem>(
  albums: T[],
) {
  return [...albums].sort(
    (left, right) =>
      new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
  );
}
