import { existsSync, mkdirSync, readdirSync, statSync } from 'fs';
import { basename, dirname, join, relative, resolve } from 'path';
import { DatabaseSync } from 'node:sqlite';
import type {
  AlbumSummary,
  PlaylistItem,
  PlaylistNarrationVariant,
} from '@wrjdyk/shared';
import sharp from 'sharp';

export interface PhotoAsset {
  contentType: string;
  filename: string;
  path: string;
}

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

export interface PhotoScanImportResult {
  discoveredPhotoCount: number;
  importedPhotoCount: number;
}

export type PhotoCenterAiStatus = 'completed' | 'failed' | 'pending';
export type PhotoCenterSourceAlbumKind = 'owned' | 'shared_by_me' | 'shared_to_me' | '';
export type PhotoCenterSourceType = 'feiniu' | 'local';

export interface PhotoCenterListQuery {
  aiCommentStatus?: PhotoCenterAiStatus;
  aiScoreStatus?: PhotoCenterAiStatus;
  aiTag?: string;
  albumId?: string;
  keyword?: string;
  page?: number;
  pageSize?: number;
  sourceType?: PhotoCenterSourceType;
}

export interface PhotoCenterItem {
  aiCompleted: boolean;
  aiBeautyScore: number | null;
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
  aiMemoryScore: number | null;
  aiNarrationVariants: PlaylistNarrationVariant[];
  aiReason: string;
  aiRecognizedAt: string;
  aiScore: number | null;
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

export interface PhotoCenterExternalItem {
  albumDescription: string;
  albumId: string;
  albumName: string;
  captionText: string;
  captionTitle: string;
  displayImageUrl: string;
  filename: string;
  imageUrl: string;
  location: string;
  photoId: string;
  sourceAlbumId: string;
  sourceAlbumKind: PhotoCenterSourceAlbumKind;
  sourceOwnerName: string;
  sourceType: Exclude<PhotoCenterSourceType, 'local'>;
  takenAt: string;
  thumbnailUrl: string;
}

export interface PhotoCenterExternalSyncOptions {
  syncedAt?: string;
}

export interface PhotoCenterExternalSyncResult {
  albumCount: number;
  discoveredPhotoCount: number;
  importedPhotoCount: number;
  syncedAt: string;
  updatedPhotoCount: number;
}

export interface PhotoDerivativeAssets {
  aiImageUrl: string;
  derivativeStatus: string;
  thumbImageUrl: string;
  tvImageUrl: string;
}

export interface PhotoDerivativeSource {
  buffer?: Buffer;
  path?: string;
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

export interface AiRuntimeSettings extends AiSettings {
  apiKey: string;
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
  provider?: string;
  scoringPrompt?: string;
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

export interface PhotoAiInsightInput {
  aiBeautyScore?: number;
  aiComment: string;
  aiDetail?: string;
  aiError?: string;
  aiFontStyle?: 'handwriting' | 'sans-serif' | 'serif';
  aiIsTrash?: boolean;
  aiLayoutPosition?: 'bottom_left' | 'bottom_right' | 'center_safe' | 'top_left' | 'top_right';
  aiMemoryScore?: number;
  aiNarrationVariants?: PlaylistNarrationVariant[];
  aiReason?: string;
  aiRecognizedAt?: string;
  aiSafeArea?: {
    h: number;
    w: number;
    x: number;
    y: number;
  };
  aiScore: number;
  aiTags: string[];
  aiTextColor?: '#000000' | '#FFFFFF';
  photoId: string;
}

export interface UpdatePhotoAiCommentInput {
  aiComment: string;
  aiLocked?: boolean;
}

export interface UpdatePhotoAiInsightInput {
  aiBeautyScore?: number | null;
  aiComment?: string;
  aiLocked?: boolean;
  aiMemoryScore?: number | null;
  aiTags?: string[];
}

export interface UpdatePhotoMetadataInput {
  captionTitle?: string;
  importAlbumTitle?: string;
  sourceAlbumKind?: PhotoCenterSourceAlbumKind;
  sourceOwnerName?: string;
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

export interface UpsertTvDeviceInput {
  appVersion?: string;
  deviceId: string;
  deviceName?: string;
  deviceToken: string;
  deviceUniqueId: string;
  platform?: string;
}

export interface UpdateTvDeviceInput {
  authorizedPlaybackAlbumIds?: string[];
  deviceName?: string;
  enabled?: boolean;
  groupName?: string;
}

export interface ApplyPhotoAiInsightsResult {
  generatedPhotoCount: number;
  requestedPhotoCount: number;
  skippedPhotoCount: number;
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

interface SqlitePhotoRepositoryOptions {
  databasePath?: string;
  derivativeRoot?: string;
  photoRoot?: string;
}

interface PhotoRow {
  ai_comment: string;
  ai_comment_status: PhotoCenterAiStatus;
  ai_beauty_score: number | null;
  ai_detail: string;
  ai_error: string;
  ai_font_style: string;
  ai_is_trash: number;
  ai_layout_position: string;
  ai_locked: number;
  ai_memory_score: number | null;
  ai_reason: string;
  ai_recognized_at: string;
  ai_safe_area: string;
  ai_score: number | null;
  ai_score_status: PhotoCenterAiStatus;
  ai_tags: string;
  ai_text_color: string;
  album_id: string;
  album_name: string;
  ai_720_url: string;
  caption_style: string;
  caption_text: string;
  caption_title: string;
  display_image_url: string;
  dominant_color: string;
  derivative_status: string;
  filename: string;
  image_url: string;
  import_album_title: string;
  imported_at: string;
  location: string;
  photo_id: string;
  position: number;
  source_album_id: string;
  source_album_kind: PhotoCenterSourceAlbumKind;
  source_owner_name: string;
  source_type: PhotoCenterSourceType;
  synced_at: string;
  taken_at: string;
  thumbnail_300_url: string;
  thumbnail_url: string;
  tv_4k_webp_url: string;
}

interface AlbumRow {
  album_id: string;
  cover_image_url: string;
  cover_photo_id: string;
  description: string;
  latest_taken_at: string;
  photo_count: number;
  thumbnail_url: string;
  title: string;
  updated_at: string;
}

interface MigrationRow {
  version: number;
}

interface PlaybackAlbumRow {
  authorized_device_ids: string;
  ai_daily_limit: number;
  ai_daily_processed_count: number;
  ai_daily_processed_on: string;
  ai_enabled: number;
  ai_priority_tags: string;
  ai_repeat_interval_minutes: number;
  ai_score_threshold: number;
  cover_photo_id: string;
  created_at: string;
  description: string;
  photo_count: number;
  playback_album_id: string;
  push_enabled: number;
  push_beauty_score_threshold: number;
  push_memory_score_threshold: number;
  push_priority_tags: string;
  push_score_threshold: number;
  source_album_id: string;
  source_album_title: string;
  source_type: string;
  title: string;
  last_ai_checked_at: string;
  updated_at: string;
}

interface AiSettingsRow {
  ai_check_interval_minutes: number;
  daily_ai_limit: number;
  api_key: string;
  base_url: string;
  classification_prompt: string;
  comment_prompt: string;
  layout_prompt: string;
  model: string;
  output_contract_prompt: string;
  provider: string;
  scoring_prompt: string;
  updated_at: string;
}

interface AiRecognitionTaskRow {
  active_photo_id: string;
  active_photo_name: string;
  album_id: string;
  album_title: string;
  completed_photo_count: number;
  created_at: string;
  error: string;
  failed_photo_count: number;
  finished_at: string;
  job_id: string;
  last_updated_at: string;
  requested_photo_count: number;
  skipped_photo_count: number;
  status: string;
  target_id: string;
  target_title: string;
  target_type: string;
}

interface TvDeviceRow {
  app_version: string;
  authorized_playback_album_ids: string;
  created_at: string;
  device_id: string;
  device_name: string;
  device_token: string;
  device_unique_id: string;
  enabled: number;
  group_name: string;
  last_login_at: string;
  platform: string;
  updated_at: string;
}

const currentSchemaVersion = 15;

const defaultBusinessVisionPrompt = [
  '按家庭记忆价值、人物情绪、清晰度、构图光影和电视大屏可观看性综合评分。账单、截图、模糊测试图、纯黑纯白图直接低分或标记废片；人物自然、家庭事件、开心瞬间、特殊场景应提高 memory_score。',
  '为家庭电视播放写 2-3 行温暖、克制、有停顿感的中文旁白，总字数 10-25 字。文字像家人轻声回忆，不像广告标题；避免照片文件名、相册名和夸张形容。',
  '识别照片中的主要类型和氛围，返回 3-6 个适合家庭影像分拣和推送优先级的中文标签。优先使用人物、开心、场景、旅行、聚会、纪念日、亲子、合影、美食、宠物、旧照片、生活瞬间。',
  '分析 16:9 电视画布中的安全文字区。文字必须避开人脸、人物主体和高信息区域；优先落在留白、暗部、背景简单区域或可加渐变遮罩区域。输出 position、safe_area、text_color、font_style。',
].join('\n\n');

const defaultOutputContractPrompt = [
  '最终只能输出一个可被 JSON.parse 直接解析的 JSON 对象；不要 Markdown、代码块、Python、工具调用、search(...)、Result、过程说明或额外文字。',
  '必须返回 schema_version: "photo_tv_payload_v1"。',
  '必须包含 photo_analysis.caption、classification、scores、narration_options、selected_narration_index、layout_plan。',
  'photo_analysis.caption 为 100-200 字中文画面描述，直接描述真实可见内容，不要根据文件名或相册名编造。',
  'classification 必须包含 category、scene_tags、tv_suitability；scene_tags 返回 3-6 个中文标签，tv_suitability 只能为 high、medium、low。',
  'scores 必须包含 memory_score、beauty_score、is_trash、reason；memory_score 和 beauty_score 为 0-100 数字，reason 不超过 80 字。',
  'narration_options 必须返回 5 组不同的三段式旁白，每组包含 scene_line、handwritten_line、closing_line；selected_narration_index 为 0-4 的整数。',
  'layout_plan 必须包含 position、safe_area、text_color、font_style；safe_area 使用 0-1 归一化 {x,y,w,h}，text_color 只能是 #FFFFFF 或 #000000，font_style 只能是 handwriting、sans-serif、serif。',
].join('\n');

const defaultAiSettings = {
  aiCheckIntervalMinutes: 60,
  dailyAiLimit: 100,
  baseUrl: '',
  classificationPrompt: '',
  commentPrompt: '',
  layoutPrompt: '',
  model: 'gpt-4o-mini',
  outputContractPrompt: defaultOutputContractPrompt,
  provider: 'openai_compatible' satisfies AiSettingsProvider,
  scoringPrompt: defaultBusinessVisionPrompt,
};

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
    description: '记录我们家的点点滴滴，那些温暖的时光。',
    dominantColor: '#d8a465',
    location: '京都',
    text: '有些快乐不用解释，照片已经替我们记住了。',
    title: '那年的夏天',
  },
  {
    albumId: 'weekend-daily',
    albumName: '周末日常',
    description: '普通的一天，也会在多年以后变得很亮。',
    dominantColor: '#758c72',
    location: '家',
    text: '普通的一天，也会在多年以后变得很亮。',
    title: '客厅里的午后',
  },
  {
    albumId: 'old-photos',
    albumName: '旧照片',
    description: '时间走得很远，画面还在原地等我们。',
    dominantColor: '#9f8a76',
    location: '老家',
    text: '时间走得很远，画面还在原地等我们。',
    title: '回到那一刻',
  },
];

export class SqlitePhotoRepository {
  private readonly databasePath: string;
  private readonly derivativeRoot: string;
  private readonly photoRoot: string;
  private database?: DatabaseSync;

  constructor(options: SqlitePhotoRepositoryOptions = {}) {
    const projectRoot = findProjectRoot(process.cwd());
    this.databasePath =
      options.databasePath ?? join(projectRoot, 'apps', 'backend-api', 'data', 'wrjdyk.sqlite');
    this.derivativeRoot =
      options.derivativeRoot ??
      join(projectRoot, 'apps', 'backend-api', 'data', 'derivatives');
    this.photoRoot = options.photoRoot ?? join(projectRoot, 'ceshi');
  }

  close(): void {
    this.database?.close();
    this.database = undefined;
  }

  getPhotoAsset(photoId: string): PhotoAsset | null {
    const photo = this.getPhotoRow(photoId);
    if (!photo) return null;

    const path = join(this.photoRoot, photo.filename);
    if (!existsSync(path)) return null;

    return {
      contentType: contentTypeForFilename(photo.filename),
      filename: photo.filename,
      path,
    };
  }

  getDerivativeAsset(photoId: string, filename: string): PhotoAsset | null {
    const normalizedPhotoId = normalizePathSegment(photoId);
    const normalizedFilename = normalizeDerivativeFilename(filename);
    if (!normalizedPhotoId || !normalizedFilename) return null;

    const path = join(this.derivativeRoot, normalizedPhotoId, normalizedFilename);
    if (!existsSync(path)) return null;

    return {
      contentType: 'image/webp',
      filename: normalizedFilename,
      path,
    };
  }

  getOverview(): PhotoLibraryOverview {
    this.initialize();
    const database = this.getDatabase();
    const photoCount = database.prepare('SELECT COUNT(*) AS count FROM photos').get() as {
      count: number;
    };
    const albumCount = database.prepare('SELECT COUNT(*) AS count FROM albums').get() as {
      count: number;
    };
    const migration = database
      .prepare('SELECT COALESCE(MAX(version), 0) AS version FROM schema_migrations')
      .get() as unknown as MigrationRow;

    return {
      albumCount: albumCount.count,
      databasePath: this.databasePath,
      migrationVersion: migration.version,
      photoCount: photoCount.count,
      photoRoot: this.photoRoot,
    };
  }

  listAiRecognitionTasks(limit = 100): AiRecognitionTaskProgress[] {
    this.initialize();
    const rows = this.getDatabase()
      .prepare(
        `
          SELECT
            job_id,
            target_type,
            target_id,
            target_title,
            album_id,
            album_title,
            status,
            requested_photo_count,
            completed_photo_count,
            skipped_photo_count,
            failed_photo_count,
            active_photo_id,
            active_photo_name,
            error,
            created_at,
            last_updated_at,
            finished_at
          FROM ai_recognition_tasks
          ORDER BY created_at DESC, last_updated_at DESC
          LIMIT ?
        `,
      )
      .all(Math.max(1, Math.min(Math.floor(limit), 200))) as unknown as AiRecognitionTaskRow[];

    return rows.map(rowToAiRecognitionTask);
  }

  clearAiRecognitionTasks(): ClearAiRecognitionTasksResult {
    this.initialize();
    const result = this.getDatabase()
      .prepare('DELETE FROM ai_recognition_tasks')
      .run() as unknown as { changes: number };
    return {
      deletedTaskCount: result.changes ?? 0,
    };
  }

  upsertAiRecognitionTask(task: AiRecognitionTaskProgress): AiRecognitionTaskProgress {
    this.initialize();
    this.getDatabase()
      .prepare(
        `
          INSERT INTO ai_recognition_tasks (
            job_id,
            target_type,
            target_id,
            target_title,
            album_id,
            album_title,
            status,
            requested_photo_count,
            completed_photo_count,
            skipped_photo_count,
            failed_photo_count,
            active_photo_id,
            active_photo_name,
            error,
            created_at,
            last_updated_at,
            finished_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(job_id) DO UPDATE SET
            target_type = excluded.target_type,
            target_id = excluded.target_id,
            target_title = excluded.target_title,
            album_id = excluded.album_id,
            album_title = excluded.album_title,
            status = excluded.status,
            requested_photo_count = excluded.requested_photo_count,
            completed_photo_count = excluded.completed_photo_count,
            skipped_photo_count = excluded.skipped_photo_count,
            failed_photo_count = excluded.failed_photo_count,
            active_photo_id = excluded.active_photo_id,
            active_photo_name = excluded.active_photo_name,
            error = excluded.error,
            last_updated_at = excluded.last_updated_at,
            finished_at = excluded.finished_at
        `,
      )
      .run(
        task.jobId,
        task.targetType,
        task.targetId,
        task.targetTitle,
        task.albumId,
        task.albumTitle,
        task.status,
        task.requestedPhotoCount,
        task.completedPhotoCount,
        task.skippedPhotoCount,
        task.failedPhotoCount,
        task.activePhotoId,
        task.activePhotoName,
        task.error,
        task.createdAt,
        task.lastUpdatedAt,
        task.finishedAt,
      );
    return task;
  }

  updateAiRecognitionTask(
    jobId: string,
    patch: Partial<Omit<AiRecognitionTaskProgress, 'createdAt' | 'jobId'>>,
  ): AiRecognitionTaskProgress | null {
    this.initialize();
    const current = this.listAiRecognitionTasks(200).find((task) => task.jobId === jobId);
    if (!current) return null;
    const updated: AiRecognitionTaskProgress = {
      ...current,
      ...patch,
      lastUpdatedAt: patch.lastUpdatedAt ?? new Date().toISOString(),
    };
    return this.upsertAiRecognitionTask(updated);
  }

