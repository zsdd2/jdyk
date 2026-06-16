<script lang="ts" setup>
import type {
  GetPhotoCenterItemsInput,
  PhotoCenterAiStatus,
  PhotoCenterItem,
  PhotoCenterSourceType,
  PlaybackAlbum,
} from '#/api/photo-library';
import type {
  Key,
  TableRowSelection,
} from 'ant-design-vue/es/table/interface';

import { computed, onMounted, reactive, ref } from 'vue';

import { Page } from '@vben/common-ui';

import {
  Alert,
  Button,
  Card,
  Dropdown,
  Empty,
  Input,
  InputNumber,
  Menu,
  message,
  Modal,
  Popconfirm,
  Popover,
  Radio,
  Select,
  Space,
  Table,
  Tag,
} from 'ant-design-vue';

import {
  addPlaybackAlbumPhotosApi,
  createPlaybackAlbumApi,
  createPhotoCenterBackfillJobApi,
  createPhotoAiJobApi,
  getPhotoAssetUrl,
  getPhotoCenterItemsApi,
  getPlaybackAlbumsApi,
  syncPhotoAiDetailApi,
  trashPhotoApi,
  updatePhotoAiInsightApi,
  updatePhotoMetadataApi,
} from '#/api/photo-library';

import {
  buildSelectedPhotoIds,
  formatAddPlaybackAlbumResult,
  validatePlaybackAlbumAssignment,
} from './playback-album-assignment';
import {
  buildPhotoReadinessSummary,
  formatBackfillJobFeedback,
} from './photo-list-status';
import {
  buildAiNarrationOptions,
  formatAiNarrationVariant,
  resolveAiNarrationVariants,
} from '../components/ai-narration-options';
import AiTaskProgressModal from '../components/AiTaskProgressModal.vue';

const loading = ref(false);
const albumLoading = ref(false);
const assignmentLoading = ref(false);
const backfillLoading = ref(false);
const assignmentVisible = ref(false);
const batchMetadataSaving = ref(false);
const batchMetadataVisible = ref(false);
const photoEditVisible = ref(false);
const photoEditSaving = ref(false);
const aiRefreshingPhotoId = ref('');
const aiDetailVisible = ref(false);
const aiDetailRecord = ref<PhotoCenterItem>();
const aiDetailSyncing = ref(false);
const aiTaskVisible = ref(false);
const insightSavingPhotoId = ref('');
const TextArea = Input.TextArea;
const items = ref<PhotoCenterItem[]>([]);
const playbackAlbums = ref<PlaybackAlbum[]>([]);
const selectedRowKeys = ref<string[]>([]);
const selectedRows = ref<PhotoCenterItem[]>([]);
const total = ref(0);
const lastBackfillFeedback = ref('');
const query = reactive<GetPhotoCenterItemsInput>({
  page: 1,
  pageSize: 20,
});
const assignmentForm = reactive({
  description: '',
  mode: 'existing' as 'create' | 'existing',
  newTitle: '',
  playbackAlbumId: '',
});
const photoEditForm = reactive({
  captionTitle: '',
  importAlbumTitle: '',
  location: '',
  photoId: '',
  sourceAlbumKind: '' as PhotoCenterItem['sourceAlbumKind'],
  sourceOwnerName: '',
  takenAt: '',
  weather: '',
});
const batchMetadataForm = reactive({
  location: '',
  takenAt: '',
  weather: '',
});

const sourceOptions = [
  { label: '全部来源', value: '' },
  { label: '本地照片', value: 'local' },
  { label: '飞牛相册', value: 'feiniu' },
];

const aiStatusOptions = [
  { label: '全部状态', value: '' },
  { label: '待处理', value: 'pending' },
  { label: '已完成', value: 'completed' },
  { label: '失败', value: 'failed' },
];
const sourceAlbumKindOptions = [
  { label: '本地导入', value: '' },
  { label: '普通相册', value: 'owned' },
  { label: '共享给我', value: 'shared_to_me' },
  { label: '我共享的', value: 'shared_by_me' },
];

const columns = [
  { dataIndex: 'thumbnailUrl', key: 'thumbnailUrl', title: '照片', width: 92 },
  { dataIndex: 'filename', key: 'filename', title: '文件' },
  { dataIndex: 'sourceType', key: 'sourceType', title: '来源', width: 110 },
  { dataIndex: 'albumName', key: 'albumName', title: '导入相册', width: 160 },
  { dataIndex: 'sourceOwnerName', key: 'sourceOwnerName', title: '源信息', width: 170 },
  { dataIndex: 'takenAt', key: 'takenAt', title: '拍摄时间', width: 130 },
  { dataIndex: 'syncedAt', key: 'syncedAt', title: '同步时间', width: 180 },
  { dataIndex: 'derivativeStatus', key: 'derivativeStatus', title: '转码', width: 96 },
  { dataIndex: 'aiCompleted', key: 'aiCompleted', title: 'AI 识别', width: 104 },
  { dataIndex: 'aiTags', key: 'aiTags', title: '类型', width: 160 },
  {
    dataIndex: 'aiCommentStatus',
    key: 'aiCommentStatus',
    title: 'AI 旁白',
    width: 240,
  },
  { dataIndex: 'actions', key: 'actions', title: '操作', width: 128 },
];

