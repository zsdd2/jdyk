export type PlayMode = 'date_desc' | 'random' | 'sequence' | 'today_in_history';

export type ImageFitMode =
  | 'contain'
  | 'cover'
  | 'cover_safe'
  | 'portrait_blur_fill';

export type PerformanceHint = 'high' | 'low' | 'standard';

export interface HealthResponse {
  name: string;
  status: 'ok';
  version: string;
  timestamp: string;
}

export interface DevicePolicyResponse {
  allowLocalOverride: boolean;
  animationTemplate: string;
  deviceId: string;
  intervalSeconds: number;
  layoutTemplate: string;
  playMode: PlayMode;
  policyId: string;
  policyVersion: number;
}

export type DeviceBindStatus = 'bound' | 'expired' | 'pending';

export interface DeviceBindSessionCreateInput {
  appVersion?: string;
  screenHeight?: number;
  screenWidth?: number;
}

export interface DeviceBindSessionResponse {
  bindCode: string;
  createdAt: string;
  deviceId?: string;
  deviceName?: string;
  deviceToken?: string;
  expiresAt: string;
  status: DeviceBindStatus;
}

export interface DeviceBindConfirmInput {
  deviceName?: string;
}

export interface DeviceLoginInput {
  appVersion?: string;
  deviceName?: string;
  deviceUniqueId?: string;
  password: string;
  platform?: string;
  username: string;
}

export interface DeviceLoginResponse {
  deviceId: string;
  deviceName: string;
  deviceToken: string;
}

export interface PlaylistCaption {
  style: 'family_diary' | 'minimal' | 'poetic' | 'travel' | 'warm_memory';
  text: string;
  title: string;
}

export interface PlaylistLayout {
  position: 'left_bottom' | 'right_bottom';
  safeArea?: {
    h: number;
    w: number;
    x: number;
    y: number;
  };
  type: string;
}

export interface PlaylistAnimation {
  imageTransition: string;
  textEnter: string;
  textExit: string;
  textIdle: string;
}

export type PlaylistAiStatus = 'completed' | 'failed' | 'pending';

export interface PlaylistAiInsight {
  beautyScore?: null | number;
  comment: string;
  commentStatus: PlaylistAiStatus;
  isTrash?: boolean;
  locked: boolean;
  memoryScore?: null | number;
  reason?: string;
  score: null | number;
  scoreStatus: PlaylistAiStatus;
  tags: string[];
}

export interface PlaylistDisplayConfig {
  aiImageUrl?: string;
  animationTemplateId: string;
  captionStyle: PlaylistCaption['style'];
  fontStyle?: 'handwriting' | 'sans-serif' | 'serif';
  layoutTemplateId: string;
  templateId: string;
  textColor?: '#000000' | '#FFFFFF';
  thumbImageUrl?: string;
  tvImageUrl?: string;
}

export interface PlaylistMediaInfo {
  height: number;
  orientation: 'landscape' | 'portrait' | 'square' | 'unknown';
  width: number;
}

export interface PlaylistNarrationVariant {
  handwrittenThought: string;
  lyricalClosure: string;
  sceneDescription: string;
}

export interface PlaylistTopMeta {
  location?: string;
  time?: string;
  weather?: string;
}

export interface PlaylistItem {
  ai: PlaylistAiInsight;
  albumId: string;
  albumName: string;
  animation: PlaylistAnimation;
  animationTemplateId: string;
  caption: PlaylistCaption;
  display: PlaylistDisplayConfig;
  displayImageUrl: string;
  dominantColor: string;
  durationMs: number;
  imageFitMode: ImageFitMode;
  imageUrl: string;
  layout: PlaylistLayout;
  layoutTemplateId: string;
  location?: string;
  media?: PlaylistMediaInfo;
  narrationVariants?: PlaylistNarrationVariant[];
  performanceHint: PerformanceHint;
  photoId: string;
  takenAt?: string;
  thumbnailUrl: string;
  topMeta?: PlaylistTopMeta;
}

export interface PlaylistResponse {
  items: PlaylistItem[];
  playlistId: string;
  policyVersion: number;
}

export interface AlbumSummary {
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

export interface AlbumDetailResponse extends AlbumSummary {
  items: PlaylistItem[];
}

export interface AlbumListResponse {
  albums: AlbumSummary[];
  total: number;
}

export interface PlayRecordInput {
  durationSeconds: number;
  error?: string;
  photoId: string;
  policyId: string;
  skipped: boolean;
}

export interface PlayRecordResponse {
  accepted: true;
  receivedAt: string;
}
