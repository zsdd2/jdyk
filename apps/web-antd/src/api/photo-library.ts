import { requestClient } from '#/api/request';

import { resolvePhotoAssetUrl } from './resolve-photo-url';

export interface PhotoLibraryOverview {
  albumCount: number;
  databasePath: string;
  lastScanJob?: PhotoScanJob;
  migrationVersion: number;
  photoCount: number;
  photoRoot: string;
}

export interface PhotoScanJob {
  discoveredPhotoCount: number;
  finishedAt?: string;
  importedPhotoCount: number;
  jobId: string;
  photoRoot: string;
  startedAt: string;
  status: 'completed' | 'failed' | 'running';
}

export type AiRecognitionTaskStatus =
  | 'completed'
  | 'failed'
  | 'queued'
  | 'retrying'
  | 'running';

export interface AiRecognitionTaskProgress {
  activePhotoId: string;
  activePhotoName: string;
  albumId: string;
  albumTitle: string;
  completedPhotoCount: number;
  createdAt: string;
  error: string;
  failedPhotoCount: number;
  finishedAt: string;
  jobId: string;
  lastUpdatedAt: string;
  requestedPhotoCount: number;
  skippedPhotoCount: number;
  status: AiRecognitionTaskStatus;
  targetId: string;
  targetTitle: string;
  targetType: 'album' | 'photo' | 'retry';
}

export interface CreatePhotoScanJobInput {
  photoRoot?: string;
}

export type PhotoCenterAiStatus = 'completed' | 'failed' | 'pending';
export type PhotoCenterSourceAlbumKind =
  | ''
  | 'owned'
  | 'shared_by_me'
  | 'shared_to_me';
export type PhotoCenterSourceType = 'feiniu' | 'local';

export interface PhotoCenterItem {
  aiCompleted: boolean;
  aiBeautyScore: null | number;
  aiComment: string;
  aiCommentStatus: PhotoCenterAiStatus;
  aiDetail: string;
  aiError: string;
  aiIsTrash: boolean;
  aiLayout: {
    fontStyle: 'handwriting' | 'sans-serif' | 'serif';
    position: string;
    safeArea: { h: number; w: number; x: number; y: number };
    textColor: '#000000' | '#FFFFFF';
  };
  aiLocked: boolean;
  aiMemoryScore: null | number;
  aiNarrationVariants: Array<{
    handwrittenThought: string;
    lyricalClosure: string;
    sceneDescription: string;
  }>;
  aiReason: string;
  aiRecognizedAt: string;
  aiScore: null | number;
  aiScoreStatus: PhotoCenterAiStatus;
  aiTags: string[];
  albumId: string;
  albumName: string;
  captionTitle: string;
  derivativeStatus: string;
  filename: string;
  importAlbumTitle: string;
  importedAt: string;
  location: string;
  photoId: string;
  removable?: boolean;
  sourceAlbumId: string;
  sourceAlbumKind: PhotoCenterSourceAlbumKind;
  sourceOwnerName: string;
  sourceType: PhotoCenterSourceType;
  syncedAt: string;
  takenAt: string;
  thumbnailUrl: string;
}

export interface PhotoCenterListResponse {
  items: PhotoCenterItem[];
  page: number;
  pageSize: number;
  total: number;
}

export interface GetPhotoCenterItemsInput {
  aiCommentStatus?: PhotoCenterAiStatus;
  aiScoreStatus?: PhotoCenterAiStatus;
  aiTag?: string;
  albumId?: string;
  keyword?: string;
  page?: number;
  pageSize?: number;
  sourceType?: PhotoCenterSourceType;
}

export interface PlaybackAlbum {
  authorizedDeviceIds: string[];
  aiDailyLimit: number;
  aiDailyProcessedCount: number;
  aiDailyProcessedOn: string;
  aiEnabled: boolean;
  aiPriorityTags: string[];
  aiRepeatIntervalMinutes: number;
  aiScoreThreshold: number;
  coverPhotoId: string;
  createdAt: string;
  description: string;
  photoCount: number;
  playbackAlbumId: string;
  pushEnabled: boolean;
  pushBeautyScoreThreshold: number;
  pushMemoryScoreThreshold: number;
  pushPriorityTags: string[];
  pushScoreThreshold: number;
  sourceAlbumId: string;
  sourceAlbumTitle: string;
  sourceType: 'feiniu_album' | 'manual';
  title: string;
  lastAiCheckedAt: string;
  updatedAt: string;
}