const pagination = computed(() => ({
  current: query.page,
  pageSize: query.pageSize,
  showSizeChanger: true,
  total: total.value,
}));
const currentPageReadiness = computed(() => buildPhotoReadinessSummary(items.value));
const selectedPhotoIds = computed(() => buildSelectedPhotoIds(selectedRows.value));
const selectedPhotoCount = computed(() => selectedPhotoIds.value.length);
const playbackAlbumOptions = computed(() =>
  playbackAlbums.value.map((album) => ({
    label: `${album.title}（${album.photoCount} 张）`,
    value: album.playbackAlbumId,
  })),
);
const rowSelection = computed(() => ({
  selectedRowKeys: selectedRowKeys.value,
  onChange: (keys: Key[], rows: PhotoCenterItem[]) => {
    selectedRowKeys.value = keys.map(String);
    selectedRows.value = rows;
  },
}) satisfies TableRowSelection<PhotoCenterItem>);

function cleanQuery(): GetPhotoCenterItemsInput {
  return {
  aiCommentStatus: query.aiCommentStatus || undefined,
  aiScoreStatus: query.aiScoreStatus || undefined,
  aiTag: query.aiTag || undefined,
    keyword: query.keyword?.trim() || undefined,
    page: query.page,
    pageSize: query.pageSize,
    sourceType: query.sourceType || undefined,
  };
}

async function loadPhotos() {
  loading.value = true;
  try {
    const result = await getPhotoCenterItemsApi(cleanQuery());
    items.value = result.items;
    total.value = result.total;
    query.page = result.page;
    query.pageSize = result.pageSize;
  } finally {
    loading.value = false;
  }
}

async function loadPlaybackAlbums() {
  albumLoading.value = true;
  try {
    playbackAlbums.value = await getPlaybackAlbumsApi();
    if (!assignmentForm.playbackAlbumId && playbackAlbums.value[0]) {
      assignmentForm.playbackAlbumId = playbackAlbums.value[0].playbackAlbumId;
    }
  } finally {
    albumLoading.value = false;
  }
}

function applyFilters() {
  query.page = 1;
  clearSelection();
  void loadPhotos();
}

function resetFilters() {
  query.keyword = undefined;
  query.sourceType = undefined;
  query.aiScoreStatus = undefined;
  query.aiCommentStatus = undefined;
  query.page = 1;
  query.aiTag = undefined;
  clearSelection();
  void loadPhotos();
}

function applyAiStatusShortcut(
  target: 'comment' | 'score',
  status: PhotoCenterAiStatus,
) {
  query.aiScoreStatus = target === 'score' ? status : undefined;
  query.aiCommentStatus = target === 'comment' ? status : undefined;
  query.page = 1;
  clearSelection();
  void loadPhotos();
}

function clearLastBackfillFeedback() {
  lastBackfillFeedback.value = '';
}

function handleTableChange(pageState: { current?: number; pageSize?: number }) {
  query.page = pageState.current ?? 1;
  query.pageSize = pageState.pageSize ?? 20;
  clearSelection();
  void loadPhotos();
}

function clearSelection() {
  selectedRowKeys.value = [];
  selectedRows.value = [];
}

async function openAssignmentModal() {
  if (selectedPhotoCount.value === 0) {
    message.warning('请选择要加入播放相册的照片');
    return;
  }
  assignmentVisible.value = true;
  await loadPlaybackAlbums();
  assignmentForm.mode = playbackAlbums.value.length > 0 ? 'existing' : 'create';
}

async function submitAssignment() {
  const validationError = validatePlaybackAlbumAssignment({
    mode: assignmentForm.mode,
    newTitle: assignmentForm.newTitle,
    photoIds: selectedPhotoIds.value,
    playbackAlbumId: assignmentForm.playbackAlbumId,
  });
  if (validationError) {
    message.warning(validationError);
    return;
  }

  assignmentLoading.value = true;
  try {
    let playbackAlbumId = assignmentForm.playbackAlbumId;
    if (assignmentForm.mode === 'create') {
      const album = await createPlaybackAlbumApi({
        description: assignmentForm.description,
        title: assignmentForm.newTitle,
      });
      playbackAlbumId = album.playbackAlbumId;
    }
    const result = await addPlaybackAlbumPhotosApi(playbackAlbumId, {
      photoIds: selectedPhotoIds.value,
    });
    message.success(formatAddPlaybackAlbumResult(result));
    assignmentVisible.value = false;
    assignmentForm.description = '';
    assignmentForm.newTitle = '';
    assignmentForm.playbackAlbumId = '';
    clearSelection();
    await loadPlaybackAlbums();
  } finally {
    assignmentLoading.value = false;
  }
}

