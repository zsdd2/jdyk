import type { CreatePlaybackAlbumInput } from '#/api/photo-library';

export interface PlaybackAlbumCreateForm {
  aiEnabled: boolean;
  aiDailyLimit: number;
  aiPriorityTags: string[];
  aiRepeatIntervalMinutes: number;
  aiScoreThreshold: number;
  description: string;
  pushEnabled: boolean;
  pushBeautyScoreThreshold: number;
  pushMemoryScoreThreshold: number;
  pushPriorityTags: string[];
  pushScoreThreshold: number;
  sourceAlbumId: string;
  sourceAlbumTitle: string;
  sourceType: 'feiniu_album' | 'manual';
  title: string;
}

export const playbackAlbumPriorityTagOptions = [
  { label: '人物', value: '人物' },
  { label: '开心', value: '开心' },
  { label: '场景', value: '场景' },
  { label: '合影', value: '合影' },
  { label: '风景', value: '风景' },
];

export function createDefaultPlaybackAlbumForm(): PlaybackAlbumCreateForm {
  return {
    aiEnabled: false,
    aiDailyLimit: 0,
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
  };
}

export function validatePlaybackAlbumCreateForm(
  form: PlaybackAlbumCreateForm,
): string {
  const title = resolvePlaybackAlbumTitle(form);
  if (!title) return '请输入播放相册名称';
  if (form.sourceType === 'feiniu_album' && !form.sourceAlbumId.trim()) {
    return '请选择飞牛相册';
  }
  return '';
}

export function buildPlaybackAlbumCreateInput(
  form: PlaybackAlbumCreateForm,
): CreatePlaybackAlbumInput {
  return {
    aiEnabled: form.aiEnabled,
    aiDailyLimit: normalizeDailyLimit(form.aiDailyLimit),
    aiPriorityTags: uniqueTags(form.aiPriorityTags),
    aiRepeatIntervalMinutes: normalizeIntervalMinutes(form.aiRepeatIntervalMinutes),
    aiScoreThreshold: clampScore(form.aiScoreThreshold),
    description: form.description.trim(),
    pushEnabled: form.pushEnabled,
    pushBeautyScoreThreshold: clampScore(form.pushBeautyScoreThreshold),
    pushMemoryScoreThreshold: clampScore(form.pushMemoryScoreThreshold),
    pushPriorityTags: uniqueTags(form.pushPriorityTags),
    pushScoreThreshold: clampScore(form.pushScoreThreshold),
    sourceAlbumId: form.sourceAlbumId.trim(),
    sourceAlbumTitle: form.sourceAlbumTitle.trim(),
    sourceType: form.sourceType,
    title: resolvePlaybackAlbumTitle(form),
  };
}

function resolvePlaybackAlbumTitle(form: PlaybackAlbumCreateForm) {
  return (form.title.trim() || form.sourceAlbumTitle.trim()).trim();
}

function uniqueTags(tags: string[]) {
  return [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))];
}

function clampScore(score: number) {
  if (!Number.isFinite(score)) return 80;
  if (score < 0) return 0;
  if (score > 100) return 100;
  return Math.round(score);
}

function normalizeIntervalMinutes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 1440;
  return Math.round(value);
}

function normalizeDailyLimit(value: number) {
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.round(value);
}