  initialize(): void {
    mkdirSync(dirname(this.databasePath), { recursive: true });
    mkdirSync(this.photoRoot, { recursive: true });
    const database = this.getDatabase();

    this.applyMigrations();
    this.cleanupMissingSeedPhotos();

    const count = database.prepare('SELECT COUNT(*) AS count FROM photos').get() as { count: number };
    if (count.count === 0 && this.hasSeedPhotoFiles()) {
      this.seedCeshiPhotos();
    }
  }

  listAlbums(): AlbumSummary[] {
    this.initialize();
    const rows = this.getDatabase().prepare(`
      SELECT
        a.album_id,
        a.title,
        a.description,
        COUNT(p.photo_id) AS photo_count,
        cover.photo_id AS cover_photo_id,
        photo_url(cover.photo_id, 'display') AS cover_image_url,
        photo_url(cover.photo_id, 'thumb') AS thumbnail_url,
        MAX(p.taken_at) AS latest_taken_at,
        COALESCE(MAX(p.taken_at), '1970-01-01') AS updated_at
      FROM albums a
      JOIN album_photos ap ON ap.album_id = a.album_id
      JOIN photos p ON p.photo_id = ap.photo_id
      JOIN album_photos cover_ap ON cover_ap.album_id = a.album_id AND cover_ap.position = 0
      JOIN photos cover ON cover.photo_id = cover_ap.photo_id
      WHERE p.source_type = 'local' AND cover.source_type = 'local' AND p.ai_is_trash != 1 AND cover.ai_is_trash != 1
      GROUP BY a.album_id
      ORDER BY a.sort_order ASC
    `).all() as unknown as AlbumRow[];

    return rows.map((row) => ({
      albumId: row.album_id,
      coverImageUrl: row.cover_image_url,
      coverPhotoId: row.cover_photo_id,
      description: row.description,
      latestTakenAt: row.latest_taken_at,
      photoCount: row.photo_count,
      thumbnailUrl: row.thumbnail_url,
      title: row.title,
      updatedAt: row.updated_at,
    }));
  }

  listPlaylistItems(albumId?: string): PlaylistItem[] {
    this.initialize();
    const rows = this.getDatabase().prepare(`
      SELECT
        p.photo_id,
        p.filename,
        p.taken_at,
        p.location,
        p.dominant_color,
          p.caption_title,
          p.caption_text,
          p.caption_style,
          p.source_type,
          p.source_album_id,
          p.import_album_title,
          p.ai_score,
          p.ai_score_status,
          p.ai_comment_status,
          p.ai_comment,
          p.ai_tags,
          p.ai_locked,
          p.ai_memory_score,
          p.ai_beauty_score,
          p.ai_is_trash,
          p.ai_reason,
          p.ai_layout_position,
          p.ai_text_color,
          p.ai_font_style,
          p.ai_safe_area,
          p.ai_detail,
          p.ai_error,
          p.ai_recognized_at,
          a.album_id,
        a.title AS album_name,
        ap.position,
        COALESCE(NULLIF(p.tv_4k_webp_url, ''), NULLIF(p.display_image_url, ''), photo_url(p.photo_id, 'display')) AS display_image_url,
        photo_url(p.photo_id, 'original') AS image_url,
        COALESCE(NULLIF(p.thumbnail_300_url, ''), NULLIF(p.thumbnail_url, ''), photo_url(p.photo_id, 'thumb')) AS thumbnail_url,
        COALESCE(NULLIF(p.thumbnail_300_url, ''), NULLIF(p.thumbnail_url, ''), photo_url(p.photo_id, 'thumb')) AS thumbnail_300_url,
        COALESCE(NULLIF(p.ai_720_url, ''), NULLIF(p.display_image_url, ''), photo_url(p.photo_id, 'display')) AS ai_720_url,
        COALESCE(NULLIF(p.tv_4k_webp_url, ''), NULLIF(p.display_image_url, ''), photo_url(p.photo_id, 'display')) AS tv_4k_webp_url,
        p.derivative_status
      FROM album_photos ap
      JOIN albums a ON a.album_id = ap.album_id
      JOIN photos p ON p.photo_id = ap.photo_id
      WHERE p.source_type = 'local' AND p.ai_is_trash != 1 AND ($albumId IS NULL OR a.album_id = $albumId)
      ORDER BY a.sort_order ASC, ap.position ASC
    `).all({ $albumId: albumId ?? null }) as unknown as PhotoRow[];

    return rows.map((row) => rowToPlaylistItem(row));
  }

  listPhotoCenterItems(
    query: PhotoCenterListQuery = {},
  ): PhotoCenterListResponse {
    this.initialize();
    const page = normalizePositiveInteger(query.page, 1);
    const pageSize = Math.min(normalizePositiveInteger(query.pageSize, 20), 100);
    const offset = (page - 1) * pageSize;
    const filters: string[] = ['p.ai_is_trash != 1'];
    const filterParams: Record<string, string> = {};

    if (query.albumId) {
      filters.push('a.album_id = $albumId');
      filterParams.$albumId = query.albumId;
    }
    if (query.sourceType) {
      filters.push('p.source_type = $sourceType');
      filterParams.$sourceType = query.sourceType;
    }
    if (query.aiScoreStatus) {
      filters.push('p.ai_score_status = $aiScoreStatus');
      filterParams.$aiScoreStatus = query.aiScoreStatus;
    }
    if (query.aiCommentStatus) {
      filters.push('p.ai_comment_status = $aiCommentStatus');
      filterParams.$aiCommentStatus = query.aiCommentStatus;
    }
    if (query.keyword?.trim()) {
      filters.push(`(
        p.photo_id LIKE $keyword OR
        p.filename LIKE $keyword OR
        p.caption_title LIKE $keyword OR
        p.caption_text LIKE $keyword OR
        a.title LIKE $keyword
      )`);
      filterParams.$keyword = `%${query.keyword.trim()}%`;
    }
    if (query.aiTag?.trim()) {
      filters.push('p.ai_tags LIKE $aiTag');
      filterParams.$aiTag = `%"${query.aiTag.trim()}"%`;
    }

    const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';
    const database = this.getDatabase();
    const totalRow = database.prepare(`
      SELECT COUNT(*) AS count
      FROM photos p
      JOIN album_photos ap ON ap.photo_id = p.photo_id
      JOIN albums a ON a.album_id = ap.album_id
      ${whereClause}
    `).get(filterParams) as { count: number };
    const listParams: Record<string, number | string> = {
      ...filterParams,
      $limit: pageSize,
      $offset: offset,
    };
    const rows = database.prepare(`
      SELECT
        p.photo_id,
        p.filename,
        p.taken_at,
        p.location,
        p.caption_title,
        p.source_type,
        p.source_album_id,
        p.source_album_kind,
        p.source_owner_name,
        p.import_album_title,
        p.imported_at,
        p.synced_at,
        p.ai_score,
        p.ai_score_status,
        p.ai_comment_status,
        p.ai_comment,
        p.ai_tags,
        p.ai_locked,
        p.ai_memory_score,
        p.ai_beauty_score,
        p.ai_is_trash,
        p.ai_reason,
        p.ai_layout_position,
        p.ai_text_color,
        p.ai_font_style,
        p.ai_safe_area,
        p.ai_detail,
        p.ai_error,
        p.ai_recognized_at,
        a.album_id,
        a.title AS album_name,
        COALESCE(NULLIF(p.thumbnail_300_url, ''), NULLIF(p.thumbnail_url, ''), photo_url(p.photo_id, 'thumb')) AS thumbnail_url,
        COALESCE(NULLIF(p.thumbnail_300_url, ''), NULLIF(p.thumbnail_url, ''), photo_url(p.photo_id, 'thumb')) AS thumbnail_300_url,
        COALESCE(NULLIF(p.ai_720_url, ''), NULLIF(p.display_image_url, ''), photo_url(p.photo_id, 'display')) AS ai_720_url,
        COALESCE(NULLIF(p.tv_4k_webp_url, ''), NULLIF(p.display_image_url, ''), photo_url(p.photo_id, 'display')) AS tv_4k_webp_url,
        p.derivative_status,
        COALESCE(NULLIF(p.tv_4k_webp_url, ''), NULLIF(p.display_image_url, ''), photo_url(p.photo_id, 'display')) AS display_image_url,
        COALESCE(NULLIF(p.image_url, ''), photo_url(p.photo_id, 'original')) AS image_url
      FROM photos p
      JOIN album_photos ap ON ap.photo_id = p.photo_id
      JOIN albums a ON a.album_id = ap.album_id
      ${whereClause}
      ORDER BY a.sort_order ASC, ap.position ASC
      LIMIT $limit OFFSET $offset
    `).all(listParams) as unknown as PhotoRow[];

    return {
      items: rows.map(rowToPhotoCenterItem),
      page,
      pageSize,
      total: totalRow.count,
    };
  }

  listPhotoCenterAlbumItems(
    albumId: string,
    sourceType?: PhotoCenterSourceType,
  ): PhotoCenterItem[] {
    this.initialize();
    const normalizedAlbumId = albumId.trim();
    if (!normalizedAlbumId) return [];

    const filters = ['a.album_id = $albumId', 'p.ai_is_trash != 1'];
    const params: Record<string, string> = {
      $albumId: normalizedAlbumId,
    };
    if (sourceType) {
      filters.push('p.source_type = $sourceType');
      params.$sourceType = sourceType;
    }

    const rows = this.getDatabase().prepare(`
      SELECT
        p.photo_id,
        p.filename,
        p.taken_at,
        p.location,
        p.caption_title,
        p.source_type,
        p.source_album_id,
        p.source_album_kind,
        p.source_owner_name,
        p.import_album_title,
        p.imported_at,
        p.synced_at,
        p.ai_score,
        p.ai_score_status,
        p.ai_comment_status,
        p.ai_comment,
        p.ai_tags,
        p.ai_locked,
        p.ai_memory_score,
        p.ai_beauty_score,
        p.ai_is_trash,
        p.ai_reason,
        p.ai_layout_position,
        p.ai_text_color,
        p.ai_font_style,
        p.ai_safe_area,
        p.ai_detail,
        p.ai_error,
        p.ai_recognized_at,
        a.album_id,
        a.title AS album_name,
        COALESCE(NULLIF(p.thumbnail_300_url, ''), NULLIF(p.thumbnail_url, ''), photo_url(p.photo_id, 'thumb')) AS thumbnail_url,
        COALESCE(NULLIF(p.thumbnail_300_url, ''), NULLIF(p.thumbnail_url, ''), photo_url(p.photo_id, 'thumb')) AS thumbnail_300_url,
        COALESCE(NULLIF(p.ai_720_url, ''), NULLIF(p.display_image_url, ''), photo_url(p.photo_id, 'display')) AS ai_720_url,
        COALESCE(NULLIF(p.tv_4k_webp_url, ''), NULLIF(p.display_image_url, ''), photo_url(p.photo_id, 'display')) AS tv_4k_webp_url,
        p.derivative_status,
        COALESCE(NULLIF(p.tv_4k_webp_url, ''), NULLIF(p.display_image_url, ''), photo_url(p.photo_id, 'display')) AS display_image_url,
        COALESCE(NULLIF(p.image_url, ''), photo_url(p.photo_id, 'original')) AS image_url
      FROM photos p
      JOIN album_photos ap ON ap.photo_id = p.photo_id
      JOIN albums a ON a.album_id = ap.album_id
      WHERE ${filters.join(' AND ')}
      ORDER BY a.sort_order ASC, ap.position ASC
    `).all(params) as unknown as PhotoRow[];

    return rows.map(rowToPhotoCenterItem);
  }