function fillPhotoEditForm(photo: PhotoCenterItem) {
  photoEditForm.captionTitle = photo.captionTitle || photo.filename;
  photoEditForm.importAlbumTitle = photo.importAlbumTitle || photo.albumName;
  photoEditForm.location = photo.location;
  photoEditForm.photoId = photo.photoId;
  photoEditForm.sourceAlbumKind = photo.sourceAlbumKind;
  photoEditForm.sourceOwnerName = photo.sourceOwnerName;
  photoEditForm.takenAt = photo.takenAt;
  photoEditForm.weather = extractObservedWeather(photo);
}

function openPhotoEdit(record: PhotoCenterItem | Record<string, any>) {
  const photo = record as PhotoCenterItem;
  fillPhotoEditForm(photo);
  photoEditVisible.value = true;
}

async function submitPhotoEdit() {
  if (!photoEditForm.photoId) return;
  photoEditSaving.value = true;
  try {
    const updated = await updatePhotoMetadataApi(photoEditForm.photoId, {
      captionTitle: photoEditForm.captionTitle,
      importAlbumTitle: photoEditForm.importAlbumTitle,
      location: photoEditForm.location,
      sourceAlbumKind: photoEditForm.sourceAlbumKind,
      sourceOwnerName: photoEditForm.sourceOwnerName,
      takenAt: photoEditForm.takenAt,
      weather: photoEditForm.weather,
    });
    items.value = items.value.map((item) =>
      item.photoId === updated.photoId ? { ...item, ...updated } : item,
    );
    if (aiDetailRecord.value?.photoId === updated.photoId) {
      aiDetailRecord.value = { ...aiDetailRecord.value, ...updated };
      fillPhotoEditForm(aiDetailRecord.value);
    }
    message.success('照片信息已更新');
    photoEditVisible.value = false;
  } finally {
    photoEditSaving.value = false;
  }
}

function openBatchMetadataModal() {
  if (selectedPhotoCount.value === 0) {
    message.warning('请选择要批量修改的照片');
    return;
  }
  batchMetadataForm.location = '';
  batchMetadataForm.takenAt = '';
  batchMetadataForm.weather = '';
  batchMetadataVisible.value = true;
}

async function submitBatchMetadata() {
  if (selectedPhotoCount.value === 0) return;
  const input = {
    ...(batchMetadataForm.location.trim() ? { location: batchMetadataForm.location } : {}),
    ...(batchMetadataForm.takenAt.trim() ? { takenAt: batchMetadataForm.takenAt } : {}),
    ...(batchMetadataForm.weather.trim() ? { weather: batchMetadataForm.weather } : {}),
  };
  if (Object.keys(input).length === 0) {
    message.warning('请至少填写时间、地点、天气中的一项');
    return;
  }
  batchMetadataSaving.value = true;
  try {
    const updates = await Promise.all(
      selectedPhotoIds.value.map((photoId) => updatePhotoMetadataApi(photoId, input)),
    );
    const updatedById = new Map(updates.map((item) => [item.photoId, item]));
    items.value = items.value.map((item) => updatedById.get(item.photoId) ?? item);
    selectedRows.value = selectedRows.value.map((item) => updatedById.get(item.photoId) ?? item);
    message.success(`已批量更新 ${updates.length} 张照片的展示信息`);
    batchMetadataVisible.value = false;
  } finally {
    batchMetadataSaving.value = false;
  }
}

async function trashPhoto(record: PhotoCenterItem | Record<string, any>) {
  const photo = record as PhotoCenterItem;
  const result = await trashPhotoApi(photo.photoId);
  items.value = items.value.filter((item) => item.photoId !== photo.photoId);
  selectedRowKeys.value = selectedRowKeys.value.filter((key) => key !== rowKey(photo));
  selectedRows.value = selectedRows.value.filter((item) => item.photoId !== photo.photoId);
  total.value = Math.max(total.value - result.trashedPhotoCount, 0);
  message.success('已移入废片库');
}

async function refreshPhotoAi(record: PhotoCenterItem | Record<string, any>) {
  const photo = record as PhotoCenterItem;
  aiRefreshingPhotoId.value = photo.photoId;
  try {
    await createPhotoAiJobApi(photo.photoId);
    aiTaskVisible.value = true;
    message.success('AI 重新识别任务已加入队列，可在 AI 进度中查看');
  } finally {
    aiRefreshingPhotoId.value = '';
  }
}

async function backfillPendingPhotos() {
  backfillLoading.value = true;
  try {
    const job = await createPhotoCenterBackfillJobApi();
    aiTaskVisible.value = true;
    lastBackfillFeedback.value = formatBackfillJobFeedback(job);
    message.success(lastBackfillFeedback.value);
    await loadPhotos();
  } finally {
    backfillLoading.value = false;
  }
}

