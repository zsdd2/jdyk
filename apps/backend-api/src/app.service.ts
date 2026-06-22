import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { SqlitePhotoRepository } from './sqlite-photo.repository';
import type { PhotoLibraryOverview, PhotoScanJob } from './sqlite-photo.repository';
import type {
  AddPlaybackAlbumPhotosResult,
  AiRecognitionTaskProgress,
  AiRuntimeSettings,
  AiSettings,
  ClearAiRecognitionTasksResult,
  CreatePlaybackAlbumInput,
  DeletePlaybackAlbumResult,
  PhotoDerivativeAssets,
  PhotoCenterExternalItem,
  PhotoCenterExternalSyncResult,
  PhotoCenterItem,
  PhotoCenterListQuery,
  PhotoCenterListResponse,
  PhotoCenterSourceType,
  PhotoAiInsightInput,
  PlaybackAlbum,
  RecoverInterruptedAiRecognitionTasksResult,
  RemovePlaybackAlbumPhotoResult,
  TrashPhotoResult,
  TvDevice,
  UpdateAiSettingsInput,
  UpdateFeiniuSettingsInput,
  UpdatePhotoAiCommentInput,
  UpdatePhotoAiInsightInput,
  UpdatePhotoMetadataInput,
  UpdatePlaybackAlbumInput,
  UpdatePlaybackAlbumAiPolicyInput,
  UpdateTvDeviceInput,
} from './sqlite-photo.repository';
import { CompositePhotoSource } from './photo-sources/composite-photo-source';
import {
  createDefaultPhotoSourceRegistry,
  PhotoSourceRegistry,
} from './photo-sources/photo-source-registry';
import { isPromiseLike } from './photo-sources/photo-source';
import type {
  MaybePromise,
  PhotoAssetVariant,
  PhotoSource,
  PhotoSourceAsset,
} from './photo-sources/photo-source';
import { SqlitePhotoSource } from './photo-sources/sqlite-photo-source';
import {
  getFeiniuRuntimeConfig,
  testFeiniuConnectivity,
} from './photo-sources/feiniu/feiniu-config';
import type {
  FeiniuConnectivityInput,
  FeiniuConnectivityResult,
  FeiniuRuntimeConfig,
} from './photo-sources/feiniu/feiniu-config';
import type {
  AlbumDetailResponse,
  AlbumListResponse,
  AlbumSummary,
  DeviceBindConfirmInput,
  DeviceBindSessionCreateInput,
  DeviceBindSessionResponse,
  DeviceLoginInput,
  DeviceLoginResponse,
  DevicePolicyResponse,
  HealthResponse,
  PlayRecordInput,
  PlayRecordResponse,
  PlaylistItem,
  PlaylistResponse,
} from '@wrjdyk/shared';

const bindSessionTtlMs = 10 * 60 * 1000;
const bindSessions = new Map<string, DeviceBindSessionResponse>();
const photoAssetTokenTtlMs = 6 * 60 * 60 * 1000;
const maxConcurrentVisionAiRequests = 3;
const visionAiRequestTimeoutMs = 90_000;
let lastPhotoScanJob: PhotoScanJob | undefined;

interface PhotoLibraryScanInput {
  photoRoot?: string;
}

interface PhotoCenterQueryInput {
  aiCommentStatus?: string;
  aiScoreStatus?: string;
  aiTag?: string;
  albumId?: string;
  keyword?: string;
  page?: string;
  pageSize?: string;
  sourceType?: string;
}

type UnifiedAiInsight = Omit<PhotoAiInsightInput, 'photoId'>;

interface UnifiedVisionAiInput {
  album: PlaybackAlbum;
  derivative: PhotoDerivativeAssets;
  item: PhotoCenterItem;
  settings: AiRuntimeSettings;
}

export interface UnifiedVisionAiAdapter {
  analyze(input: UnifiedVisionAiInput): MaybePromise<UnifiedAiInsight>;
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

export interface PhotoCenterBackfillJobInput {
  jobId?: string;
  limit?: number;
  sourceType?: PhotoCenterSourceType;
}

export interface PhotoCenterBackfillJobResult extends PlaybackAlbumScanJobResult {
  failedPhotoCount: number;
  targetPhotoCount: number;
}

export interface PlaybackAlbumAiSchedulerAlbumResult {
  error?: string;
  finishedAt?: string;
  generatedPhotoCount: number;
  importedSourcePhotoCount: number;
  jobId?: string;
  playbackAlbumId: string;
  requestedPhotoCount: number;
  skippedPhotoCount: number;
  status: 'completed' | 'failed' | 'queued';
  title: string;
}

export interface PlaybackAlbumAiSchedulerRunResult {
  checkedAt: string;
  dueAlbumCount: number;
  jobResults: PlaybackAlbumAiSchedulerAlbumResult[];
  skippedAlbumCount: number;
  status: 'completed' | 'running';
}

export interface PlaybackAlbumAiPolicyUpdateResult {
  aiJob?: PlaybackAlbumAiJobResult;
  album: PlaybackAlbum;
}

export interface PhotoSourceConfigResponse {
  activeSourceId: string;
  feiniu: FeiniuRuntimeConfig;
  local: {
    albumCount: number;
    enabled: boolean;
    photoCount: number;
  };
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

export interface TvAppUpdateManifest {
  apkUrl: string;
  forceUpdate: boolean;
  publishedAt: string;
  releaseNotes: string;
  sha256: string;
  sizeBytes: number;
  versionCode: number;
  versionName: string;
}

export interface TvReleaseVersion {
  apkUrl: string;
  fileExists: boolean;
  fileName: string;
  forceUpdate: boolean;
  isLatest: boolean;
  publishedAt: string;
  releaseNotes: string;
  sha256: string;
  sizeBytes: number;
  versionCode: number;
  versionName: string;
}

export interface TvReleaseInfo {
  fileExists: boolean;
  fileName: string;
  manifest: TvAppUpdateManifest;
  releasesDirectory: string;
  versions: TvReleaseVersion[];
}

export interface TvReleaseUploadInput {
  buffer: Buffer;
  forceUpdate?: boolean | string;
  originalName?: string;
  releaseNotes?: string;
  versionCode?: number | string;
  versionName?: string;
}

export interface TvReleaseSyncInput {
  forceUpdate?: boolean | string;
  releaseNotes?: string;
  versionName?: string;
}

type TvReleaseAssetFetcher = (url: string) => Promise<Buffer>;

export interface AdminAuthResult {
  accessToken: string;
  mustChangePassword: boolean;
}

export interface AdminPasswordChangeInput {
  currentPassword?: string;
  newPassword?: string;
}

export interface AdminTokenValidationOptions {
  allowPasswordChangeRequired?: boolean;
}

const realPhotoFiles = [
  '_DSC6456.jpg',
  '_DSC6463.jpg',
  '_DSC6468.jpg',
  '_DSC6470.jpg',
  '_DSC6477.jpg',
  '_DSC6486.jpg',
  '_DSC6489.jpg',
  '_DSC6494.jpg',
  '_DSC6500.jpg',
];

const sampleAlbumDefinitions = [
  {
    albumId: 'family-travel',
    albumName: '家庭旅行',
    dominantColor: '#d8a465',
    location: '京都',
    text: '有些快乐不用解释，照片已经替我们记住了。',
    title: '那年的夏天',
  },
  {
    albumId: 'weekend-daily',
    albumName: '周末日常',
    dominantColor: '#758c72',
    location: '家',
    text: '普通的一天，也会在多年以后变得很亮。',
    title: '客厅里的午后',
  },
  {
    albumId: 'old-photos',
    albumName: '旧照片',
    dominantColor: '#9f8a76',
    location: '老家',
    text: '时间走得很远，画面还在原地等我们。',
    title: '回到那一刻',
  },
];

const sampleItems: PlaylistItem[] = realPhotoFiles.map((filename, index) => {
  const album = sampleAlbumDefinitions[Math.floor(index / 3)]!;
  const photoNumber = index + 1;
  const photoId = `p_${photoNumber.toString().padStart(3, '0')}`;
  const captionStyle = index < 3 ? 'warm_memory' : index < 6 ? 'family_diary' : 'minimal';

  return {
    ai: {
      comment: '',
      commentStatus: 'pending',
      locked: false,
      score: null,
      scoreStatus: 'pending',
      tags: [],
    },
    albumId: album.albumId,
    albumName: album.albumName,
    animation: {
      imageTransition: 'ken_burns_fade',
      textEnter: 'fade_up',
      textExit: 'fade_out',
      textIdle: 'soft_float',
    },
    animationTemplateId: 'cinematic_soft',
    caption: {
      style: captionStyle,
      text: album.text,
      title: `${album.title} ${photoNumber}`,
    },
    display: {
      animationTemplateId: 'cinematic_soft',
      captionStyle,
      layoutTemplateId: 'bottom_gradient',
      templateId: 'classic-memory-v1',
    },
    displayImageUrl: photoUrl(photoId, 'display'),
    dominantColor: album.dominantColor,
    durationMs: 12_000,
    imageFitMode: 'cover_safe',
    imageUrl: photoUrl(photoId, 'original'),
    layout: {
      position: 'left_bottom',
      type: 'bottom_gradient',
    },
    layoutTemplateId: 'bottom_gradient',
    location: album.location,
    performanceHint: 'standard',
    photoId,
    takenAt: `2022-11-${(index + 2).toString().padStart(2, '0')}`,
    thumbnailUrl: photoUrl(photoId, 'thumb'),
  };
});

const samplePalettes: Record<string, [string, string, string]> = {
  p_001: ['#b7d3d8', '#d8a465', '#4e6172'],
  p_002: ['#d7c9a7', '#758c72', '#343e34'],
  p_003: ['#9f8a76', '#d5c0a0', '#33313a'],
};

const sampleAlbumDescriptions: Record<string, string> = {
  'family-travel': '记录我们家的点点滴滴，那些温暖的时光。',
  'old-photos': '时间走得很远，画面还在原地等我们。',
  'weekend-daily': '普通的一天，也会在多年以后变得很亮。',
};

const emptyDemoAlbum: AlbumSummary = {
  albumId: 'empty-demo',
  coverImageUrl: '/api/photos/empty-demo/display',
  coverPhotoId: 'empty-demo',
  description: '这个图包暂时还没有可播放的照片。',
  photoCount: 0,
  thumbnailUrl: '/api/photos/empty-demo/thumb',
  title: '空图包测试',
  updatedAt: '1970-01-01',
};

@Injectable()
export class AppService implements OnModuleDestroy, OnModuleInit {
  private aiSchedulerRunning = false;
  private aiSchedulerTimer?: ReturnType<typeof setTimeout>;
  private readonly aiRetryAttempts = new Map<string, number>();
  private tvReleaseAssetFetcher: TvReleaseAssetFetcher = fetchTvReleaseAsset;
  private readonly aiRetryForceOverwrite = new Map<string, boolean>();
  private readonly aiRetryTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly aiTaskByPhotoId = new Map<string, string>();
  private activeVisionAiRequestCount = 0;
  private playbackAlbumJobQueue: Promise<void> = Promise.resolve();
  private photoSourceConfigKey = '';
  private photoSourceRefreshDisabled = false;
  private photoSources: PhotoSourceRegistry = createDefaultPhotoSourceRegistry();
  private readonly visionAiWaitQueue: Array<() => void> = [];
  private visionAi: UnifiedVisionAiAdapter = new OpenAiCompatibleUnifiedVisionAiAdapter();

  onModuleInit(): void {
    this.recoverInterruptedAiRecognitionTasks();
    this.syncConfiguredTvReleaseOnStartup();
  }

  onModuleDestroy(): void {
    this.close();
  }

  close(): void {
    if (this.aiSchedulerTimer) {
      clearTimeout(this.aiSchedulerTimer);
      this.aiSchedulerTimer = undefined;
    }
    for (const timer of this.aiRetryTimers.values()) {
      clearTimeout(timer);
    }
    this.aiRetryTimers.clear();
    this.aiRetryAttempts.clear();
    this.aiRetryForceOverwrite.clear();
    this.aiTaskByPhotoId.clear();
    while (this.visionAiWaitQueue.length > 0) {
      this.visionAiWaitQueue.shift()?.();
    }
    this.photoSources.close();
  }

  authenticateAdmin(input: DeviceLoginInput): AdminAuthResult | null {
    const username = input.username.trim().toLowerCase();
    const credential = this.getAdminCredentialState();
    if (
      username !== credential.username ||
      !this.verifyAdminPassword(input.password, credential)
    ) {
      return null;
    }
    return {
      accessToken: createAdminAccessToken(username, credential.mustChangePassword),
      mustChangePassword: credential.mustChangePassword,
    };
  }

  refreshAdminToken(authorizationHeader?: string): string | null {
    const payload = verifyAdminAccessToken(
      normalizeDeviceToken(undefined, authorizationHeader),
    );
    if (!payload || payload.sub !== this.getAdminCredentialState().username) return null;
    return createAdminAccessToken(payload.sub, payload.mustChangePassword);
  }

  validateAdminToken(
    authorizationHeader?: string,
    options: AdminTokenValidationOptions = {},
  ): boolean {
    const token = normalizeDeviceToken(undefined, authorizationHeader);
    if (!token) return false;
    const payload = verifyAdminAccessToken(token);
    if (payload?.sub !== this.getAdminCredentialState().username) return false;
    return options.allowPasswordChangeRequired === true || !payload.mustChangePassword;
  }

  changeAdminPassword(
    authorizationHeader: string | undefined,
    input: AdminPasswordChangeInput,
  ): { mustChangePassword: boolean } | null {
    const token = normalizeDeviceToken(undefined, authorizationHeader);
    const payload = verifyAdminAccessToken(token);
    const credential = this.getAdminCredentialState();
    const newPassword = input.newPassword?.trim() ?? '';
    if (payload?.sub !== credential.username) return null;
    if (!payload.mustChangePassword && !this.validateAdminToken(authorizationHeader)) {
      return null;
    }
    if (!this.verifyAdminPassword(input.currentPassword ?? '', credential)) {
      return null;
    }
    if (newPassword.length < 8 || newPassword === initialAdminPassword) {
      return null;
    }

    const passwordSalt = randomBytes(16).toString('hex');
    const passwordHash = hashAdminPassword(newPassword, passwordSalt);
    this.getSqliteSource().repository.updateAdminCredential({
      passwordHash,
      passwordSalt,
      username: credential.username,
    });
    return { mustChangePassword: false };
  }

  validatePhotoAssetToken(path: string, token?: string): boolean {
    return verifyPhotoAssetToken(path, token);
  }

  replacePhotoRepositoryForTesting(photoRepository: SqlitePhotoRepository): void {
    this.photoSourceConfigKey = '';
    this.photoSourceRefreshDisabled = false;
    this.photoSources.replaceActiveSource(new SqlitePhotoSource(photoRepository));
  }

  replacePhotoSourceForTesting(photoSource: PhotoSource): void {
    this.photoSourceConfigKey = '';
    this.photoSourceRefreshDisabled = true;
    this.photoSources.replaceActiveSource(photoSource);
  }

  replaceVisionAiForTesting(visionAi: UnifiedVisionAiAdapter): void {
    this.visionAi = visionAi;
  }

  listAiRecognitionTasks(): AiRecognitionTaskProgress[] {
    return this.getSqliteSource().repository.listAiRecognitionTasks();
  }

  clearAiRecognitionTasks(): ClearAiRecognitionTasksResult {
    return this.getSqliteSource().repository.clearAiRecognitionTasks();
  }

  recoverInterruptedAiRecognitionTasks(): RecoverInterruptedAiRecognitionTasksResult {
    return this.getSqliteSource().repository.recoverInterruptedAiRecognitionTasks();
  }

  private createAiRecognitionTask(input: {
    albumId?: string;
    albumTitle?: string;
    jobId?: string;
    requestedPhotoCount: number;
    targetId: string;
    targetTitle: string;
    targetType: AiRecognitionTaskProgress['targetType'];
  }): AiRecognitionTaskProgress {
    const now = new Date().toISOString();
    const task: AiRecognitionTaskProgress = {
      activePhotoId: '',
      activePhotoName: '',
      albumId: input.albumId ?? '',
      albumTitle: input.albumTitle ?? '',
      completedPhotoCount: 0,
      createdAt: now,
      error: '',
      failedPhotoCount: 0,
      finishedAt: '',
      jobId: input.jobId ?? `ai_task_${Date.now().toString(36)}`,
      lastUpdatedAt: now,
      requestedPhotoCount: input.requestedPhotoCount,
      skippedPhotoCount: 0,
      status: 'queued',
      targetId: input.targetId,
      targetTitle: input.targetTitle,
      targetType: input.targetType,
    };
    return this.getSqliteSource().repository.upsertAiRecognitionTask(task);
  }

  private updateAiRecognitionTask(
    jobId: string | undefined,
    patch: Partial<Omit<AiRecognitionTaskProgress, 'createdAt' | 'jobId'>>,
  ): void {
    if (!jobId) return;
    this.getSqliteSource().repository.updateAiRecognitionTask(jobId, {
      ...patch,
      lastUpdatedAt: new Date().toISOString(),
    });
  }

  private finishAiRecognitionTask(
    jobId: string | undefined,
    patch: Partial<AiRecognitionTaskProgress> = {},
  ): void {
    if (!jobId) return;
    const status = patch.status === 'failed' ? 'failed' : 'completed';
    this.updateAiRecognitionTask(jobId, {
      ...patch,
      activePhotoId: '',
      activePhotoName: '',
      finishedAt: new Date().toISOString(),
      status,
    });
  }

  authenticateDevice(input: DeviceLoginInput): DeviceLoginResponse | null {
    const normalizedUsername = input.username.trim().toLowerCase();
    const credential = this.getAdminCredentialState();
    if (
      credential.mustChangePassword ||
      normalizedUsername !== credential.username ||
      !this.verifyAdminPassword(input.password, credential)
    ) {
      return null;
    }

    const deviceUniqueId = normalizeDeviceUniqueId(
      input.deviceUniqueId || normalizedUsername,
    );
    const deviceId = `tv_${deviceUniqueId}`;
    const device = (() => {
      try {
        const existingDevice = this.getSqliteSource().repository
          .listTvDevices()
          .find((candidate) => (
            candidate.deviceId === deviceId ||
            candidate.deviceUniqueId === deviceUniqueId
          ));
        const deviceToken = existingDevice?.deviceToken?.trim() || createRandomDeviceToken();
        return this.getSqliteSource().repository.upsertTvDevice({
          appVersion: input.appVersion,
          deviceId,
          deviceName: input.deviceName || '测试电视',
          deviceToken,
          deviceUniqueId,
          platform: input.platform || 'AndroidTV',
        });
      } catch {
        return {
          deviceId: `tv_${normalizedUsername}`,
          deviceName: input.deviceName || '测试电视',
          deviceToken: createRandomDeviceToken(),
        };
      }
    })();
    return {
      deviceId: device.deviceId,
      deviceName: device.deviceName,
      deviceToken: device.deviceToken,
    };
  }