  rebuildFromPhotoRoot(): PhotoScanImportResult {
    mkdirSync(dirname(this.databasePath), { recursive: true });
    mkdirSync(this.photoRoot, { recursive: true });
    this.applyMigrations();

    const files = collectPhotoFiles(this.photoRoot);
    const database = this.getDatabase();

    database.exec('BEGIN');
    try {
      database.exec(`
        DELETE FROM album_photos;
        DELETE FROM photos;
        DELETE FROM albums;
      `);

      if (files.length > 0) {
        database
          .prepare(
            `
              INSERT INTO albums (album_id, title, description, sort_order)
              VALUES (?, ?, ?, ?)
            `,
          )
          .run(
            'local-scan',
            '本地扫描',
            '从本地照片目录扫描导入的照片。',
            0,
          );

        const insertPhoto = database.prepare(`
          INSERT INTO photos (
            photo_id,
            filename,
            taken_at,
            location,
            dominant_color,
            caption_title,
            caption_text,
            caption_style,
            source_type,
            source_album_id,
            import_album_title
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const insertAlbumPhoto = database.prepare(`
          INSERT INTO album_photos (album_id, photo_id, position)
          VALUES (?, ?, ?)
        `);

        files.forEach((file, index) => {
          const photoNumber = index + 1;
          const photoId = `scan_${photoNumber.toString().padStart(3, '0')}`;
          const title = basename(file.relativePath).replace(/\.[^.]+$/, '');
          insertPhoto.run(
            photoId,
            file.relativePath,
            file.takenAt,
            '',
            '#6b7280',
            title,
            '等待补充照片回忆文案。',
            'minimal',
            'local',
            'local-scan',
            '本地扫描',
          );
          insertAlbumPhoto.run('local-scan', photoId, index);
        });
      }

      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }

    return {
      discoveredPhotoCount: files.length,
      importedPhotoCount: files.length,
    };
  }

  syncExternalPhotoCenterItems(
    inputItems: PhotoCenterExternalItem[],
    options: PhotoCenterExternalSyncOptions = {},
  ): PhotoCenterExternalSyncResult {
    this.initialize();
    const syncedAt = options.syncedAt ?? new Date().toISOString();
    const database = this.getDatabase();
    const itemsByPhotoId = new Map<string, PhotoCenterExternalItem>();
    for (const item of inputItems) {
      if (item.photoId.trim()) itemsByPhotoId.set(item.photoId, item);
    }
    const items = [...itemsByPhotoId.values()];
    const albumsById = new Map<string, PhotoCenterExternalItem>();
    for (const item of items) {
      if (!albumsById.has(item.albumId)) albumsById.set(item.albumId, item);
    }

    let importedPhotoCount = 0;
    let updatedPhotoCount = 0;

    database.exec('BEGIN');
    try {
      const insertAlbum = database.prepare(`
        INSERT INTO albums (album_id, title, description, sort_order)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(album_id) DO UPDATE SET
          title = excluded.title,
          description = excluded.description,
          sort_order = excluded.sort_order
      `);
      let albumIndex = 0;
      for (const album of albumsById.values()) {
        insertAlbum.run(
          album.albumId,
          album.albumName,
          album.albumDescription,
          1_000 + albumIndex,
        );
        database
          .prepare('DELETE FROM album_photos WHERE album_id = ?')
          .run(album.albumId);
        albumIndex += 1;
      }

      const existingPhoto = database.prepare(`
        SELECT photo_id
        FROM photos
        WHERE photo_id = ?
      `);
      const upsertPhoto = database.prepare(`
        INSERT INTO photos (
          photo_id,
          filename,
          taken_at,
          location,
          dominant_color,
          caption_title,
          caption_text,
          caption_style,
          source_type,
          source_album_id,
          source_album_kind,
          source_owner_name,
          import_album_title,
          imported_at,
          synced_at,
          display_image_url,
          image_url,
          thumbnail_url
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(photo_id) DO UPDATE SET
          filename = excluded.filename,
          taken_at = excluded.taken_at,
          location = excluded.location,
          dominant_color = excluded.dominant_color,
          caption_title = excluded.caption_title,
          caption_text = excluded.caption_text,
          caption_style = excluded.caption_style,
          source_type = excluded.source_type,
          source_album_id = excluded.source_album_id,
          source_album_kind = excluded.source_album_kind,
          source_owner_name = excluded.source_owner_name,
          import_album_title = excluded.import_album_title,
          synced_at = excluded.synced_at,
          display_image_url = excluded.display_image_url,
          image_url = excluded.image_url,
          thumbnail_url = excluded.thumbnail_url
      `);
      const insertAlbumPhoto = database.prepare(`
        INSERT INTO album_photos (album_id, photo_id, position)
        VALUES (?, ?, ?)
      `);
      const positionsByAlbumId = new Map<string, number>();

      for (const item of items) {
        const exists = Boolean(existingPhoto.get(item.photoId));
        if (exists) {
          updatedPhotoCount += 1;
        } else {
          importedPhotoCount += 1;
        }
        upsertPhoto.run(
          item.photoId,
          item.filename,
          item.takenAt,
          item.location,
          '#6b7280',
          item.captionTitle,
          item.captionText,
          'minimal',
          item.sourceType,
          item.sourceAlbumId,
          item.sourceAlbumKind,
          item.sourceOwnerName,
          item.albumName,
          syncedAt,
          syncedAt,
          item.displayImageUrl,
          item.imageUrl,
          item.thumbnailUrl,
        );
        const position = positionsByAlbumId.get(item.albumId) ?? 0;
        insertAlbumPhoto.run(item.albumId, item.photoId, position);
        positionsByAlbumId.set(item.albumId, position + 1);
      }

      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }

    return {
      albumCount: albumsById.size,
      discoveredPhotoCount: items.length,
      importedPhotoCount,
      syncedAt,
      updatedPhotoCount,
    };
  }

  getAiSettings(): AiSettings {
    this.initialize();
    return rowToAiSettings(this.getAiSettingsRow());
  }

  getAiRuntimeSettings(): AiRuntimeSettings {
    this.initialize();
    const row = this.getAiSettingsRow();
    return {
      ...rowToAiSettings(row),
      apiKey: row.api_key,
    };
  }

  updateAiSettings(input: UpdateAiSettingsInput): AiSettings {
    this.initialize();
    const current = this.getAiSettingsRow();
    const now = new Date().toISOString();
    const apiKey = typeof input.apiKey === 'string' && input.apiKey.trim()
      ? input.apiKey.trim()
      : current.api_key;

    this.getDatabase()
      .prepare(
        `
          UPDATE ai_settings
          SET
            ai_check_interval_minutes = ?,
            daily_ai_limit = ?,
            provider = ?,
            model = ?,
            base_url = ?,
            api_key = ?,
            scoring_prompt = ?,
            comment_prompt = ?,
            classification_prompt = ?,
            layout_prompt = ?,
            output_contract_prompt = ?,
            updated_at = ?
          WHERE id = 1
        `,
      )
      .run(
        normalizePositiveInteger(
          input.aiCheckIntervalMinutes,
          current.ai_check_interval_minutes,
        ),
        normalizePositiveInteger(
          input.dailyAiLimit,
          current.daily_ai_limit,
        ),
        normalizeAiProvider(input.provider, current.provider),
        normalizeOptionalText(input.model, current.model),
        normalizeOptionalText(input.baseUrl, current.base_url, true),
        apiKey,
        normalizeOptionalText(input.scoringPrompt, current.scoring_prompt),
        normalizeOptionalText(input.commentPrompt, current.comment_prompt),
        normalizeOptionalText(
          input.classificationPrompt,
          current.classification_prompt,
        ),
        normalizeOptionalText(input.layoutPrompt, current.layout_prompt),
        normalizeOptionalText(
          input.outputContractPrompt,
          current.output_contract_prompt,
        ),
        now,
      );

    return this.getAiSettings();
  }

  async ensurePhotoDerivatives(
    photoId: string,
    source?: PhotoDerivativeSource,
  ): Promise<PhotoDerivativeAssets> {
    this.initialize();
    const normalizedPhotoId = photoId.trim();
    const row = this.getDatabase()
      .prepare(
        `
          SELECT
            photo_id,
            filename,
            source_type,
            COALESCE(NULLIF(thumbnail_300_url, ''), NULLIF(thumbnail_url, ''), photo_url(photo_id, 'thumb')) AS thumbnail_300_url,
            COALESCE(NULLIF(ai_720_url, ''), NULLIF(display_image_url, ''), photo_url(photo_id, 'display')) AS ai_720_url,
            COALESCE(NULLIF(tv_4k_webp_url, ''), NULLIF(display_image_url, ''), photo_url(photo_id, 'display')) AS tv_4k_webp_url
          FROM photos
          WHERE photo_id = ?
        `,
      )
      .get(normalizedPhotoId) as unknown as {
        filename: string;
        photo_id: string;
        source_type: PhotoCenterSourceType;
        ai_720_url: string;
        thumbnail_300_url: string;
        tv_4k_webp_url: string;
      } | undefined;
    if (!row) throw new Error(`Photo not found: ${normalizedPhotoId}`);

    const sourceInput = source?.buffer ?? source?.path;
    const localSourcePath = join(this.photoRoot, row.filename);
    const outputDir = join(this.derivativeRoot, normalizedPhotoId);
    const thumbPath = join(outputDir, 'thumb_300.webp');
    const aiPath = join(outputDir, 'ai_720.webp');
    const tvPath = join(outputDir, 'tv_4k.webp');
    if (!sourceInput && existsSync(aiPath)) {
      const assets: PhotoDerivativeAssets = {
        aiImageUrl: derivativeUrl(normalizedPhotoId, 'ai_720.webp'),
        derivativeStatus: 'ready',
        thumbImageUrl: existsSync(thumbPath)
          ? derivativeUrl(normalizedPhotoId, 'thumb_300.webp')
          : withDerivativeProfile(row.thumbnail_300_url, 'thumb_300'),
        tvImageUrl: existsSync(tvPath)
          ? derivativeUrl(normalizedPhotoId, 'tv_4k.webp')
          : withDerivativeProfile(row.tv_4k_webp_url, 'tv_4k_webp'),
      };

      this.getDatabase()
        .prepare(
          `
            UPDATE photos
            SET
              thumbnail_300_url = ?,
              ai_720_url = ?,
              tv_4k_webp_url = ?,
              derivative_status = 'ready'
            WHERE photo_id = ?
          `,
        )
        .run(
          assets.thumbImageUrl,
          assets.aiImageUrl,
          assets.tvImageUrl,
          normalizedPhotoId,
        );

      return assets;
    }

    if (row.source_type !== 'local' && !sourceInput) {
      const assets: PhotoDerivativeAssets = {
        aiImageUrl: withDerivativeProfile(row.ai_720_url, 'ai_720'),
        derivativeStatus: 'remote_pending',
        thumbImageUrl: withDerivativeProfile(row.thumbnail_300_url, 'thumb_300'),
        tvImageUrl: withDerivativeProfile(row.tv_4k_webp_url, 'tv_4k_webp'),
      };

      this.getDatabase()
        .prepare(
          `
            UPDATE photos
            SET
              thumbnail_300_url = ?,
              ai_720_url = ?,
              tv_4k_webp_url = ?,
              derivative_status = 'remote_pending'
            WHERE photo_id = ?
          `,
        )
        .run(
          assets.thumbImageUrl,
          assets.aiImageUrl,
          assets.tvImageUrl,
          normalizedPhotoId,
        );

      return assets;
    }

    if (!sourceInput && !existsSync(localSourcePath)) {
      this.getDatabase()
        .prepare(
          `
            UPDATE photos
            SET derivative_status = 'failed'
            WHERE photo_id = ?
          `,
        )
        .run(normalizedPhotoId);
      throw new Error(`Photo source file not found: ${normalizedPhotoId}`);
    }

    mkdirSync(outputDir, { recursive: true });

    await Promise.all([
      ensureWebpDerivative(sourceInput ?? localSourcePath, thumbPath, 300, 78),
      ensureWebpDerivative(sourceInput ?? localSourcePath, aiPath, 720, 82),
      ensureWebpDerivative(sourceInput ?? localSourcePath, tvPath, 3840, 86),
    ]);

    const assets: PhotoDerivativeAssets = {
      aiImageUrl: derivativeUrl(normalizedPhotoId, 'ai_720.webp'),
      derivativeStatus: 'ready',
      thumbImageUrl: derivativeUrl(normalizedPhotoId, 'thumb_300.webp'),
      tvImageUrl: derivativeUrl(normalizedPhotoId, 'tv_4k.webp'),
    };

    this.getDatabase()
      .prepare(
        `
          UPDATE photos
          SET
            thumbnail_300_url = ?,
            ai_720_url = ?,
            tv_4k_webp_url = ?,
            derivative_status = 'ready'
          WHERE photo_id = ?
        `,
      )
      .run(
        assets.thumbImageUrl,
        assets.aiImageUrl,
        assets.tvImageUrl,
        normalizedPhotoId,
      );

    return assets;
  }

  async ensurePhotoThumbnail(
    photoId: string,
    source?: PhotoDerivativeSource,
  ): Promise<string> {
    this.initialize();
    const normalizedPhotoId = photoId.trim();
    const row = this.getDatabase()
      .prepare(
        `
          SELECT photo_id, filename, source_type, thumbnail_300_url
          FROM photos
          WHERE photo_id = ? AND ai_is_trash != 1
        `,
      )
      .get(normalizedPhotoId) as unknown as {
        filename: string;
        photo_id: string;
        source_type: PhotoCenterSourceType;
        thumbnail_300_url: string;
      } | undefined;
    if (!row) throw new Error(`Photo not found: ${normalizedPhotoId}`);
    if (row.thumbnail_300_url.trim().startsWith('/api/derivatives/')) {
      return row.thumbnail_300_url;
    }

    const sourceInput = source?.buffer ?? source?.path;
    const localSourcePath = join(this.photoRoot, row.filename);
    if (!sourceInput && !existsSync(localSourcePath)) {
      return row.thumbnail_300_url || photoUrl(normalizedPhotoId, 'thumb');
    }

    const outputDir = join(this.derivativeRoot, normalizedPhotoId);
    mkdirSync(outputDir, { recursive: true });
    const thumbPath = join(outputDir, 'thumb_300.webp');
    await ensureWebpDerivative(sourceInput ?? localSourcePath, thumbPath, 300, 78);
    const thumbImageUrl = derivativeUrl(normalizedPhotoId, 'thumb_300.webp');
    this.getDatabase()
      .prepare(
        `
          UPDATE photos
          SET thumbnail_300_url = ?
          WHERE photo_id = ?
        `,
      )
      .run(thumbImageUrl, normalizedPhotoId);
    return thumbImageUrl;
  }

  createPlaybackAlbum(input: CreatePlaybackAlbumInput): PlaybackAlbum {
    this.initialize();
    const now = new Date().toISOString();
    const playbackAlbumId = `play_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const title = input.title.trim();
    if (!title) throw new Error('Playback album title is required');
    const aiPriorityTags = normalizeTags(input.aiPriorityTags);
    const pushPriorityTags = normalizeTags(input.pushPriorityTags);
    const aiScoreThreshold = normalizeScoreThreshold(input.aiScoreThreshold, 80);
    const aiRepeatIntervalMinutes = normalizePositiveInteger(
      input.aiRepeatIntervalMinutes,
      1440,
    );
    const aiDailyLimit = normalizeNonNegativeInteger(input.aiDailyLimit, 0);
    const pushScoreThreshold = normalizeScoreThreshold(input.pushScoreThreshold, 80);
    const pushMemoryScoreThreshold = normalizeScoreThreshold(
      input.pushMemoryScoreThreshold,
      pushScoreThreshold,
    );
    const pushBeautyScoreThreshold = normalizeScoreThreshold(
      input.pushBeautyScoreThreshold,
      70,
    );
    const sourceType = input.sourceType === 'feiniu_album' ? 'feiniu_album' : 'manual';

    this.getDatabase()
      .prepare(
        `
          INSERT INTO playback_albums (
            playback_album_id,
            title,
            description,
            source_type,
            source_album_id,
            source_album_title,
            ai_enabled,
            ai_score_threshold,
            ai_priority_tags,
            ai_repeat_interval_minutes,
            ai_daily_limit,
            push_enabled,
            push_score_threshold,
            push_memory_score_threshold,
            push_beauty_score_threshold,
            push_priority_tags,
            created_at,
            updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .run(
        playbackAlbumId,
        title,
        input.description?.trim() ?? '',
        sourceType,
        input.sourceAlbumId?.trim() ?? '',
        input.sourceAlbumTitle?.trim() ?? '',
        input.aiEnabled ? 1 : 0,
        aiScoreThreshold,
        JSON.stringify(aiPriorityTags),
        aiRepeatIntervalMinutes,
        aiDailyLimit,
        input.pushEnabled === false ? 0 : 1,
        pushScoreThreshold,
        pushMemoryScoreThreshold,
        pushBeautyScoreThreshold,
        JSON.stringify(pushPriorityTags),
        now,
        now,
      );

    return {
      authorizedDeviceIds: [],
      aiDailyLimit,
      aiDailyProcessedCount: 0,
      aiDailyProcessedOn: '',
      aiEnabled: input.aiEnabled === true,
      aiPriorityTags,
      aiRepeatIntervalMinutes,
      aiScoreThreshold,
      coverPhotoId: '',
      createdAt: now,
      description: input.description?.trim() ?? '',
      photoCount: 0,
      playbackAlbumId,
      pushEnabled: input.pushEnabled !== false,
      pushBeautyScoreThreshold,
      pushMemoryScoreThreshold,
      pushPriorityTags,
      pushScoreThreshold,
      sourceAlbumId: input.sourceAlbumId?.trim() ?? '',
      sourceAlbumTitle: input.sourceAlbumTitle?.trim() ?? '',
      sourceType,
      title,
      lastAiCheckedAt: '',
      updatedAt: now,
    };
  }

  updatePlaybackAlbumAiPolicy(
    playbackAlbumId: string,
    input: UpdatePlaybackAlbumAiPolicyInput,
  ): PlaybackAlbum {
    this.initialize();
    const database = this.getDatabase();
    const existing = database
      .prepare('SELECT playback_album_id FROM playback_albums WHERE playback_album_id = ?')
      .get(playbackAlbumId);
    if (!existing) throw new Error(`Playback album not found: ${playbackAlbumId}`);

    const now = new Date().toISOString();
    const currentAlbum = this.listPlaybackAlbums().find(
      (album) => album.playbackAlbumId === playbackAlbumId,
    );
    if (!currentAlbum) throw new Error(`Playback album not found: ${playbackAlbumId}`);

    database
      .prepare(
        `
          UPDATE playback_albums
          SET
            ai_enabled = ?,
            ai_score_threshold = ?,
            ai_priority_tags = ?,
            ai_repeat_interval_minutes = ?,
            ai_daily_limit = ?,
            push_enabled = ?,
            push_score_threshold = ?,
            push_memory_score_threshold = ?,
            push_beauty_score_threshold = ?,
            push_priority_tags = ?,
            updated_at = ?
          WHERE playback_album_id = ?
        `,
      )
      .run(
        typeof input.aiEnabled === 'boolean'
          ? input.aiEnabled ? 1 : 0
          : currentAlbum.aiEnabled ? 1 : 0,
        normalizeScoreThreshold(
          input.aiScoreThreshold,
          currentAlbum.aiScoreThreshold,
        ),
        JSON.stringify(
          Array.isArray(input.aiPriorityTags)
            ? normalizeTags(input.aiPriorityTags)
            : currentAlbum.aiPriorityTags,
        ),
        normalizePositiveInteger(
          input.aiRepeatIntervalMinutes,
          currentAlbum.aiRepeatIntervalMinutes,
        ),
        normalizeNonNegativeInteger(input.aiDailyLimit, currentAlbum.aiDailyLimit),
        typeof input.pushEnabled === 'boolean'
          ? input.pushEnabled ? 1 : 0
          : currentAlbum.pushEnabled ? 1 : 0,
        normalizeScoreThreshold(
          input.pushScoreThreshold,
          currentAlbum.pushScoreThreshold,
        ),
        normalizeScoreThreshold(
          input.pushMemoryScoreThreshold,
          currentAlbum.pushMemoryScoreThreshold,
        ),
        normalizeScoreThreshold(
          input.pushBeautyScoreThreshold,
          currentAlbum.pushBeautyScoreThreshold,
        ),
        JSON.stringify(
          Array.isArray(input.pushPriorityTags)
            ? normalizeTags(input.pushPriorityTags)
            : currentAlbum.pushPriorityTags,
        ),
        now,
        playbackAlbumId,
      );

    return this.listPlaybackAlbums().find(
      (album) => album.playbackAlbumId === playbackAlbumId,
    )!;
  }

  markPlaybackAlbumAiChecked(playbackAlbumId: string, checkedAt: string): void {
    this.initialize();
    this.getDatabase()
      .prepare(
        `
          UPDATE playback_albums
          SET
            last_ai_checked_at = ?,
            updated_at = ?
          WHERE playback_album_id = ?
        `,
      )
      .run(checkedAt, checkedAt, playbackAlbumId.trim());
  }

  markPlaybackAlbumAiProcessed(
    playbackAlbumId: string,
    processedOn: string,
    processedCount: number,
  ): void {
    this.initialize();
    const normalizedPlaybackAlbumId = playbackAlbumId.trim();
    const album = this.listPlaybackAlbums().find(
      (item) => item.playbackAlbumId === normalizedPlaybackAlbumId,
    );
    if (!album) throw new Error(`Playback album not found: ${playbackAlbumId}`);
    const nextCount = album.aiDailyProcessedOn === processedOn
      ? album.aiDailyProcessedCount + Math.max(processedCount, 0)
      : Math.max(processedCount, 0);
    this.getDatabase()
      .prepare(
        `
          UPDATE playback_albums
          SET
            ai_daily_processed_on = ?,
            ai_daily_processed_count = ?,
            updated_at = ?
          WHERE playback_album_id = ?
        `,
      )
      .run(processedOn, nextCount, new Date().toISOString(), normalizedPlaybackAlbumId);
  }

  updatePhotoAiComment(
    photoId: string,
    input: UpdatePhotoAiCommentInput,
  ): PhotoCenterItem {
    this.initialize();
    const normalizedPhotoId = photoId.trim();
    const aiComment = input.aiComment.trim();
    const database = this.getDatabase();
    const result = database
      .prepare(
        `
          UPDATE photos
          SET
            ai_comment = ?,
            ai_comment_status = 'completed',
            ai_locked = ?
          WHERE photo_id = ?
        `,
      )
      .run(
        aiComment,
        input.aiLocked === false ? 0 : 1,
        normalizedPhotoId,
      ) as unknown as { changes: number };
    if (!result.changes) throw new Error(`Photo not found: ${normalizedPhotoId}`);

    const item = this.listPhotoCenterItems({
      keyword: normalizedPhotoId,
      page: 1,
      pageSize: 1,
    }).items.find((candidate) => candidate.photoId === normalizedPhotoId);
    if (!item) throw new Error(`Photo not found: ${normalizedPhotoId}`);
    return item;
  }

  updatePhotoAiInsight(
    photoId: string,
    input: UpdatePhotoAiInsightInput,
  ): PhotoCenterItem {
    this.initialize();
    const normalizedPhotoId = photoId.trim();
    const current = this.getDatabase()
      .prepare('SELECT ai_comment, ai_tags, ai_memory_score, ai_beauty_score, ai_locked FROM photos WHERE photo_id = ?')
      .get(normalizedPhotoId) as {
        ai_beauty_score: number | null;
        ai_comment: string;
        ai_locked: number;
        ai_memory_score: number | null;
        ai_tags: string;
      } | undefined;
    if (!current) throw new Error(`Photo not found: ${normalizedPhotoId}`);

    const aiComment = input.aiComment === undefined
      ? current.ai_comment
      : input.aiComment.trim();
    const aiMemoryScore = input.aiMemoryScore === undefined
      ? current.ai_memory_score
      : normalizeNullableScore(input.aiMemoryScore);
    const aiBeautyScore = input.aiBeautyScore === undefined
      ? current.ai_beauty_score
      : normalizeNullableScore(input.aiBeautyScore);
    const aiTags = input.aiTags === undefined
      ? current.ai_tags
      : JSON.stringify(uniqueAiTags(input.aiTags));
    const aiScore = mergeAiScore(aiMemoryScore, aiBeautyScore);

    this.getDatabase()
      .prepare(
        `
          UPDATE photos
          SET
            ai_comment = ?,
            ai_comment_status = 'completed',
            ai_memory_score = ?,
            ai_beauty_score = ?,
            ai_score = ?,
            ai_score_status = 'completed',
            ai_tags = ?,
            ai_locked = ?
          WHERE photo_id = ?
        `,
      )
      .run(
        aiComment,
        aiMemoryScore,
        aiBeautyScore,
        aiScore,
        aiTags,
        input.aiLocked === false ? 0 : 1,
        normalizedPhotoId,
      );

    const item = this.listPhotoCenterItems({
      keyword: normalizedPhotoId,
      page: 1,
      pageSize: 1,
    }).items.find((candidate) => candidate.photoId === normalizedPhotoId);
    if (!item) throw new Error(`Photo not found: ${normalizedPhotoId}`);
    return item;
  }

  markPhotoAiPending(
    photoId: string,
    options: { clearAiComment?: boolean } = {},
  ): void {
    this.initialize();
    const clearAiComment = options.clearAiComment === true ? 1 : 0;
    this.getDatabase()
      .prepare(
        `
          UPDATE photos
          SET
            ai_score_status = 'pending',
            ai_score = CASE WHEN ? = 1 THEN NULL ELSE ai_score END,
            ai_memory_score = CASE WHEN ? = 1 THEN NULL ELSE ai_memory_score END,
            ai_beauty_score = CASE WHEN ? = 1 THEN NULL ELSE ai_beauty_score END,
            ai_is_trash = CASE WHEN ? = 1 THEN 0 ELSE ai_is_trash END,
            ai_tags = CASE WHEN ? = 1 THEN '' ELSE ai_tags END,
            ai_reason = CASE WHEN ? = 1 THEN '' ELSE ai_reason END,
            ai_comment = CASE WHEN ? = 1 THEN '' ELSE ai_comment END,
            ai_comment_status = CASE
              WHEN ? = 1 THEN 'pending'
              WHEN ai_locked = 1 AND TRIM(ai_comment) != '' THEN 'completed'
              ELSE 'pending'
            END,
            ai_detail = CASE WHEN ? = 1 THEN '' ELSE ai_detail END,
            ai_error = '',
            ai_recognized_at = CASE WHEN ? = 1 THEN '' ELSE ai_recognized_at END
          WHERE photo_id = ?
        `,
      )
      .run(
        clearAiComment,
        clearAiComment,
        clearAiComment,
        clearAiComment,
        clearAiComment,
        clearAiComment,
        clearAiComment,
        clearAiComment,
        clearAiComment,
        clearAiComment,
        photoId.trim(),
      );
  }

  markPhotoAiFailed(photoId: string, reason = ''): void {
    this.initialize();
    this.getDatabase()
      .prepare(
        `
          UPDATE photos
          SET
            ai_score_status = 'failed',
            ai_comment_status = CASE WHEN ai_locked = 1 AND TRIM(ai_comment) != '' THEN 'completed' ELSE 'failed' END,
            ai_reason = ?,
            ai_error = ?,
            ai_recognized_at = ?
          WHERE photo_id = ?
        `,
      )
      .run(reason.trim(), reason.trim(), new Date().toISOString(), photoId.trim());
  }

  updatePhotoMetadata(
    photoId: string,
    input: UpdatePhotoMetadataInput,
  ): PhotoCenterItem {
    this.initialize();
    const normalizedPhotoId = photoId.trim();
    const current = this.getDatabase()
      .prepare(
        `
          SELECT caption_title, import_album_title, source_album_kind, source_owner_name
          FROM photos
          WHERE photo_id = ? AND ai_is_trash != 1
        `,
      )
      .get(normalizedPhotoId) as {
        caption_title: string;
        import_album_title: string;
        source_album_kind: PhotoCenterSourceAlbumKind;
        source_owner_name: string;
      } | undefined;
    if (!current) throw new Error(`Photo not found: ${normalizedPhotoId}`);

    this.getDatabase()
      .prepare(
        `
          UPDATE photos
          SET
            caption_title = ?,
            import_album_title = ?,
            source_album_kind = ?,
            source_owner_name = ?
          WHERE photo_id = ?
        `,
      )
      .run(
        normalizeOptionalText(input.captionTitle, current.caption_title),
        normalizeOptionalText(input.importAlbumTitle, current.import_album_title),
        normalizeSourceAlbumKind(input.sourceAlbumKind, current.source_album_kind),
        normalizeOptionalText(input.sourceOwnerName, current.source_owner_name),
        normalizedPhotoId,
      );

    const item = this.listPhotoCenterItems({
      keyword: normalizedPhotoId,
      page: 1,
      pageSize: 1,
    }).items.find((candidate) => candidate.photoId === normalizedPhotoId);
    if (!item) throw new Error(`Photo not found: ${normalizedPhotoId}`);
    return item;
  }

  trashPhoto(photoId: string): TrashPhotoResult {
    this.initialize();
    const normalizedPhotoId = photoId.trim();
    const database = this.getDatabase();
    const result = database
      .prepare(
        `
          UPDATE photos
          SET ai_is_trash = 1
          WHERE photo_id = ? AND ai_is_trash != 1
        `,
      )
      .run(normalizedPhotoId) as unknown as { changes: number };
    const trashedPhotoCount = result.changes ?? 0;
    if (trashedPhotoCount > 0) {
      database
        .prepare('DELETE FROM playback_album_photos WHERE photo_id = ?')
        .run(normalizedPhotoId);
    }
    return { trashedPhotoCount };
  }

  listPlaybackAlbums(): PlaybackAlbum[] {
    this.initialize();
    const rows = this.getDatabase()
      .prepare(
        `
          SELECT
            a.playback_album_id,
            a.title,
            a.description,
            a.source_type,
            a.source_album_id,
            a.source_album_title,
            a.ai_enabled,
            a.ai_score_threshold,
            a.ai_priority_tags,
            a.ai_repeat_interval_minutes,
            a.ai_daily_limit,
            a.ai_daily_processed_on,
            a.ai_daily_processed_count,
            a.push_enabled,
            a.push_score_threshold,
            a.push_memory_score_threshold,
            a.push_beauty_score_threshold,
            a.push_priority_tags,
            a.last_ai_checked_at,
            a.created_at,
            a.updated_at,
            COALESCE((
              SELECT json_group_array(auth.device_id)
              FROM tv_device_album_authorizations auth
              WHERE auth.playback_album_id = a.playback_album_id
            ), '[]') AS authorized_device_ids,
            COALESCE(COUNT(ap_photo.photo_id), 0) AS photo_count,
            COALESCE((
              SELECT cover.photo_id
              FROM playback_album_photos cover
              JOIN photos cover_photo ON cover_photo.photo_id = cover.photo_id
              WHERE cover.playback_album_id = a.playback_album_id
                AND cover_photo.ai_is_trash != 1
              ORDER BY cover.position ASC
              LIMIT 1
            ), '') AS cover_photo_id
          FROM playback_albums a
          LEFT JOIN playback_album_photos ap ON ap.playback_album_id = a.playback_album_id
          LEFT JOIN photos ap_photo ON ap_photo.photo_id = ap.photo_id AND ap_photo.ai_is_trash != 1
          GROUP BY a.playback_album_id
          ORDER BY a.created_at DESC
        `,
      )
      .all() as unknown as PlaybackAlbumRow[];

    return rows.map(rowToPlaybackAlbum);
  }

  updatePlaybackAlbum(
    playbackAlbumId: string,
    input: UpdatePlaybackAlbumInput,
  ): PlaybackAlbum {
    this.initialize();
    const normalizedPlaybackAlbumId = playbackAlbumId.trim();
    const currentAlbum = this.listPlaybackAlbums().find(
      (album) => album.playbackAlbumId === normalizedPlaybackAlbumId,
    );
    if (!currentAlbum) throw new Error(`Playback album not found: ${playbackAlbumId}`);

    const now = new Date().toISOString();
    this.getDatabase()
      .prepare(
        `
          UPDATE playback_albums
          SET
            title = ?,
            description = ?,
            source_type = ?,
            source_album_id = ?,
            source_album_title = ?,
            ai_enabled = ?,
            ai_repeat_interval_minutes = ?,
            ai_daily_limit = ?,
            ai_priority_tags = ?,
            push_enabled = ?,
            push_score_threshold = ?,
            push_memory_score_threshold = ?,
            push_beauty_score_threshold = ?,
            push_priority_tags = ?,
            updated_at = ?
          WHERE playback_album_id = ?
        `,
      )
      .run(
        normalizeOptionalText(input.title, currentAlbum.title) || currentAlbum.title,
        normalizeOptionalText(input.description, currentAlbum.description),
        input.sourceType === 'feiniu_album' ? 'feiniu_album' : input.sourceType === 'manual' ? 'manual' : currentAlbum.sourceType,
        normalizeOptionalText(input.sourceAlbumId, currentAlbum.sourceAlbumId),
        normalizeOptionalText(input.sourceAlbumTitle, currentAlbum.sourceAlbumTitle),
        typeof input.aiEnabled === 'boolean' ? (input.aiEnabled ? 1 : 0) : (currentAlbum.aiEnabled ? 1 : 0),
        normalizePositiveInteger(
          input.aiRepeatIntervalMinutes,
          currentAlbum.aiRepeatIntervalMinutes,
        ),
        normalizeNonNegativeInteger(input.aiDailyLimit, currentAlbum.aiDailyLimit),
        JSON.stringify(normalizeTags(input.aiPriorityTags ?? currentAlbum.aiPriorityTags)),
        typeof input.pushEnabled === 'boolean' ? (input.pushEnabled ? 1 : 0) : (currentAlbum.pushEnabled ? 1 : 0),
        normalizeScoreThreshold(
          input.pushScoreThreshold,
          currentAlbum.pushScoreThreshold,
        ),
        normalizeScoreThreshold(
          input.pushMemoryScoreThreshold,
          currentAlbum.pushMemoryScoreThreshold,
        ),
        normalizeScoreThreshold(
          input.pushBeautyScoreThreshold,
          currentAlbum.pushBeautyScoreThreshold,
        ),
        JSON.stringify(normalizeTags(input.pushPriorityTags ?? currentAlbum.pushPriorityTags)),
        now,
        normalizedPlaybackAlbumId,
      );

    if (Array.isArray(input.authorizedDeviceIds)) {
      this.updatePlaybackAlbumDeviceAuthorizations(
        normalizedPlaybackAlbumId,
        input.authorizedDeviceIds,
      );
    }

    return this.listPlaybackAlbums().find(
      (album) => album.playbackAlbumId === normalizedPlaybackAlbumId,
    )!;
  }

  listPlaybackAlbumItems(playbackAlbumId: string): PhotoCenterItem[] {
    this.initialize();
    const database = this.getDatabase();
    const rows = database
      .prepare(
        `
          SELECT
            p.photo_id,
            p.filename,
            p.taken_at,
            p.location,
            p.caption_title,
            p.source_type,
            p.source_album_id,
            p.source_album_kind,
            p.source_owner_name,
            p.import_album_title,
            p.imported_at,
            p.synced_at,
            p.ai_score,
            p.ai_score_status,
            p.ai_comment_status,
            p.ai_comment,
            p.ai_tags,
            p.ai_locked,
            p.ai_memory_score,
            p.ai_beauty_score,
            p.ai_is_trash,
            p.ai_reason,
            p.ai_layout_position,
            p.ai_text_color,
            p.ai_font_style,
            p.ai_safe_area,
            p.ai_detail,
            p.ai_error,
            p.ai_recognized_at,
            a.album_id,
            a.title AS album_name,
            COALESCE(NULLIF(p.thumbnail_300_url, ''), NULLIF(p.thumbnail_url, ''), photo_url(p.photo_id, 'thumb')) AS thumbnail_url,
            COALESCE(NULLIF(p.thumbnail_300_url, ''), NULLIF(p.thumbnail_url, ''), photo_url(p.photo_id, 'thumb')) AS thumbnail_300_url,
            COALESCE(NULLIF(p.ai_720_url, ''), NULLIF(p.display_image_url, ''), photo_url(p.photo_id, 'display')) AS ai_720_url,
            COALESCE(NULLIF(p.tv_4k_webp_url, ''), NULLIF(p.display_image_url, ''), photo_url(p.photo_id, 'display')) AS tv_4k_webp_url,
            p.derivative_status,
            COALESCE(NULLIF(p.tv_4k_webp_url, ''), NULLIF(p.display_image_url, ''), photo_url(p.photo_id, 'display')) AS display_image_url,
            COALESCE(NULLIF(p.image_url, ''), photo_url(p.photo_id, 'original')) AS image_url
          FROM playback_album_photos pap
          JOIN photos p ON p.photo_id = pap.photo_id
          JOIN album_photos ap ON ap.photo_id = p.photo_id
          JOIN albums a ON a.album_id = ap.album_id
          WHERE pap.playback_album_id = ? AND p.ai_is_trash != 1
          GROUP BY p.photo_id
          ORDER BY pap.position ASC
        `,
      )
      .all(playbackAlbumId) as unknown as PhotoRow[];

    return rows.map(rowToPhotoCenterItem);
  }

  listPlaybackAlbumPlaylistItems(playbackAlbumId: string): PlaylistItem[] {
    this.initialize();
    const playbackAlbum = this.listPlaybackAlbums().find(
      (album) => album.playbackAlbumId === playbackAlbumId,
    );
    if (!playbackAlbum) return [];

    const rows = this.getDatabase()
      .prepare(
        `
          SELECT
            p.photo_id,
            p.filename,
            p.taken_at,
            p.location,
            p.dominant_color,
            p.caption_title,
            p.caption_text,
            p.caption_style,
            p.source_type,
            p.source_album_id,
            p.import_album_title,
            p.ai_score,
            p.ai_score_status,
            p.ai_comment_status,
            p.ai_comment,
            p.ai_tags,
            p.ai_locked,
            p.ai_memory_score,
            p.ai_beauty_score,
            p.ai_is_trash,
            p.ai_reason,
            p.ai_layout_position,
            p.ai_text_color,
            p.ai_font_style,
            p.ai_safe_area,
            p.ai_detail,
            p.ai_error,
            p.ai_recognized_at,
            a.album_id,
            a.title AS album_name,
            COALESCE(pap.position, ap.position) AS position,
            COALESCE(NULLIF(p.tv_4k_webp_url, ''), NULLIF(p.display_image_url, ''), photo_url(p.photo_id, 'display')) AS display_image_url,
            photo_url(p.photo_id, 'original') AS image_url,
            COALESCE(NULLIF(p.thumbnail_300_url, ''), NULLIF(p.thumbnail_url, ''), photo_url(p.photo_id, 'thumb')) AS thumbnail_url,
            COALESCE(NULLIF(p.thumbnail_300_url, ''), NULLIF(p.thumbnail_url, ''), photo_url(p.photo_id, 'thumb')) AS thumbnail_300_url,
            COALESCE(NULLIF(p.ai_720_url, ''), NULLIF(p.display_image_url, ''), photo_url(p.photo_id, 'display')) AS ai_720_url,
            COALESCE(NULLIF(p.tv_4k_webp_url, ''), NULLIF(p.display_image_url, ''), photo_url(p.photo_id, 'display')) AS tv_4k_webp_url,
            p.derivative_status
          FROM photos p
          JOIN album_photos ap ON ap.photo_id = p.photo_id
          JOIN albums a ON a.album_id = ap.album_id
          LEFT JOIN playback_album_photos pap
            ON pap.photo_id = p.photo_id
            AND pap.playback_album_id = $playbackAlbumId
          WHERE
            p.ai_is_trash != 1
            AND (
              pap.playback_album_id = $playbackAlbumId
              OR ($sourceAlbumId != '' AND a.album_id = $sourceAlbumId)
            )
          GROUP BY p.photo_id
          ORDER BY position ASC
        `,
      )
      .all({
        $playbackAlbumId: playbackAlbumId,
        $sourceAlbumId: playbackAlbum.sourceAlbumId,
      }) as unknown as PhotoRow[];

    if (!playbackAlbum.pushEnabled) return [];

    return rows
      .filter((row) =>
        normalizeAiStatus(row.ai_score_status) === 'completed' &&
        normalizeAiStatus(row.ai_comment_status) === 'completed' &&
        row.ai_is_trash !== 1 &&
        normalizeScoreThreshold(row.ai_memory_score ?? undefined, 0) >=
          playbackAlbum.pushMemoryScoreThreshold &&
        normalizeScoreThreshold(row.ai_beauty_score ?? undefined, 0) >=
          playbackAlbum.pushBeautyScoreThreshold
      )
      .map((row) => rowToPlaylistItem(row));
  }

  addPhotosToPlaybackAlbum(
    playbackAlbumId: string,
    photoIds: string[],
  ): AddPlaybackAlbumPhotosResult {
    this.initialize();
    const database = this.getDatabase();
    const uniquePhotoIds = [...new Set(photoIds.map((photoId) => photoId.trim()).filter(Boolean))];
    const existingAlbum = database
      .prepare('SELECT playback_album_id FROM playback_albums WHERE playback_album_id = ?')
      .get(playbackAlbumId);
    if (!existingAlbum) throw new Error(`Playback album not found: ${playbackAlbumId}`);

    const existingPosition = database
      .prepare(
        `
          SELECT COALESCE(MAX(position), -1) AS position
          FROM playback_album_photos
          WHERE playback_album_id = ?
        `,
      )
      .get(playbackAlbumId) as { position: number };
    const photoExists = database.prepare('SELECT photo_id FROM photos WHERE photo_id = ? AND ai_is_trash != 1');
    const alreadyMember = database.prepare(`
      SELECT photo_id
      FROM playback_album_photos
      WHERE playback_album_id = ? AND photo_id = ?
    `);
    const insertMember = database.prepare(`
      INSERT INTO playback_album_photos (
        playback_album_id,
        photo_id,
        position,
        added_at
      )
      VALUES (?, ?, ?, ?)
    `);
    const now = new Date().toISOString();
    let addedPhotoCount = 0;
    let nextPosition = existingPosition.position + 1;

    database.exec('BEGIN');
    try {
      for (const photoId of uniquePhotoIds) {
        const exists = Boolean(photoExists.get(photoId));
        const member = Boolean(alreadyMember.get(playbackAlbumId, photoId));
        if (!exists || member) continue;
        insertMember.run(playbackAlbumId, photoId, nextPosition, now);
        addedPhotoCount += 1;
        nextPosition += 1;
      }
      if (addedPhotoCount > 0) {
        database
          .prepare(
            `
              UPDATE playback_albums
              SET updated_at = ?
              WHERE playback_album_id = ?
            `,
          )
          .run(now, playbackAlbumId);
      }
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }

    const totalRow = database
      .prepare(
        `
          SELECT COUNT(*) AS count
          FROM playback_album_photos
          WHERE playback_album_id = ?
        `,
      )
      .get(playbackAlbumId) as { count: number };

    return {
      addedPhotoCount,
      requestedPhotoCount: photoIds.length,
      skippedPhotoCount: photoIds.length - addedPhotoCount,
      totalPhotoCount: totalRow.count,
    };
  }

  removePhotoFromPlaybackAlbum(
    playbackAlbumId: string,
    photoId: string,
  ): RemovePlaybackAlbumPhotoResult {
    this.initialize();
    const database = this.getDatabase();
    const existingAlbum = database
      .prepare('SELECT playback_album_id FROM playback_albums WHERE playback_album_id = ?')
      .get(playbackAlbumId);
    if (!existingAlbum) throw new Error(`Playback album not found: ${playbackAlbumId}`);

    const normalizedPhotoId = photoId.trim();
    const now = new Date().toISOString();
    const deleteResult = database
      .prepare(
        `
          DELETE FROM playback_album_photos
          WHERE playback_album_id = ? AND photo_id = ?
        `,
      )
      .run(playbackAlbumId, normalizedPhotoId) as unknown as { changes: number };
    const removedPhotoCount = deleteResult.changes ?? 0;

    if (removedPhotoCount > 0) {
      database
        .prepare(
          `
            UPDATE playback_albums
            SET updated_at = ?
            WHERE playback_album_id = ?
          `,
        )
        .run(now, playbackAlbumId);
    }

    const totalRow = database
      .prepare(
        `
          SELECT COUNT(*) AS count
          FROM playback_album_photos
          WHERE playback_album_id = ?
        `,
      )
      .get(playbackAlbumId) as { count: number };

    return {
      removedPhotoCount,
      totalPhotoCount: totalRow.count,
    };
  }

  deletePlaybackAlbum(playbackAlbumId: string): DeletePlaybackAlbumResult {
    this.initialize();
    const normalizedPlaybackAlbumId = playbackAlbumId.trim();
    const database = this.getDatabase();
    const existingAlbum = database
      .prepare('SELECT playback_album_id FROM playback_albums WHERE playback_album_id = ?')
      .get(normalizedPlaybackAlbumId);
    if (!existingAlbum) throw new Error(`Playback album not found: ${playbackAlbumId}`);

    database
      .prepare('DELETE FROM tv_device_album_authorizations WHERE playback_album_id = ?')
      .run(normalizedPlaybackAlbumId);
    const memberResult = database
      .prepare('DELETE FROM playback_album_photos WHERE playback_album_id = ?')
      .run(normalizedPlaybackAlbumId) as unknown as { changes: number };
    const albumResult = database
      .prepare('DELETE FROM playback_albums WHERE playback_album_id = ?')
      .run(normalizedPlaybackAlbumId) as unknown as { changes: number };

    return {
      deletedAlbumCount: albumResult.changes ?? 0,
      removedPhotoCount: memberResult.changes ?? 0,
    };
  }

  listTvDevices(): TvDevice[] {
    this.initialize();
    const rows = this.getDatabase()
      .prepare(
        `
          SELECT
            d.device_id,
            d.device_unique_id,
            d.device_name,
            d.group_name,
            d.device_token,
            d.platform,
            d.app_version,
            d.enabled,
            d.last_login_at,
            d.created_at,
            d.updated_at,
            COALESCE((
              SELECT json_group_array(auth.playback_album_id)
              FROM tv_device_album_authorizations auth
              WHERE auth.device_id = d.device_id
            ), '[]') AS authorized_playback_album_ids
          FROM tv_devices d
          ORDER BY d.last_login_at DESC, d.created_at DESC
        `,
      )
      .all() as unknown as TvDeviceRow[];

    return rows.map(rowToTvDevice);
  }

  getTvDeviceByToken(deviceToken: string): TvDevice | null {
    this.initialize();
    const token = deviceToken.trim();
    if (!token) return null;
    const row = this.getDatabase()
      .prepare(
        `
          SELECT
            d.device_id,
            d.device_unique_id,
            d.device_name,
            d.group_name,
            d.device_token,
            d.platform,
            d.app_version,
            d.enabled,
            d.last_login_at,
            d.created_at,
            d.updated_at,
            COALESCE((
              SELECT json_group_array(auth.playback_album_id)
              FROM tv_device_album_authorizations auth
              WHERE auth.device_id = d.device_id
            ), '[]') AS authorized_playback_album_ids
          FROM tv_devices d
          WHERE d.device_token = ?
          LIMIT 1
        `,
      )
      .get(token) as unknown as TvDeviceRow | undefined;

    return row ? rowToTvDevice(row) : null;
  }

  upsertTvDevice(input: UpsertTvDeviceInput): TvDevice {
    this.initialize();
    const now = new Date().toISOString();
    const deviceId = normalizeDeviceId(input.deviceId);
    const deviceUniqueId = input.deviceUniqueId.trim() || deviceId;
    const deviceName = input.deviceName?.trim() || 'Android TV';
    const platform = input.platform?.trim() || 'AndroidTV';
    const appVersion = input.appVersion?.trim() || '';
    const existing = this.getDatabase()
      .prepare('SELECT device_id FROM tv_devices WHERE device_unique_id = ? OR device_id = ? LIMIT 1')
      .get(deviceUniqueId, deviceId) as { device_id: string } | undefined;
    const resolvedDeviceId = existing?.device_id ?? deviceId;

    this.getDatabase()
      .prepare(
        `
          INSERT INTO tv_devices (
            device_id,
            device_unique_id,
            device_name,
            group_name,
            device_token,
            platform,
            app_version,
            enabled,
            last_login_at,
            created_at,
            updated_at
          )
          VALUES (?, ?, ?, '', ?, ?, ?, 1, ?, ?, ?)
          ON CONFLICT(device_id) DO UPDATE SET
            device_unique_id = excluded.device_unique_id,
            device_name = excluded.device_name,
            device_token = excluded.device_token,
            platform = excluded.platform,
            app_version = excluded.app_version,
            enabled = 1,
            last_login_at = excluded.last_login_at,
            updated_at = excluded.updated_at
        `,
      )
      .run(
        resolvedDeviceId,
        deviceUniqueId,
        deviceName,
        input.deviceToken,
        platform,
        appVersion,
        now,
        now,
        now,
      );

    this.ensureDefaultDeviceAuthorizations(resolvedDeviceId);
    return this.listTvDevices().find((device) => device.deviceId === resolvedDeviceId)!;
  }

  updateTvDevice(deviceId: string, input: UpdateTvDeviceInput): TvDevice {
    this.initialize();
    const normalizedDeviceId = normalizeDeviceId(deviceId);
    const current = this.listTvDevices().find(
      (device) => device.deviceId === normalizedDeviceId,
    );
    if (!current) throw new Error(`TV device not found: ${deviceId}`);

    const now = new Date().toISOString();
    this.getDatabase()
      .prepare(
        `
          UPDATE tv_devices
          SET
            device_name = ?,
            group_name = ?,
            enabled = ?,
            updated_at = ?
          WHERE device_id = ?
        `,
      )
      .run(
        normalizeOptionalText(input.deviceName, current.deviceName) || current.deviceName,
        normalizeOptionalText(input.groupName, current.groupName),
        typeof input.enabled === 'boolean' ? (input.enabled ? 1 : 0) : (current.enabled ? 1 : 0),
        now,
        normalizedDeviceId,
      );

    if (Array.isArray(input.authorizedPlaybackAlbumIds)) {
      this.updateDeviceAlbumAuthorizations(
        normalizedDeviceId,
        input.authorizedPlaybackAlbumIds,
      );
    }

    return this.listTvDevices().find((device) => device.deviceId === normalizedDeviceId)!;
  }

  updatePlaybackAlbumDeviceAuthorizations(
    playbackAlbumId: string,
    deviceIds: string[],
  ): void {
    this.initialize();
    const normalizedPlaybackAlbumId = playbackAlbumId.trim();
    const database = this.getDatabase();
    database
      .prepare('DELETE FROM tv_device_album_authorizations WHERE playback_album_id = ?')
      .run(normalizedPlaybackAlbumId);
    const insert = database.prepare(`
      INSERT OR IGNORE INTO tv_device_album_authorizations (
        device_id,
        playback_album_id,
        created_at
      )
      VALUES (?, ?, ?)
    `);
    const now = new Date().toISOString();
    for (const deviceId of normalizeDeviceIds(deviceIds)) {
      insert.run(deviceId, normalizedPlaybackAlbumId, now);
    }
  }

  updateDeviceAlbumAuthorizations(
    deviceId: string,
    playbackAlbumIds: string[],
  ): void {
    this.initialize();
    const normalizedDeviceId = normalizeDeviceId(deviceId);
    const database = this.getDatabase();
    database
      .prepare('DELETE FROM tv_device_album_authorizations WHERE device_id = ?')
      .run(normalizedDeviceId);
    const insert = database.prepare(`
      INSERT OR IGNORE INTO tv_device_album_authorizations (
        device_id,
        playback_album_id,
        created_at
      )
      VALUES (?, ?, ?)
    `);
    const now = new Date().toISOString();
    for (const playbackAlbumId of normalizePlaybackAlbumIds(playbackAlbumIds)) {
      insert.run(normalizedDeviceId, playbackAlbumId, now);
    }
  }

  private ensureDefaultDeviceAuthorizations(deviceId: string): void {
    const existing = this.getDatabase()
      .prepare(
        `
          SELECT COUNT(*) AS count
          FROM tv_device_album_authorizations
          WHERE device_id = ?
        `,
      )
      .get(deviceId) as { count: number };
    if (existing.count > 0) return;
    this.updateDeviceAlbumAuthorizations(
      deviceId,
      this.listPlaybackAlbums().map((album) => album.playbackAlbumId),
    );
  }

  applyPhotoAiInsights(
    insights: PhotoAiInsightInput[],
    options: { forceOverwriteLockedComment?: boolean } = {},
  ): ApplyPhotoAiInsightsResult {
    this.initialize();
    const database = this.getDatabase();
    const uniqueInsights = new Map(
      insights
        .filter((insight) => insight.photoId.trim())
        .map((insight) => [insight.photoId.trim(), insight]),
    );
    const forceOverwriteLockedComment = options.forceOverwriteLockedComment === true;
    const updatePhoto = database.prepare(
      `
        UPDATE photos
        SET
          ai_score = ?,
          ai_score_status = 'completed',
          ai_comment = ${
            forceOverwriteLockedComment
              ? '?'
              : "CASE WHEN ai_locked = 1 AND TRIM(ai_comment) != '' THEN ai_comment ELSE ? END"
          },
          ai_comment_status = CASE
            WHEN ai_locked = 1 AND TRIM(ai_comment) != '' AND ? = 0 THEN 'completed'
            WHEN TRIM(?) != '' THEN 'completed'
            ELSE 'pending'
          END,
          ai_tags = ?,
          ai_memory_score = ?,
          ai_beauty_score = ?,
          ai_is_trash = ?,
          ai_reason = ?,
          ai_layout_position = ?,
          ai_text_color = ?,
          ai_font_style = ?,
          ai_safe_area = ?,
          ai_detail = ?,
          ai_error = ?,
          ai_recognized_at = ?,
          ai_locked = CASE WHEN ? = 1 THEN 0 ELSE ai_locked END
        WHERE photo_id = ?
      `,
    );
    let generatedPhotoCount = 0;

    database.exec('BEGIN');
    try {
      for (const [photoId, insight] of uniqueInsights.entries()) {
        const result = updatePhoto.run(
          normalizeScoreThreshold(insight.aiScore, 80),
          insight.aiComment.trim(),
          forceOverwriteLockedComment ? 1 : 0,
          insight.aiComment.trim(),
          JSON.stringify(normalizeTags(insight.aiTags)),
          normalizeOptionalScore(insight.aiMemoryScore),
          normalizeOptionalScore(insight.aiBeautyScore),
          insight.aiIsTrash === true ? 1 : 0,
          insight.aiReason?.trim() ?? '',
          normalizeAiLayoutPosition(insight.aiLayoutPosition),
          normalizeAiTextColor(insight.aiTextColor),
          normalizeAiFontStyle(insight.aiFontStyle),
          JSON.stringify(normalizeSafeArea(insight.aiSafeArea)),
          insight.aiDetail?.trim() ?? '',
          insight.aiError?.trim() ?? '',
          insight.aiRecognizedAt?.trim() || new Date().toISOString(),
          forceOverwriteLockedComment ? 1 : 0,
          photoId,
        ) as unknown as { changes: number };
        generatedPhotoCount += result.changes ?? 0;
      }
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }

    return {
      generatedPhotoCount,
      requestedPhotoCount: insights.length,
      skippedPhotoCount: insights.length - generatedPhotoCount,
    };
  }

  private getAiSettingsRow(): AiSettingsRow {
    const database = this.getDatabase();
    const existing = database
      .prepare(
        `
          SELECT
            provider,
            model,
            base_url,
            api_key,
            ai_check_interval_minutes,
            daily_ai_limit,
            scoring_prompt,
            comment_prompt,
            classification_prompt,
            layout_prompt,
            output_contract_prompt,
            updated_at
          FROM ai_settings
          WHERE id = 1
        `,
      )
      .get() as unknown as AiSettingsRow | undefined;
    if (existing) return existing;

    const now = new Date().toISOString();
    database
      .prepare(
        `
          INSERT INTO ai_settings (
            id,
            provider,
            model,
            base_url,
            api_key,
            ai_check_interval_minutes,
            daily_ai_limit,
            scoring_prompt,
            comment_prompt,
            classification_prompt,
            layout_prompt,
            output_contract_prompt,
            updated_at
          )
          VALUES (1, ?, ?, ?, '', ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .run(
        defaultAiSettings.provider,
        defaultAiSettings.model,
        defaultAiSettings.baseUrl,
        defaultAiSettings.aiCheckIntervalMinutes,
        defaultAiSettings.dailyAiLimit,
        defaultAiSettings.scoringPrompt,
        defaultAiSettings.commentPrompt,
        defaultAiSettings.classificationPrompt,
        defaultAiSettings.layoutPrompt,
        defaultAiSettings.outputContractPrompt,
        now,
      );
    return {
      api_key: '',
      ai_check_interval_minutes: defaultAiSettings.aiCheckIntervalMinutes,
      daily_ai_limit: defaultAiSettings.dailyAiLimit,
      base_url: defaultAiSettings.baseUrl,
      classification_prompt: defaultAiSettings.classificationPrompt,
      comment_prompt: defaultAiSettings.commentPrompt,
      layout_prompt: defaultAiSettings.layoutPrompt,
      model: defaultAiSettings.model,
      output_contract_prompt: defaultAiSettings.outputContractPrompt,
      provider: defaultAiSettings.provider,
      scoring_prompt: defaultAiSettings.scoringPrompt,
      updated_at: now,
    };
  }

  private getDatabase(): DatabaseSync {
    this.database ??= new DatabaseSync(this.databasePath);
    this.database.function('photo_url', (_photoId: unknown, _variant: unknown) =>
      photoUrl(String(_photoId), String(_variant) as 'display' | 'original' | 'thumb'),
    );
    return this.database;
  }

  private applyMigrations(): void {
    const database = this.getDatabase();
    database.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const row = database
      .prepare('SELECT COALESCE(MAX(version), 0) AS version FROM schema_migrations')
      .get() as unknown as MigrationRow;

    if (row.version >= currentSchemaVersion) return;

    database.exec('BEGIN');
    try {
      if (row.version < 1) {
        database.exec(`
          CREATE TABLE IF NOT EXISTS albums (
            album_id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            sort_order INTEGER NOT NULL
          );

          CREATE TABLE IF NOT EXISTS photos (
            photo_id TEXT PRIMARY KEY,
            filename TEXT NOT NULL,
            taken_at TEXT NOT NULL,
            location TEXT NOT NULL,
            dominant_color TEXT NOT NULL,
            caption_title TEXT NOT NULL,
            caption_text TEXT NOT NULL,
            caption_style TEXT NOT NULL
          );

          CREATE TABLE IF NOT EXISTS album_photos (
            album_id TEXT NOT NULL,
            photo_id TEXT NOT NULL,
            position INTEGER NOT NULL,
            PRIMARY KEY (album_id, photo_id),
            FOREIGN KEY (album_id) REFERENCES albums(album_id),
            FOREIGN KEY (photo_id) REFERENCES photos(photo_id)
          );
        `);
        database
          .prepare('INSERT INTO schema_migrations (version, name) VALUES (?, ?)')
          .run(1, 'initial_photo_library');
      }
      if (row.version < 2) {
        addColumnIfMissing(database, 'photos', 'source_type', "TEXT NOT NULL DEFAULT 'local'");
        addColumnIfMissing(database, 'photos', 'source_album_id', "TEXT NOT NULL DEFAULT ''");
        addColumnIfMissing(database, 'photos', 'import_album_title', "TEXT NOT NULL DEFAULT ''");
        addColumnIfMissing(database, 'photos', 'ai_score', 'INTEGER');
        addColumnIfMissing(database, 'photos', 'ai_score_status', "TEXT NOT NULL DEFAULT 'pending'");
        addColumnIfMissing(database, 'photos', 'ai_comment_status', "TEXT NOT NULL DEFAULT 'pending'");
        addColumnIfMissing(database, 'photos', 'ai_comment', "TEXT NOT NULL DEFAULT ''");
        addColumnIfMissing(database, 'photos', 'ai_tags', "TEXT NOT NULL DEFAULT '[]'");
        addColumnIfMissing(database, 'photos', 'ai_locked', 'INTEGER NOT NULL DEFAULT 0');
        database.exec(`
          UPDATE photos
          SET
            source_album_id = COALESCE(NULLIF(source_album_id, ''), (
              SELECT album_id FROM album_photos WHERE album_photos.photo_id = photos.photo_id LIMIT 1
            )),
            import_album_title = COALESCE(NULLIF(import_album_title, ''), (
              SELECT title
              FROM albums
              JOIN album_photos ON album_photos.album_id = albums.album_id
              WHERE album_photos.photo_id = photos.photo_id
              LIMIT 1
            ));
        `);
        database
          .prepare('INSERT INTO schema_migrations (version, name) VALUES (?, ?)')
          .run(2, 'photo_center_metadata');
      }
      if (row.version < 3) {
        addColumnIfMissing(database, 'photos', 'source_album_kind', "TEXT NOT NULL DEFAULT ''");
        addColumnIfMissing(database, 'photos', 'source_owner_name', "TEXT NOT NULL DEFAULT ''");
        addColumnIfMissing(database, 'photos', 'imported_at', "TEXT NOT NULL DEFAULT ''");
        addColumnIfMissing(database, 'photos', 'synced_at', "TEXT NOT NULL DEFAULT ''");
        addColumnIfMissing(database, 'photos', 'display_image_url', "TEXT NOT NULL DEFAULT ''");
        addColumnIfMissing(database, 'photos', 'image_url', "TEXT NOT NULL DEFAULT ''");
        addColumnIfMissing(database, 'photos', 'thumbnail_url', "TEXT NOT NULL DEFAULT ''");
        database
          .prepare('INSERT INTO schema_migrations (version, name) VALUES (?, ?)')
          .run(3, 'photo_center_external_index');
      }
      if (row.version < 4) {
        database.exec(`
          CREATE TABLE IF NOT EXISTS playback_albums (
            playback_album_id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
          );

          CREATE TABLE IF NOT EXISTS playback_album_photos (
            playback_album_id TEXT NOT NULL,
            photo_id TEXT NOT NULL,
            position INTEGER NOT NULL,
            added_at TEXT NOT NULL,
            PRIMARY KEY (playback_album_id, photo_id),
            FOREIGN KEY (playback_album_id) REFERENCES playback_albums(playback_album_id),
            FOREIGN KEY (photo_id) REFERENCES photos(photo_id)
          );
        `);
        database
          .prepare('INSERT INTO schema_migrations (version, name) VALUES (?, ?)')
          .run(4, 'playback_album_curation');
      }
      if (row.version < 5) {
        addColumnIfMissing(database, 'playback_albums', 'source_type', "TEXT NOT NULL DEFAULT 'manual'");
        addColumnIfMissing(database, 'playback_albums', 'source_album_id', "TEXT NOT NULL DEFAULT ''");
        addColumnIfMissing(database, 'playback_albums', 'source_album_title', "TEXT NOT NULL DEFAULT ''");
        addColumnIfMissing(database, 'playback_albums', 'ai_enabled', 'INTEGER NOT NULL DEFAULT 0');
        addColumnIfMissing(database, 'playback_albums', 'ai_score_threshold', 'INTEGER NOT NULL DEFAULT 80');
        addColumnIfMissing(database, 'playback_albums', 'ai_priority_tags', "TEXT NOT NULL DEFAULT '[]'");
        addColumnIfMissing(database, 'playback_albums', 'push_enabled', 'INTEGER NOT NULL DEFAULT 1');
        addColumnIfMissing(database, 'playback_albums', 'push_score_threshold', 'INTEGER NOT NULL DEFAULT 80');
        addColumnIfMissing(database, 'playback_albums', 'push_priority_tags', "TEXT NOT NULL DEFAULT '[]'");
        database
          .prepare('INSERT INTO schema_migrations (version, name) VALUES (?, ?)')
          .run(5, 'playback_album_ai_push_policy');
      }
      if (row.version < 6) {
        database.exec(`
          CREATE TABLE IF NOT EXISTS ai_settings (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            provider TEXT NOT NULL,
            model TEXT NOT NULL,
            base_url TEXT NOT NULL,
            api_key TEXT NOT NULL,
            ai_check_interval_minutes INTEGER NOT NULL DEFAULT 60,
            scoring_prompt TEXT NOT NULL,
            comment_prompt TEXT NOT NULL,
            classification_prompt TEXT NOT NULL,
            layout_prompt TEXT NOT NULL DEFAULT '',
            output_contract_prompt TEXT NOT NULL DEFAULT '',
            updated_at TEXT NOT NULL
          );
        `);
        database
          .prepare(
            `
              INSERT OR IGNORE INTO ai_settings (
                id,
                provider,
                model,
                base_url,
                api_key,
                ai_check_interval_minutes,
                scoring_prompt,
                comment_prompt,
                classification_prompt,
                layout_prompt,
                output_contract_prompt,
                updated_at
              )
              VALUES (1, ?, ?, ?, '', ?, ?, ?, ?, ?, ?, ?)
            `,
          )
          .run(
            defaultAiSettings.provider,
            defaultAiSettings.model,
            defaultAiSettings.baseUrl,
            defaultAiSettings.aiCheckIntervalMinutes,
            defaultAiSettings.scoringPrompt,
            defaultAiSettings.commentPrompt,
            defaultAiSettings.classificationPrompt,
            defaultAiSettings.layoutPrompt,
            defaultAiSettings.outputContractPrompt,
            new Date().toISOString(),
          );
        database
          .prepare('INSERT INTO schema_migrations (version, name) VALUES (?, ?)')
          .run(6, 'ai_settings_center');
      }
      if (row.version < 7) {
        addColumnIfMissing(database, 'photos', 'thumbnail_300_url', "TEXT NOT NULL DEFAULT ''");
        addColumnIfMissing(database, 'photos', 'ai_720_url', "TEXT NOT NULL DEFAULT ''");
        addColumnIfMissing(database, 'photos', 'tv_4k_webp_url', "TEXT NOT NULL DEFAULT ''");
        addColumnIfMissing(database, 'photos', 'derivative_status', "TEXT NOT NULL DEFAULT 'pending'");
        addColumnIfMissing(database, 'photos', 'ai_memory_score', 'INTEGER');
        addColumnIfMissing(database, 'photos', 'ai_beauty_score', 'INTEGER');
        addColumnIfMissing(database, 'photos', 'ai_is_trash', 'INTEGER NOT NULL DEFAULT 0');
        addColumnIfMissing(database, 'photos', 'ai_reason', "TEXT NOT NULL DEFAULT ''");
        addColumnIfMissing(database, 'photos', 'ai_layout_position', "TEXT NOT NULL DEFAULT ''");
        addColumnIfMissing(database, 'photos', 'ai_text_color', "TEXT NOT NULL DEFAULT ''");
        addColumnIfMissing(database, 'photos', 'ai_font_style', "TEXT NOT NULL DEFAULT ''");
        addColumnIfMissing(database, 'photos', 'ai_safe_area', "TEXT NOT NULL DEFAULT '{}'");
        addColumnIfMissing(database, 'photos', 'ai_detail', "TEXT NOT NULL DEFAULT ''");
        addColumnIfMissing(database, 'photos', 'ai_error', "TEXT NOT NULL DEFAULT ''");
        addColumnIfMissing(database, 'photos', 'ai_recognized_at', "TEXT NOT NULL DEFAULT ''");
        database
          .prepare('INSERT INTO schema_migrations (version, name) VALUES (?, ?)')
          .run(7, 'photo_derivatives_and_unified_ai');
      }
      if (row.version < 8) {
        addColumnIfMissing(
          database,
          'playback_albums',
          'ai_repeat_interval_minutes',
          'INTEGER NOT NULL DEFAULT 1440',
        );
        addColumnIfMissing(
          database,
          'playback_albums',
          'last_ai_checked_at',
          "TEXT NOT NULL DEFAULT ''",
        );
        addColumnIfMissing(
          database,
          'ai_settings',
          'ai_check_interval_minutes',
          'INTEGER NOT NULL DEFAULT 60',
        );
        database
          .prepare('INSERT INTO schema_migrations (version, name) VALUES (?, ?)')
          .run(8, 'ai_policy_schedule_controls');
      }
      if (row.version < 9) {
        addColumnIfMissing(
          database,
          'playback_albums',
          'push_memory_score_threshold',
          'INTEGER NOT NULL DEFAULT 80',
        );
        addColumnIfMissing(
          database,
          'playback_albums',
          'push_beauty_score_threshold',
          'INTEGER NOT NULL DEFAULT 70',
        );
        addColumnIfMissing(
          database,
          'ai_settings',
          'layout_prompt',
          "TEXT NOT NULL DEFAULT ''",
        );
        database
          .prepare('UPDATE ai_settings SET layout_prompt = ? WHERE id = 1 AND layout_prompt = ?')
          .run(defaultAiSettings.layoutPrompt, '');
        database
          .prepare('INSERT INTO schema_migrations (version, name) VALUES (?, ?)')
          .run(9, 'ai_layout_prompt_and_push_thresholds');
      }
      if (row.version < 10) {
        addColumnIfMissing(
          database,
          'ai_settings',
          'daily_ai_limit',
          'INTEGER NOT NULL DEFAULT 100',
        );
        addColumnIfMissing(
          database,
          'playback_albums',
          'ai_daily_limit',
          'INTEGER NOT NULL DEFAULT 0',
        );
        addColumnIfMissing(
          database,
          'playback_albums',
          'ai_daily_processed_on',
          "TEXT NOT NULL DEFAULT ''",
        );
        addColumnIfMissing(
          database,
          'playback_albums',
          'ai_daily_processed_count',
          'INTEGER NOT NULL DEFAULT 0',
        );
        database
          .prepare('INSERT INTO schema_migrations (version, name) VALUES (?, ?)')
          .run(10, 'ai_daily_limit_controls');
      }
      if (row.version < 11) {
        database.exec(`
          CREATE TABLE IF NOT EXISTS tv_devices (
            device_id TEXT PRIMARY KEY,
            device_unique_id TEXT NOT NULL UNIQUE,
            device_name TEXT NOT NULL,
            group_name TEXT NOT NULL DEFAULT '',
            device_token TEXT NOT NULL,
            platform TEXT NOT NULL DEFAULT 'AndroidTV',
            app_version TEXT NOT NULL DEFAULT '',
            enabled INTEGER NOT NULL DEFAULT 1,
            last_login_at TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
          );

          CREATE TABLE IF NOT EXISTS tv_device_album_authorizations (
            device_id TEXT NOT NULL,
            playback_album_id TEXT NOT NULL,
            created_at TEXT NOT NULL,
            PRIMARY KEY (device_id, playback_album_id),
            FOREIGN KEY (device_id) REFERENCES tv_devices(device_id),
            FOREIGN KEY (playback_album_id) REFERENCES playback_albums(playback_album_id)
          );
        `);
        database
          .prepare('INSERT INTO schema_migrations (version, name) VALUES (?, ?)')
          .run(11, 'tv_device_authorizations');
      }
      if (row.version < 12) {
        addColumnIfMissing(database, 'photos', 'ai_detail', "TEXT NOT NULL DEFAULT ''");
        addColumnIfMissing(database, 'photos', 'ai_error', "TEXT NOT NULL DEFAULT ''");
        addColumnIfMissing(database, 'photos', 'ai_recognized_at', "TEXT NOT NULL DEFAULT ''");
        database
          .prepare('INSERT INTO schema_migrations (version, name) VALUES (?, ?)')
          .run(12, 'photo_ai_recognition_details');
      }
      if (row.version < 13) {
        database.exec(`
          CREATE TABLE IF NOT EXISTS ai_recognition_tasks (
            job_id TEXT PRIMARY KEY,
            target_type TEXT NOT NULL,
            target_id TEXT NOT NULL,
            target_title TEXT NOT NULL DEFAULT '',
            album_id TEXT NOT NULL DEFAULT '',
            album_title TEXT NOT NULL DEFAULT '',
            status TEXT NOT NULL,
            requested_photo_count INTEGER NOT NULL DEFAULT 0,
            completed_photo_count INTEGER NOT NULL DEFAULT 0,
            skipped_photo_count INTEGER NOT NULL DEFAULT 0,
            failed_photo_count INTEGER NOT NULL DEFAULT 0,
            active_photo_id TEXT NOT NULL DEFAULT '',
            active_photo_name TEXT NOT NULL DEFAULT '',
            error TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL,
            last_updated_at TEXT NOT NULL,
            finished_at TEXT NOT NULL DEFAULT ''
          );

          CREATE INDEX IF NOT EXISTS idx_ai_recognition_tasks_created_at
            ON ai_recognition_tasks(created_at DESC);

          CREATE INDEX IF NOT EXISTS idx_ai_recognition_tasks_status
            ON ai_recognition_tasks(status);

          CREATE INDEX IF NOT EXISTS idx_ai_recognition_tasks_target
            ON ai_recognition_tasks(target_type, target_id);
        `);
        database
          .prepare('INSERT INTO schema_migrations (version, name) VALUES (?, ?)')
          .run(13, 'ai_recognition_tasks');
      }
      if (row.version < 14) {
        addColumnIfMissing(
          database,
          'ai_settings',
          'output_contract_prompt',
          "TEXT NOT NULL DEFAULT ''",
        );
        database
          .prepare('INSERT INTO schema_migrations (version, name) VALUES (?, ?)')
          .run(14, 'ai_output_contract_prompt');
      }
      if (row.version < 15) {
        addColumnIfMissing(
          database,
          'ai_settings',
          'output_contract_prompt',
          "TEXT NOT NULL DEFAULT ''",
        );
        database
          .prepare(
            `
              UPDATE ai_settings
              SET output_contract_prompt = ?
              WHERE id = 1 AND TRIM(output_contract_prompt) = ''
            `,
          )
          .run(defaultAiSettings.outputContractPrompt);
        database
          .prepare('INSERT INTO schema_migrations (version, name) VALUES (?, ?)')
          .run(15, 'default_ai_output_contract_prompt');
      }
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
  }

  private cleanupMissingSeedPhotos(): number {
    const database = this.getDatabase();
    const rows = database
      .prepare(
        `
          SELECT photo_id, filename
          FROM photos
          WHERE source_type = 'local'
            AND photo_id GLOB 'p_[0-9][0-9][0-9]'
        `,
      )
      .all() as unknown as Array<{ filename: string; photo_id: string }>;
    const missingRows = rows.filter(
      (row) =>
        realPhotoFiles.includes(row.filename) &&
        !existsSync(join(this.photoRoot, row.filename)),
    );
    if (missingRows.length === 0) return 0;

    database.exec('BEGIN');
    try {
      const deletePlaybackAlbumPhoto = database.prepare(
        'DELETE FROM playback_album_photos WHERE photo_id = ?',
      );
      const deleteAlbumPhoto = database.prepare(
        'DELETE FROM album_photos WHERE photo_id = ?',
      );
      const deletePhoto = database.prepare(
        'DELETE FROM photos WHERE photo_id = ?',
      );
      for (const row of missingRows) {
        deletePlaybackAlbumPhoto.run(row.photo_id);
        deleteAlbumPhoto.run(row.photo_id);
        deletePhoto.run(row.photo_id);
      }
      const deleteEmptySeedAlbum = database.prepare(
        `
          DELETE FROM albums
          WHERE album_id = ?
            AND NOT EXISTS (
              SELECT 1 FROM album_photos WHERE album_photos.album_id = albums.album_id
            )
        `,
      );
      for (const album of sampleAlbumDefinitions) {
        deleteEmptySeedAlbum.run(album.albumId);
      }
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }

    return missingRows.length;
  }

  private hasSeedPhotoFiles(): boolean {
    return realPhotoFiles.every((filename) =>
      existsSync(join(this.photoRoot, filename)),
    );
  }

  private getPhotoRow(photoId: string): PhotoRow | null {
    this.initialize();
    return (
      this.getDatabase()
        .prepare(`
          SELECT
            p.photo_id,
            p.filename,
            p.taken_at,
            p.location,
            p.dominant_color,
            p.caption_title,
            p.caption_text,
            p.caption_style,
            p.source_type,
            p.source_album_id,
            p.source_album_kind,
            p.source_owner_name,
            p.import_album_title,
            p.imported_at,
            p.synced_at,
            p.ai_score,
            p.ai_score_status,
            p.ai_comment_status,
            p.ai_comment,
            p.ai_tags,
            p.ai_locked,
            p.ai_memory_score,
            p.ai_beauty_score,
            p.ai_is_trash,
            p.ai_reason,
            p.ai_layout_position,
            p.ai_text_color,
            p.ai_font_style,
            p.ai_safe_area,
            p.ai_detail,
            p.ai_error,
            p.ai_recognized_at,
            a.album_id,
            a.title AS album_name,
            ap.position,
            COALESCE(NULLIF(p.tv_4k_webp_url, ''), NULLIF(p.display_image_url, ''), photo_url(p.photo_id, 'display')) AS display_image_url,
            COALESCE(NULLIF(p.image_url, ''), photo_url(p.photo_id, 'original')) AS image_url,
            COALESCE(NULLIF(p.thumbnail_300_url, ''), NULLIF(p.thumbnail_url, ''), photo_url(p.photo_id, 'thumb')) AS thumbnail_url,
            COALESCE(NULLIF(p.thumbnail_300_url, ''), NULLIF(p.thumbnail_url, ''), photo_url(p.photo_id, 'thumb')) AS thumbnail_300_url,
            COALESCE(NULLIF(p.ai_720_url, ''), NULLIF(p.display_image_url, ''), photo_url(p.photo_id, 'display')) AS ai_720_url,
            COALESCE(NULLIF(p.tv_4k_webp_url, ''), NULLIF(p.display_image_url, ''), photo_url(p.photo_id, 'display')) AS tv_4k_webp_url,
            p.derivative_status
          FROM photos p
          JOIN album_photos ap ON ap.photo_id = p.photo_id
          JOIN albums a ON a.album_id = ap.album_id
          WHERE p.photo_id = ? AND p.source_type = 'local'
          LIMIT 1
        `)
        .get(photoId) as PhotoRow | undefined
    ) ?? null;
  }

  private seedCeshiPhotos(): void {
    const database = this.getDatabase();
    database.exec('BEGIN');
    try {
      const insertAlbum = database.prepare(`
        INSERT INTO albums (album_id, title, description, sort_order)
        VALUES (?, ?, ?, ?)
      `);
      const insertPhoto = database.prepare(`
        INSERT INTO photos (
          photo_id,
          filename,
          taken_at,
          location,
          dominant_color,
          caption_title,
          caption_text,
          caption_style,
          source_type,
          source_album_id,
          import_album_title
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const insertAlbumPhoto = database.prepare(`
        INSERT INTO album_photos (album_id, photo_id, position)
        VALUES (?, ?, ?)
      `);

      sampleAlbumDefinitions.forEach((album, index) => {
        insertAlbum.run(album.albumId, album.albumName, album.description, index);
      });

      realPhotoFiles.forEach((filename, index) => {
        const album = sampleAlbumDefinitions[Math.floor(index / 3)]!;
        const photoNumber = index + 1;
        const photoId = `p_${photoNumber.toString().padStart(3, '0')}`;
        insertPhoto.run(
          photoId,
          filename,
          `2022-11-${(index + 2).toString().padStart(2, '0')}`,
          album.location,
          album.dominantColor,
          `${album.title} ${photoNumber}`,
          album.text,
          index < 3 ? 'warm_memory' : index < 6 ? 'family_diary' : 'minimal',
          'local',
          album.albumId,
          album.albumName,
        );
        insertAlbumPhoto.run(album.albumId, photoId, index % 3);
      });
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
  }
}

function rowToPlaylistItem(row: PhotoRow): PlaylistItem {
  const animationTemplateId = 'cinematic_soft';
  const captionStyle = normalizeCaptionStyle(row.caption_style);
  const layoutTemplateId = 'bottom_gradient';
  const aiComment = row.ai_comment.trim();
  const aiDetailProjection = extractAiDetailProjection(row.ai_detail);

  return {
    ai: {
      beautyScore: row.ai_beauty_score,
      comment: aiComment,
      commentStatus: normalizeAiStatus(row.ai_comment_status),
      isTrash: row.ai_is_trash === 1,
      locked: row.ai_locked === 1,
      memoryScore: row.ai_memory_score,
      reason: row.ai_reason,
      score: row.ai_score,
      scoreStatus: normalizeAiStatus(row.ai_score_status),
      tags: parseAiTags(row.ai_tags),
    },
    albumId: row.album_id,
    albumName: row.album_name,
    animation: {
      imageTransition: 'ken_burns_fade',
      textEnter: 'fade_up',
      textExit: 'fade_out',
      textIdle: 'soft_float',
    },
    animationTemplateId,
    caption: {
      style: captionStyle,
      text: aiComment || row.caption_text,
      title: row.caption_title,
    },
    display: {
      aiImageUrl: row.ai_720_url,
      animationTemplateId,
      captionStyle,
      fontStyle: normalizeAiFontStyle(row.ai_font_style),
      layoutTemplateId,
      templateId: 'classic-memory-v1',
      textColor: normalizeAiTextColor(row.ai_text_color),
      thumbImageUrl: row.thumbnail_300_url,
      tvImageUrl: row.tv_4k_webp_url,
    },
    displayImageUrl: row.display_image_url,
    dominantColor: row.dominant_color,
    durationMs: 12_000,
    imageFitMode: 'cover_safe',
    imageUrl: row.image_url,
    layout: {
      position: toPlaylistLayoutPosition(row.ai_layout_position),
      safeArea: parseSafeArea(row.ai_safe_area),
      type: 'bottom_gradient',
    },
    layoutTemplateId,
    location: row.location,
    narrationVariants: aiDetailProjection?.aiNarrationVariants ?? [],
    performanceHint: 'standard',
    photoId: row.photo_id,
    takenAt: row.taken_at,
    thumbnailUrl: row.thumbnail_url,
  };
}

function rowToPhotoCenterItem(row: PhotoRow): PhotoCenterItem {
  const aiScoreStatus = normalizeAiStatus(row.ai_score_status);
  const aiCommentStatus = normalizeAiStatus(row.ai_comment_status);
  const aiDetailProjection = extractAiDetailProjection(row.ai_detail);
  const shouldUseAiDetailProjection = Boolean(
    aiDetailProjection &&
    (
      aiScoreStatus !== 'completed' ||
      aiCommentStatus !== 'completed' ||
      row.ai_comment.trim() === ''
    ),
  );
  const projectedComment = shouldUseAiDetailProjection
    ? aiDetailProjection?.aiComment ?? ''
    : '';
  const projectedMemoryScore = shouldUseAiDetailProjection
    ? aiDetailProjection?.aiMemoryScore
    : undefined;
  const projectedBeautyScore = shouldUseAiDetailProjection
    ? aiDetailProjection?.aiBeautyScore
    : undefined;
  const projectedAiScore = shouldUseAiDetailProjection
    ? aiDetailProjection?.aiScore
    : undefined;
  const projectedTags = shouldUseAiDetailProjection
    ? aiDetailProjection?.aiTags ?? []
    : [];
  const projectedScoreStatus = projectedMemoryScore !== undefined && projectedBeautyScore !== undefined
    ? 'completed'
    : aiScoreStatus;
  const projectedCommentStatus = projectedComment
    ? 'completed'
    : aiCommentStatus;
  const aiComment = row.ai_comment.trim() || projectedComment;
  const aiMemoryScore = shouldUseAiDetailProjection
    ? projectedMemoryScore ?? row.ai_memory_score
    : row.ai_memory_score;
  const aiBeautyScore = shouldUseAiDetailProjection
    ? projectedBeautyScore ?? row.ai_beauty_score
    : row.ai_beauty_score;
  const aiScore = shouldUseAiDetailProjection
    ? projectedAiScore ?? row.ai_score
    : row.ai_score;
  const aiTags = parseAiTags(row.ai_tags);
  return {
    aiCompleted: projectedScoreStatus === 'completed' && projectedCommentStatus === 'completed',
    aiBeautyScore,
    aiComment,
    aiCommentStatus: projectedCommentStatus,
    aiDetail: row.ai_detail,
    aiError: row.ai_error,
    aiIsTrash: row.ai_is_trash === 1,
    aiLayout: {
      fontStyle: normalizeAiFontStyle(row.ai_font_style),
      position: normalizeAiLayoutPosition(row.ai_layout_position),
      safeArea: parseSafeArea(row.ai_safe_area),
      textColor: normalizeAiTextColor(row.ai_text_color),
    },
    aiLocked: row.ai_locked === 1,
    aiMemoryScore,
    aiNarrationVariants: aiDetailProjection?.aiNarrationVariants ?? [],
    aiReason: row.ai_reason || (shouldUseAiDetailProjection ? aiDetailProjection?.aiReason ?? '' : ''),
    aiRecognizedAt: row.ai_recognized_at,
    aiScore,
    aiScoreStatus: projectedScoreStatus,
    aiTags: shouldUseAiDetailProjection && projectedTags.length > 0
      ? projectedTags
      : aiTags,
    albumId: row.album_id,
    albumName: row.album_name,
    captionTitle: row.caption_title,
    derivativeStatus: row.derivative_status,
    filename: row.filename,
    importAlbumTitle: row.import_album_title || row.album_name,
    importedAt: row.imported_at,
    location: row.location,
    photoId: row.photo_id,
    sourceAlbumId: row.source_album_id || row.album_id,
    sourceAlbumKind: row.source_album_kind,
    sourceOwnerName: row.source_owner_name,
    sourceType: row.source_type === 'feiniu' ? 'feiniu' : 'local',
    syncedAt: row.synced_at,
    takenAt: row.taken_at,
    thumbnailUrl: row.thumbnail_url,
  };
}

function rowToPlaybackAlbum(row: PlaybackAlbumRow): PlaybackAlbum {
  return {
    authorizedDeviceIds: parseJsonStringArray(row.authorized_device_ids),
    aiDailyLimit: normalizeNonNegativeInteger(row.ai_daily_limit, 0),
    aiDailyProcessedCount: normalizeNonNegativeInteger(row.ai_daily_processed_count, 0),
    aiDailyProcessedOn: row.ai_daily_processed_on,
    aiEnabled: row.ai_enabled === 1,
    aiPriorityTags: parseAiTags(row.ai_priority_tags),
    aiRepeatIntervalMinutes: normalizePositiveInteger(
      row.ai_repeat_interval_minutes,
      1440,
    ),
    aiScoreThreshold: normalizeScoreThreshold(row.ai_score_threshold, 80),
    coverPhotoId: row.cover_photo_id,
    createdAt: row.created_at,
    description: row.description,
    photoCount: row.photo_count,
    playbackAlbumId: row.playback_album_id,
    pushEnabled: row.push_enabled === 1,
    pushBeautyScoreThreshold: normalizeScoreThreshold(
      row.push_beauty_score_threshold,
      70,
    ),
    pushMemoryScoreThreshold: normalizeScoreThreshold(
      row.push_memory_score_threshold,
      row.push_score_threshold,
    ),
    pushPriorityTags: parseAiTags(row.push_priority_tags),
    pushScoreThreshold: normalizeScoreThreshold(row.push_score_threshold, 80),
    sourceAlbumId: row.source_album_id,
    sourceAlbumTitle: row.source_album_title,
    sourceType: row.source_type === 'feiniu_album' ? 'feiniu_album' : 'manual',
    title: row.title,
    lastAiCheckedAt: row.last_ai_checked_at,
    updatedAt: row.updated_at,
  };
}

interface AiDetailProjection {
  aiBeautyScore?: number;
  aiComment?: string;
  aiMemoryScore?: number;
  aiNarrationVariants?: PlaylistNarrationVariant[];
  aiReason?: string;
  aiScore?: number;
  aiTags?: string[];
}

function extractAiDetailProjection(value: string): AiDetailProjection | null {
  if (!value.trim()) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return null;
  }
  const envelope = asRecord(parsed);
  const raw = asRecord(envelope?.raw) ?? envelope;
  if (!raw) return null;
  const analysis = asRecord(raw.analysis) ?? asRecord(raw.ai_analysis);
  const classification = asRecord(raw.classification);
  const evaluation = asRecord(raw.evaluation);
  const pushDecision = asRecord(raw.push_decision);
  const memoryScore = normalizeAiDetailScore(
    raw.memory_score ??
    evaluation?.memory_score ??
    pushDecision?.memory_score ??
    analysis?.memory_score,
  );
  const beautyScore = normalizeAiDetailScore(
    raw.beauty_score ??
    evaluation?.beauty_score ??
    pushDecision?.beauty_score ??
    analysis?.beauty_score,
  );
  const comment = extractAiDetailComment(raw, analysis);
  const narrationVariants = extractAiNarrationVariants(raw);
  const tags = extractAiDetailTags(raw, analysis, classification);
  const reason = [
    raw.reason,
    evaluation?.reason,
    pushDecision?.push_reason,
    analysis?.memory_score_reason,
    analysis?.beauty_score_reason,
  ].find((candidate) => typeof candidate === 'string' && candidate.trim());
  const projection: AiDetailProjection = {};
  if (beautyScore !== undefined) projection.aiBeautyScore = beautyScore;
  if (comment) projection.aiComment = comment;
  if (memoryScore !== undefined) projection.aiMemoryScore = memoryScore;
  if (narrationVariants.length > 0) projection.aiNarrationVariants = narrationVariants;
  if (memoryScore !== undefined && beautyScore !== undefined) {
    projection.aiScore = Math.round((memoryScore * 0.65) + (beautyScore * 0.35));
  }
  if (typeof reason === 'string') projection.aiReason = reason.trim().slice(0, 120);
  if (tags.length > 0) projection.aiTags = tags;
  return Object.keys(projection).length > 0 ? projection : null;
}

function extractAiNarrationVariants(
  raw: Record<string, unknown>,
): PlaylistNarrationVariant[] {
  const narration = asRecord(raw.narration);
  const candidates = Array.isArray(narration?.variants)
    ? narration.variants
    : Array.isArray(raw.narration_options)
      ? raw.narration_options
    : Array.isArray(raw.narration_variants)
      ? raw.narration_variants
      : [];
  return candidates
    .map((candidate) => asRecord(candidate))
    .filter((candidate): candidate is Record<string, unknown> => candidate !== null)
    .map((candidate) => ({
      handwrittenThought: normalizeNarrationPart(
        candidate.handwritten_thought ??
          candidate.handwrittenThought ??
          candidate.handwritten_line,
      ),
      lyricalClosure: normalizeNarrationPart(
        candidate.lyrical_closure ??
          candidate.lyricalClosure ??
          candidate.closing_line,
      ),
      sceneDescription: normalizeNarrationPart(
        candidate.scene_description ??
          candidate.sceneDescription ??
          candidate.scene_line,
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

function normalizeNarrationPart(value: unknown): string {
  return typeof value === 'string' ? value.trim().slice(0, 48) : '';
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function normalizeAiDetailScore(value: unknown): number | undefined {
  const score = typeof value === 'number'
    ? value
    : typeof value === 'string'
      ? Number(value)
      : Number.NaN;
  if (!Number.isFinite(score)) return undefined;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function extractAiDetailComment(
  raw: Record<string, unknown>,
  analysis: Record<string, unknown> | null,
): string {
  const directCandidates = [
    raw.comment,
    raw.caption,
    raw.copywriting,
  ];
  for (const candidate of directCandidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim().slice(0, 36);
    }
  }
  const narrationVariants = extractAiNarrationVariants(raw);
  if (narrationVariants.length > 0) {
    return narrationVariantToComment(narrationVariants[0]);
  }
  if (Array.isArray(raw.generated_captions)) {
    const generatedCaption = raw.generated_captions
      .map((item) => asRecord(item))
      .find((item) => typeof item?.text === 'string' && item.text.trim());
    if (typeof generatedCaption?.text === 'string') {
      return generatedCaption.text.trim().slice(0, 72);
    }
  }
  const captionCandidates = analysis?.caption_candidates;
  if (Array.isArray(captionCandidates)) {
    const candidate = captionCandidates.find(
      (item) => typeof item === 'string' && item.trim(),
    );
    if (typeof candidate === 'string') return candidate.trim().slice(0, 36);
  }
  const analysisCaption = analysis?.caption;
  if (typeof analysisCaption === 'string' && analysisCaption.trim()) {
    return analysisCaption.trim().slice(0, 36);
  }
  return '';
}

function narrationVariantToComment(variant: PlaylistNarrationVariant): string {
  return [
    variant.sceneDescription,
    variant.handwrittenThought,
    variant.lyricalClosure,
  ].join('\n');
}

function extractAiDetailTags(
  raw: Record<string, unknown>,
  analysis: Record<string, unknown> | null,
  classification: Record<string, unknown> | null = null,
): string[] {
  const classificationTags = classification?.scene_tags;
  if (Array.isArray(classificationTags)) {
    return classificationTags.filter(
      (item): item is string => typeof item === 'string' && item.trim().length > 0,
    );
  }
  const classificationCategory = classification?.category;
  if (typeof classificationCategory === 'string' && classificationCategory.trim()) {
    return classificationCategory
      .split(/[,，]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  const rawType = raw.type;
  if (typeof rawType === 'string' && rawType.trim()) {
    return rawType.split(/[,，]/).map((item) => item.trim()).filter(Boolean);
  }
  const rawTags = raw.tags;
  if (Array.isArray(rawTags)) {
    return rawTags.filter(
      (item): item is string => typeof item === 'string' && item.trim().length > 0,
    );
  }
  const analysisTags = analysis?.tags;
  if (Array.isArray(analysisTags)) {
    return analysisTags.filter(
      (item): item is string => typeof item === 'string' && item.trim().length > 0,
    );
  }
  return [];
}

function rowToTvDevice(row: TvDeviceRow): TvDevice {
  return {
    appVersion: row.app_version,
    authorizedPlaybackAlbumIds: parseJsonStringArray(row.authorized_playback_album_ids),
    createdAt: row.created_at,
    deviceId: row.device_id,
    deviceName: row.device_name,
    deviceToken: row.device_token,
    deviceUniqueId: row.device_unique_id,
    enabled: row.enabled === 1,
    groupName: row.group_name,
    lastLoginAt: row.last_login_at,
    platform: row.platform,
    updatedAt: row.updated_at,
  };
}

function rowToAiSettings(row: AiSettingsRow): AiSettings {
  return {
    aiCheckIntervalMinutes: normalizePositiveInteger(
      row.ai_check_interval_minutes,
      defaultAiSettings.aiCheckIntervalMinutes,
    ),
    dailyAiLimit: normalizePositiveInteger(
      row.daily_ai_limit,
      defaultAiSettings.dailyAiLimit,
    ),
    apiKeyConfigured: row.api_key.trim().length > 0,
    baseUrl: row.base_url,
    classificationPrompt: row.classification_prompt,
    commentPrompt: row.comment_prompt,
    layoutPrompt: row.layout_prompt || defaultAiSettings.layoutPrompt,
    model: row.model,
    outputContractPrompt: row.output_contract_prompt || defaultAiSettings.outputContractPrompt,
    provider: normalizeAiProvider(row.provider, defaultAiSettings.provider),
    scoringPrompt: row.scoring_prompt || defaultAiSettings.scoringPrompt,
    updatedAt: row.updated_at,
  };
}

function rowToAiRecognitionTask(row: AiRecognitionTaskRow): AiRecognitionTaskProgress {
  return {
    activePhotoId: row.active_photo_id,
    activePhotoName: row.active_photo_name,
    albumId: row.album_id,
    albumTitle: row.album_title,
    completedPhotoCount: row.completed_photo_count,
    createdAt: row.created_at,
    error: row.error,
    failedPhotoCount: row.failed_photo_count,
    finishedAt: row.finished_at,
    jobId: row.job_id,
    lastUpdatedAt: row.last_updated_at,
    requestedPhotoCount: row.requested_photo_count,
    skippedPhotoCount: row.skipped_photo_count,
    status: normalizeAiRecognitionTaskStatus(row.status),
    targetId: row.target_id,
    targetTitle: row.target_title,
    targetType: normalizeAiRecognitionTaskTargetType(row.target_type),
  };
}

function normalizeAiRecognitionTaskStatus(status: string): AiRecognitionTaskStatus {
  return status === 'completed' ||
    status === 'failed' ||
    status === 'queued' ||
    status === 'retrying' ||
    status === 'running'
    ? status
    : 'queued';
}

function normalizeAiRecognitionTaskTargetType(
  targetType: string,
): AiRecognitionTaskProgress['targetType'] {
  return targetType === 'album' || targetType === 'photo' || targetType === 'retry'
    ? targetType
    : 'photo';
}

function normalizeAiStatus(status: string): PhotoCenterAiStatus {
  return status === 'completed' || status === 'failed' ? status : 'pending';
}

function parseAiTags(value: string): string[] {
  return parseJsonStringArray(value);
}

function parseJsonStringArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : [];
  } catch {
    return [];
  }
}

function normalizeTags(value: string[] | undefined): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => item.trim()).filter(Boolean))];
}

function normalizeOptionalScore(value: number | undefined): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return normalizeScoreThreshold(value, 80);
}

function normalizeAiLayoutPosition(
  value: PhotoAiInsightInput['aiLayoutPosition'] | string | undefined,
): string {
  return value === 'top_left' ||
    value === 'top_right' ||
    value === 'bottom_left' ||
    value === 'bottom_right' ||
    value === 'center_safe'
    ? value
    : 'bottom_left';
}

function normalizeAiTextColor(
  value: PhotoAiInsightInput['aiTextColor'] | string | undefined,
): '#000000' | '#FFFFFF' {
  return value === '#000000' ? '#000000' : '#FFFFFF';
}

function normalizeAiFontStyle(
  value: PhotoAiInsightInput['aiFontStyle'] | string | undefined,
): 'handwriting' | 'sans-serif' | 'serif' {
  return value === 'handwriting' || value === 'serif' ? value : 'sans-serif';
}

function normalizeSafeArea(
  value: PhotoAiInsightInput['aiSafeArea'] | undefined,
): { h: number; w: number; x: number; y: number } {
  const fallback = { h: 0.18, w: 0.36, x: 0.08, y: 0.72 };
  if (!value) return fallback;
  const safeArea = {
    h: normalizeUnit(value.h),
    w: normalizeUnit(value.w),
    x: normalizeUnit(value.x),
    y: normalizeUnit(value.y),
  };
  return safeArea.h > 0 && safeArea.w > 0 ? safeArea : fallback;
}

function parseSafeArea(value: string): { h: number; w: number; x: number; y: number } {
  try {
    return normalizeSafeArea(JSON.parse(value));
  } catch {
    return normalizeSafeArea(undefined);
  }
}

function normalizeUnit(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(Math.max(value, 0), 1)
    : 0;
}

function toPlaylistLayoutPosition(value: string): 'left_bottom' | 'right_bottom' {
  return value === 'bottom_right' || value === 'top_right'
    ? 'right_bottom'
    : 'left_bottom';
}

function withDerivativeProfile(url: string, profile: 'ai_720' | 'thumb_300' | 'tv_4k_webp'): string {
  const trimmedUrl = url.trim();
  if (!trimmedUrl) return trimmedUrl;
  if (/[?&]profile=/.test(trimmedUrl)) return trimmedUrl;
  return `${trimmedUrl}${trimmedUrl.includes('?') ? '&' : '?'}profile=${profile}`;
}

async function ensureWebpDerivative(
  source: Buffer | string,
  outputPath: string,
  maxEdge: number,
  quality: number,
): Promise<void> {
  if (existsSync(outputPath) && statSync(outputPath).size > 0) return;

  await sharp(source)
    .rotate()
    .resize({
      fit: 'inside',
      height: maxEdge,
      withoutEnlargement: true,
      width: maxEdge,
    })
    .webp({
      effort: 4,
      quality,
    })
    .toFile(outputPath);
}

function derivativeUrl(photoId: string, filename: string): string {
  return `/api/derivatives/${encodeURIComponent(photoId)}/${encodeURIComponent(filename)}`;
}

function normalizePathSegment(value: string): string {
  const trimmedValue = value.trim();
  return /^[a-zA-Z0-9_-]+$/.test(trimmedValue) ? trimmedValue : '';
}

function normalizeDeviceId(value: string): string {
  const normalized = normalizePathSegment(value);
  return normalized || `tv_${Date.now().toString(36)}`;
}

function normalizeDeviceIds(values: string[]): string[] {
  return [...new Set(values.map(normalizeDeviceId).filter(Boolean))];
}

function normalizePlaybackAlbumIds(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function normalizeDerivativeFilename(value: string): string {
  const trimmedValue = value.trim();
  return /^(thumb_300|ai_720|tv_4k)\.webp$/.test(trimmedValue)
    ? trimmedValue
    : '';
}

function normalizeAiProvider(
  value: string | undefined,
  fallback: string,
): AiSettingsProvider {
  const provider = value?.trim();
  if (
    provider === 'custom' ||
    provider === 'deepseek' ||
    provider === 'openai' ||
    provider === 'openai_compatible' ||
    provider === 'qwen'
  ) {
    return provider;
  }
  return normalizeAiProvider(fallback, defaultAiSettings.provider);
}

function normalizeOptionalText(
  value: string | undefined,
  fallback: string,
  allowEmpty = false,
): string {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim();
  return normalized || allowEmpty ? normalized : fallback;
}

function normalizeSourceAlbumKind(
  value: PhotoCenterSourceAlbumKind | undefined,
  fallback: PhotoCenterSourceAlbumKind,
): PhotoCenterSourceAlbumKind {
  return value === 'owned' ||
    value === 'shared_by_me' ||
    value === 'shared_to_me' ||
    value === ''
    ? value
    : fallback;
}

function normalizeScoreThreshold(value: number | undefined, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  if (value < 0) return 0;
  if (value > 100) return 100;
  return Math.round(value);
}

function normalizeNullableScore(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  return normalizeScoreThreshold(value, 0);
}

function uniqueAiTags(tags: string[]): string[] {
  return [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))];
}

function mergeAiScore(
  memoryScore: number | null,
  beautyScore: number | null,
): number | null {
  if (memoryScore === null && beautyScore === null) return null;
  if (memoryScore === null) return beautyScore;
  if (beautyScore === null) return memoryScore;
  return Math.round((memoryScore + beautyScore) / 2);
}

function normalizePositiveInteger(value: number | undefined, fallback: number): number {
  if (!value) return fallback;
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function normalizeNonNegativeInteger(value: number | undefined, fallback: number): number {
  if (value === undefined || value === null) return fallback;
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : fallback;
}

function normalizeCaptionStyle(style: string): PlaylistItem['caption']['style'] {
  const validStyles: readonly PlaylistItem['caption']['style'][] = [
    'family_diary',
    'minimal',
    'poetic',
    'travel',
    'warm_memory',
  ];
  return validStyles.includes(style as PlaylistItem['caption']['style'])
    ? (style as PlaylistItem['caption']['style'])
    : 'warm_memory';
}

function addColumnIfMissing(
  database: DatabaseSync,
  tableName: string,
  columnName: string,
  definition: string,
): void {
  const columns = database.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{
    name: string;
  }>;
  if (columns.some((column) => column.name === columnName)) return;
  database.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
}

interface ScannedPhotoFile {
  relativePath: string;
  takenAt: string;
}

function collectPhotoFiles(photoRoot: string): ScannedPhotoFile[] {
  if (!existsSync(photoRoot)) return [];

  const stats = statSync(photoRoot);
  if (!stats.isDirectory()) return [];

  const files = collectPhotoFilesRecursive(photoRoot, photoRoot);
  return files.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

function collectPhotoFilesRecursive(
  photoRoot: string,
  currentDir: string,
): ScannedPhotoFile[] {
  return readdirSync(currentDir, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(currentDir, entry.name);
    if (entry.isDirectory()) return collectPhotoFilesRecursive(photoRoot, entryPath);
    if (!isSupportedPhotoFilename(entry.name)) return [];

    return [
      {
        relativePath: relative(photoRoot, entryPath),
        takenAt: statSync(entryPath).mtime.toISOString().slice(0, 10),
      },
    ];
  });
}

function contentTypeForFilename(filename: string): string {
  const lowerFilename = filename.toLowerCase();
  if (lowerFilename.endsWith('.png')) return 'image/png';
  if (lowerFilename.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}

function isSupportedPhotoFilename(filename: string): boolean {
  return /\.(jpe?g|png|webp)$/i.test(filename);
}

function photoUrl(photoId: string, variant: 'display' | 'original' | 'thumb'): string {
  return `/api/photos/${photoId}/${variant}?source=ceshi`;
}

function findProjectRoot(startDir: string): string {
  let currentDir = resolve(startDir);
  for (let depth = 0; depth < 8; depth += 1) {
    if (existsSync(join(currentDir, 'ceshi'))) return currentDir;
    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) break;
    currentDir = parentDir;
  }
  return resolve(startDir);
}