function handlePhotoAction(action: string, record: PhotoCenterItem | Record<string, any>) {
  if (action === 'refreshAi') {
    void refreshPhotoAi(record);
    return;
  }
  if (action === 'aiDetail') {
    openAiDetail(record);
    return;
  }
  if (action === 'edit') {
    openPhotoEdit(record);
    return;
  }
  if (action === 'trash') {
    Modal.confirm({
      content: '原始文件不会删除，照片会进入废片库并从分拣入口隐藏。',
      okButtonProps: { danger: true },
      okText: '移入废片库',
      title: '移入废片库？',
      onOk: () => trashPhoto(record),
    });
  }
}

async function openAiDetail(record: PhotoCenterItem | Record<string, any>) {
  const photo = record as PhotoCenterItem;
  const result = await getPhotoCenterItemsApi({
    keyword: photo.photoId,
    page: 1,
    pageSize: 1,
  });
  aiDetailRecord.value = result.items.find((item) => item.photoId === photo.photoId) ?? photo;
  fillPhotoEditForm(aiDetailRecord.value);
  aiDetailVisible.value = true;
}

async function syncAiDetail() {
  const photo = aiDetailRecord.value;
  if (!photo) return;
  aiDetailSyncing.value = true;
  try {
    aiDetailRecord.value = await syncPhotoAiDetailApi(photo.photoId);
    message.success('已从 AI 原始返回同步结构化数据');
    await loadPhotos();
  } catch (error) {
    message.error(error instanceof Error ? error.message : '同步 AI 数据失败');
  } finally {
    aiDetailSyncing.value = false;
  }
}

function rowKey(record: PhotoCenterItem) {
  return `${record.albumId}:${record.photoId}`;
}

function sourceColor(sourceType: PhotoCenterSourceType) {
  return sourceType === 'feiniu' ? 'purple' : 'blue';
}

function sourceLabel(sourceType: PhotoCenterSourceType) {
  return sourceType === 'feiniu' ? '飞牛' : '本地';
}

function sourceAlbumKindLabel(kind: PhotoCenterItem['sourceAlbumKind']) {
  if (kind === 'shared_to_me') return '共享给我';
  if (kind === 'shared_by_me') return '我共享的';
  if (kind === 'owned') return '普通相册';
  return '本地导入';
}

function aiStatusColor(status: PhotoCenterAiStatus) {
  if (status === 'completed') return 'success';
  if (status === 'failed') return 'error';
  return 'processing';
}

function aiStatusLabel(status: PhotoCenterAiStatus) {
  if (status === 'completed') return '已完成';
  if (status === 'failed') return '失败';
  return '待处理';
}

void aiStatusColor;
void aiStatusLabel;

function aiRecognitionLabel(record: PhotoCenterItem | Record<string, any>) {
  return record.aiCompleted ? '已完成' : '待补全';
}

function aiRecognitionColor(record: PhotoCenterItem | Record<string, any>) {
  return record.aiCompleted ? 'success' : 'warning';
}

function derivativeStatusColor(status: string) {
  if (status === 'ready') return 'success';
  if (status === 'failed') return 'error';
  if (status === 'remote_pending') return 'warning';
  return 'processing';
}

function derivativeStatusLabel(status: string) {
  if (status === 'ready') return '已转码';
  if (status === 'failed') return '失败';
  if (status === 'remote_pending') return '待拉取';
  return '待转码';
}

function filterByAiTag(tag: string) {
  query.aiTag = tag;
  applyFilters();
}

function eventInputValue(event: Event) {
  const target = event.target;
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement
    ? target.value
    : '';
}

function updateInlineAiComment(record: PhotoCenterItem | Record<string, any>, event: Event) {
  (record as PhotoCenterItem).aiComment = eventInputValue(event);
}