  private getAdminCredentialState(): AdminCredentialState {
    const configuredPassword = process.env.WRJDYK_ADMIN_PASSWORD?.trim();
    const configuredUsername = getAdminUsername();
    const storedCredential = this.getSqliteSource().repository.getAdminCredential();
    if (storedCredential) {
      return {
        mustChangePassword: false,
        passwordHash: storedCredential.passwordHash,
        passwordSalt: storedCredential.passwordSalt,
        type: 'hash',
        username: storedCredential.username.trim().toLowerCase() || configuredUsername,
      };
    }
    if (configuredPassword) {
      return {
        mustChangePassword:
          isProductionRuntime() &&
          configuredUsername === defaultAdminUsername &&
          configuredPassword === initialAdminPassword,
        password: configuredPassword,
        type: 'plain',
        username: configuredUsername,
      };
    }
    return {
      mustChangePassword: isProductionRuntime(),
      password: initialAdminPassword,
      type: 'plain',
      username: configuredUsername,
    };
  }

  private verifyAdminPassword(password: string, credential: AdminCredentialState): boolean {
    if (credential.type === 'plain') {
      return credential.password === password;
    }
    return constantTimeEquals(
      hashAdminPassword(password, credential.passwordSalt),
      credential.passwordHash,
    );
  }

  validateDeviceToken(
    deviceToken?: string,
    authorizationHeader?: string,
  ): boolean {
    const token = normalizeDeviceToken(deviceToken, authorizationHeader);
    if (!token) return false;

    try {
      const device = this.getSqliteSource().repository.getTvDeviceByToken(token);
      if (device) return device.enabled;
    } catch {
      // Non-sqlite test or external sources can still use legacy tokens.
    }

    for (const session of bindSessions.values()) {
      if (session.status === 'bound' && session.deviceToken === token) {
        return true;
      }
    }

    return false;
  }

  confirmDeviceBindSession(
    bindCode: string,
    input: DeviceBindConfirmInput = {},
  ): DeviceBindSessionResponse {
    const existing = this.getDeviceBindSession(bindCode);
    if (existing.status === 'expired') return existing;

    const normalizedCode = normalizeBindCode(bindCode);
    const confirmed: DeviceBindSessionResponse = {
      ...existing,
      deviceId: `tv_${normalizedCode.toLowerCase()}`,
      deviceName: input.deviceName?.trim() || '客厅电视',
      deviceToken: `dt_${normalizedCode.toLowerCase()}_${Date.now().toString(36)}`,
      status: 'bound',
    };

    bindSessions.set(normalizedCode, confirmed);
    return confirmed;
  }

  createDeviceBindSession(
    _input: DeviceBindSessionCreateInput = {},
  ): DeviceBindSessionResponse {
    cleanupExpiredBindSessions();

    const now = new Date();
    const bindCode = createUniqueBindCode();
    const session: DeviceBindSessionResponse = {
      bindCode,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + bindSessionTtlMs).toISOString(),
      status: 'pending',
    };

    bindSessions.set(bindCode, session);
    return session;
  }

  createPlayRecord(input: PlayRecordInput): PlayRecordResponse {
    console.info('play-record', {
      ...input,
      receivedAt: new Date().toISOString(),
    });

    return {
      accepted: true,
      receivedAt: new Date().toISOString(),
    };
  }

  getCurrentPolicy(): DevicePolicyResponse {
    return {
      allowLocalOverride: true,
      animationTemplate: 'cinematic_soft',
      deviceId: 'tv_living_room',
      intervalSeconds: 12,
      layoutTemplate: 'bottom_gradient',
      playMode: 'sequence',
      policyId: 'policy_demo_family',
      policyVersion: 1,
    };
  }

  getHealth(): HealthResponse {
    return {
      name: 'wangri-zhongxian-backend',
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '2.0.6',
    };
  }

  getTvAppUpdateManifest(): TvAppUpdateManifest {
    const storedManifest = readTvReleaseManifest(this.getTvReleaseManifestPath());
    if (storedManifest) return storedManifest;

    return {
      apkUrl: normalizeOptionalEnv(process.env.WRJDYK_TV_UPDATE_APK_URL),
      forceUpdate: normalizeBooleanEnv(process.env.WRJDYK_TV_UPDATE_FORCE),
      publishedAt: normalizeOptionalEnv(process.env.WRJDYK_TV_UPDATE_PUBLISHED_AT),
      releaseNotes: normalizeOptionalEnv(process.env.WRJDYK_TV_UPDATE_NOTES),
      sha256: normalizeOptionalEnv(process.env.WRJDYK_TV_UPDATE_SHA256),
      sizeBytes: normalizeIntegerEnv(process.env.WRJDYK_TV_UPDATE_SIZE_BYTES),
      versionCode: normalizeIntegerEnv(process.env.WRJDYK_TV_UPDATE_VERSION_CODE),
      versionName: normalizeOptionalEnv(process.env.WRJDYK_TV_UPDATE_VERSION_NAME),
    };
  }

  getTvReleaseInfo(): TvReleaseInfo {
    const releasesDirectory = this.getTvReleaseDirectory();
    const manifest = this.getTvAppUpdateManifest();
    const fileName = normalizeTvReleaseFileNameFromUrl(manifest.apkUrl);
    const releasePath = fileName ? resolve(releasesDirectory, fileName) : '';
    const fileExists = Boolean(
      releasePath &&
      releasePath.startsWith(`${releasesDirectory}${pathSeparator()}`) &&
      existsSync(releasePath) &&
      statSync(releasePath).isFile(),
    );

    return {
      fileExists,
      fileName,
      manifest,
      releasesDirectory,
      versions: listTvReleaseVersions(releasesDirectory, manifest, fileName),
    };
  }

  uploadTvReleasePackage(input: TvReleaseUploadInput): TvReleaseInfo {
    const versionCode = normalizeIntegerValue(input.versionCode);
    const versionName = normalizeTvVersionName(input.versionName);
    if (!versionCode) {
      throw new Error('TV release versionCode must be a positive integer');
    }
    if (!versionName) {
      throw new Error('TV release versionName is required');
    }
    if (!input.buffer || input.buffer.length === 0) {
      throw new Error('TV release APK file is required');
    }
    if (input.originalName && !input.originalName.toLowerCase().endsWith('.apk')) {
      throw new Error('TV release file must be an APK');
    }

    const releasesDirectory = this.getTvReleaseDirectory();
    mkdirSync(releasesDirectory, { recursive: true });
    const fileName = `wangri-tv-${versionName}.apk`;
    const releasePath = resolve(releasesDirectory, fileName);
    if (!releasePath.startsWith(`${releasesDirectory}${pathSeparator()}`)) {
      throw new Error('Invalid TV release path');
    }

    writeFileSync(releasePath, input.buffer);
    const manifest: TvAppUpdateManifest = {
      apkUrl: `/releases/${fileName}`,
      forceUpdate: normalizeBooleanValue(input.forceUpdate),
      publishedAt: new Date().toISOString(),
      releaseNotes: normalizeOptionalText(input.releaseNotes),
      sha256: createHash('sha256').update(input.buffer).digest('hex'),
      sizeBytes: input.buffer.length,
      versionCode,
      versionName,
    };
    writeFileSync(
      getTvReleaseMetadataPath(releasesDirectory, fileName),
      `${JSON.stringify(manifest, null, 2)}\n`,
    );
    writeFileSync(
      this.getTvReleaseManifestPath(),
      `${JSON.stringify(manifest, null, 2)}\n`,
    );

    return this.getTvReleaseInfo();
  }

  async syncTvReleasePackage(input: TvReleaseSyncInput = {}): Promise<TvReleaseInfo> {
    const versionName = this.resolveTvReleaseSyncVersionName(input.versionName);
    if (!versionName) {
      throw new Error('TV release versionName is required');
    }

    const downloadBaseUrl = this.resolveTvReleaseDownloadBaseUrl(versionName);
    const remoteManifest = readTvReleaseManifestFromBuffer(
      await this.tvReleaseAssetFetcher(`${downloadBaseUrl}/latest.json`),
    );
    if (!remoteManifest) {
      throw new Error('TV release manifest is invalid');
    }
    if (remoteManifest.versionName !== versionName) {
      throw new Error(
        `TV release manifest versionName ${remoteManifest.versionName} does not match requested ${versionName}`,
      );
    }

    const fileName = `wangri-tv-${versionName}.apk`;
    const apkDownloadUrl = normalizeHttpUrl(remoteManifest.apkUrl) || `${downloadBaseUrl}/${fileName}`;
    const apkBuffer = await this.tvReleaseAssetFetcher(apkDownloadUrl);
    if (!apkBuffer.length) {
      throw new Error('TV release APK file is empty');
    }

    const sha256 = createHash('sha256').update(apkBuffer).digest('hex');
    if (isSha256(remoteManifest.sha256) && remoteManifest.sha256 !== sha256) {
      throw new Error('TV release APK sha256 does not match manifest');
    }

    const releasesDirectory = this.getTvReleaseDirectory();
    mkdirSync(releasesDirectory, { recursive: true });
    const releasePath = resolve(releasesDirectory, fileName);
    if (!releasePath.startsWith(`${releasesDirectory}${pathSeparator()}`)) {
      throw new Error('Invalid TV release path');
    }

    const releaseNotesOverride = normalizeOptionalText(input.releaseNotes);
    const manifest: TvAppUpdateManifest = {
      apkUrl: `/releases/${fileName}`,
      forceUpdate: input.forceUpdate === undefined
        ? remoteManifest.forceUpdate
        : normalizeBooleanValue(input.forceUpdate),
      publishedAt: remoteManifest.publishedAt || new Date().toISOString(),
      releaseNotes: releaseNotesOverride || remoteManifest.releaseNotes,
      sha256,
      sizeBytes: apkBuffer.length,
      versionCode: remoteManifest.versionCode,
      versionName,
    };

    writeFileSync(releasePath, apkBuffer);
    writeFileSync(
      getTvReleaseMetadataPath(releasesDirectory, fileName),
      `${JSON.stringify(manifest, null, 2)}\n`,
    );
    writeFileSync(
      this.getTvReleaseManifestPath(),
      `${JSON.stringify(manifest, null, 2)}\n`,
    );

    return this.getTvReleaseInfo();
  }

  replaceTvReleaseAssetFetcherForTesting(fetcher?: TvReleaseAssetFetcher): void {
    this.tvReleaseAssetFetcher = fetcher ?? fetchTvReleaseAsset;
  }

  private getTvReleaseDirectory(): string {
    return resolve(
      process.env.WRJDYK_RELEASES_DIR?.trim() || join(process.cwd(), 'releases'),
    );
  }

  private getTvReleaseManifestPath(): string {
    return join(this.getTvReleaseDirectory(), 'latest.json');
  }

  private resolveTvReleaseSyncVersionName(versionName?: string): string {
    return normalizeTvVersionName(versionName)
      || normalizeTvVersionName(process.env.WRJDYK_TV_RELEASE_SYNC_VERSION_NAME)
      || normalizeTvVersionName(process.env.WRJDYK_TV_UPDATE_VERSION_NAME)
      || this.getHealth().version;
  }

  private resolveTvReleaseDownloadBaseUrl(versionName: string): string {
    const configuredBase = normalizeOptionalEnv(process.env.WRJDYK_TV_RELEASE_DOWNLOAD_BASE_URL);
    if (configuredBase) {
      return configuredBase.replace(/\/+$/, '');
    }
    const repository = normalizeOptionalEnv(process.env.WRJDYK_TV_RELEASE_REPOSITORY) || 'zsdd2/jdyk';
    return `https://github.com/${repository}/releases/download/tv-v${versionName}`;
  }