export interface CreatePlaybackAlbumInput {
  aiDailyLimit?: number;
  aiEnabled?: boolean;
  aiPriorityTags?: string[];
  aiRepeatIntervalMinutes?: number;
  aiScoreThreshold?: number;
  description?: string;
  pushEnabled?: boolean;
  pushBeautyScoreThreshold?: number;
  pushMemoryScoreThreshold?: number;
  pushPriorityTags?: string[];
  pushScoreThreshold?: number;
  sourceAlbumId?: string;
  sourceAlbumTitle?: string;
  sourceType?: 'feiniu_album' | 'manual';
  title: string;
}

export interface UpdatePlaybackAlbumInput {
  aiDailyLimit?: number;
  aiEnabled?: boolean;
  aiPriorityTags?: string[];
  aiRepeatIntervalMinutes?: number;
  authorizedDeviceIds?: string[];
  description?: string;
  pushBeautyScoreThreshold?: number;
  pushEnabled?: boolean;
  pushMemoryScoreThreshold?: number;
  pushPriorityTags?: string[];
  pushScoreThreshold?: number;
  sourceAlbumId?: string;
  sourceAlbumTitle?: string;
  sourceType?: 'feiniu_album' | 'manual';
  title?: string;
}

export interface AddPlaybackAlbumPhotosInput {
  photoIds?: string[];
  sourceAlbumIds?: string[];
}

export interface AddPlaybackAlbumPhotosResult {
  addedPhotoCount: number;
  requestedPhotoCount: number;
  skippedPhotoCount: number;
  totalPhotoCount: number;
}

export interface RemovePlaybackAlbumPhotoResult {
  removedPhotoCount: number;
  totalPhotoCount: number;
}

export interface DeletePlaybackAlbumResult {
  deletedAlbumCount: number;
  removedPhotoCount: number;
}

export interface TrashPhotoResult {
  trashedPhotoCount: number;
}

export interface ClearAiRecognitionTasksResult {
  deletedTaskCount: number;
}

export interface PlaybackAlbumAiJobResult {
  finishedAt: string;
  generatedPhotoCount: number;
  importedSourcePhotoCount: number;
  jobId: string;
  requestedPhotoCount: number;
  skippedPhotoCount: number;
  startedAt: string;
  status: 'completed' | 'queued';
}

export interface PlaybackAlbumScanJobResult extends PlaybackAlbumAiJobResult {
  transcodedPhotoCount: number;
}

export type AiSettingsProvider =
  | 'custom'
  | 'deepseek'
  | 'openai'
  | 'openai_compatible'
  | 'qwen';

export interface AiSettings {
  aiCheckIntervalMinutes: number;
  dailyAiLimit: number;
  apiKeyConfigured: boolean;
  baseUrl: string;
  classificationPrompt: string;
  commentPrompt: string;
  layoutPrompt: string;
  model: string;
  outputContractPrompt: string;
  provider: AiSettingsProvider;
  scoringPrompt: string;
  updatedAt: string;
}

export interface UpdateAiSettingsInput {
  aiCheckIntervalMinutes?: number;
  dailyAiLimit?: number;
  apiKey?: string;
  baseUrl?: string;
  classificationPrompt?: string;
  commentPrompt?: string;
  layoutPrompt?: string;
  model?: string;
  outputContractPrompt?: string;
  provider?: AiSettingsProvider;
  scoringPrompt?: string;
}

export interface UpdatePlaybackAlbumAiPolicyInput {
  aiDailyLimit?: number;
  aiEnabled?: boolean;
  aiPriorityTags?: string[];
  aiRepeatIntervalMinutes?: number;
  aiScoreThreshold?: number;
  pushEnabled?: boolean;
  pushBeautyScoreThreshold?: number;
  pushMemoryScoreThreshold?: number;
  pushPriorityTags?: string[];
  pushScoreThreshold?: number;
}

export interface PlaybackAlbumAiPolicyUpdateResult {
  aiJob?: PlaybackAlbumAiJobResult;
  album: PlaybackAlbum;
}

export interface FeiniuRuntimeConfig {
  baseUrl?: string;
  enabled: boolean;
  missingFields: string[];
  passwordConfigured: boolean;
  sourceMode: string;
  username?: string;
}

export interface TvDevice {
  appVersion: string;
  authorizedPlaybackAlbumIds: string[];
  createdAt: string;
  deviceId: string;
  deviceName: string;
  deviceToken: string;
  deviceUniqueId: string;
  enabled: boolean;
  groupName: string;
  lastLoginAt: string;
  platform: string;
  updatedAt: string;
}