function normalizeTagInput(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function narrationOptions(record: PhotoCenterItem | Record<string, any>) {
  return buildAiNarrationOptions(resolvedNarrationVariants(record));
}

function resolvedNarrationVariants(record: PhotoCenterItem | Record<string, any>) {
  return resolveAiNarrationVariants(record as PhotoCenterItem);
}

function extractObservedWeather(record: Pick<PhotoCenterItem, 'aiDetail'>) {
  if (!record.aiDetail.trim()) return '';
  try {
    const parsed = JSON.parse(record.aiDetail) as Record<string, any>;
    const raw = parsed.raw && typeof parsed.raw === 'object' ? parsed.raw : parsed;
    const weather = raw?.photo_analysis?.observed_meta?.weather;
    return typeof weather === 'string' ? weather : '';
  } catch {
    return '';
  }
}

async function selectPhotoNarration(
  record: PhotoCenterItem | Record<string, any>,
  value: unknown,
) {
  if (typeof value !== 'string') return;
  await savePhotoAiInsight(record, { aiComment: value });
}

async function savePhotoAiInsight(
  record: PhotoCenterItem | Record<string, any>,
  input: {
    aiBeautyScore?: null | number;
    aiComment?: string;
    aiMemoryScore?: null | number;
    aiTags?: string[];
  },
) {
  const photo = record as PhotoCenterItem;
  insightSavingPhotoId.value = photo.photoId;
  try {
    const updated = await updatePhotoAiInsightApi(photo.photoId, {
      ...input,
      aiLocked: true,
    });
    items.value = items.value.map((item) =>
      item.photoId === updated.photoId ? { ...item, ...updated } : item,
    );
    if (aiDetailRecord.value?.photoId === updated.photoId) {
      aiDetailRecord.value = { ...aiDetailRecord.value, ...updated };
    }
  } finally {
    insightSavingPhotoId.value = '';
  }
}

onMounted(loadPhotos);
</script>

<template>
  <Page description="照片中心资产目录" title="照片列表">
    <Card class="mb-4" :body-style="{ paddingBottom: '12px' }">
      <div class="photo-status-metrics">
        <div class="photo-status-card">
          <span>当前页照片</span>
          <strong>{{ currentPageReadiness.totalCount }}</strong>
        </div>
        <div class="photo-status-card ready">
          <span>可用于播放</span>
          <strong>{{ currentPageReadiness.readyCount }}</strong>
        </div>
        <div class="photo-status-card pending">
          <span>待处理</span>
          <strong>{{ currentPageReadiness.pendingCount }}</strong>
        </div>
        <div class="photo-status-card failed">
          <span>失败</span>
          <strong>{{ currentPageReadiness.failedCount }}</strong>
        </div>
        <div class="photo-status-total">
          <span>全库匹配</span>
          <strong>{{ total }}</strong>
        </div>
      </div>

      <Alert
        v-if="lastBackfillFeedback"
        closable
        class="backfill-feedback"
        :message="lastBackfillFeedback"
        show-icon
        type="success"
        @close="clearLastBackfillFeedback"
      />

      <Space wrap>
        <Input
          v-model:value="query.keyword"
          allow-clear
          class="filter-keyword"
          placeholder="文件名、标题、相册"
          @press-enter="applyFilters"
        />
        <Select
          v-model:value="query.sourceType"
          allow-clear
          class="filter-select"
          :options="sourceOptions"
          placeholder="来源"
        />
        <Select
          v-model:value="query.aiScoreStatus"
          allow-clear
          class="filter-select"
          :options="aiStatusOptions"
          placeholder="AI 识别"
        />
        <Select
          v-model:value="query.aiCommentStatus"
          allow-clear
          class="filter-select"
          :options="aiStatusOptions"
          placeholder="AI 旁白"
        />
        <Button @click="applyAiStatusShortcut('score', 'pending')">识别待处理</Button>
        <Button @click="applyAiStatusShortcut('comment', 'pending')">旁白待处理</Button>
        <Button @click="applyAiStatusShortcut('score', 'failed')">识别失败</Button>
        <Button @click="applyAiStatusShortcut('comment', 'failed')">旁白失败</Button>
        <Tag
          v-if="query.aiTag"
          class="active-filter-tag"
          closable
          color="blue"
          @close.prevent="() => { query.aiTag = undefined; applyFilters(); }"
        >
          类型：{{ query.aiTag }}
        </Tag>
        <Button type="primary" @click="applyFilters">查询</Button>
        <Button @click="resetFilters">重置</Button>
      </Space>
    </Card>

    <Card>
      <div class="batch-toolbar">
        <div class="batch-summary">
          <strong>已选 {{ selectedPhotoCount }} 张</strong>
          <span>从照片中心分拣到播放相册，后续用于设备授权和每日十图。</span>
        </div>
        <Space>
          <Button @click="aiTaskVisible = true">AI 进度</Button>
          <Button :loading="backfillLoading" @click="backfillPendingPhotos">
            补齐待处理
          </Button>
          <Button :disabled="selectedPhotoCount === 0" @click="clearSelection">
            清空选择
          </Button>
          <Button :disabled="selectedPhotoCount === 0" @click="openBatchMetadataModal">
            批量改展示信息
          </Button>
          <Button
            :disabled="selectedPhotoCount === 0"
            type="primary"
            @click="openAssignmentModal"
          >
            加入播放相册
          </Button>
        </Space>
      </div>

      <Table
        :columns="columns"
        :data-source="items"
        :loading="loading"
        :pagination="pagination"
        :row-key="rowKey"
        :row-selection="rowSelection"
        size="middle"
        @change="handleTableChange"
      >
        <template #emptyText>
          <Empty description="暂无照片" />
        </template>

        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'thumbnailUrl'">
            <img
              :alt="record.filename"
              class="photo-thumb"
              loading="lazy"
              :src="getPhotoAssetUrl(record.thumbnailUrl)"
            />
          </template>
          <template v-else-if="column.key === 'filename'">
            <div class="file-cell">
              <strong>{{ record.captionTitle || record.filename }}</strong>
              <span>{{ record.filename }}</span>
              <span v-if="record.location">{{ record.location }}</span>
            </div>
          </template>
          <template v-else-if="column.key === 'sourceType'">
            <Tag :color="sourceColor(record.sourceType)">
              {{ sourceLabel(record.sourceType) }}
            </Tag>
          </template>
          <template v-else-if="column.key === 'albumName'">
            {{ record.importAlbumTitle || record.albumName }}
          </template>
          <template v-else-if="column.key === 'sourceOwnerName'">
            <div class="source-cell">
              <span>{{ sourceAlbumKindLabel(record.sourceAlbumKind) }}</span>
              <span v-if="record.sourceOwnerName">
                所有者：{{ record.sourceOwnerName }}
              </span>
            </div>
          </template>
          <template v-else-if="column.key === 'syncedAt'">
            {{ record.syncedAt || record.importedAt || '-' }}
          </template>
          <template v-else-if="column.key === 'derivativeStatus'">
            <Tag :color="derivativeStatusColor(record.derivativeStatus)">
              {{ derivativeStatusLabel(record.derivativeStatus) }}
            </Tag>
          </template>
          <template v-else-if="column.key === 'aiCompleted'">
            <Popover trigger="click" placement="leftTop">
              <template #content>
                <div class="ai-insight-popover">
                  <label>
                    <span>回忆相关度</span>
                    <InputNumber
                      :max="100"
                      :min="0"
                      size="small"
                      :value="record.aiMemoryScore"
                      @change="(value) => savePhotoAiInsight(record, { aiMemoryScore: typeof value === 'number' ? value : null })"
                    />
                  </label>
                  <label>
                    <span>美学水平</span>
                    <InputNumber
                      :max="100"
                      :min="0"
                      size="small"
                      :value="record.aiBeautyScore"
                      @change="(value) => savePhotoAiInsight(record, { aiBeautyScore: typeof value === 'number' ? value : null })"
                    />
                  </label>
                  <label>
                    <span>AI 旁白</span>
                    <TextArea
                      :auto-size="{ minRows: 2, maxRows: 4 }"
                      :value="record.aiComment"
                      @input="(event) => updateInlineAiComment(record, event)"
                      @blur="(event) => savePhotoAiInsight(record, { aiComment: eventInputValue(event) })"
                    />
                    <Select
                      v-if="resolvedNarrationVariants(record).length > 1"
                      :options="narrationOptions(record)"
                      placeholder="选择其他识别旁白"
                      size="small"
                      style="margin-top: 6px; width: 100%"
                      @change="(value) => selectPhotoNarration(record, value)"
                    />
                  </label>
                  <label>
                    <span>类型</span>
                    <Select
                      mode="tags"
                      size="small"
                      :value="record.aiTags"
                      @change="(value) => savePhotoAiInsight(record, { aiTags: normalizeTagInput(value) })"
                    />
                  </label>
                </div>
              </template>
              <Tag
                class="clickable-tag"
                :color="aiRecognitionColor(record)"
              >
                {{ insightSavingPhotoId === record.photoId ? '保存中' : aiRecognitionLabel(record) }}
              </Tag>
            </Popover>
          </template>
          <template v-else-if="column.key === 'aiTags'">
            <div class="tag-cell">
              <Tag
                v-for="tag in record.aiTags"
                :key="tag"
                class="clickable-tag"
                color="blue"
                @click="filterByAiTag(tag)"
              >
                {{ tag }}
              </Tag>
              <span v-if="record.aiTags.length === 0">-</span>
            </div>
          </template>
          <template v-else-if="column.key === 'aiCommentStatus'">
            <span v-if="record.aiComment" class="ai-comment-ready">
              {{ record.aiComment }}
            </span>
          </template>
          <template v-else-if="column.key === 'actions'">
            <Dropdown trigger="click">
              <Button
                size="small"
                :loading="aiRefreshingPhotoId === record.photoId"
              >
                操作
              </Button>
              <template #overlay>
                <Menu @click="({ key }) => handlePhotoAction(String(key), record)">
                  <Menu.Item key="refreshAi">重新识别</Menu.Item>
                  <Menu.Item key="edit">编辑</Menu.Item>
                  <Menu.Item key="trash" danger>删除</Menu.Item>
                  <Menu.Item key="aiDetail">AI 详情</Menu.Item>
                </Menu>
              </template>
            </Dropdown>
            <Space v-if="false" size="small">
              <Button
                size="small"
                type="link"
                :loading="aiRefreshingPhotoId === record.photoId"
                @click="refreshPhotoAi(record)"
              >
                重新识别
              </Button>
              <Button size="small" type="link" @click="openPhotoEdit(record)">
                编辑
              </Button>
              <Popconfirm
                title="移入废片库？原始文件不会删除。"
                @confirm="trashPhoto(record)"
              >
                <Button danger size="small" type="link">删除</Button>
              </Popconfirm>
            </Space>
          </template>
        </template>
      </Table>
    </Card>

    <Modal
      v-model:open="assignmentVisible"
      :confirm-loading="assignmentLoading"
      :ok-button-props="{ disabled: selectedPhotoCount === 0 }"
      ok-text="确认加入"
      title="加入播放相册"
      width="560px"
      @ok="submitAssignment"
    >
      <Space class="assignment-form" direction="vertical" size="middle">
        <div class="assignment-count">
          已选择 <strong>{{ selectedPhotoCount }}</strong> 张照片
        </div>

        <Radio.Group v-model:value="assignmentForm.mode">
          <Radio value="existing" :disabled="playbackAlbums.length === 0">
            加入已有播放相册
          </Radio>
          <Radio value="create">创建新播放相册</Radio>
        </Radio.Group>

        <Select
          v-if="assignmentForm.mode === 'existing'"
          v-model:value="assignmentForm.playbackAlbumId"
          class="assignment-field"
          :loading="albumLoading"
          :options="playbackAlbumOptions"
          placeholder="选择播放相册"
        />

        <template v-else>
          <Input
            v-model:value="assignmentForm.newTitle"
            class="assignment-field"
            placeholder="播放相册名称，例如 客厅每日精选"
          />
          <Input
            v-model:value="assignmentForm.description"
            class="assignment-field"
            placeholder="说明，可选"
          />
        </template>
      </Space>
    </Modal>

    <Modal
      v-model:open="photoEditVisible"
      :confirm-loading="photoEditSaving"
      ok-text="保存"
      title="编辑照片信息"
      width="520px"
      @ok="submitPhotoEdit"
    >
      <Space class="assignment-form" direction="vertical" size="middle">
        <Input v-model:value="photoEditForm.captionTitle" placeholder="照片名称" />
        <Input v-model:value="photoEditForm.importAlbumTitle" placeholder="导入相册" />
        <Input v-model:value="photoEditForm.takenAt" placeholder="展示时间，例如 2026-06-16" />
        <Input v-model:value="photoEditForm.location" placeholder="展示地点，例如 杭州西湖区" />
        <Input v-model:value="photoEditForm.weather" placeholder="展示天气，例如 晴" />
        <Select
          v-model:value="photoEditForm.sourceAlbumKind"
          :options="sourceAlbumKindOptions"
          placeholder="来源类型"
        />
        <Input v-model:value="photoEditForm.sourceOwnerName" placeholder="来源账号/所有者" />
      </Space>
    </Modal>
    <Modal
      v-model:open="batchMetadataVisible"
      :confirm-loading="batchMetadataSaving"
      ok-text="批量保存"
      title="批量修改展示信息"
      width="520px"
      @ok="submitBatchMetadata"
    >
      <Space class="assignment-form" direction="vertical" size="middle">
        <div class="assignment-count">
          将更新已选择的 <strong>{{ selectedPhotoCount }}</strong> 张照片；留空字段不会覆盖原值。
        </div>
        <Input v-model:value="batchMetadataForm.takenAt" placeholder="展示时间，例如 2026-06-16" />
        <Input v-model:value="batchMetadataForm.location" placeholder="展示地点，例如 杭州西湖区" />
        <Input v-model:value="batchMetadataForm.weather" placeholder="展示天气，例如 晴" />
      </Space>
    </Modal>
    <Modal
      v-model:open="aiDetailVisible"
      :footer="null"
      title="AI 识别详情"
      width="760px"
    >
      <div v-if="aiDetailRecord" class="ai-detail-panel">
        <div class="ai-detail-grid">
          <span>照片</span>
          <strong>{{ aiDetailRecord.filename }}</strong>
          <span>状态</span>
          <strong>{{ aiRecognitionLabel(aiDetailRecord) }}</strong>
          <span>回忆相关度</span>
          <strong>{{ aiDetailRecord.aiMemoryScore ?? '-' }}</strong>
          <span>美学水平</span>
          <strong>{{ aiDetailRecord.aiBeautyScore ?? '-' }}</strong>
          <span>类型</span>
          <strong>{{ aiDetailRecord.aiTags.join(', ') || '-' }}</strong>
          <span>识别时间</span>
          <strong>{{ aiDetailRecord.aiRecognizedAt || '-' }}</strong>
          <span>错误</span>
          <strong>{{ aiDetailRecord.aiError || '-' }}</strong>
          <span>三段式旁白</span>
          <strong>{{ resolvedNarrationVariants(aiDetailRecord).length }} 组</strong>
        </div>
        <div class="ai-display-meta-editor">
          <strong>展示信息</strong>
          <div class="ai-display-meta-grid">
            <Input v-model:value="photoEditForm.takenAt" placeholder="展示时间" />
            <Input v-model:value="photoEditForm.location" placeholder="展示地点" />
            <Input v-model:value="photoEditForm.weather" placeholder="展示天气" />
            <Button
              :loading="photoEditSaving"
              type="primary"
              @click="submitPhotoEdit"
            >
              保存展示信息
            </Button>
          </div>
        </div>
        <Button
          :loading="aiDetailSyncing"
          style="margin-bottom: 12px"
          type="primary"
          @click="syncAiDetail"
        >
          同步识别数据
        </Button>
        <div
          v-if="resolvedNarrationVariants(aiDetailRecord).length > 0"
          class="ai-narration-options"
        >
          <strong>可选识别旁白</strong>
          <Button
            v-for="(variant, index) in resolvedNarrationVariants(aiDetailRecord)"
            :key="index"
            block
            size="small"
            style="height: auto; margin-top: 8px; white-space: pre-line; text-align: left"
            @click="savePhotoAiInsight(aiDetailRecord, { aiComment: formatAiNarrationVariant(variant) })"
          >
            {{ index + 1 }}. {{ formatAiNarrationVariant(variant) }}
          </Button>
        </div>
        <pre class="ai-detail-raw">{{ aiDetailRecord.aiDetail || aiDetailRecord.aiReason || '暂无 AI 原始返回' }}</pre>
      </div>
    </Modal>
    <AiTaskProgressModal
      v-model:visible="aiTaskVisible"
      @changed="loadPhotos"
    />
  </Page>
</template>

<style scoped>
.photo-status-metrics {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 150px));
  gap: 10px;
  margin-bottom: 12px;
}