  private syncConfiguredTvReleaseOnStartup(): void {
    if (normalizeOptionalEnv(process.env.WRJDYK_TV_RELEASE_SYNC).toLowerCase() !== 'auto') {
      return;
    }
    void this.syncTvReleasePackage().catch((error) => {
      console.warn('TV release auto-sync failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }

  getAlbums(
    demoScenario?: string,
    deviceToken?: string,
    authorizationHeader?: string,
  ): MaybePromise<AlbumListResponse> {
    const scenario = resolveDemoScenario(demoScenario);
    if (scenario === 'empty-albums') {
      return {
        albums: [],
        total: 0,
      };
    }

    if (scenario === 'empty-playlist') {
      return {
        albums: [emptyDemoAlbum],
        total: 1,
      };
    }

    const authorizedDevice = this.resolveAuthorizedDevice(deviceToken, authorizationHeader);
    const playbackAlbums = this.listDevicePlaybackAlbums(deviceToken, authorizationHeader);
    if (authorizedDevice && authorizedDevice.authorizedPlaybackAlbumIds.length > 0) {
      return this.signPhotoAssetUrls({
        albums: playbackAlbums,
        total: playbackAlbums.length,
      });
    }
    const albums = this.getPhotoSources().getActiveSource().listAlbums();
    if (isPromiseLike(albums)) {
      return albums.then((resolvedAlbums) => this.signPhotoAssetUrls({
        albums: [...playbackAlbums, ...resolvedAlbums],
        total: playbackAlbums.length + resolvedAlbums.length,
      }));
    }

    return this.signPhotoAssetUrls({
      albums: [...playbackAlbums, ...albums],
      total: playbackAlbums.length + albums.length,
    });
  }

  getAlbum(
    albumId: string,
    demoScenario?: string,
    deviceToken?: string,
    authorizationHeader?: string,
  ): MaybePromise<AlbumDetailResponse | null> {
    const scenario = resolveDemoScenario(demoScenario);
    if (scenario === 'empty-playlist' && albumId === emptyDemoAlbum.albumId) {
      return this.signPhotoAssetUrls({
        ...emptyDemoAlbum,
        items: [],
      });
    }

    const playbackAlbum = this.getDevicePlaybackAlbumDetail(
      albumId,
      deviceToken,
      authorizationHeader,
    );
    if (playbackAlbum) return this.signPhotoAssetUrls(playbackAlbum);

    const album = this.getPhotoSources().getActiveSource().getAlbum(albumId);
    return isPromiseLike(album)
      ? album.then((resolvedAlbum) => this.signPhotoAssetUrls(resolvedAlbum))
      : this.signPhotoAssetUrls(album);
  }

  getPlaylist(
    limit?: string,
    albumId?: string,
    demoScenario?: string,
    deviceToken?: string,
    authorizationHeader?: string,
  ): MaybePromise<PlaylistResponse> {
    const scenario = resolveDemoScenario(demoScenario);
    if (scenario === 'empty-albums' || scenario === 'empty-playlist') {
      return this.signPhotoAssetUrls({
        items: [],
        playlistId: albumId ? `pl_demo_${albumId}` : 'pl_demo_empty',
        policyVersion: 1,
      });
    }

    const playbackItems = this.listDevicePlaybackAlbumItems(
      albumId,
      deviceToken,
      authorizationHeader,
    );
    if (playbackItems) {
      return this.signPhotoAssetUrls(buildPlaylistResponse(playbackItems, limit, albumId));
    }

    const sourceItems = this.getPhotoSources().getActiveSource().listPlaylistItems(albumId);
    if (isPromiseLike(sourceItems)) {
      return sourceItems.then((items) =>
        this.signPhotoAssetUrls(buildPlaylistResponse(items, limit, albumId)),
      );
    }

    return this.signPhotoAssetUrls(buildPlaylistResponse(sourceItems, limit, albumId));
  }

  private resolveAuthorizedDevice(
    deviceToken?: string,
    authorizationHeader?: string,
  ): TvDevice | null {
    const token = normalizeDeviceToken(deviceToken, authorizationHeader);
    if (!token) return null;
    return this.getSqliteSource().repository.getTvDeviceByToken(token);
  }

  private deviceCanAccessPlaybackAlbum(
    device: TvDevice | null,
    album: PlaybackAlbum,
  ): boolean {
    if (!device) return true;
    if (!device.enabled) return false;
    if (device.authorizedPlaybackAlbumIds.length === 0) return true;
    return device.authorizedPlaybackAlbumIds.includes(album.playbackAlbumId);
  }

  private listDevicePlaybackAlbums(
    deviceToken?: string,
    authorizationHeader?: string,
  ): AlbumSummary[] {
    const repository = this.getSqliteSource().repository;
    const device = this.resolveAuthorizedDevice(deviceToken, authorizationHeader);
    return repository
      .listPlaybackAlbums()
      .filter((album) => this.deviceCanAccessPlaybackAlbum(device, album))
      .map((album) => {
      const items = repository.listPlaybackAlbumPlaylistItems(album.playbackAlbumId);
      const cover = items[0];
      return {
        albumId: album.playbackAlbumId,
        coverImageUrl: cover?.displayImageUrl ?? '',
        coverPhotoId: cover?.photoId ?? album.coverPhotoId,
        description: album.description,
        latestTakenAt: cover?.takenAt,
        photoCount: items.length,
        thumbnailUrl: cover?.thumbnailUrl ?? '',
        title: album.title,
        updatedAt: album.updatedAt,
      };
    });
  }

  private listDevicePlaybackAlbumItems(
    albumId?: string,
    deviceToken?: string,
    authorizationHeader?: string,
  ): PlaylistItem[] | null {
    if (!albumId) return null;
    const repository = this.getSqliteSource().repository;
    const playbackAlbum = repository
      .listPlaybackAlbums()
      .find((album) => album.playbackAlbumId === albumId);
    if (!playbackAlbum) return null;
    if (!this.deviceCanAccessPlaybackAlbum(
      this.resolveAuthorizedDevice(deviceToken, authorizationHeader),
      playbackAlbum,
    )) {
      return [];
    }

    return repository.listPlaybackAlbumPlaylistItems(albumId);
  }

  private getDevicePlaybackAlbumDetail(
    albumId: string,
    deviceToken?: string,
    authorizationHeader?: string,
  ): AlbumDetailResponse | null {
    if (!albumId.startsWith('play_')) return null;

    const repository = this.getSqliteSource().repository;
    const playbackAlbum = repository
      .listPlaybackAlbums()
      .find((album) => album.playbackAlbumId === albumId);
    if (!playbackAlbum) return null;
    if (!this.deviceCanAccessPlaybackAlbum(
      this.resolveAuthorizedDevice(deviceToken, authorizationHeader),
      playbackAlbum,
    )) {
      return null;
    }

    const items = repository.listPlaybackAlbumPlaylistItems(albumId);
    const cover = items[0];
    const sortedTakenAt = items
      .map((item) => item.takenAt)
      .filter((takenAt): takenAt is string => Boolean(takenAt))
      .sort();
    const latestTakenAt = sortedTakenAt[sortedTakenAt.length - 1];

    return {
      albumId: playbackAlbum.playbackAlbumId,
      coverImageUrl: cover?.displayImageUrl ?? '',
      coverPhotoId: cover?.photoId ?? playbackAlbum.coverPhotoId,
      description: playbackAlbum.description,
      items,
      latestTakenAt,
      photoCount: items.length,
      thumbnailUrl: cover?.thumbnailUrl ?? '',
      title: playbackAlbum.title,
      updatedAt: playbackAlbum.updatedAt,
    };
  }

  getDeviceBindSession(bindCode: string): DeviceBindSessionResponse {
    cleanupExpiredBindSessions();

    const normalizedCode = normalizeBindCode(bindCode);
    const existing = bindSessions.get(normalizedCode);
    if (!existing) {
      const now = new Date().toISOString();
      return {
        bindCode: normalizedCode,
        createdAt: now,
        expiresAt: now,
        status: 'expired',
      };
    }

    if (new Date(existing.expiresAt).getTime() <= Date.now()) {
      const expired: DeviceBindSessionResponse = {
        ...existing,
        status: 'expired',
      };
      bindSessions.set(normalizedCode, expired);
      return expired;
    }

    return existing;
  }

  getPhotoAsset(
    photoId: string,
    variant?: PhotoAssetVariant,
  ): MaybePromise<PhotoSourceAsset | null> {
    return this.getPhotoSources().getActiveSource().getPhotoAsset?.(photoId, variant) ?? null;
  }

  getDerivativeAsset(photoId: string, filename: string): PhotoSourceAsset | null {
    return this.getSqliteSource().repository.getDerivativeAsset(photoId, filename);
  }

  getPhotoLibraryOverview(): PhotoLibraryOverview {
    return {
      ...this.getSqliteSource().repository.getOverview(),
      lastScanJob: lastPhotoScanJob,
    };
  }

  getPhotoCenterItems(query: PhotoCenterQueryInput = {}): MaybePromise<PhotoCenterListResponse> {
    const listQuery: PhotoCenterListQuery = {
      aiCommentStatus: normalizePhotoCenterStatus(query.aiCommentStatus),
      aiScoreStatus: normalizePhotoCenterStatus(query.aiScoreStatus),
      aiTag: query.aiTag?.trim() || undefined,
      albumId: query.albumId?.trim() || undefined,
      keyword: query.keyword?.trim() || undefined,
      page: parsePositiveInteger(query.page),
      pageSize: parsePositiveInteger(query.pageSize),
      sourceType: query.sourceType === 'feiniu' ? 'feiniu' : query.sourceType === 'local' ? 'local' : undefined,
    };
    const sqliteSource = this.getSqliteSource();
    const response = sqliteSource.repository.listPhotoCenterItems(listQuery);
    return isPromiseLike(response)
      ? response.then((resolvedResponse) => this.signPhotoAssetUrls(resolvedResponse))
      : this.signPhotoAssetUrls(response);
  }

  createPlaybackAlbum(input: CreatePlaybackAlbumInput): PlaybackAlbum {
    return this.signPhotoAssetUrls(
      this.getSqliteSource().repository.createPlaybackAlbum(input),
    );
  }

  updatePlaybackAlbum(
    playbackAlbumId: string,
    input: UpdatePlaybackAlbumInput,
  ): PlaybackAlbum {
    return this.signPhotoAssetUrls(
      this.getSqliteSource().repository.updatePlaybackAlbum(playbackAlbumId, input),
    );
  }

  deletePlaybackAlbum(playbackAlbumId: string): DeletePlaybackAlbumResult {
    return this.getSqliteSource().repository.deletePlaybackAlbum(playbackAlbumId);
  }

  getAiSettings(): AiSettings {
    return this.getSqliteSource().repository.getAiSettings();
  }

  updateAiSettings(input: UpdateAiSettingsInput): AiSettings {
    const settings = this.getSqliteSource().repository.updateAiSettings(input);
    this.reschedulePlaybackAlbumAiScheduler();
    return settings;
  }

  listPlaybackAlbums(): MaybePromise<PlaybackAlbum[]> {
    const albums = this.getSqliteSource().repository.listPlaybackAlbums();
    const mountedAlbums = albums.filter(
      (album) => album.sourceType === 'feiniu_album' && album.sourceAlbumId,
    );
    if (mountedAlbums.length === 0) return this.signPhotoAssetUrls(albums);

    const sourceAlbums = this.listFeiniuAlbumsForCuration();
    const enrichAlbums = (items: AlbumSummary[]) => {
      const sourceAlbumsById = new Map(items.map((item) => [item.albumId, item]));
      const enrichedAlbums = albums.map((album) => {
        if (album.sourceType !== 'feiniu_album' || !album.sourceAlbumId) return album;
        const sourceAlbum = sourceAlbumsById.get(album.sourceAlbumId);
        if (!sourceAlbum) return album;
        return {
          ...album,
          coverImageUrl: album.coverImageUrl || sourceAlbum.coverImageUrl,
          coverPhotoId: album.coverPhotoId || sourceAlbum.coverPhotoId,
          photoCount: album.photoCount + sourceAlbum.photoCount,
          sourceAlbumTitle: album.sourceAlbumTitle || sourceAlbum.title,
          thumbnailUrl: album.thumbnailUrl || sourceAlbum.thumbnailUrl,
        };
      });
      return this.signPhotoAssetUrls(enrichedAlbums);
    };

    return isPromiseLike(sourceAlbums)
      ? sourceAlbums.then(enrichAlbums)
      : enrichAlbums(sourceAlbums);
  }

  listTvDevices(): TvDevice[] {
    return this.getSqliteSource().repository.listTvDevices();
  }

  updateTvDevice(deviceId: string, input: UpdateTvDeviceInput): TvDevice {
    return this.getSqliteSource().repository.updateTvDevice(deviceId, input);
  }

  listFeiniuAlbumsForCuration(): MaybePromise<AlbumSummary[]> {
    const albums = this.getPhotoSources().getActiveSource().listAlbums();
    const filterFeiniuAlbums = (items: AlbumSummary[]) =>
      items.filter((album) => inferPhotoCenterSourceTypeFromAlbumId(album.albumId) === 'feiniu');
    return isPromiseLike(albums) ? albums.then(filterFeiniuAlbums) : filterFeiniuAlbums(albums);
  }

  addPhotosToPlaybackAlbum(
    playbackAlbumId: string,
    photoIds: string[] = [],
  ): AddPlaybackAlbumPhotosResult {
    return this.getSqliteSource()
      .repository
      .addPhotosToPlaybackAlbum(playbackAlbumId, photoIds);
  }

  async addFeiniuAlbumsToPlaybackAlbum(
    playbackAlbumId: string,
    sourceAlbumIds: string[] = [],
  ): Promise<AddPlaybackAlbumPhotosResult> {
    const repository = this.getSqliteSource().repository;
    const targetAlbum = repository
      .listPlaybackAlbums()
      .find((album) => album.playbackAlbumId === playbackAlbumId);
    if (!targetAlbum) throw new Error(`Playback album not found: ${playbackAlbumId}`);

    const uniqueSourceAlbumIds = [
      ...new Set(sourceAlbumIds.map((albumId) => albumId.trim()).filter(Boolean)),
    ];
    if (uniqueSourceAlbumIds.length === 0) {
      return repository.addPhotosToPlaybackAlbum(playbackAlbumId, []);
    }

    const feiniuAlbums = await Promise.resolve(this.listFeiniuAlbumsForCuration());
    const feiniuAlbumsById = new Map(
      feiniuAlbums.map((album) => [album.albumId, album]),
    );
    const source = this.getPhotoSourceById('feiniu') ?? this.getPhotoSources().getActiveSource();
    const photoIds: string[] = [];

    for (const sourceAlbumId of uniqueSourceAlbumIds) {
      const sourceAlbum = feiniuAlbumsById.get(sourceAlbumId);
      const sourceItems = await Promise.resolve(source.listPlaylistItems(sourceAlbumId));
      const albumContext: PlaybackAlbum = {
        ...targetAlbum,
        description: targetAlbum.description ||
          `Mounted Feiniu album: ${sourceAlbum?.title ?? sourceAlbumId}`,
        sourceAlbumId,
        sourceAlbumTitle: sourceAlbum?.title ?? sourceAlbumId,
        sourceType: 'feiniu_album',
      };
      repository.syncExternalPhotoCenterItems(
        sourceItems.map((item) =>
          playlistItemToExternalPhotoCenterItem(item, albumContext),
        ),
      );
      for (const item of sourceItems) {
        photoIds.push(item.photoId);
        const asset = await Promise.resolve(source.getPhotoAsset?.(item.photoId, 'original') ?? null)
          .catch(() => null);
        if (!asset) continue;
        if (asset.kind === 'remote') {
          const buffer = await streamToBuffer(asset.stream).catch(() => undefined);
          if (buffer) {
            await repository.ensurePhotoThumbnail(item.photoId, { buffer }).catch(() => undefined);
          }
        } else {
          await repository.ensurePhotoThumbnail(item.photoId, { path: asset.path }).catch(() => undefined);
        }
      }
    }

    return repository.addPhotosToPlaybackAlbum(playbackAlbumId, photoIds);
  }

  listPlaybackAlbumItems(playbackAlbumId: string): MaybePromise<PhotoCenterItem[]> {
    const repository = this.getSqliteSource().repository;
    const localItems = repository
      .listPlaybackAlbumItems(playbackAlbumId)
      .map((item) => ({
        ...item,
        removable: true,
      }));
    const playbackAlbum = repository
      .listPlaybackAlbums()
      .find((album) => album.playbackAlbumId === playbackAlbumId);

    if (
      !playbackAlbum ||
      playbackAlbum.sourceType !== 'feiniu_album' ||
      !playbackAlbum.sourceAlbumId
    ) {
      return this.signPhotoAssetUrls(localItems);
    }

    const persistedSourceItems = repository.listPhotoCenterAlbumItems(
      playbackAlbum.sourceAlbumId,
      'feiniu',
    );
    const persistedSourceItemsByPhotoId = new Map(
      persistedSourceItems.map((item) => [item.photoId, item]),
    );
    const sourceItems = (this.getPhotoSourceById('feiniu') ?? this.getPhotoSources().getActiveSource())
      .listPlaylistItems(playbackAlbum.sourceAlbumId);
    const mergeItems = (items: PlaylistItem[]) => {
      const liveItems = items.map((item) => {
        const mapped = playlistItemToPhotoCenterItem(item, playbackAlbum);
        return mergePersistedPhotoCenterState(
          mapped,
          persistedSourceItemsByPhotoId.get(mapped.photoId),
        );
      });
      const livePhotoIds = new Set(liveItems.map((item) => item.photoId));
      const persistedOnlyItems = persistedSourceItems
        .filter((item) => !livePhotoIds.has(item.photoId))
        .map((item) => ({
          ...item,
          removable: false,
        }));
      return mergePlaybackAlbumItems(localItems, [
        ...liveItems,
        ...persistedOnlyItems,
      ]);
    };

    return isPromiseLike(sourceItems)
      ? sourceItems.then((items) => this.signPhotoAssetUrls(mergeItems(items)))
      : this.signPhotoAssetUrls(mergeItems(sourceItems));
  }

  removePhotoFromPlaybackAlbum(
    playbackAlbumId: string,
    photoId: string,
  ): RemovePlaybackAlbumPhotoResult {
    return this.getSqliteSource()
      .repository
      .removePhotoFromPlaybackAlbum(playbackAlbumId, photoId);
  }

  updatePhotoAiComment(
    photoId: string,
    input: UpdatePhotoAiCommentInput,
  ): PhotoCenterItem {
    return this.signPhotoAssetUrls(
      this.getSqliteSource().repository.updatePhotoAiComment(photoId, input),
    );
  }

  updatePhotoAiInsight(
    photoId: string,
    input: UpdatePhotoAiInsightInput,
  ): PhotoCenterItem {
    return this.signPhotoAssetUrls(
      this.getSqliteSource().repository.updatePhotoAiInsight(photoId, input),
    );
  }

  syncPhotoAiDetail(photoId: string): PhotoCenterItem {
    const repository = this.getSqliteSource().repository;
    const normalizedPhotoId = photoId.trim();
    const item = repository.listPhotoCenterItems({
      keyword: normalizedPhotoId,
      page: 1,
      pageSize: 100,
    }).items.find((candidate) => candidate.photoId === normalizedPhotoId);
    if (!item) throw new Error(`Photo not found: ${normalizedPhotoId}`);
    if (!item.aiDetail.trim()) {
      throw new Error('Photo has no stored AI response');
    }

    const insight = normalizeStoredAiDetail(item.aiDetail);
    repository.applyPhotoAiInsights([
      {
        ...insight,
        photoId: normalizedPhotoId,
      },
    ]);

    return this.signPhotoAssetUrls(repository.listPhotoCenterItems({
      keyword: normalizedPhotoId,
      page: 1,
      pageSize: 100,
    }).items.find((candidate) => candidate.photoId === normalizedPhotoId) ?? item);
  }

  updatePhotoMetadata(
    photoId: string,
    input: UpdatePhotoMetadataInput,
  ): PhotoCenterItem {
    return this.signPhotoAssetUrls(
      this.getSqliteSource().repository.updatePhotoMetadata(photoId, input),
    );
  }

  private signPhotoAssetUrls<T>(value: T): T {
    return signPhotoAssetUrls(value);
  }

  trashPhoto(photoId: string): TrashPhotoResult {
    return this.getSqliteSource().repository.trashPhoto(photoId);
  }

  updatePlaybackAlbumAiPolicy(
    playbackAlbumId: string,
    input: UpdatePlaybackAlbumAiPolicyInput,
  ): PlaybackAlbumAiPolicyUpdateResult {
    const repository = this.getSqliteSource().repository;
    const album = repository.updatePlaybackAlbumAiPolicy(playbackAlbumId, input);
    return { album };
  }

  createPlaybackAlbumAiJob(
    playbackAlbumId: string,
    input: { jobId?: string } = {},
  ): MaybePromise<PlaybackAlbumAiJobResult> {
    return this.enqueuePlaybackAlbumJob(() =>
      this.runPlaybackAlbumAiJob(playbackAlbumId, input),
    );
  }

  createPlaybackAlbumScanJob(playbackAlbumId: string): MaybePromise<PlaybackAlbumScanJobResult> {
    return this.enqueuePlaybackAlbumJob(() =>
      this.runPlaybackAlbumScanJob(playbackAlbumId),
    );
  }

  async createPhotoAiJob(
    photoId: string,
    input: { jobId?: string } = {},
  ): Promise<PlaybackAlbumAiJobResult> {
    const repository = this.getSqliteSource().repository;
    const startedAt = new Date().toISOString();
    const aiSettings = repository.getAiRuntimeSettings();
    const item = repository.listPhotoCenterItems({
      keyword: photoId.trim(),
      page: 1,
      pageSize: 1,
    }).items.find((candidate) => candidate.photoId === photoId.trim());
    if (!item) throw new Error(`Photo not found: ${photoId}`);

    const task = this.createAiRecognitionTask({
      albumId: item.albumId,
      albumTitle: item.albumName,
      jobId: input.jobId,
      requestedPhotoCount: 1,
      targetId: item.photoId,
      targetTitle: item.captionTitle || item.filename,
      targetType: 'photo',
    });
    this.aiTaskByPhotoId.set(item.photoId, task.jobId);
    this.updateAiRecognitionTask(task.jobId, {
      activePhotoId: item.photoId,
      activePhotoName: item.filename,
      status: 'running',
    });

    repository.markPhotoAiPending(item.photoId, { clearAiComment: true });
    let result = { generatedPhotoCount: 0, requestedPhotoCount: 1, skippedPhotoCount: 1 };
    try {
      const playbackAlbum = this.resolveAiAlbumForPhoto(repository, item);
      const derivative = await this.ensurePhotoDerivativesForAiTarget(repository, item);
      const insight = await this.analyzePhotoAiTarget(
        repository,
        item,
        playbackAlbum,
        derivative,
        aiSettings,
        true,
        true,
      );
      result = insight
        ? repository.applyPhotoAiInsights([
          {
            ...insight,
            photoId: item.photoId,
          },
        ], { forceOverwriteLockedComment: true })
        : result;
      if (result.generatedPhotoCount > 0) {
        this.aiTaskByPhotoId.delete(item.photoId);
        this.finishAiRecognitionTask(task.jobId, {
          completedPhotoCount: 1,
          skippedPhotoCount: 0,
        });
      } else {
        this.updateAiRecognitionTask(task.jobId, {
          skippedPhotoCount: 1,
          status: 'retrying',
        });
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.aiTaskByPhotoId.delete(item.photoId);
      this.finishAiRecognitionTask(task.jobId, {
        error: reason,
        failedPhotoCount: 1,
        status: 'failed',
      });
      throw error;
    }
    const finishedAt = new Date().toISOString();
    return {
      finishedAt,
      generatedPhotoCount: result.generatedPhotoCount,
      importedSourcePhotoCount: 0,
      jobId: task.jobId,
      requestedPhotoCount: 1,
      skippedPhotoCount: 1 - result.generatedPhotoCount,
      startedAt,
      status: 'completed',
    };
  }

  async createPhotoCenterBackfillJob(
    input: PhotoCenterBackfillJobInput = {},
  ): Promise<PhotoCenterBackfillJobResult> {
    const repository = this.getSqliteSource().repository;
    const startedAt = new Date().toISOString();
    const aiSettings = repository.getAiRuntimeSettings();
    const targets = this.listPhotoCenterBackfillTargets(repository, input);
    const task = this.createAiRecognitionTask({
      albumId: 'photo-center',
      albumTitle: '照片中心',
      jobId: input.jobId,
      requestedPhotoCount: targets.length,
      targetId: 'photo-center-backfill',
      targetTitle: '照片中心补齐',
      targetType: 'backfill',
    });
    this.updateAiRecognitionTask(task.jobId, {
      status: targets.length > 0 ? 'running' : 'completed',
    });

    let completedPhotoCount = 0;
    let failedPhotoCount = 0;
    let generatedPhotoCount = 0;
    let skippedPhotoCount = 0;
    let transcodedPhotoCount = 0;

    for (const item of targets) {
      this.updateAiRecognitionTask(task.jobId, {
        activePhotoId: item.photoId,
        activePhotoName: item.filename,
      });
      try {
        const beforeReady = repository.hasCurrentTvBlurFillDerivative(item.photoId);
        const derivative = await this.ensurePhotoDerivativesForAiTarget(
          repository,
          item,
        );
        if (
          !beforeReady &&
          derivative.derivativeStatus === 'ready' &&
          repository.hasCurrentTvBlurFillDerivative(item.photoId)
        ) {
          transcodedPhotoCount += 1;
        }

        if (shouldBackfillPhotoAi(item)) {
          const playbackAlbum = this.resolveAiAlbumForPhoto(repository, item);
          const insight = await this.analyzePhotoAiTarget(
            repository,
            item,
            playbackAlbum,
            derivative,
            aiSettings,
            true,
            false,
          );
          if (insight) {
            const result = repository.applyPhotoAiInsights([
              {
                ...insight,
                photoId: item.photoId,
              },
            ]);
            generatedPhotoCount += result.generatedPhotoCount;
          } else {
            skippedPhotoCount += 1;
          }
        }

        completedPhotoCount += 1;
        this.updateAiRecognitionTask(task.jobId, {
          completedPhotoCount,
          failedPhotoCount,
          skippedPhotoCount,
        });
      } catch (error) {
        failedPhotoCount += 1;
        this.updateAiRecognitionTask(task.jobId, {
          error: error instanceof Error ? error.message : String(error),
          failedPhotoCount,
        });
      }
    }

    this.finishAiRecognitionTask(task.jobId, {
      completedPhotoCount,
      failedPhotoCount,
      skippedPhotoCount,
      status: failedPhotoCount > 0 ? 'failed' : 'completed',
    });

    return {
      failedPhotoCount,
      finishedAt: new Date().toISOString(),
      generatedPhotoCount,
      importedSourcePhotoCount: 0,
      jobId: task.jobId,
      requestedPhotoCount: targets.length,
      skippedPhotoCount,
      startedAt,
      status: 'completed',
      targetPhotoCount: targets.length,
      transcodedPhotoCount,
    };
  }

  private listPhotoCenterBackfillTargets(
    repository: SqlitePhotoRepository,
    input: PhotoCenterBackfillJobInput,
  ): PhotoCenterItem[] {
    const pageSize = 100;
    const targets: PhotoCenterItem[] = [];
    const maxTargets =
      typeof input.limit === 'number' && Number.isFinite(input.limit)
        ? Math.max(Math.floor(input.limit), 0)
        : Number.POSITIVE_INFINITY;
    let page = 1;
    let total = Number.POSITIVE_INFINITY;

    while ((page - 1) * pageSize < total && targets.length < maxTargets) {
      const response = repository.listPhotoCenterItems({
        page,
        pageSize,
        sourceType: input.sourceType,
      });
      total = response.total;
      for (const item of response.items) {
        if (!shouldBackfillPhoto(item)) continue;
        targets.push(item);
        if (targets.length >= maxTargets) break;
      }
      page += 1;
    }

    return targets;
  }

  private runPlaybackAlbumAiJob(
    playbackAlbumId: string,
    input: { jobId?: string } = {},
  ): MaybePromise<PlaybackAlbumAiJobResult> {
    const repository = this.getSqliteSource().repository;
    const startedAt = new Date().toISOString();
    const aiSettings = repository.getAiRuntimeSettings();
    const playbackAlbum = repository
      .listPlaybackAlbums()
      .find((album) => album.playbackAlbumId === playbackAlbumId);
    if (!playbackAlbum) throw new Error(`Playback album not found: ${playbackAlbumId}`);

    const task = this.createAiRecognitionTask({
      albumId: playbackAlbum.playbackAlbumId,
      albumTitle: playbackAlbum.title,
      jobId: input.jobId,
      requestedPhotoCount: 0,
      targetId: playbackAlbum.playbackAlbumId,
      targetTitle: playbackAlbum.title,
      targetType: 'album',
    });

    const sourceImport = this.importPlaybackAlbumSourcePhotos(
      repository,
      playbackAlbum,
    );
    const runAi = async (
      importResult: PhotoCenterExternalSyncResult | undefined,
    ): Promise<PlaybackAlbumAiJobResult> => {
      const today = new Date().toISOString().slice(0, 10);
      const dailyLimit = resolvePlaybackAlbumDailyAiLimit(playbackAlbum, aiSettings);
      const usedToday = playbackAlbum.aiDailyProcessedOn === today
        ? playbackAlbum.aiDailyProcessedCount
        : 0;
      const remainingToday = Math.max(dailyLimit - usedToday, 0);
      const allAiTargets = playbackAlbum.aiEnabled
        ? this.listPlaybackAlbumAiTargets(repository, playbackAlbum)
        : [];
      const aiTargets = allAiTargets.slice(0, remainingToday);
      this.updateAiRecognitionTask(task.jobId, {
        requestedPhotoCount: aiTargets.length,
        status: 'running',
      });
      let completedPhotoCount = 0;
      let skippedPhotoCount = 0;
      const aiResults = await Promise.all(
        aiTargets.map(async (item) => {
          this.updateAiRecognitionTask(task.jobId, {
            activePhotoId: item.photoId,
            activePhotoName: item.filename,
          });
          const derivative = await this.ensurePhotoDerivativesForAiTarget(
            repository,
            item,
          );
          const insight = await this.analyzePhotoAiTarget(
            repository,
            item,
            playbackAlbum,
            derivative,
            aiSettings,
            true,
            false,
          );
          if (!insight) {
            skippedPhotoCount += 1;
            this.updateAiRecognitionTask(task.jobId, {
              skippedPhotoCount,
            });
            return null;
          }
          completedPhotoCount += 1;
          this.updateAiRecognitionTask(task.jobId, {
            completedPhotoCount,
          });
          return {
            ...insight,
            photoId: item.photoId,
          };
        }),
      );
      const insights = aiResults.filter(
        (insight): insight is PhotoAiInsightInput => insight !== null,
      );
      const result = repository.applyPhotoAiInsights(insights);
      const finishedAt = new Date().toISOString();
      repository.markPlaybackAlbumAiChecked(playbackAlbum.playbackAlbumId, finishedAt);
      if (aiTargets.length > 0) {
        repository.markPlaybackAlbumAiProcessed(
          playbackAlbum.playbackAlbumId,
          today,
          aiTargets.length,
        );
      }
      this.finishAiRecognitionTask(task.jobId, {
        completedPhotoCount: result.generatedPhotoCount,
        skippedPhotoCount: allAiTargets.length - result.generatedPhotoCount,
      });

      return {
        finishedAt,
        generatedPhotoCount: result.generatedPhotoCount,
        importedSourcePhotoCount: importResult?.importedPhotoCount ?? 0,
        jobId: task.jobId,
        requestedPhotoCount: aiTargets.length,
        skippedPhotoCount: allAiTargets.length - result.generatedPhotoCount,
        startedAt,
        status: 'completed',
      };
    };

    const result = isPromiseLike(sourceImport)
      ? sourceImport.then(runAi)
      : runAi(sourceImport);
    if (isPromiseLike(result)) {
      return result.catch((error) => {
        const reason = error instanceof Error ? error.message : String(error);
        this.finishAiRecognitionTask(task.jobId, {
          error: reason,
          failedPhotoCount: Math.max(task.requestedPhotoCount, 1),
          status: 'failed',
        });
        throw error;
      });
    }
    return result;
  }

  private async analyzePhotoAiTarget(
    repository: SqlitePhotoRepository,
    item: PhotoCenterItem,
    playbackAlbum: PlaybackAlbum,
    derivative: PhotoDerivativeAssets,
    aiSettings: AiRuntimeSettings,
    scheduleRetry: boolean,
    forceOverwriteLockedComment = false,
  ): Promise<UnifiedAiInsight | null> {
    if (
      derivative.derivativeStatus !== 'ready' ||
      !derivative.aiImageUrl.startsWith('data:image/')
    ) {
      const reason = 'AI image derivative is not ready';
      if (scheduleRetry) {
        this.schedulePhotoAiRetry(item.photoId, reason, forceOverwriteLockedComment);
      }
      repository.markPhotoAiPending(item.photoId, {
        clearAiComment: forceOverwriteLockedComment,
      });
      return null;
    }

    try {
      const requestedAt = Date.now();
      console.info('ai-analyze-start', {
        photoId: item.photoId,
        waitQueueLength: this.visionAiWaitQueue.length,
      });
      const insight = await this.runWithVisionAiSlot(() =>
        Promise.resolve(
          this.visionAi.analyze({
            album: playbackAlbum,
            derivative,
            item,
            settings: aiSettings,
          }),
        ),
      );
      console.info('ai-analyze-success', {
        durationMs: Date.now() - requestedAt,
        hasComment: Boolean(insight.aiComment.trim()),
        photoId: item.photoId,
      });
      this.aiRetryAttempts.delete(item.photoId);
      this.aiRetryForceOverwrite.delete(item.photoId);
      const retryTimer = this.aiRetryTimers.get(item.photoId);
      if (retryTimer) {
        clearTimeout(retryTimer);
        this.aiRetryTimers.delete(item.photoId);
      }
      return insight;
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Vision AI request failed';
      console.warn('ai-analyze-retry', {
        forceOverwriteLockedComment,
        photoId: item.photoId,
        reason,
      });
      if (scheduleRetry) {
        this.schedulePhotoAiRetry(item.photoId, reason, forceOverwriteLockedComment);
      }
      return null;
    }
  }

  private async runWithVisionAiSlot<T>(run: () => Promise<T>): Promise<T> {
    await this.acquireVisionAiSlot();
    try {
      return await run();
    } finally {
      this.releaseVisionAiSlot();
    }
  }

  private acquireVisionAiSlot(): Promise<void> {
    if (this.activeVisionAiRequestCount < maxConcurrentVisionAiRequests) {
      this.activeVisionAiRequestCount += 1;
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      this.visionAiWaitQueue.push(() => {
        this.activeVisionAiRequestCount += 1;
        resolve();
      });
    });
  }

  private releaseVisionAiSlot(): void {
    this.activeVisionAiRequestCount = Math.max(0, this.activeVisionAiRequestCount - 1);
    const next = this.visionAiWaitQueue.shift();
    if (next) next();
  }

  private schedulePhotoAiRetry(
    photoId: string,
    reason: string,
    forceOverwriteLockedComment = false,
  ): void {
    const normalizedPhotoId = photoId.trim();
    if (!normalizedPhotoId) return;
    if (forceOverwriteLockedComment) {
      this.aiRetryForceOverwrite.set(normalizedPhotoId, true);
    }
    const existingTaskId = this.aiTaskByPhotoId.get(normalizedPhotoId);
    if (existingTaskId) {
      this.updateAiRecognitionTask(existingTaskId, {
        error: reason,
        status: 'retrying',
      });
    } else {
      const task = this.createAiRecognitionTask({
        requestedPhotoCount: 1,
        targetId: normalizedPhotoId,
        targetTitle: normalizedPhotoId,
        targetType: 'retry',
      });
      this.aiTaskByPhotoId.set(normalizedPhotoId, task.jobId);
      this.updateAiRecognitionTask(task.jobId, {
        error: reason,
        status: 'retrying',
      });
    }
    if (this.aiRetryTimers.has(normalizedPhotoId)) return;

    const attempts = this.aiRetryAttempts.get(normalizedPhotoId) ?? 0;
    if (attempts >= 3) {
      this.getSqliteSource().repository.markPhotoAiFailed(normalizedPhotoId, reason);
      const taskId = this.aiTaskByPhotoId.get(normalizedPhotoId);
      this.finishAiRecognitionTask(taskId, {
        error: reason,
        failedPhotoCount: 1,
        status: 'failed',
      });
      this.aiTaskByPhotoId.delete(normalizedPhotoId);
      this.aiRetryForceOverwrite.delete(normalizedPhotoId);
      return;
    }

    this.getSqliteSource().repository.markPhotoAiPending(normalizedPhotoId, {
      clearAiComment: forceOverwriteLockedComment,
    });
    this.aiRetryAttempts.set(normalizedPhotoId, attempts + 1);
    const delayMs = Math.min(60_000, 10_000 * (attempts + 1));
    const timer = setTimeout(() => {
      this.aiRetryTimers.delete(normalizedPhotoId);
      void this.retryPhotoAiJob(normalizedPhotoId, reason);
    }, delayMs);
    this.aiRetryTimers.set(normalizedPhotoId, timer);
    (timer as ReturnType<typeof setTimeout> & { unref?: () => void }).unref?.();
  }

  private async retryPhotoAiJob(photoId: string, previousReason: string): Promise<void> {
    const repository = this.getSqliteSource().repository;
    const aiSettings = repository.getAiRuntimeSettings();
    const forceOverwriteLockedComment = this.aiRetryForceOverwrite.get(photoId) === true;
    const item = repository.listPhotoCenterItems({
      keyword: photoId,
      page: 1,
      pageSize: 1,
    }).items.find((candidate) => candidate.photoId === photoId);
    if (!item) return;

    const taskId = this.aiTaskByPhotoId.get(photoId);
    this.updateAiRecognitionTask(taskId, {
      activePhotoId: item.photoId,
      activePhotoName: item.filename,
      status: 'running',
    });

    const playbackAlbum = this.resolveAiAlbumForPhoto(repository, item);
    const derivative = await this.ensurePhotoDerivativesForAiTarget(repository, item)
      .catch(() => null);
    if (!derivative) {
      this.schedulePhotoAiRetry(photoId, previousReason, forceOverwriteLockedComment);
      return;
    }

    const insight = await this.analyzePhotoAiTarget(
      repository,
      item,
      playbackAlbum,
      derivative,
      aiSettings,
      false,
      forceOverwriteLockedComment,
    );
    if (insight) {
      repository.applyPhotoAiInsights([
        {
          ...insight,
          photoId: item.photoId,
        },
      ], { forceOverwriteLockedComment });
      this.finishAiRecognitionTask(taskId, {
        completedPhotoCount: 1,
        skippedPhotoCount: 0,
      });
      this.aiTaskByPhotoId.delete(photoId);
      this.aiRetryForceOverwrite.delete(photoId);
      return;
    }

    const attempts = this.aiRetryAttempts.get(photoId) ?? 0;
    if (attempts < 3) {
      this.schedulePhotoAiRetry(photoId, previousReason, forceOverwriteLockedComment);
    } else {
      repository.markPhotoAiFailed(photoId, previousReason);
      const taskId = this.aiTaskByPhotoId.get(photoId);
      this.finishAiRecognitionTask(taskId, {
        error: previousReason,
        failedPhotoCount: 1,
        status: 'failed',
      });
      this.aiTaskByPhotoId.delete(photoId);
      this.aiRetryForceOverwrite.delete(photoId);
    }
  }

  private resolveAiAlbumForPhoto(
    repository: SqlitePhotoRepository,
    item: PhotoCenterItem,
  ): PlaybackAlbum {
    const albums = repository.listPlaybackAlbums();
    for (const album of albums) {
      if (repository.listPlaybackAlbumItems(album.playbackAlbumId).some(
        (member) => member.photoId === item.photoId,
      )) {
        return album;
      }
    }
    return {
      authorizedDeviceIds: [],
      aiDailyLimit: 0,
      aiDailyProcessedCount: 0,
      aiDailyProcessedOn: '',
      aiEnabled: true,
      aiPriorityTags: [],
      aiRepeatIntervalMinutes: 1440,
      aiScoreThreshold: 80,
      coverImageUrl: item.thumbnailUrl,
      coverPhotoId: item.photoId,
      createdAt: '',
      description: '',
      lastAiCheckedAt: '',
      photoCount: 1,
      playbackAlbumId: 'single_photo_refresh',
      pushBeautyScoreThreshold: 70,
      pushEnabled: true,
      pushMemoryScoreThreshold: 80,
      pushPriorityTags: [],
      pushScoreThreshold: 80,
      sourceAlbumId: item.sourceAlbumId,
      sourceAlbumTitle: item.importAlbumTitle || item.albumName,
      sourceType: item.sourceType === 'feiniu' ? 'feiniu_album' : 'manual',
      title: item.importAlbumTitle || item.albumName || '单张照片刷新',
      thumbnailUrl: item.thumbnailUrl,
      updatedAt: '',
    };
  }

  private async runPlaybackAlbumScanJob(
    playbackAlbumId: string,
  ): Promise<PlaybackAlbumScanJobResult> {
    const repository = this.getSqliteSource().repository;
    const startedAt = new Date().toISOString();
    const playbackAlbum = repository
      .listPlaybackAlbums()
      .find((album) => album.playbackAlbumId === playbackAlbumId);
    if (!playbackAlbum) throw new Error(`Playback album not found: ${playbackAlbumId}`);

    const sourceImport = await Promise.resolve(
      this.importPlaybackAlbumSourcePhotos(repository, playbackAlbum),
    );
    const items = await Promise.resolve(this.listPlaybackAlbumItems(playbackAlbumId));
    let transcodedPhotoCount = 0;
    for (const item of items) {
      const beforeReady = repository.hasCurrentTvBlurFillDerivative(item.photoId);
      const derivative = await this.ensurePhotoDerivativesForAiTarget(
        repository,
        item,
      );
      if (
        !beforeReady &&
        derivative.derivativeStatus === 'ready' &&
        repository.hasCurrentTvBlurFillDerivative(item.photoId)
      ) {
        transcodedPhotoCount += 1;
      }
    }

    const aiJob = playbackAlbum.aiEnabled
      ? await Promise.resolve(this.runPlaybackAlbumAiJob(playbackAlbumId))
      : {
          finishedAt: new Date().toISOString(),
          generatedPhotoCount: 0,
          importedSourcePhotoCount: sourceImport?.importedPhotoCount ?? 0,
          jobId: `scan_playback_${Date.now().toString(36)}`,
          requestedPhotoCount: 0,
          skippedPhotoCount: 0,
          startedAt,
          status: 'completed' as const,
        };

    return {
      ...aiJob,
      importedSourcePhotoCount:
        Math.max(aiJob.importedSourcePhotoCount, sourceImport?.importedPhotoCount ?? 0),
      startedAt,
      transcodedPhotoCount,
    };
  }

  private enqueuePlaybackAlbumJob<T>(run: () => MaybePromise<T>): Promise<T> {
    const queued = this.playbackAlbumJobQueue.then(
      () => Promise.resolve(run()),
      () => Promise.resolve(run()),
    );
    this.playbackAlbumJobQueue = queued.then(
      () => undefined,
      () => undefined,
    );
    return queued;
  }

  startPlaybackAlbumAiScheduler(): void {
    if (this.aiSchedulerTimer) return;
    this.scheduleNextPlaybackAlbumAiCheck();
  }

  async runDuePlaybackAlbumAiJobs(
    now = new Date(),
  ): Promise<PlaybackAlbumAiSchedulerRunResult> {
    if (this.aiSchedulerRunning) {
      return {
        checkedAt: now.toISOString(),
        dueAlbumCount: 0,
        jobResults: [],
        skippedAlbumCount: 0,
        status: 'running',
      };
    }

    this.aiSchedulerRunning = true;
    try {
      const repository = this.getSqliteSource().repository;
      const enabledAlbums = repository
        .listPlaybackAlbums()
        .filter((album) => album.aiEnabled);
      const dueAlbums = enabledAlbums.filter((album) =>
        isPlaybackAlbumAiDue(album, now),
      );
      const jobResults: PlaybackAlbumAiSchedulerAlbumResult[] = [];

      for (const album of dueAlbums) {
        try {
          const startedAt = now.toISOString();
          const jobId = `ai_album_${Date.now().toString(36)}`;
          repository.markPlaybackAlbumAiChecked(album.playbackAlbumId, startedAt);
          this.createAiRecognitionTask({
            albumId: album.playbackAlbumId,
            albumTitle: album.title,
            jobId,
            requestedPhotoCount: 0,
            targetId: album.playbackAlbumId,
            targetTitle: album.title,
            targetType: 'album',
          });
          void Promise.resolve(
            this.createPlaybackAlbumAiJob(album.playbackAlbumId, { jobId }),
          ).catch((error) => {
            const reason = error instanceof Error ? error.message : String(error);
            console.warn('scheduled-playback-album-ai-job failed', {
              error: reason,
              jobId,
              playbackAlbumId: album.playbackAlbumId,
            });
          });
          jobResults.push({
            finishedAt: '',
            generatedPhotoCount: 0,
            importedSourcePhotoCount: 0,
            jobId,
            playbackAlbumId: album.playbackAlbumId,
            requestedPhotoCount: 0,
            skippedPhotoCount: 0,
            status: 'queued',
            title: album.title,
          });
        } catch (error) {
          jobResults.push({
            error: error instanceof Error ? error.message : String(error),
            generatedPhotoCount: 0,
            importedSourcePhotoCount: 0,
            playbackAlbumId: album.playbackAlbumId,
            requestedPhotoCount: 0,
            skippedPhotoCount: 0,
            status: 'failed',
            title: album.title,
          });
        }
      }

      return {
        checkedAt: now.toISOString(),
        dueAlbumCount: dueAlbums.length,
        jobResults,
        skippedAlbumCount: enabledAlbums.length - dueAlbums.length,
        status: 'completed',
      };
    } finally {
      this.aiSchedulerRunning = false;
    }
  }

  createPhotoLibraryScanJob(input: PhotoLibraryScanInput = {}): PhotoScanJob {
    const sqliteSource = this.getSqliteSource();
    const overview = sqliteSource.repository.getOverview();
    const photoRoot = input.photoRoot?.trim() || overview.photoRoot;
    const startedAt = new Date().toISOString();
    const importResult = sqliteSource.repository.rebuildFromPhotoRoot();
    const finishedAt = new Date().toISOString();

    lastPhotoScanJob = {
      discoveredPhotoCount: importResult.discoveredPhotoCount,
      finishedAt,
      importedPhotoCount: importResult.importedPhotoCount,
      jobId: `scan_${Date.now().toString(36)}`,
      photoRoot,
      startedAt,
      status: 'completed',
    };

    void this.ensurePhotoCenterThumbnails().catch(() => undefined);
    return lastPhotoScanJob;
  }

  private async ensurePhotoCenterThumbnails(): Promise<void> {
    const repository = this.getSqliteSource().repository;
    const page = repository.listPhotoCenterItems({ page: 1, pageSize: 100 });
    for (const item of page.items) {
      await repository.ensurePhotoThumbnail(item.photoId).catch(() => undefined);
    }
  }

  async createFeiniuPhotoSyncJob(): Promise<FeiniuPhotoSyncJob> {
    const startedAt = new Date().toISOString();
    try {
      const finishedAt = new Date().toISOString();
      const albums = await Promise.resolve(this.listFeiniuAlbumsForCuration());

      return {
        albumCount: albums.length,
        discoveredPhotoCount: 0,
        finishedAt,
        importedPhotoCount: 0,
        jobId: `feiniu_sync_${Date.now().toString(36)}`,
        startedAt,
        status: 'completed',
        syncedAt: finishedAt,
        updatedPhotoCount: 0,
      };
    } catch (error) {
      const finishedAt = new Date().toISOString();
      return {
        albumCount: 0,
        discoveredPhotoCount: 0,
        error: error instanceof Error ? error.message : String(error),
        finishedAt,
        importedPhotoCount: 0,
        jobId: `feiniu_sync_${Date.now().toString(36)}`,
        startedAt,
        status: 'failed',
        syncedAt: finishedAt,
        updatedPhotoCount: 0,
      };
    }
  }

  getPhotoSourceConfig(): PhotoSourceConfigResponse {
    const photoSources = this.getPhotoSources();
    const overview = this.getSqliteSource().repository.getOverview();
    return {
      activeSourceId: photoSources.getActiveSource().id,
      feiniu: getFeiniuRuntimeConfig(this.getEffectivePhotoSourceEnv()),
      local: {
        albumCount: overview.albumCount,
        enabled: true,
        photoCount: overview.photoCount,
      },
    };
  }

  updateFeiniuSettings(input: UpdateFeiniuSettingsInput = {}) {
    const settings = this.getSqliteSource().repository.updateFeiniuSettings(input);
    this.photoSourceConfigKey = '';
    this.photoSourceRefreshDisabled = false;
    this.refreshPhotoSourcesFromSettings();
    return settings;
  }

  testFeiniuConnectivity(
    input: FeiniuConnectivityInput = {},
  ): Promise<FeiniuConnectivityResult> {
    return testFeiniuConnectivity(input, this.getEffectivePhotoSourceEnv());
  }

  getSamplePhotoSvg(
    photoId: string,
    variant: 'display' | 'original' | 'thumb',
  ): string {
    const [sky, warm, ink] = samplePalettes[photoId] ?? samplePalettes.p_001;
    const width = variant === 'thumb' ? 640 : variant === 'display' ? 1920 : 3840;
    const height = variant === 'thumb' ? 360 : variant === 'display' ? 1080 : 2160;

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 1920 1080" role="img" aria-label="sample family memory image">
  <defs>
    <linearGradient id="sky" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="${sky}"/>
      <stop offset="0.58" stop-color="${warm}"/>
      <stop offset="1" stop-color="${ink}"/>
    </linearGradient>
    <radialGradient id="sun" cx="72%" cy="30%" r="45%">
      <stop offset="0" stop-color="#fff7d1" stop-opacity="0.95"/>
      <stop offset="0.42" stop-color="#fff7d1" stop-opacity="0.24"/>
      <stop offset="1" stop-color="#fff7d1" stop-opacity="0"/>
    </radialGradient>
    <filter id="grain">
      <feTurbulence baseFrequency="0.9" numOctaves="2" seed="7" type="fractalNoise"/>
      <feColorMatrix type="saturate" values="0"/>
      <feComponentTransfer>
        <feFuncA slope="0.12" type="linear"/>
      </feComponentTransfer>
    </filter>
  </defs>
  <rect width="1920" height="1080" fill="url(#sky)"/>
  <rect width="1920" height="1080" fill="url(#sun)"/>
  <path d="M0 768 C260 690 430 725 640 682 C910 628 1110 582 1350 650 C1540 704 1700 710 1920 628 L1920 1080 L0 1080 Z" fill="#1f2933" opacity="0.62"/>
  <path d="M0 850 C250 792 430 835 690 782 C985 722 1200 748 1430 795 C1650 840 1780 818 1920 780 L1920 1080 L0 1080 Z" fill="#111827" opacity="0.72"/>
  <circle cx="1180" cy="495" r="62" fill="#f8efe3" opacity="0.9"/>
  <circle cx="1100" cy="520" r="42" fill="#f2dfca" opacity="0.88"/>
  <path d="M1125 575 C1168 625 1218 628 1260 572" fill="none" stroke="#f8efe3" stroke-linecap="round" stroke-width="28" opacity="0.72"/>
  <rect width="1920" height="1080" filter="url(#grain)" opacity="0.35"/>
</svg>`;
  }

  private importPlaybackAlbumSourcePhotos(
    repository: SqlitePhotoRepository,
    playbackAlbum: PlaybackAlbum,
  ): MaybePromise<PhotoCenterExternalSyncResult | undefined> {
    if (
      playbackAlbum.sourceType !== 'feiniu_album' ||
      !playbackAlbum.sourceAlbumId
    ) {
      return undefined;
    }

    const source = this.getPhotoSourceById('feiniu') ?? this.getPhotoSources().getActiveSource();
    const sourceItems = source.listPlaylistItems(playbackAlbum.sourceAlbumId);
    const syncItems = async (items: PlaylistItem[]) => {
      if (items.length === 0) {
        return {
          albumCount: 0,
          discoveredPhotoCount: 0,
          importedPhotoCount: 0,
          syncedAt: new Date().toISOString(),
          updatedPhotoCount: 0,
        };
      }
      const result = repository.syncExternalPhotoCenterItems(
        items.map((item) =>
          playlistItemToExternalPhotoCenterItem(item, playbackAlbum),
        ),
      );
      for (const item of items) {
        const asset = await Promise.resolve(source.getPhotoAsset?.(item.photoId, 'original') ?? null)
          .catch(() => null);
        if (!asset) continue;
        if (asset.kind === 'remote') {
          const buffer = await streamToBuffer(asset.stream).catch(() => undefined);
          if (buffer) {
            await repository.ensurePhotoThumbnail(item.photoId, { buffer }).catch(() => undefined);
          }
        } else {
          await repository.ensurePhotoThumbnail(item.photoId, { path: asset.path }).catch(() => undefined);
        }
      }
      return result;
    };

    return isPromiseLike(sourceItems)
      ? sourceItems.then(syncItems)
      : syncItems(sourceItems);
  }

  private listPlaybackAlbumAiTargets(
    repository: SqlitePhotoRepository,
    playbackAlbum: PlaybackAlbum,
  ): PhotoCenterItem[] {
    const localItems = repository.listPlaybackAlbumItems(
      playbackAlbum.playbackAlbumId,
    );
    const sourceItems = playbackAlbum.sourceType === 'feiniu_album' &&
      playbackAlbum.sourceAlbumId
      ? repository.listPhotoCenterAlbumItems(
        playbackAlbum.sourceAlbumId,
        'feiniu',
      )
      : [];

    return mergePlaybackAlbumItems(localItems, sourceItems).filter(
      (item) =>
        !item.aiLocked &&
        (
          item.aiScoreStatus !== 'completed' ||
          item.aiCommentStatus !== 'completed'
        ),
    );
  }

  private async ensurePhotoDerivativesForAiTarget(
    repository: SqlitePhotoRepository,
    item: PhotoCenterItem,
  ): Promise<PhotoDerivativeAssets> {
    const initialDerivative = await repository.ensurePhotoDerivatives(item.photoId);
    if (initialDerivative.derivativeStatus !== 'remote_pending') {
      return withAiImageDataUrl(repository, item.photoId, initialDerivative);
    }

    const asset = await Promise.resolve(
      this.getPhotoSources().getActiveSource().getPhotoAsset?.(item.photoId, 'display') ??
      null,
    );
    if (!asset) return initialDerivative;

    if ('stream' in asset) {
      const derivative = await repository.ensurePhotoDerivatives(item.photoId, {
        buffer: await streamToBuffer(asset.stream),
      });
      return withAiImageDataUrl(repository, item.photoId, derivative);
    }

    const derivative = await repository.ensurePhotoDerivatives(item.photoId, {
      path: asset.path,
    });
    return withAiImageDataUrl(repository, item.photoId, derivative);
  }

  private reschedulePlaybackAlbumAiScheduler(): void {
    if (!this.aiSchedulerTimer) return;
    clearTimeout(this.aiSchedulerTimer);
    this.aiSchedulerTimer = undefined;
    this.scheduleNextPlaybackAlbumAiCheck();
  }

  private scheduleNextPlaybackAlbumAiCheck(): void {
    const repository = this.getSqliteSource().repository;
    const settings = repository.getAiSettings();
    const delayMs = toSchedulerDelayMs(settings.aiCheckIntervalMinutes);
    this.aiSchedulerTimer = setTimeout(() => {
      this.aiSchedulerTimer = undefined;
      void this.runDuePlaybackAlbumAiJobs()
        .catch(() => undefined)
        .finally(() => this.scheduleNextPlaybackAlbumAiCheck());
    }, delayMs);
    const timer = this.aiSchedulerTimer as ReturnType<typeof setTimeout> & {
      unref?: () => void;
    };
    timer.unref?.();
  }

  private getPhotoSources(): PhotoSourceRegistry {
    if (this.photoSourceRefreshDisabled) return this.photoSources;
    this.refreshPhotoSourcesFromSettings();
    return this.photoSources;
  }

  private refreshPhotoSourcesFromSettings(): void {
    const sqliteSource = this.getSqliteSource();
    const env = this.getEffectivePhotoSourceEnv();
    const key = [
      env.WRJDYK_PHOTO_SOURCE ?? '',
      env.WRJDYK_FEINIU_BASE_URL ?? '',
      env.WRJDYK_FEINIU_USERNAME ?? '',
      env.WRJDYK_FEINIU_PASSWORD ? 'password' : '',
    ].join('\n');
    if (key === this.photoSourceConfigKey) return;

    this.photoSources = createDefaultPhotoSourceRegistry(env, sqliteSource);
    this.photoSourceConfigKey = key;
  }

  private getEffectivePhotoSourceEnv(): Record<string, string | undefined> {
    const saved = this.getSqliteSource().repository.getFeiniuRuntimeSettings();
    return {
      ...process.env,
      WRJDYK_FEINIU_BASE_URL:
        saved.baseUrl.trim() || process.env.WRJDYK_FEINIU_BASE_URL,
      WRJDYK_FEINIU_PASSWORD:
        saved.password.trim() || process.env.WRJDYK_FEINIU_PASSWORD,
      WRJDYK_FEINIU_USERNAME:
        saved.username.trim() || process.env.WRJDYK_FEINIU_USERNAME,
    };
  }

  private getPhotoSourceById(id: string): PhotoSource | undefined {
    const photoSources = this.getPhotoSources();
    const source = photoSources.getSourceById(id);
    if (source) return source;
    const activeSource = photoSources.getActiveSource();
    if (activeSource instanceof CompositePhotoSource) {
      return activeSource.getSourceById(id);
    }
    return undefined;
  }

  private getSqliteSource(): SqlitePhotoSource {
    const source = this.photoSources.getSourceById('sqlite');
    if (source instanceof SqlitePhotoSource) return source;
    const activeSource = this.photoSources.getActiveSource();
    if (activeSource instanceof CompositePhotoSource) {
      const nestedSource = activeSource.getSourceById('sqlite');
      if (nestedSource instanceof SqlitePhotoSource) return nestedSource;
    }
    throw new Error('Active photo source does not support local photo library operations');
  }
}

function withAiImageDataUrl(
  repository: SqlitePhotoRepository,
  photoId: string,
  derivative: PhotoDerivativeAssets,
): PhotoDerivativeAssets {
  const asset = repository.getDerivativeAsset(photoId, 'ai_720.webp');
  if (!asset) return derivative;

  const buffer = readFileSync(asset.path);
  return {
    ...derivative,
    aiImageUrl: `data:${asset.contentType};base64,${buffer.toString('base64')}`,
  };
}

function inferPhotoCenterSourceTypeFromAlbumId(albumId: string): PhotoCenterItem['sourceType'] {
  return albumId.startsWith('feiniu-') ? 'feiniu' : 'local';
}

function inferSourceAlbumKindFromAlbumId(albumId: string): PhotoCenterItem['sourceAlbumKind'] {
  if (albumId.startsWith('feiniu-shared-to-me-')) return 'shared_to_me';
  if (albumId.startsWith('feiniu-shared-by-me-')) return 'shared_by_me';
  return albumId.startsWith('feiniu-') ? 'owned' : '';
}

function mergePlaybackAlbumItems(
  localItems: PhotoCenterItem[],
  sourceItems: PhotoCenterItem[],
): PhotoCenterItem[] {
  const seenPhotoIds = new Set(localItems.map((item) => item.photoId));
  return [
    ...localItems,
    ...sourceItems.filter((item) => {
      if (seenPhotoIds.has(item.photoId)) return false;
      seenPhotoIds.add(item.photoId);
      return true;
    }),
  ];
}

function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk: Buffer | string | Uint8Array) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    stream.once('error', reject);
    stream.once('end', () => resolve(Buffer.concat(chunks)));
  });
}

function mergePersistedPhotoCenterState(
  item: PhotoCenterItem,
  persisted?: PhotoCenterItem,
): PhotoCenterItem {
  if (!persisted) return item;

  return {
    ...item,
    aiCompleted: persisted.aiCompleted,
    aiBeautyScore: persisted.aiBeautyScore,
    aiComment: persisted.aiComment,
    aiCommentStatus: persisted.aiCommentStatus,
    aiIsTrash: persisted.aiIsTrash,
    aiLayout: persisted.aiLayout,
    aiLocked: persisted.aiLocked,
    aiMemoryScore: persisted.aiMemoryScore,
    aiNarrationVariants: persisted.aiNarrationVariants,
    aiReason: persisted.aiReason,
    aiScore: persisted.aiScore,
    aiScoreStatus: persisted.aiScoreStatus,
    aiTags: persisted.aiTags,
    derivativeStatus: persisted.derivativeStatus || item.derivativeStatus,
    filename: persisted.filename || item.filename,
    importAlbumTitle: persisted.importAlbumTitle || item.importAlbumTitle,
    importedAt: persisted.importedAt,
    location: persisted.location || item.location,
    sourceOwnerName: persisted.sourceOwnerName,
    syncedAt: persisted.syncedAt,
    takenAt: persisted.takenAt || item.takenAt,
    thumbnailUrl: persisted.thumbnailUrl || item.thumbnailUrl,
  };
}

function playlistItemToPhotoCenterItem(
  item: PlaylistItem,
  playbackAlbum: PlaybackAlbum,
): PhotoCenterItem {
  const albumId = item.albumId || playbackAlbum.sourceAlbumId;
  const albumName = item.albumName || playbackAlbum.sourceAlbumTitle || playbackAlbum.title;
  const captionTitle = item.caption?.title || item.photoId;
  const ai = item.ai;

  return {
    aiCompleted: normalizePlaybackAiStatus(ai?.scoreStatus) === 'completed' &&
      normalizePlaybackAiStatus(ai?.commentStatus) === 'completed',
    aiBeautyScore: null,
    aiComment: ai?.comment ?? '',
    aiCommentStatus: normalizePlaybackAiStatus(ai?.commentStatus),
    aiDetail: '',
    aiError: '',
    aiIsTrash: false,
    aiLayout: {
      fontStyle: 'sans-serif',
      position: 'bottom_left',
      safeArea: { h: 0.18, w: 0.36, x: 0.08, y: 0.72 },
      textColor: '#FFFFFF',
    },
    aiLocked: ai?.locked === true,
    aiMemoryScore: null,
    aiNarrationVariants: item.narrationVariants ?? [],
    aiReason: '',
    aiRecognizedAt: '',
    aiScore: typeof ai?.score === 'number' ? ai.score : null,
    aiScoreStatus: normalizePlaybackAiStatus(ai?.scoreStatus),
    aiTags: Array.isArray(ai?.tags) ? ai.tags : [],
    albumId,
    albumName,
    captionTitle,
    derivativeStatus: '',
    filename: `${captionTitle}.jpg`,
    importAlbumTitle: albumName,
    importedAt: '',
    location: item.location ?? '',
    photoId: item.photoId,
    removable: false,
    sourceAlbumId: albumId,
    sourceAlbumKind: inferSourceAlbumKindFromAlbumId(albumId),
    sourceOwnerName: '',
    sourceType: inferPhotoCenterSourceTypeFromAlbumId(albumId),
    syncedAt: '',
    takenAt: item.takenAt ?? '',
    thumbnailUrl: item.thumbnailUrl,
  };
}

function playlistItemToExternalPhotoCenterItem(
  item: PlaylistItem,
  playbackAlbum: PlaybackAlbum,
): PhotoCenterExternalItem {
  const albumId = item.albumId || playbackAlbum.sourceAlbumId;
  const albumName = item.albumName || playbackAlbum.sourceAlbumTitle || playbackAlbum.title;
  const captionTitle = item.caption?.title || item.photoId;

  return {
    albumDescription: playbackAlbum.description ||
      `播放相册挂载的飞牛相册：${albumName}`,
    albumId,
    albumName,
    captionText: item.caption?.text ?? '',
    captionTitle,
    displayImageUrl: item.displayImageUrl,
    filename: `${captionTitle}.jpg`,
    imageUrl: item.imageUrl,
    location: item.location ?? '',
    photoId: item.photoId,
    sourceAlbumId: albumId,
    sourceAlbumKind: inferSourceAlbumKindFromAlbumId(albumId),
    sourceOwnerName: '',
    sourceType: 'feiniu',
    takenAt: item.takenAt ?? '',
    thumbnailUrl: item.thumbnailUrl,
  };
}

function normalizePlaybackAiStatus(status: unknown): PhotoCenterItem['aiScoreStatus'] {
  return status === 'completed' || status === 'failed' ? status : 'pending';
}

function buildPlaceholderAiInsight(
  item: PhotoCenterItem,
  album: PlaybackAlbum,
  settings: AiSettings,
): PhotoAiInsightInput {
  const scoreSeed = [...item.photoId].reduce(
    (total, char) => total + char.charCodeAt(0),
    0,
  );
  const score = Math.max(album.pushMemoryScoreThreshold, 82 + (scoreSeed % 13));
  const inferredTags = inferPlaceholderTags(item);
  const aiTags = album.aiPriorityTags.length > 0
    ? album.aiPriorityTags
    : inferredTags;
  const commentTone = settings.commentPrompt.trim()
    ? ''
    : '';

  return {
    aiComment: commentTone,
    aiScore: Math.min(score, 100),
    aiTags,
    photoId: item.photoId,
  };
}

function buildFallbackUnifiedAiInsight(
  item: PhotoCenterItem,
  album: PlaybackAlbum,
  settings: AiSettings,
): UnifiedAiInsight {
  const base = buildPlaceholderAiInsight(item, album, settings);
  return {
    ...base,
    aiBeautyScore: Math.max(0, Math.min(base.aiScore - 6, 100)),
    aiFontStyle: 'sans-serif',
    aiIsTrash: false,
    aiLayoutPosition: 'bottom_left',
    aiMemoryScore: base.aiScore,
    aiReason: 'Vision AI did not return usable recognition content.',
    aiSafeArea: { h: 0.18, w: 0.36, x: 0.08, y: 0.72 },
    aiTextColor: '#FFFFFF',
  };
}

function inferPlaceholderTags(item: PhotoCenterItem): string[] {
  const text = `${item.captionTitle} ${item.albumName} ${item.location}`;
  const tags = new Set<string>(['回忆']);
  if (/旅行|旅|景|山|海|湖|光|京都|场景/.test(text)) {
    tags.add('场景');
  }
  if (/家|客厅|厨房|合影|人物/.test(text)) {
    tags.add('人物');
  }
  if (/笑|开心|快乐|聚会/.test(text)) {
    tags.add('开心');
  }
  return [...tags];
}

class OpenAiCompatibleUnifiedVisionAiAdapter implements UnifiedVisionAiAdapter {
  async analyze(input: UnifiedVisionAiInput): Promise<UnifiedAiInsight> {
    if (!input.settings.apiKey.trim() || !input.settings.baseUrl.trim()) {
      throw new Error('Vision AI is not configured');
    }

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const content = await requestUnifiedVisionContent(input, attempt === 1);
      const rawResult = parseAiJsonContent(content);
      try {
        const insight = normalizeUnifiedVisionResult(rawResult);
        return {
          ...insight,
          aiDetail: JSON.stringify({
            imageSent: input.derivative.aiImageUrl.startsWith('data:image/'),
            imageSource: 'image_url',
            model: input.settings.model,
            photoId: input.item.photoId,
            provider: input.settings.provider,
            raw: rawResult,
          }, null, 2),
          aiError: '',
          aiRecognizedAt: new Date().toISOString(),
        };
      } catch (error) {
        if (attempt === 0 && isRetryableVisionContractError(error)) continue;
        if (isRetryableVisionContractError(error)) {
          throw new Error(describeVisionContractError(error, input.settings.model));
        }
        throw error;
      }
    }
    throw new Error('Vision AI contract repair failed');
  }
}

async function requestUnifiedVisionContent(
  input: UnifiedVisionAiInput,
  contractRepair: boolean,
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), visionAiRequestTimeoutMs);
  let response: Awaited<ReturnType<typeof fetch>>;
  const systemPrompt = buildUnifiedVisionSystemPrompt(input.settings);
  const repairPrompt = [
    systemPrompt,
    '【格式纠错】上一份回答使用了旧版字段结构，已被系统拒绝。',
    '禁止返回 analysis、display_mode、typography、layout、handwriting 作为顶层结构。',
    '必须严格按标准输出字段要求重新生成完整 JSON，不得省略任何必填字段。',
  ].join('\n');
  try {
    response = await fetch(buildChatCompletionsUrl(input.settings.baseUrl), {
      body: JSON.stringify({
        max_tokens: 1_600,
        messages: [
          {
            content: contractRepair ? repairPrompt : systemPrompt,
            role: 'system',
          },
          {
            content: [
              {
                text: buildUnifiedVisionUserPrompt(input),
                type: 'text',
              },
              {
                image_url: {
                  detail: 'low',
                  url: input.derivative.aiImageUrl,
                },
                type: 'image_url',
              },
            ],
            role: 'user',
          },
        ],
        model: input.settings.model,
        response_format: { type: 'json_object' },
        temperature: contractRepair ? 0 : 0.3,
      }),
      headers: {
        Authorization: `Bearer ${input.settings.apiKey}`,
        'Content-Type': 'application/json',
      },
      method: 'POST',
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Vision AI request timed out');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok) throw new Error(`Vision AI request failed: ${response.status}`);
  const payload = await response.json() as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error('Vision AI returned empty content');
  return content;
}

export function isRetryableVisionContractError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.message.startsWith('Invalid current AI response:') ||
    error.message.startsWith('Invalid photo_tv_payload_v1 response:');
}

export function describeVisionContractError(error: unknown, model: string): string {
  const reason = error instanceof Error ? error.message : String(error);
  const modelName = model.trim() || 'unknown';
  if (reason.startsWith('Invalid current AI response:')) {
    return [
      `AI 模型 ${modelName} 返回了旧版输出结构。`,
      '可能原因：模型已下线、模型别名回退到旧模型，或该模型不兼容当前标准输出提示词。',
      '缺少必填字段：scores、narration_options、selected_narration_index、layout_plan。',
      '请在 AI 设置中选择当前可用的视觉模型并重新测试。',
    ].join(' ');
  }
  if (reason.startsWith('Invalid photo_tv_payload_v1 response:')) {
    return `AI 模型 ${modelName} 返回了不完整的 photo_tv_payload_v1：${reason.replace('Invalid photo_tv_payload_v1 response: ', '')}。请检查模型兼容性或输出是否被截断。`;
  }
  return reason;
}

export function parseAiJsonContent(content: string): unknown {
  const trimmed = content.trim();
  if (!trimmed) throw new Error('Vision AI returned empty content');

  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch?.[1]) {
    return JSON.parse(fenceMatch[1].trim());
  }

  try {
    return JSON.parse(trimmed);
  } catch (error) {
    const balancedCandidates = extractJsonObjectCandidates(trimmed);
    for (let index = balancedCandidates.length - 1; index >= 0; index -= 1) {
      try {
        return JSON.parse(balancedCandidates[index] ?? '');
      } catch {
        // Try the next candidate. Some providers echo prompt JSON before the answer.
      }
    }
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw error;
  }
}

function extractJsonObjectCandidates(content: string): string[] {
  const candidates: string[] = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === '{') {
      if (depth === 0) start = index;
      depth += 1;
      continue;
    }
    if (char === '}' && depth > 0) {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        candidates.push(content.slice(start, index + 1));
        start = -1;
      }
    }
  }

  return candidates;
}

function buildChatCompletionsUrl(baseUrl: string): string {
  const normalizedBaseUrl = baseUrl.trim().replace(/\/+$/, '');
  return normalizedBaseUrl.endsWith('/chat/completions')
    ? normalizedBaseUrl
    : `${normalizedBaseUrl}/chat/completions`;
}

export function buildUnifiedVisionSystemPrompt(settings: AiRuntimeSettings): string {
  const unifiedPrompt = settings.scoringPrompt.trim();
  const outputContractPrompt = settings.outputContractPrompt?.trim() ?? '';
  if (outputContractPrompt) {
    return [
      '你是“往日重现”家庭影像展播系统的专业策展 AI。',
      '严格只输出一个 JSON 对象，不要 Markdown，不要解释，不要额外文字。',
      '【业务提示词】',
      unifiedPrompt,
      '【标准输出字段要求】',
      '标准输出字段要求的优先级高于业务提示词中的任何输出示例；如果业务提示词中出现其他 JSON 示例，只能作为业务判断参考，不得照抄其字段结构。',
      outputContractPrompt,
      '再次确认：最终只输出一个可被 JSON.parse 直接解析的 JSON 对象，不要 Markdown，不要代码块，不要解释。',
    ].join('\n');
  }
  if (unifiedPrompt.includes('photo_tv_payload_v1')) {
    return [
      unifiedPrompt,
      buildFiveNarrationVariantsPrompt(),
      '再次确认：最终只输出一个可被 JSON.parse 直接解析的 JSON 对象，不要 Markdown，不要代码块，不要解释。',
    ].join('\n');
  }

  return [
    '你是“往日重现”家庭影像展播系统的专业策展 AI。',
    '你必须一次完成照片评分、点评、分类和电视文字版式设计。所有下列模块提示词都只服务于最终 photo_tv_payload_v1 JSON 字段，不允许改变最终输出格式。',
    '严格只输出一个 JSON 对象，不要 Markdown，不要解释，不要额外文字。',
    '【评分中心提示词】',
    settings.scoringPrompt,
    '【点评中心提示词】',
    settings.commentPrompt,
    '【类型识别提示词】',
    settings.classificationPrompt,
    '【TV 版式提示词】',
    settings.layoutPrompt,
    '【最终 JSON 契约】',
    '必须返回 schema_version 为 "photo_tv_payload_v1" 的 JSON 对象。',
    '必须包含且只能围绕这些顶层对象：schema_version、photo_analysis、evaluation、classification、narration、tv_layout、push_decision。',
    'photo_analysis.caption：100-200 字中文画面描述，直接描述看到的内容，不要以“照片中/画面里/这张图片”等开头。',
    'photo_analysis.observed_meta：必须包含 time、location、weather、evidence；没有明确证据时必须返回空字符串；location 国内只写到市+县/区，没有县/区只写城市，国外只写国家。',
    'evaluation.memory_score 与 evaluation.beauty_score：0-100 数值，允许一位小数。',
    'evaluation.is_trash：boolean，低俗违规、账单收据、广告、杂物、测试图、屏幕截图、严重模糊图为 true 或低分。',
    'evaluation.reason：不超过 80 字中文评分理由。',
    'classification.category：中文类型字符串，多个类型用英文逗号分隔。',
    'classification.scene_tags：中文标签数组，需与 category 保持一致。',
    'classification.tv_suitability：high、medium、low 之一。',
    buildFiveNarrationVariantsPrompt(),
    'tv_layout.layout.position_anchor：top_left、top_right、bottom_left、bottom_right、center_safe 之一。',
    'tv_layout.layout.safe_area：0-1 归一化坐标 {x,y,w,h}，按 16:9 电视画布给出，宽度建议 0.34-0.46，高度建议 0.16-0.30。',
    'tv_layout.layout.text_color：只能是 #FFFFFF 或 #000000。',
    'tv_layout.typography.primary_text.content：使用 narration.variants[0].handwritten_thought。',
    'tv_layout.typography.primary_text.font_family：serif、sans-serif、handwriting 或明确中文字体建议。',
    'tv_layout.typography.primary_text.weight：light、regular、bold 之一。',
    'push_decision.should_push：memory_score 和 beauty_score 都达到阈值时才为 true。',
    '文字区必须避开人脸、人物主体、宠物主体和画面高信息区域；优先选择留白、暗部、背景简单区域。',
    '兼容字段名提醒：不要输出旧字段 "caption"、"type"、"layout" 作为最终顶层字段；它们只能体现在上述 v1 对象内部。',
    'narration.variants 示例必须完整写出 5 个对象，不得用省略号、不得只返回 1 组。',
  ].join('\n');
}

function buildFiveNarrationVariantsPrompt(): string {
  return [
    '【五组三段式相册旁白】',
    'narration 必须包含 variants 数组，并且必须恰好生成 5 组明显不同的旁白。',
    '每组对象格式：{"scene_description":"...","handwritten_thought":"...","lyrical_closure":"..."}。',
    'scene_description：8-16 个中文字符，客观、具体，只写真实可见的人物、动作、物件、光线、颜色或环境，不编造关系和故事。',
    'handwritten_thought：12-25 个中文字符，是最打动人的一句，适合手写体；温暖克制、生活化，可有轻微诗意，不要过度煽情。',
    'lyrical_closure：不超过 10 个中文字符，轻轻收住情绪；不要广告语、鸡汤文或祝福语，少用“幸福、感动、美好、珍贵、永远”。',
    '5 组分别从具体物件、人物动作、现场氛围、日后回忆、诗意总结等角度生成，不要重复同一种表达。',
    '不要把文件名、相册名、评分、分类过程写进旁白。',
  ].join('\n');
}

export function buildUnifiedVisionUserPrompt(input: UnifiedVisionAiInput): string {
  return buildPhotoTvVisionUserPrompt(input);

  return [
    `照片：${input.item.captionTitle}`,
    `来源相册：${input.item.albumName}`,
    `播放相册：${input.album.title}`,
    `回忆相关度阈值：${input.album.pushMemoryScoreThreshold}`,
    `美学水平阈值：${input.album.pushBeautyScoreThreshold}`,
    `优先推送类型：${input.album.pushPriorityTags.join('、') || '未指定'}`,
    `拍摄时间：${input.item.takenAt || '未知'}`,
    `地点：${input.item.location || '未知'}`,
    'AI 720p analysis image: sent with the image_url payload. Do not infer content from filenames or URLs.',
    '判断是否适合推送时只看两个阈值：memory_score 必须达到回忆相关度阈值，beauty_score 必须达到美学水平阈值；无论是否过线都要返回完整 JSON。',
  ].join('\n');
}

export function normalizeUnifiedVisionResult(value: unknown): UnifiedAiInsight {
  const record = value && typeof value === 'object'
    ? value as Record<string, unknown>
    : {};
  if (
    record.schema_version === 'photo_tv_payload_v1' ||
    (record.scores && record.narration_options && record.layout_plan)
  ) {
    return normalizePhotoTvPayloadV1(record);
  }
  if (isLegacyLayoutOnlyResponse(record)) {
    throw new Error(
      'Invalid current AI response: missing scores, narration_options, selected_narration_index, layout_plan',
    );
  }
  const layout = record.layout && typeof record.layout === 'object'
    ? record.layout as Record<string, unknown>
    : {};
  const typography = record.typography && typeof record.typography === 'object'
    ? record.typography as Record<string, unknown>
    : {};
  const caption = record.caption && typeof record.caption === 'object'
    ? record.caption as Record<string, unknown>
    : {};
  const primaryText = typography.primary_text && typeof typography.primary_text === 'object'
    ? typography.primary_text as Record<string, unknown>
    : {};
  const secondaryText = typography.secondary_text && typeof typography.secondary_text === 'object'
    ? typography.secondary_text as Record<string, unknown>
    : {};
  const analysisRecord = getObjectRecord(record.analysis);
  const aiAnalysisRecord = getObjectRecord(record.ai_analysis);
  const analysis = Object.keys(analysisRecord).length > 0
    ? analysisRecord
    : aiAnalysisRecord;
  const pushDecision = getObjectRecord(record.push_decision);
  const generatedCaptions = Array.isArray(record.generated_captions)
    ? record.generated_captions.map((item) => getObjectRecord(item))
    : [];
  const typeTags = typeof record.type === 'string'
    ? record.type.split(',').map((item) => item.trim()).filter(Boolean)
    : [];
  const priorityTags = Array.isArray(record.priority_tags)
    ? record.priority_tags.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];
  const analysisTags = Array.isArray(analysis.tags)
    ? analysis.tags.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];
  const categories = Array.isArray(record.categories)
    ? record.categories.filter((item): item is string => typeof item === 'string')
    : typeTags.length > 0
      ? typeTags
      : priorityTags.length > 0
        ? priorityTags
        : analysisTags;
  const memoryScore = normalizeAiScore(
    record.memory_score ?? pushDecision.memory_score ?? analysis.memory_score,
  );
  const beautyScore = normalizeAiScore(
    record.beauty_score ?? pushDecision.beauty_score ?? analysis.beauty_score,
  );
  const aiScore = Math.round((memoryScore * 0.65) + (beautyScore * 0.35));
  const generatedCaption = generatedCaptions.find(
    (item) => typeof item.text === 'string' && item.text.trim(),
  );
  const comment = normalizeUnifiedComment(record, primaryText, secondaryText, analysis) ||
    (typeof generatedCaption?.text === 'string'
      ? generatedCaption.text.trim().slice(0, 72)
      : '');
  const fontStyle = normalizeUnifiedFontStyle(
    layout.font_style ?? caption.font_family ?? primaryText.font_family ?? secondaryText.font_family,
  );
  const reason = [
    typeof record.reason === 'string' ? record.reason.trim() : '',
    typeof pushDecision.push_reason === 'string' ? pushDecision.push_reason.trim() : '',
    typeof analysis.memory_score_reason === 'string' ? analysis.memory_score_reason.trim() : '',
    typeof analysis.beauty_score_reason === 'string' ? analysis.beauty_score_reason.trim() : '',
  ].find(Boolean) ?? '';

  return {
    aiBeautyScore: beautyScore,
    aiComment: comment,
    aiFontStyle: fontStyle,
    aiIsTrash: record.is_trash === true,
    aiLayoutPosition: normalizeUnifiedLayoutPosition(
      layout.position ??
      layout.position_anchor ??
      caption.position ??
      generatedCaption?.position,
    ),
    aiMemoryScore: memoryScore,
    aiReason: reason.slice(0, 120),
    aiSafeArea: normalizeUnifiedSafeArea(layout.safe_area),
    aiScore,
    aiTags: categories.length > 0 ? categories : ['回忆'],
    aiTextColor: '#FFFFFF',
  };
}

function isLegacyLayoutOnlyResponse(record: Record<string, unknown>): boolean {
  const hasLegacyTvLayoutShape = Boolean(
    record.display_mode ||
    record.typography ||
    record.handwriting ||
    record.photo_meta ||
    record.push_info,
  );
  const hasCurrentThreePartContract = Boolean(
    record.scores &&
    record.narration_options &&
    record.selected_narration_index !== undefined &&
    record.layout_plan,
  );
  return hasLegacyTvLayoutShape && !hasCurrentThreePartContract;
}

function buildPhotoTvVisionUserPrompt(input: UnifiedVisionAiInput): string {
  return [
    '请根据这张照片和下面的 photo_meta / display_preferences 输出完整 JSON。',
    JSON.stringify({
      display_preferences: {
        allow_handwriting: true,
        allow_ken_burns: true,
        allow_voiceover: true,
        default_caption_position: 'bottom_left',
        theme: 'dark_gold_memory',
      },
      photo_meta: {
        album_id: input.album.playbackAlbumId,
        album_name: input.album.title,
        created_at: input.item.takenAt || '',
        photo_id: input.item.photoId,
        photo_index: 1,
        photo_total: 1,
        photo_url: input.derivative.tvImageUrl,
        resolution: '3840x2160',
        screen_ratio: '16:9',
        target_device: 'tv',
        thumbnail_url: input.derivative.thumbImageUrl,
      },
      push_thresholds: {
        beauty_score: input.album.pushBeautyScoreThreshold,
        memory_score: input.album.pushMemoryScoreThreshold,
        priority_tags: input.album.pushPriorityTags,
      },
    }, null, 2),
    `回忆相关度阈值：${input.album.pushMemoryScoreThreshold}`,
    `美学水平阈值：${input.album.pushBeautyScoreThreshold}`,
    'AI 720p analysis image: sent with the image_url payload. Do not infer content from filenames or URLs.',
    '判断是否适合推送时只看两个阈值：memory_score 必须达到回忆相关度阈值，beauty_score 必须达到美学水平阈值；无论是否过线都要返回完整 JSON。',
  ].join('\n');
}

function normalizeUnifiedComment(
  record: Record<string, unknown>,
  primaryText: Record<string, unknown>,
  secondaryText: Record<string, unknown>,
  analysis: Record<string, unknown> = {},
): string {
  if (typeof record.comment === 'string' && record.comment.trim()) {
    return record.comment.trim().slice(0, 36);
  }
  const caption = record.caption && typeof record.caption === 'object'
    ? record.caption as Record<string, unknown>
    : {};
  if (typeof caption.text === 'string' && caption.text.trim()) {
    return caption.text.trim().slice(0, 36);
  }
  if (Array.isArray(analysis.caption_candidates)) {
    const candidate = analysis.caption_candidates.find(
      (item): item is string => typeof item === 'string' && item.trim().length > 0,
    );
    if (candidate) return candidate.trim().slice(0, 36);
  }
  if (typeof analysis.caption === 'string' && analysis.caption.trim()) {
    return analysis.caption.trim().slice(0, 36);
  }

  const lines = [
    typeof primaryText.content === 'string' ? primaryText.content.trim() : '',
    typeof secondaryText.content === 'string' ? secondaryText.content.trim() : '',
  ].filter(Boolean);
  if (lines.length > 0) return lines.join('，').slice(0, 36);

  return '';
}

function normalizePhotoTvPayloadV1(record: Record<string, unknown>): UnifiedAiInsight {
  const caption = getObjectRecord(record.caption);
  const photoAnalysisRecord = getObjectRecord(record.photo_analysis);
  const captionText = typeof caption.text === 'string'
    ? caption.text
    : typeof record.caption === 'string'
      ? record.caption
      : '';
  const photoAnalysis = Object.keys(photoAnalysisRecord).length > 0
    ? photoAnalysisRecord
    : { caption: captionText };
  const classification = getObjectRecord(record.classification);
  const evaluationRecord = getObjectRecord(record.evaluation);
  const scores = getObjectRecord(record.scores);
  const evaluation = Object.keys(evaluationRecord).length > 0
    ? evaluationRecord
    : scores;
  const narrationRecord = getObjectRecord(record.narration);
  const narration = Object.keys(narrationRecord).length > 0
    ? narrationRecord
    : { variants: record.narration_options };
  const tvLayoutRecord = getObjectRecord(record.tv_layout);
  const layoutPlan = getObjectRecord(record.layout_plan);
  const tvLayout = Object.keys(tvLayoutRecord).length > 0
    ? tvLayoutRecord
    : layoutPlan;
  const typography = getObjectRecord(tvLayout.typography);
  const primaryText = getObjectRecord(typography.primary_text);
  const secondaryText = getObjectRecord(typography.secondary_text);
  const handwritingText = getObjectRecord(typography.handwriting_text);
  const layoutRecord = getObjectRecord(tvLayout.layout);
  const layout = Object.keys(layoutRecord).length > 0 ? layoutRecord : layoutPlan;
  const observedMeta = normalizeObservedMeta(photoAnalysis.observed_meta);
  const narrationVariants = normalizeNarrationVariants(narration.variants);
  const selectedNarrationIndex = normalizeNarrationIndex(
    record.selected_narration_index,
    narrationVariants.length,
  );

  validatePhotoTvPayloadV1({
    classification,
    evaluation,
    layout,
    narration,
    photoAnalysis,
    record,
    tvLayout,
  });

  const memoryScore = normalizeAiScore(evaluation.memory_score);
  const beautyScore = normalizeAiScore(evaluation.beauty_score);
  const aiScore = Math.round((memoryScore * 0.65) + (beautyScore * 0.35));
  const categories = normalizePhotoTvCategories(classification);
  const comment = narrationVariantToComment(
    narrationVariants[selectedNarrationIndex] ?? narrationVariants[0],
  );

  return {
    aiBeautyScore: beautyScore,
    aiComment: comment,
    aiFontStyle: normalizeUnifiedFontStyle(
      primaryText.font_family ??
      handwritingText.font_family ??
      secondaryText.font_family ??
      layout.font_style,
    ),
    aiIsTrash: classification.tv_suitability === 'low',
    aiLayoutPosition: normalizeUnifiedLayoutPosition(layout.position_anchor ?? layout.position),
    aiMemoryScore: memoryScore,
    aiNarrationVariants: narrationVariants,
    aiObservedMeta: observedMeta,
    aiReason: typeof evaluation.reason === 'string'
      ? evaluation.reason.trim()
      : typeof photoAnalysis.caption === 'string'
        ? photoAnalysis.caption.trim().slice(0, 60)
        : '',
    aiSafeArea: normalizeUnifiedSafeArea(layout.safe_area),
    aiScore,
    aiTags: categories.length > 0 ? categories : ['回忆'],
    aiTextColor: normalizePhotoTvTextColor(
      layout.text_color ?? primaryText.color ?? secondaryText.color,
    ),
  };
}

function validatePhotoTvPayloadV1(input: {
  classification: Record<string, unknown>;
  evaluation: Record<string, unknown>;
  layout: Record<string, unknown>;
  narration: Record<string, unknown>;
  photoAnalysis: Record<string, unknown>;
  record: Record<string, unknown>;
  tvLayout: Record<string, unknown>;
}): void {
  const missing: string[] = [];
  if (
    input.record.schema_version !== undefined &&
    input.record.schema_version !== 'photo_tv_payload_v1'
  ) {
    missing.push('schema_version');
  }
  if (typeof input.photoAnalysis.caption !== 'string' || !input.photoAnalysis.caption.trim()) {
    missing.push('photo_analysis.caption');
  }
  if (typeof input.evaluation.memory_score !== 'number') {
    missing.push('evaluation.memory_score');
  }
  if (typeof input.evaluation.beauty_score !== 'number') {
    missing.push('evaluation.beauty_score');
  }
  if (typeof input.evaluation.reason !== 'string' || !input.evaluation.reason.trim()) {
    missing.push('evaluation.reason');
  }
  if (typeof input.classification.category !== 'string' || !input.classification.category.trim()) {
    missing.push('classification.category');
  }
  if (!Array.isArray(input.classification.scene_tags)) {
    missing.push('classification.scene_tags');
  }
  if (normalizeNarrationVariants(input.narration.variants).length !== 5) {
    missing.push('narration.variants[5]');
  }
  if (Object.keys(input.tvLayout).length === 0) {
    missing.push('tv_layout');
  }
  if (
    typeof input.layout.position_anchor !== 'string' &&
    typeof input.layout.position !== 'string'
  ) {
    missing.push('tv_layout.layout.position_anchor');
  }
  if (typeof input.layout.safe_area !== 'object' || input.layout.safe_area === null) {
    missing.push('tv_layout.layout.safe_area');
  }
  if (typeof input.layout.text_color !== 'string') {
    missing.push('tv_layout.layout.text_color');
  }
  if (missing.length > 0) {
    throw new Error(`Invalid photo_tv_payload_v1 response: missing ${missing.join(', ')}`);
  }
}

function normalizeObservedMeta(value: unknown): NonNullable<UnifiedAiInsight['aiObservedMeta']> {
  const observedMeta = getObjectRecord(value);
  return {
    location: normalizeObservedLocationForDisplay(observedMeta.location),
    time: typeof observedMeta.time === 'string' ? observedMeta.time.trim() : '',
    weather: typeof observedMeta.weather === 'string' ? observedMeta.weather.trim() : '',
  };
}

function normalizeNarrationVariants(value: unknown): Array<{
  handwrittenThought: string;
  lyricalClosure: string;
  sceneDescription: string;
}> {
  if (!Array.isArray(value)) return [];
  return value
    .map((candidate) => getObjectRecord(candidate))
    .map((candidate) => ({
      handwrittenThought: normalizeNarrationPart(
        candidate.handwritten_thought ??
        candidate.handwritten_line ??
        candidate.handwrittenThought,
      ),
      lyricalClosure: normalizeNarrationPart(
        candidate.lyrical_closure ??
        candidate.closing_line ??
        candidate.lyricalClosure,
        10,
      ),
      sceneDescription: normalizeNarrationPart(
        candidate.scene_description ??
        candidate.scene_line ??
        candidate.sceneDescription,
      ),
    }))
    .filter(
      (candidate) =>
        candidate.sceneDescription &&
        candidate.handwrittenThought &&
        candidate.lyricalClosure,
    )
    .slice(0, 5);
}

function normalizeNarrationPart(value: unknown, maxLength = 48): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function normalizeObservedLocationForDisplay(value: unknown): string {
  if (typeof value !== 'string') return '';
  const location = value.trim().replace(/\s+/g, '');
  if (!location) return '';
  if (!isDomesticLocation(location)) return normalizeForeignLocationForDisplay(location);
  const withoutCountry = location
    .replace(/^中华人民共和国/, '')
    .replace(/^中国大陆/, '')
    .replace(/^中国/, '');
  const municipality = withoutCountry.match(/^(北京市|上海市|天津市|重庆市)(.*)$/);
  if (municipality) {
    const city = municipality[1];
    const county = municipality[2].match(/^(.+?(?:县|区))/)?.[1] ?? '';
    return county ? `${city}${county}` : city;
  }
  const withoutProvince = withoutCountry.replace(
    /^(?:[^省]{2,12}省|(?:内蒙古|广西壮族|西藏|宁夏回族|新疆维吾尔)自治区|香港特别行政区|澳门特别行政区)/,
    '',
  );
  const prefecture = withoutProvince.match(/^(.+?(?:自治州|地区|盟|市))(.*)$/) ??
    withoutProvince.match(/^(.+?州)(.*)$/);
  if (prefecture) {
    const city = prefecture[1];
    const county = prefecture[2].match(/^(.+?(?:县|区|市|旗))/)?.[1] ?? '';
    return county ? `${city}${county}` : city;
  }
  const countyOnly = withoutProvince.match(/^(.+?(?:县|区|市|旗))/)?.[1];
  return countyOnly ?? withoutProvince;
}

function isDomesticLocation(location: string): boolean {
  return /^中国|^中华人民共和国|^中国大陆/.test(location) ||
    /^(?:[^省]{2,12}省|北京市|上海市|天津市|重庆市|(?:内蒙古|广西壮族|西藏|宁夏回族|新疆维吾尔)自治区|香港特别行政区|澳门特别行政区)/.test(location);
}

function normalizeForeignLocationForDisplay(location: string): string {
  const countryAliases: Array<[RegExp, string]> = [
    [/日本|japan/i, '日本'],
    [/美国|usa|unitedstates|america/i, '美国'],
    [/英国|uk|unitedkingdom|england/i, '英国'],
    [/法国|france/i, '法国'],
    [/德国|germany/i, '德国'],
    [/意大利|italy/i, '意大利'],
    [/西班牙|spain/i, '西班牙'],
    [/加拿大|canada/i, '加拿大'],
    [/澳大利亚|australia/i, '澳大利亚'],
    [/新西兰|newzealand/i, '新西兰'],
    [/韩国|southkorea|korea/i, '韩国'],
    [/泰国|thailand/i, '泰国'],
    [/新加坡|singapore/i, '新加坡'],
    [/马来西亚|malaysia/i, '马来西亚'],
    [/印度尼西亚|indonesia/i, '印度尼西亚'],
    [/越南|vietnam/i, '越南'],
    [/菲律宾|philippines/i, '菲律宾'],
    [/俄罗斯|russia/i, '俄罗斯'],
    [/瑞士|switzerland/i, '瑞士'],
    [/奥地利|austria/i, '奥地利'],
    [/荷兰|netherlands/i, '荷兰'],
    [/比利时|belgium/i, '比利时'],
    [/希腊|greece/i, '希腊'],
    [/土耳其|turkey/i, '土耳其'],
    [/印度|india/i, '印度'],
    [/阿联酋|uae|unitedarabemirates/i, '阿联酋'],
  ];
  const compact = location.replace(/[,\-_/，、]/g, '');
  return countryAliases.find(([pattern]) => pattern.test(compact))?.[1] ?? location;
}

function normalizeNarrationIndex(value: unknown, length: number): number {
  if (length <= 0) return 0;
  if (typeof value !== 'number' || !Number.isInteger(value)) return 0;
  if (value >= 1 && value <= length) return value - 1;
  return Math.min(Math.max(value, 0), length - 1);
}

function narrationVariantToComment(
  variant: {
    handwrittenThought: string;
    lyricalClosure: string;
    sceneDescription: string;
  } | undefined,
): string {
  if (!variant) return '';
  return [
    variant.sceneDescription,
    variant.handwrittenThought,
    variant.lyricalClosure,
  ].join('\n');
}

export function normalizeStoredAiDetail(aiDetail: string): UnifiedAiInsight {
  const parsed = JSON.parse(aiDetail) as unknown;
  const envelope = getObjectRecord(parsed);
  const rawEnvelope = getObjectRecord(envelope.raw);
  const raw = Object.keys(rawEnvelope).length > 0 ? rawEnvelope : parsed;
  return {
    ...normalizeUnifiedVisionResult(raw),
    aiDetail,
    aiError: '',
    aiRecognizedAt: new Date().toISOString(),
  };
}

function getObjectRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function normalizePhotoTvCategories(classification: Record<string, unknown>): string[] {
  const category = typeof classification.category === 'string'
    ? classification.category.split(',').map((item) => item.trim()).filter(Boolean)
    : [];
  const sceneTags = Array.isArray(classification.scene_tags)
    ? classification.scene_tags.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];
  return [...new Set([...category, ...sceneTags])];
}

function normalizePhotoTvTextColor(value: unknown): '#000000' | '#FFFFFF' {
  return value === '#000000' ? '#000000' : '#FFFFFF';
}

function normalizeAiScore(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(Math.max(Math.round(value), 0), 100)
    : 80;
}

function normalizeUnifiedLayoutPosition(
  value: unknown,
): NonNullable<PhotoAiInsightInput['aiLayoutPosition']> {
  return value === 'top_left' ||
    value === 'top_right' ||
    value === 'bottom_left' ||
    value === 'bottom_right' ||
    value === 'center_safe'
    ? value
    : value === 'left_center' || value === 'right_center'
      ? 'center_safe'
    : 'center_safe';
}

function normalizeUnifiedFontStyle(
  value: unknown,
): NonNullable<PhotoAiInsightInput['aiFontStyle']> {
  if (value === 'serif' || value === 'handwriting') return value;
  if (typeof value !== 'string') return 'serif';
  const normalized = value.toLowerCase();
  if (
    normalized.includes('wenkai') ||
    normalized.includes('xishan') ||
    normalized.includes('caveat') ||
    normalized.includes('signature') ||
    normalized.includes('handwriting') ||
    normalized.includes('3type')
  ) {
    return 'handwriting';
  }
  if (
    normalized.includes('serif') ||
    normalized.includes('song') ||
    normalized.includes('didot') ||
    normalized.includes('cinzel') ||
    normalized.includes('juzhen') ||
    normalized.includes('reimin')
  ) {
    return 'serif';
  }
  return 'serif';
}

function normalizeUnifiedSafeArea(value: unknown): NonNullable<PhotoAiInsightInput['aiSafeArea']> {
  const record = value && typeof value === 'object'
    ? value as Record<string, unknown>
    : {};
  if (
    typeof record.x_min === 'number' ||
    typeof record.x_max === 'number' ||
    typeof record.y_min === 'number' ||
    typeof record.y_max === 'number'
  ) {
    const xMin = normalizeUnifiedPercent(record.x_min, 8);
    const xMax = normalizeUnifiedPercent(record.x_max, 44);
    const yMin = normalizeUnifiedPercent(record.y_min, 42);
    const yMax = normalizeUnifiedPercent(record.y_max, 62);
    const x = Math.min(xMin, xMax);
    const y = Math.min(yMin, yMax);
    return normalizeUnifiedTvSafeArea({
      h: Number(Math.max(Math.abs(yMax - yMin), 0.08).toFixed(3)),
      w: Number(Math.max(Math.abs(xMax - xMin), 0.18).toFixed(3)),
      x: Number(x.toFixed(3)),
      y: Number(y.toFixed(3)),
    });
  }
  return normalizeUnifiedTvSafeArea({
    h: normalizeUnifiedUnit(record.h, 0.18),
    w: normalizeUnifiedUnit(record.w, 0.36),
    x: normalizeUnifiedUnit(record.x, 0.08),
    y: normalizeUnifiedUnit(record.y, 0.42),
  });
}

function normalizeUnifiedTvSafeArea(
  area: NonNullable<PhotoAiInsightInput['aiSafeArea']>,
): NonNullable<PhotoAiInsightInput['aiSafeArea']> {
  const w = Math.min(Math.max(area.w, 0.34), 0.46);
  const h = Math.min(Math.max(area.h, 0.18), 0.32);
  const x = Math.min(Math.max(area.x, 0.06), 0.94 - w);
  const y = Math.min(Math.max(area.y, 0.16), 0.62 - h);
  return {
    h: Number(h.toFixed(3)),
    w: Number(w.toFixed(3)),
    x: Number(x.toFixed(3)),
    y: Number(y.toFixed(3)),
  };
}

function normalizeUnifiedPercent(value: unknown, fallback: number): number {
  const raw = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return Math.min(Math.max(raw / 100, 0), 1);
}

function normalizeUnifiedUnit(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(Math.max(value, 0), 1)
    : fallback;
}

function isPlaybackAlbumAiDue(album: PlaybackAlbum, now: Date): boolean {
  if (!album.aiEnabled) return false;
  if (!album.lastAiCheckedAt.trim()) return true;
  const lastCheckedAt = Date.parse(album.lastAiCheckedAt);
  if (!Number.isFinite(lastCheckedAt)) return true;
  return now.getTime() - lastCheckedAt >=
    Math.max(album.aiRepeatIntervalMinutes, 1) * 60 * 1000;
}

function shouldBackfillPhoto(item: PhotoCenterItem): boolean {
  return item.derivativeStatus !== 'ready' || shouldBackfillPhotoAi(item);
}

function shouldBackfillPhotoAi(item: PhotoCenterItem): boolean {
  if (item.aiLocked) return false;
  return item.aiScoreStatus !== 'completed' || item.aiCommentStatus !== 'completed';
}

function resolvePlaybackAlbumDailyAiLimit(
  album: PlaybackAlbum,
  settings: AiRuntimeSettings,
): number {
  const albumLimit = Number.isFinite(album.aiDailyLimit) ? album.aiDailyLimit : 0;
  if (albumLimit > 0) return Math.floor(albumLimit);
  const settingsLimit = Number.isFinite(settings.dailyAiLimit) ? settings.dailyAiLimit : 100;
  return Math.max(Math.floor(settingsLimit), 1);
}

function toSchedulerDelayMs(minutes: number): number {
  const safeMinutes = Number.isFinite(minutes) && minutes > 0 ? minutes : 60;
  return Math.max(Math.floor(safeMinutes), 1) * 60 * 1000;
}

function buildPlaylistResponse(
  sourceItems: PlaylistItem[],
  limit?: string,
  albumId?: string,
): PlaylistResponse {
    const parsedLimit = Number(limit ?? sourceItems.length);
    const safeLimit = Number.isFinite(parsedLimit)
      ? Math.min(Math.max(parsedLimit, 1), sourceItems.length)
      : sourceItems.length;

    return {
      items: sourceItems.slice(0, safeLimit),
      playlistId: albumId ? `pl_demo_${albumId}` : 'pl_demo_family',
      policyVersion: 1,
    };
}

function buildAlbumsFromItems(items: PlaylistItem[]): AlbumSummary[] {
  const groupedItems = new Map<string, PlaylistItem[]>();
  for (const item of items) {
    groupedItems.set(item.albumId, [
      ...(groupedItems.get(item.albumId) ?? []),
      item,
    ]);
  }

  return Array.from(groupedItems.entries()).map(([albumId, albumItems]) =>
    buildAlbumSummary(albumId, albumItems),
  );
}

function buildAlbumSummary(
  albumId: string,
  items: PlaylistItem[],
): AlbumSummary {
  const cover = items[0]!;
  const sortedTakenAt = items
    .map((item) => item.takenAt)
    .filter((takenAt): takenAt is string => Boolean(takenAt))
    .sort();
  const latestTakenAt = sortedTakenAt[sortedTakenAt.length - 1];

  return {
    albumId,
    coverImageUrl: cover.displayImageUrl,
    coverPhotoId: cover.photoId,
    description:
      sampleAlbumDescriptions[albumId] ??
      cover.caption.text,
    latestTakenAt,
    photoCount: items.length,
    thumbnailUrl: cover.thumbnailUrl,
    title: cover.albumName,
    updatedAt: latestTakenAt ?? '1970-01-01',
  };
}

function cleanupExpiredBindSessions() {
  const now = Date.now();
  for (const [bindCode, session] of bindSessions.entries()) {
    const expiredAt = new Date(session.expiresAt).getTime();
    if (session.status !== 'bound' && expiredAt <= now) {
      bindSessions.delete(bindCode);
    }
  }
}

function createUniqueBindCode(): string {
  for (let index = 0; index < 20; index += 1) {
    const bindCode = Math.floor(100_000 + Math.random() * 900_000).toString();
    if (!bindSessions.has(bindCode)) return bindCode;
  }

  return Date.now().toString().slice(-6);
}

function normalizeBindCode(bindCode: string): string {
  return bindCode.trim().toUpperCase();
}

interface AdminAccessTokenPayload {
  exp: number;
  iat: number;
  mustChangePassword: boolean;
  sub: string;
}

type AdminCredentialState =
  | {
      mustChangePassword: boolean;
      password: string;
      type: 'plain';
      username: string;
    }
  | {
      mustChangePassword: false;
      passwordHash: string;
      passwordSalt: string;
      type: 'hash';
      username: string;
    };

const defaultAdminUsername = 'admin';
const initialAdminPassword = 'admin123';

function createAdminAccessToken(username: string, mustChangePassword: boolean): string {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const payload: AdminAccessTokenPayload = {
    exp: nowSeconds + 30 * 24 * 60 * 60,
    iat: nowSeconds,
    mustChangePassword,
    sub: username.trim().toLowerCase(),
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  return `wrjdyk_admin.${encodedPayload}.${signAdminAccessPayload(encodedPayload)}`;
}

function verifyAdminAccessToken(token: string): AdminAccessTokenPayload | null {
  if (!token.startsWith('wrjdyk_admin.')) return null;
  const [, encodedPayload, signature] = token.split('.', 3);
  if (!encodedPayload || !signature) return null;
  if (!constantTimeEquals(signature, signAdminAccessPayload(encodedPayload))) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as Partial<AdminAccessTokenPayload>;
    if (typeof payload.sub !== 'string' || !payload.sub.trim()) return null;
    if (!Number.isFinite(payload.exp) || payload.exp! <= Math.floor(Date.now() / 1000)) {
      return null;
    }
    if (!Number.isFinite(payload.iat)) return null;
    return {
      exp: payload.exp!,
      iat: payload.iat!,
      mustChangePassword: payload.mustChangePassword === true,
      sub: payload.sub.trim().toLowerCase(),
    };
  } catch {
    return null;
  }
}

function createPhotoAssetToken(path: string): string {
  const normalizedPath = normalizePhotoAssetTokenPath(path);
  const expiresAt = Date.now() + photoAssetTokenTtlMs;
  const expiresAtSeconds = Math.floor(expiresAt / 1000);
  return `${expiresAtSeconds}.${signPhotoAssetPayload(normalizedPath, expiresAtSeconds)}`;
}

function verifyPhotoAssetToken(path: string, token?: string): boolean {
  if (!token) return false;
  const [expiresAtText, signature] = token.split('.', 2);
  const expiresAtSeconds = Number(expiresAtText);
  if (!Number.isFinite(expiresAtSeconds) || !signature) return false;
  if (expiresAtSeconds <= Math.floor(Date.now() / 1000)) return false;

  const expected = signPhotoAssetPayload(
    normalizePhotoAssetTokenPath(path),
    expiresAtSeconds,
  );
  return constantTimeEquals(signature, expected);
}

function signPhotoAssetPayload(path: string, expiresAtSeconds: number): string {
  return createHmac('sha256', getAdminTokenSecret())
    .update(`${path}.${expiresAtSeconds}`)
    .digest('base64url');
}

function signPhotoAssetUrls<T>(value: T): T {
  if (typeof value === 'string') {
    return signPhotoAssetUrl(value) as T;
  }
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    return value.map((item) => signPhotoAssetUrls(item)) as T;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      signPhotoAssetUrls(entry),
    ]),
  ) as T;
}

function signPhotoAssetUrl(url: string): string {
  if (!isPhotoAssetUrl(url)) return url;

  const parsed = new URL(url, 'http://wrjdyk.local');
  parsed.searchParams.set('assetToken', createPhotoAssetToken(parsed.pathname));
  const signedPath = `${parsed.pathname}${parsed.search}`;

  if (/^https?:\/\//i.test(url)) {
    return `${parsed.origin}${signedPath}`;
  }
  return signedPath;
}

function isPhotoAssetUrl(url: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url, 'http://wrjdyk.local');
    const path = normalizePhotoAssetTokenPath(parsed.pathname);
    return path.startsWith('/photos/') || path.startsWith('/derivatives/');
  } catch {
    return false;
  }
}

function normalizePhotoAssetTokenPath(path: string): string {
  const onlyPath = path.split('?', 1)[0] || '/';
  const normalized = onlyPath.startsWith('/') ? onlyPath : `/${onlyPath}`;
  return normalized.startsWith('/api/')
    ? normalized.slice('/api'.length)
    : normalized;
}

function signAdminAccessPayload(encodedPayload: string): string {
  return createHmac('sha256', getAdminTokenSecret())
    .update(encodedPayload)
    .digest('base64url');
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function constantTimeEquals(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function getAdminUsername(): string {
  return process.env.WRJDYK_ADMIN_USERNAME?.trim().toLowerCase() || defaultAdminUsername;
}

function getAdminTokenSecret(): string {
  return (
    process.env.WRJDYK_AUTH_SECRET?.trim() ||
    process.env.WRJDYK_ADMIN_PASSWORD?.trim() ||
    'wrjdyk-local-admin-token-secret'
  );
}

function hashAdminPassword(password: string, salt: string): string {
  return scryptSync(password, salt, 64).toString('hex');
}

function isProductionRuntime(): boolean {
  return process.env.NODE_ENV?.trim().toLowerCase() === 'production';
}

function createRandomDeviceToken(): string {
  return `dt_${randomBytes(24).toString('hex')}`;
}

function normalizeDeviceUniqueId(value: string): string {
  const normalized = value.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  return normalized || 'unknown';
}

function photoUrl(photoId: string, variant: 'display' | 'original' | 'thumb'): string {
  return `/api/photos/${photoId}/${variant}?source=ceshi`;
}

function resolveDemoScenario(demoScenario?: string): string {
  return (
    demoScenario?.trim() ||
    process.env.WRJDYK_DEMO_SCENARIO?.trim() ||
    ''
  );
}

function normalizeDeviceToken(
  deviceToken?: string,
  authorizationHeader?: string,
): string {
  const directToken = deviceToken?.trim();
  if (directToken) return directToken;

  const authorization = authorizationHeader?.trim();
  if (!authorization) return '';

  const [scheme, token] = authorization.split(/\s+/, 2);
  if (scheme?.toLowerCase() !== 'bearer') return '';
  return token?.trim() ?? '';
}

function parsePositiveInteger(value?: string): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : undefined;
}

function normalizeOptionalEnv(value?: string): string {
  return value?.trim() ?? '';
}

function normalizeIntegerEnv(value?: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

function normalizeBooleanEnv(value?: string): boolean {
  const normalized = value?.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
}

function listTvReleaseVersions(
  releasesDirectory: string,
  latestManifest: TvAppUpdateManifest,
  latestFileName: string,
): TvReleaseVersion[] {
  const fileNames = new Set<string>();
  if (existsSync(releasesDirectory)) {
    try {
      for (const entry of readdirSync(releasesDirectory, { withFileTypes: true })) {
        if (entry.isFile() && isTvReleaseApkFileName(entry.name)) {
          fileNames.add(entry.name);
        }
      }
    } catch {
      // Directory readability is reported through the empty list; the latest row is kept below.
    }
  }
  if (latestFileName) {
    fileNames.add(latestFileName);
  }

  return Array.from(fileNames)
    .map((fileName) =>
      buildTvReleaseVersion(releasesDirectory, fileName, latestManifest, latestFileName),
    )
    .sort(compareTvReleaseVersions);
}

function buildTvReleaseVersion(
  releasesDirectory: string,
  fileName: string,
  latestManifest: TvAppUpdateManifest,
  latestFileName: string,
): TvReleaseVersion {
  const releasePath = resolve(releasesDirectory, fileName);
  const isSafePath = releasePath.startsWith(`${releasesDirectory}${pathSeparator()}`);
  const fileExists = Boolean(
    isSafePath &&
    existsSync(releasePath) &&
    statSync(releasePath).isFile(),
  );
  const fileSizeBytes = fileExists ? statSync(releasePath).size : 0;
  const metadataManifest = readTvReleaseManifest(
    getTvReleaseMetadataPath(releasesDirectory, fileName),
  );
  const isLatest = fileName === latestFileName;
  const manifest = metadataManifest ?? (isLatest ? latestManifest : null);

  return {
    apkUrl: manifest?.apkUrl || `/releases/${fileName}`,
    fileExists,
    fileName,
    forceUpdate: manifest?.forceUpdate ?? false,
    isLatest,
    publishedAt: manifest?.publishedAt || '',
    releaseNotes: manifest?.releaseNotes || '',
    sha256: manifest?.sha256 || '',
    sizeBytes: manifest?.sizeBytes || fileSizeBytes,
    versionCode: manifest?.versionCode || 0,
    versionName: manifest?.versionName || inferTvVersionNameFromFileName(fileName),
  };
}

function compareTvReleaseVersions(left: TvReleaseVersion, right: TvReleaseVersion): number {
  if (left.isLatest !== right.isLatest) return left.isLatest ? -1 : 1;
  if (left.versionCode !== right.versionCode) return right.versionCode - left.versionCode;
  const leftTime = Date.parse(left.publishedAt || '');
  const rightTime = Date.parse(right.publishedAt || '');
  if (Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime !== rightTime) {
    return rightTime - leftTime;
  }
  return right.fileName.localeCompare(left.fileName);
}

function readTvReleaseManifest(manifestPath: string): TvAppUpdateManifest | null {
  if (!existsSync(manifestPath)) return null;
  try {
    return readTvReleaseManifestFromBuffer(Buffer.from(readFileSync(manifestPath, 'utf8')));
  } catch {
    return null;
  }
}

function readTvReleaseManifestFromBuffer(buffer: Buffer): TvAppUpdateManifest | null {
  try {
    const parsed = JSON.parse(buffer.toString('utf8')) as unknown;
    const record = parsed && typeof parsed === 'object'
      ? parsed as Record<string, unknown>
      : {};
    const versionCode = normalizeIntegerValue(record.versionCode);
    const versionName = normalizeTvVersionName(record.versionName);
    const apkUrl = normalizeOptionalText(record.apkUrl);
    if (!versionCode || !versionName || !apkUrl) return null;
    return {
      apkUrl,
      forceUpdate: normalizeBooleanValue(record.forceUpdate),
      publishedAt: normalizeOptionalText(record.publishedAt),
      releaseNotes: normalizeOptionalText(record.releaseNotes),
      sha256: normalizeOptionalText(record.sha256),
      sizeBytes: normalizeIntegerValue(record.sizeBytes),
      versionCode,
      versionName,
    };
  } catch {
    return null;
  }
}

function normalizeIntegerValue(value: unknown): number {
  const parsed = typeof value === 'number'
    ? value
    : typeof value === 'string'
      ? Number(value)
      : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

function normalizeBooleanValue(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return false;
  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

function normalizeOptionalText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeTvVersionName(value: unknown): string {
  const normalized = normalizeOptionalText(value).replace(/[^A-Za-z0-9._-]/g, '_');
  return normalized.slice(0, 48);
}

function normalizeTvReleaseFileNameFromUrl(value: string): string {
  const lastSegment = value.split(/[\\/]/).pop()?.split('?')[0]?.trim() ?? '';
  return /^[A-Za-z0-9._-]+\.apk$/.test(lastSegment) ? lastSegment : '';
}

function normalizeHttpUrl(value: string): string {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.toString() : '';
  } catch {
    return '';
  }
}

function isSha256(value: string): boolean {
  return /^[a-f0-9]{64}$/i.test(value);
}

function isTvReleaseApkFileName(value: string): boolean {
  return /^[A-Za-z0-9._-]+\.apk$/i.test(value);
}

function inferTvVersionNameFromFileName(fileName: string): string {
  const normalized = fileName.replace(/\.apk$/i, '');
  return normalized.startsWith('wangri-tv-')
    ? normalized.slice('wangri-tv-'.length)
    : normalized;
}

function getTvReleaseMetadataPath(releasesDirectory: string, fileName: string): string {
  return join(releasesDirectory, fileName.replace(/\.apk$/i, '.json'));
}

function pathSeparator(): '\\' | '/' {
  return process.platform === 'win32' ? '\\' : '/';
}

async function fetchTvReleaseAsset(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Unable to download TV release asset ${url}: HTTP ${response.status}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

function normalizePhotoCenterStatus(
  value?: string,
): PhotoCenterListQuery['aiCommentStatus'] {
  return value === 'completed' || value === 'failed' || value === 'pending'
    ? value
    : undefined;
}