export interface UpdateTvDeviceInput {
  authorizedPlaybackAlbumIds?: string[];
  deviceName?: string;
  enabled?: boolean;
  groupName?: string;
}

export interface PhotoSourceConfig {
  activeSourceId: string;
  feiniu: FeiniuRuntimeConfig;
  local: {
    albumCount: number;
    enabled: boolean;
    photoCount: number;
  };
}

export interface FeiniuConnectivityInput {
  baseUrl?: string;
  password?: string;
  useConfiguredPassword?: boolean;
  username?: string;
}

export interface UpdateFeiniuSettingsInput {
  baseUrl?: string;
  keepPassword?: boolean;
  password?: string;
  username?: string;
}

export interface FeiniuConnectivityResult {
  albumCount?: number;
  baseUrl?: string;
  checkedAt: string;
  error?: string;
  missingFields?: string[];
  ok: boolean;
  sharedByMeCount?: number;
  sharedToMeCount?: number;
  totalAlbumCount?: number;
  username?: string;
}

export interface FeiniuPhotoSyncJob {
  albumCount: number;
  discoveredPhotoCount: number;
  error?: string;
  finishedAt: string;
  importedPhotoCount: number;
  jobId: string;
  startedAt: string;
  status: 'completed' | 'failed';
  syncedAt: string;
  updatedPhotoCount: number;
}

export interface FeiniuAlbumOption {
  albumId: string;
  coverImageUrl: string;
  coverPhotoId: string;
  description: string;
  latestTakenAt?: string;
  photoCount: number;
  thumbnailUrl: string;
  title: string;
  updatedAt: string;
}

export function getPhotoLibraryOverviewApi() {
  return requestClient.get<PhotoLibraryOverview>('/admin/photo-library/overview');
}

export function getPhotoCenterItemsApi(params: GetPhotoCenterItemsInput) {
  return requestClient.get<PhotoCenterListResponse>('/admin/photo-library/photos', {
    params,
  });
}

export function getPhotoAssetUrl(url: string) {
  return resolvePhotoAssetUrl(url, requestClient.getBaseUrl());
}

export function createPhotoScanJobApi(input: CreatePhotoScanJobInput) {
  return requestClient.post<PhotoScanJob>('/admin/photo-library/scan-jobs', input);
}

export function getPlaybackAlbumsApi() {
  return requestClient.get<PlaybackAlbum[]>('/admin/photo-library/playback-albums');
}

export function createPlaybackAlbumApi(input: CreatePlaybackAlbumInput) {
  return requestClient.post<PlaybackAlbum>(
    '/admin/photo-library/playback-albums',
    input,
  );
}

export function updatePlaybackAlbumApi(
  playbackAlbumId: string,
  input: UpdatePlaybackAlbumInput,
) {
  return requestClient.request<PlaybackAlbum>(
    `/admin/photo-library/playback-albums/${encodeURIComponent(playbackAlbumId)}`,
    {
      data: input,
      method: 'PATCH',
    },
  );
}

export function deletePlaybackAlbumApi(playbackAlbumId: string) {
  return requestClient.delete<DeletePlaybackAlbumResult>(
    `/admin/photo-library/playback-albums/${encodeURIComponent(playbackAlbumId)}`,
  );
}

export function getTvDevicesApi() {
  return requestClient.get<TvDevice[]>('/admin/photo-library/devices');
}

export function updateTvDeviceApi(deviceId: string, input: UpdateTvDeviceInput) {
  return requestClient.request<TvDevice>(
    `/admin/photo-library/devices/${encodeURIComponent(deviceId)}`,
    {
      data: input,
      method: 'PATCH',
    },
  );
}

export function getPlaybackAlbumItemsApi(playbackAlbumId: string) {
  return requestClient.get<PhotoCenterItem[]>(
    `/admin/photo-library/playback-albums/${encodeURIComponent(playbackAlbumId)}/photos`,
  );
}

export function addPlaybackAlbumPhotosApi(
  playbackAlbumId: string,
  input: AddPlaybackAlbumPhotosInput,
) {
  return requestClient.post<AddPlaybackAlbumPhotosResult>(
    `/admin/photo-library/playback-albums/${encodeURIComponent(playbackAlbumId)}/photos`,
    input,
  );
}