.photo-status-card,
.photo-status-total {
  display: grid;
  gap: 4px;
  padding: 10px 12px;
  border: 1px solid rgb(148 163 184 / 22%);
  border-radius: 8px;
  background: rgb(15 23 42 / 3%);
}

.photo-status-card.ready {
  border-color: rgb(34 197 94 / 30%);
}

.photo-status-card.pending {
  border-color: rgb(245 158 11 / 35%);
}

.photo-status-card.failed {
  border-color: rgb(239 68 68 / 32%);
}

.photo-status-card span,
.photo-status-total span {
  color: #64748b;
  font-size: 12px;
}

.photo-status-card strong,
.photo-status-total strong {
  font-size: 20px;
  line-height: 1.2;
}

.backfill-feedback {
  margin-bottom: 12px;
}

.filter-keyword {
  width: 240px;
}

.filter-select {
  width: 140px;
}

.active-filter-tag,
.clickable-tag {
  cursor: pointer;
}

.batch-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 0 0 16px;
}

.batch-summary {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.batch-summary span {
  color: #64748b;
  font-size: 12px;
}

.assignment-form {
  width: 100%;
}

.assignment-count {
  padding: 10px 12px;
  border: 1px solid #d9e2ec;
  border-radius: 6px;
  background: #f8fafc;
}

.assignment-field {
  width: 100%;
}

.photo-thumb {
  width: 64px;
  height: 48px;
  object-fit: cover;
  border-radius: 6px;
  background: #f1f5f9;
}

.file-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.file-cell span {
  color: #64748b;
  font-size: 12px;
}

.source-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.source-cell span {
  color: #64748b;
  font-size: 12px;
}

.tag-cell {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  min-width: 0;
}

.tag-cell span {
  color: #64748b;
  font-size: 12px;
}

.ai-comment-cell {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.ai-comment-cell span:not(.ant-tag) {
  overflow: hidden;
  color: #64748b;
  font-size: 12px;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ai-comment-ready {
  display: inline-block;
  overflow: hidden;
  max-width: 220px;
  color: #1677ff;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ai-insight-popover {
  display: grid;
  gap: 10px;
  width: 280px;
}

.ai-insight-popover label {
  display: grid;
  gap: 4px;
}

.ai-insight-popover label > span {
  color: #64748b;
  font-size: 12px;
}

.ai-detail-panel {
  display: grid;
  gap: 14px;
}

.ai-detail-grid {
  display: grid;
  grid-template-columns: 110px 1fr;
  gap: 8px 12px;
}

.ai-detail-grid span {
  color: #64748b;
}

.ai-display-meta-editor {
  display: grid;
  gap: 8px;
}

.ai-display-meta-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr)) auto;
  gap: 8px;
  align-items: center;
}

.ai-detail-raw {
  overflow: auto;
  max-height: 360px;
  padding: 12px;
  border: 1px solid #d9e2ec;
  border-radius: 6px;
  background: #0f172a;
  color: #dbeafe;
  white-space: pre-wrap;
}
</style>