export function removePlaybackAlbumPhotoApi(
  playbackAlbumId: string,
  photoId: string,
) {
  return requestClient.delete<RemovePlaybackAlbumPhotoResult>(
    `/admin/photo-library/playback-albums/${encodeURIComponent(playbackAlbumId)}/photos/${encodeURIComponent(photoId)}`,
  );
}

export function createPlaybackAlbumAiJobApi(playbackAlbumId: string) {
  return requestClient.post<PlaybackAlbumAiJobResult>(
    `/admin/photo-library/playback-albums/${encodeURIComponent(playbackAlbumId)}/ai-jobs`,
  );
}

export function createPlaybackAlbumScanJobApi(playbackAlbumId: string) {
  return requestClient.post<PlaybackAlbumScanJobResult>(
    `/admin/photo-library/playback-albums/${encodeURIComponent(playbackAlbumId)}/scan-jobs`,
  );
}

export function createPhotoAiJobApi(photoId: string) {
  return requestClient.post<PlaybackAlbumAiJobResult>(
    `/admin/photo-library/photos/${encodeURIComponent(photoId)}/ai-jobs`,
  );
}

export function syncPhotoAiDetailApi(photoId: string) {
  return requestClient.post<PhotoCenterItem>(
    `/admin/photo-library/photos/${encodeURIComponent(photoId)}/ai-sync`,
  );
}

export function getAiRecognitionTasksApi() {
  return requestClient.get<AiRecognitionTaskProgress[]>(
    '/admin/photo-library/ai-tasks',
  );
}

export function clearAiRecognitionTasksApi() {
  return requestClient.delete<ClearAiRecognitionTasksResult>(
    '/admin/photo-library/ai-tasks',
  );
}

export function updatePlaybackAlbumAiPolicyApi(
  playbackAlbumId: string,
  input: UpdatePlaybackAlbumAiPolicyInput,
) {
  return requestClient.request<PlaybackAlbumAiPolicyUpdateResult>(
    `/admin/photo-library/playback-albums/${encodeURIComponent(playbackAlbumId)}/ai-policy`,
    {
      data: input,
      method: 'PATCH',
    },
  );
}

export function updatePhotoAiInsightApi(
  photoId: string,
  input: {
    aiBeautyScore?: null | number;
    aiComment?: string;
    aiLocked?: boolean;
    aiMemoryScore?: null | number;
    aiTags?: string[];
  },
) {
  return requestClient.request<PhotoCenterItem>(
    `/admin/photo-library/photos/${encodeURIComponent(photoId)}/ai-insight`,
    {
      data: input,
      method: 'PATCH',
    },
  );
}

export function updatePhotoMetadataApi(
  photoId: string,
  input: {
    captionTitle?: string;
    importAlbumTitle?: string;
    sourceAlbumKind?: PhotoCenterSourceAlbumKind;
    sourceOwnerName?: string;
  },
) {
  return requestClient.request<PhotoCenterItem>(
    `/admin/photo-library/photos/${encodeURIComponent(photoId)}/metadata`,
    {
      data: input,
      method: 'PATCH',
    },
  );
}

export function trashPhotoApi(photoId: string) {
  return requestClient.delete<TrashPhotoResult>(
    `/admin/photo-library/photos/${encodeURIComponent(photoId)}`,
  );
}

export function getAiSettingsApi() {
  return requestClient.get<AiSettings>('/admin/photo-library/ai-settings');
}

export function updateAiSettingsApi(input: UpdateAiSettingsInput) {
  return requestClient.put<AiSettings>(
    '/admin/photo-library/ai-settings',
    input,
  );
}

export function getPhotoSourceConfigApi() {
  return requestClient.get<PhotoSourceConfig>('/admin/photo-library/source-config');
}

export function updateFeiniuSettingsApi(input: UpdateFeiniuSettingsInput) {
  return requestClient.put<PhotoSourceConfig['feiniu']>(
    '/admin/photo-library/feiniu/settings',
    input,
  );
}

export function testFeiniuConnectivityApi(input: FeiniuConnectivityInput) {
  return requestClient.post<FeiniuConnectivityResult>(
    '/admin/photo-library/feiniu/connectivity',
    input,
  );
}

export function getFeiniuAlbumsApi() {
  return requestClient.get<FeiniuAlbumOption[]>(
    '/admin/photo-library/feiniu/albums',
  );
}

export function createFeiniuPhotoSyncJobApi() {
  return requestClient.post<FeiniuPhotoSyncJob>(
    '/admin/photo-library/feiniu/sync-jobs',
  );
}
