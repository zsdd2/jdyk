<script lang="ts" setup>
import type {
  PhotoCenterAiStatus,
  FeiniuAlbumOption,
  PhotoCenterItem,
  PhotoCenterSourceType,
  PlaybackAlbum,
  TvDevice,
} from '#/api/photo-library';

import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';

import { Page } from '@vben/common-ui';

import {
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
  Select,
  Space,
  Switch,
  Table,
  Tag,
} from 'ant-design-vue';

import {
  addPlaybackAlbumPhotosApi,
  createPlaybackAlbumAiJobApi,
  createPlaybackAlbumApi,
  createPlaybackAlbumScanJobApi,
  createPhotoAiJobApi,
  deletePlaybackAlbumApi,
  getFeiniuAlbumsApi,
  getPhotoAssetUrl,
  getPhotoCenterItemsApi,
  getPlaybackAlbumItemsApi,
  getPlaybackAlbumsApi,
  getTvDevicesApi,
  removePlaybackAlbumPhotoApi,
  syncPhotoAiDetailApi,
  updatePhotoAiInsightApi,
  updatePlaybackAlbumApi,
  updatePlaybackAlbumAiPolicyApi,
} from '#/api/photo-library';

import {
  buildPlaybackAlbumCoverPath,
  formatPlaybackAlbumPhotoCount,
  sortPlaybackAlbumsByUpdatedAt,
} from './playback-album-view';
import {
  buildPlaybackAlbumCreateInput,
  createDefaultPlaybackAlbumForm,
  playbackAlbumPriorityTagOptions,
  validatePlaybackAlbumCreateForm,
} from './playback-album-curation';
import {
  buildAiNarrationOptions,
  formatAiNarrationVariant,
  resolveAiNarrationVariants,
} from '../components/ai-narration-options';
import AiTaskProgressModal from '../components/AiTaskProgressModal.vue';

const router = useRouter();
const loading = ref(false);
const membersLoading = ref(false);
const memberRemovingPhotoId = ref('');
const memberScanningAlbumId = ref('');
const memberBatchRefreshing = ref(false);
const selectedMemberRowKeys = ref<string[]>([]);
const aiRefreshingPhotoId = ref('');
const aiDetailVisible = ref(false);
const aiDetailRecord = ref<PhotoCenterItem>();
const aiDetailSyncing = ref(false);
const aiNarrationEditVisible = ref(false);
const aiNarrationEditRecord = ref<PhotoCenterItem>();
const aiNarrationEditSaving = ref(false);
const aiNarrationEditText = ref('');
const aiTaskVisible = ref(false);
const insightSavingPhotoId = ref('');
const TextArea = Input.TextArea;
const aiTogglingAlbumId = ref('');
const aiGeneratingAlbumId = ref('');
const memberModalVisible = ref(false);
const createModalVisible = ref(false);
const createSubmitting = ref(false);
const editModalVisible = ref(false);
const editSubmitting = ref(false);
const albumImportingId = ref('');
const feiniuAlbumsLoading = ref(false);
const devicesLoading = ref(false);
const sortDeskVisible = ref(false);
const sortDeskLoading = ref(false);
const sortDeskSubmitting = ref(false);
const albums = ref<PlaybackAlbum[]>([]);
const feiniuAlbums = ref<FeiniuAlbumOption[]>([]);
const devices = ref<TvDevice[]>([]);
const members = ref<PhotoCenterItem[]>([]);
const sortDeskPhotos = ref<PhotoCenterItem[]>([]);
const sortSelectedPhotoIds = ref<string[]>([]);
const sortSelectedSourceAlbumIds = ref<string[]>([]);
const activeAlbum = ref<PlaybackAlbum>();
const createForm = reactive(createDefaultPlaybackAlbumForm());
const editForm = reactive({
  aiDailyLimit: 0,
  aiEnabled: true,
  aiPriorityTags: [] as string[],
  aiRepeatIntervalMinutes: 1440,
  authorizedDeviceIds: [] as string[],
  description: '',
  playbackAlbumId: '',
  pushBeautyScoreThreshold: 70,
  pushEnabled: true,
  pushMemoryScoreThreshold: 80,
  pushPriorityTags: [] as string[],
  pushScoreThreshold: 80,
  sourceAlbumId: '',
  sourceAlbumTitle: '',
  sourceType: 'manual' as PlaybackAlbum['sourceType'],
  title: '',
});
const sortSourceType = ref<'' | PhotoCenterSourceType>('');
const sortTargetAlbumId = ref('');

const sortedAlbums = computed(() => sortPlaybackAlbumsByUpdatedAt(albums.value));
const totalPhotoCount = computed(() =>
  albums.value.reduce((total, album) => total + album.photoCount, 0),
);
const selectedMemberRowKeySet = computed(() => new Set(selectedMemberRowKeys.value));
const selectedMemberRecords = computed(() =>
  members.value.filter((item) => selectedMemberRowKeySet.value.has(memberRowKey(item))),
);
const selectedMemberCount = computed(() => selectedMemberRecords.value.length);
const memberRowSelection = computed(() => ({
  selectedRowKeys: selectedMemberRowKeys.value,
  onChange: (keys: Array<number | string>) => {
    selectedMemberRowKeys.value = keys.map(String);
  },
}));
const sourceTypeOptions = [
  { label: '手动分拣', value: 'manual' },
  { label: '飞牛相册', value: 'feiniu_album' },
];
const feiniuAlbumOptions = computed(() =>
  feiniuAlbums.value.map((album) => ({
    label: `${album.title} / ${album.photoCount} 张`,
    value: album.albumId,
  })),
);
const sortTargetOptions = computed(() =>
  sortedAlbums.value.map((album) => ({
    label: `${album.title} / ${album.photoCount} 张`,
    value: album.playbackAlbumId,
  })),
);
const deviceOptions = computed(() =>
  devices.value.map((device) => ({
    label: `${device.deviceName} / ${device.groupName || '未分组'}`,
    value: device.deviceId,
  })),
);
const sortSourceOptions = [
  { label: '全部来源', value: '' },
  { label: '本地照片', value: 'local' },
  { label: '飞牛照片', value: 'feiniu' },
];
const sortSelectedSet = computed(() => new Set(sortSelectedPhotoIds.value));
const sortSelectedSourceAlbumSet = computed(() => new Set(sortSelectedSourceAlbumIds.value));
const isFeiniuSortMode = computed(() => sortSourceType.value === 'feiniu');
const sortSelectedCount = computed(() =>
  isFeiniuSortMode.value
    ? sortSelectedSourceAlbumIds.value.length
    : sortSelectedPhotoIds.value.length,
);

const albumColumns = [
  { dataIndex: 'coverPhotoId', key: 'coverPhotoId', title: '封面', width: 96 },
  { dataIndex: 'title', key: 'title', title: '播放相册' },
  { dataIndex: 'sourceType', key: 'sourceType', title: '来源', width: 150 },
  { dataIndex: 'aiEnabled', key: 'aiPolicy', title: 'AI 策略', width: 230 },
  { dataIndex: 'pushScoreThreshold', key: 'pushPolicy', title: '推送要求', width: 260 },
  { dataIndex: 'photoCount', key: 'photoCount', title: '照片', width: 110 },
  { dataIndex: 'updatedAt', key: 'updatedAt', title: '更新时间', width: 190 },
  { dataIndex: 'actions', key: 'actions', title: '操作', width: 280 },
];

const memberColumns = [
  { dataIndex: 'thumbnailUrl', key: 'thumbnailUrl', title: '照片', width: 84 },
  { dataIndex: 'filename', key: 'filename', title: '文件' },
  { dataIndex: 'sourceType', key: 'sourceType', title: '来源', width: 100 },
  { dataIndex: 'albumName', key: 'albumName', title: '导入相册', width: 150 },
  { dataIndex: 'takenAt', key: 'takenAt', title: '拍摄时间', width: 130 },
  { dataIndex: 'derivativeStatus', key: 'derivativeStatus', title: '转码', width: 96 },
  { dataIndex: 'aiCompleted', key: 'aiCompleted', title: 'AI 识别', width: 104 },
  { dataIndex: 'aiTags', key: 'aiTags', title: '类型', width: 150 },
  { dataIndex: 'aiComment', key: 'aiComment', title: 'AI 旁白', width: 240 },
  { dataIndex: 'actions', key: 'actions', title: '操作', width: 96 },
];

const compactAlbumColumns = computed(() =>
  albumColumns
    .filter((column) => column.key !== 'pushPolicy')
    .map((column) => {
      if (column.key === 'aiPolicy') return { ...column, title: 'AI 识别', width: 180 };
      if (column.key === 'actions') return { ...column, title: '操作', width: 110 };
      return column;
    }),
);

async function loadAlbums() {
  loading.value = true;
  try {
    albums.value = await getPlaybackAlbumsApi();
  } finally {
    loading.value = false;
  }
}

async function loadFeiniuAlbums() {
  feiniuAlbumsLoading.value = true;
  try {
    feiniuAlbums.value = await getFeiniuAlbumsApi();
  } finally {
    feiniuAlbumsLoading.value = false;
  }
}

async function loadDevices() {
  devicesLoading.value = true;
  try {
    devices.value = await getTvDevicesApi();
  } finally {
    devicesLoading.value = false;
  }
}

async function openCreateAlbumModal() {
  Object.assign(createForm, createDefaultPlaybackAlbumForm());
  createModalVisible.value = true;
  await loadFeiniuAlbums();
}

async function openSortDesk() {
  sortDeskVisible.value = true;
  sortSelectedPhotoIds.value = [];
  sortSelectedSourceAlbumIds.value = [];
  if (albums.value.length === 0) {
    await loadAlbums();
  }
  if (!sortTargetAlbumId.value && sortedAlbums.value[0]) {
    sortTargetAlbumId.value = sortedAlbums.value[0].playbackAlbumId;
  }
  await loadSortDeskPhotos();
  await loadFeiniuAlbums();
}

async function loadSortDeskPhotos() {
  sortSelectedPhotoIds.value = [];
  sortSelectedSourceAlbumIds.value = [];
  if (isFeiniuSortMode.value) {
    sortDeskPhotos.value = [];
    await loadFeiniuAlbums();
    return;
  }
  sortDeskLoading.value = true;
  try {
    const result = await getPhotoCenterItemsApi({
      page: 1,
      pageSize: 48,
      sourceType: sortSourceType.value || undefined,
    });
    sortDeskPhotos.value = result.items;
  } finally {
    sortDeskLoading.value = false;
  }
}

function toggleSortPhoto(photoId: string) {
  const selected = sortSelectedSet.value;
  sortSelectedPhotoIds.value = selected.has(photoId)
    ? sortSelectedPhotoIds.value.filter((item) => item !== photoId)
    : [...sortSelectedPhotoIds.value, photoId];
}

function toggleSortSourceAlbum(albumId: string) {
  const selected = sortSelectedSourceAlbumSet.value;
  sortSelectedSourceAlbumIds.value = selected.has(albumId)
    ? sortSelectedSourceAlbumIds.value.filter((item) => item !== albumId)
    : [...sortSelectedSourceAlbumIds.value, albumId];
  sortSelectedPhotoIds.value = [...sortSelectedSourceAlbumIds.value];
}

function selectAllSortPhotos() {
  if (isFeiniuSortMode.value) {
    sortSelectedSourceAlbumIds.value = feiniuAlbums.value.map((album) => album.albumId);
    sortSelectedPhotoIds.value = [...sortSelectedSourceAlbumIds.value];
    return;
  }
  sortSelectedPhotoIds.value = sortDeskPhotos.value.map((photo) => photo.photoId);
}

function clearSortSelection() {
  sortSelectedPhotoIds.value = [];
  sortSelectedSourceAlbumIds.value = [];
}

async function openCreateAlbumFromSortDesk() {
  sortDeskVisible.value = false;
  await openCreateAlbumModal();
}

async function submitSortDesk() {
  if (!sortTargetAlbumId.value) {
    message.warning('请选择目标播放相册');
    return;
  }
  if (sortSelectedCount.value === 0) {
    message.warning('请选择要分拣的照片');
    return;
  }

  sortDeskSubmitting.value = true;
  try {
    const result = await addPlaybackAlbumPhotosApi(sortTargetAlbumId.value, {
      photoIds: isFeiniuSortMode.value ? [] : sortSelectedPhotoIds.value,
      sourceAlbumIds: isFeiniuSortMode.value ? sortSelectedSourceAlbumIds.value : [],
    });
    message.success(`已加入 ${result.addedPhotoCount} 张，跳过 ${result.skippedPhotoCount} 张`);
    await loadAlbums();
    await loadSortDeskPhotos();
  } finally {
    sortDeskSubmitting.value = false;
  }
}

function handleSourceAlbumChange(sourceAlbumId: unknown) {
  const resolvedSourceAlbumId = typeof sourceAlbumId === 'string' ? sourceAlbumId : '';
  const album = feiniuAlbums.value.find((item) => item.albumId === resolvedSourceAlbumId);
  createForm.sourceAlbumId = resolvedSourceAlbumId;
  createForm.sourceAlbumTitle = album?.title ?? '';
  if (!createForm.title.trim() && album?.title) {
    createForm.title = album.title;
  }
}

function handleEditSourceAlbumChange(sourceAlbumId: unknown) {
  const resolvedSourceAlbumId = typeof sourceAlbumId === 'string' ? sourceAlbumId : '';
  const album = feiniuAlbums.value.find((item) => item.albumId === resolvedSourceAlbumId);
  editForm.sourceAlbumId = resolvedSourceAlbumId;
  editForm.sourceAlbumTitle = album?.title ?? '';
  if (album?.title && !editForm.title.trim()) {
    editForm.title = album.title;
  }
}

async function openEditAlbum(record: PlaybackAlbum | Record<string, any>) {
  const album = record as PlaybackAlbum;
  editForm.description = album.description;
  editForm.aiDailyLimit = album.aiDailyLimit;
  editForm.aiEnabled = album.aiEnabled;
  editForm.aiPriorityTags = [...album.aiPriorityTags];
  editForm.aiRepeatIntervalMinutes = album.aiRepeatIntervalMinutes;
  editForm.authorizedDeviceIds = [...(album.authorizedDeviceIds ?? [])];
  editForm.playbackAlbumId = album.playbackAlbumId;
  editForm.pushBeautyScoreThreshold = album.pushBeautyScoreThreshold;
  editForm.pushEnabled = album.pushEnabled;
  editForm.pushMemoryScoreThreshold = album.pushMemoryScoreThreshold;
  editForm.pushPriorityTags = [...album.pushPriorityTags];
  editForm.pushScoreThreshold = album.pushScoreThreshold;
  editForm.sourceAlbumId = album.sourceAlbumId;
  editForm.sourceAlbumTitle = album.sourceAlbumTitle;
  editForm.sourceType = album.sourceType;
  editForm.title = album.title;
  editModalVisible.value = true;
  await Promise.all([loadFeiniuAlbums(), loadDevices()]);
}

async function submitEditAlbum() {
  if (!editForm.playbackAlbumId || !editForm.title.trim()) {
    message.warning('请填写播放相册名称');
    return;
  }
  editSubmitting.value = true;
  try {
    const updated = await updatePlaybackAlbumApi(editForm.playbackAlbumId, {
      description: editForm.description,
      aiEnabled: editForm.aiEnabled,
      aiDailyLimit: Number(editForm.aiDailyLimit || 0),
      aiPriorityTags: editForm.aiPriorityTags,
      aiRepeatIntervalMinutes: Number(editForm.aiRepeatIntervalMinutes || 1440),
      authorizedDeviceIds: editForm.authorizedDeviceIds,
      pushBeautyScoreThreshold: Number(editForm.pushBeautyScoreThreshold || 70),
      pushEnabled: editForm.pushEnabled,
      pushMemoryScoreThreshold: Number(editForm.pushMemoryScoreThreshold || 80),
      pushPriorityTags: editForm.pushPriorityTags,
      pushScoreThreshold: Number(editForm.pushScoreThreshold || 80),
      sourceAlbumId: editForm.sourceType === 'feiniu_album' ? editForm.sourceAlbumId : '',
      sourceAlbumTitle: editForm.sourceType === 'feiniu_album' ? editForm.sourceAlbumTitle : '',
      sourceType: editForm.sourceType,
      title: editForm.title,
    });
    albums.value = albums.value.map((item) =>
      item.playbackAlbumId === updated.playbackAlbumId ? updated : item,
    );
    if (activeAlbum.value?.playbackAlbumId === updated.playbackAlbumId) {
      activeAlbum.value = updated;
    }
    message.success('播放相册已更新');
    editModalVisible.value = false;
  } finally {
    editSubmitting.value = false;
  }
}

async function deleteAlbum(record: PlaybackAlbum | Record<string, any>) {
  const album = record as PlaybackAlbum;
  await deletePlaybackAlbumApi(album.playbackAlbumId);
  albums.value = albums.value.filter((item) => item.playbackAlbumId !== album.playbackAlbumId);
  if (activeAlbum.value?.playbackAlbumId === album.playbackAlbumId) {
    activeAlbum.value = undefined;
    memberModalVisible.value = false;
    members.value = [];
  }
  message.success('已解除播放相册');
}

async function importAlbumPhotos(record: PlaybackAlbum | Record<string, any>) {
  const album = record as PlaybackAlbum;
  if (album.sourceType !== 'feiniu_album') {
    sortTargetAlbumId.value = album.playbackAlbumId;
    await openSortDesk();
    return;
  }
  albumImportingId.value = album.playbackAlbumId;
  try {
    const result = await createPlaybackAlbumScanJobApi(album.playbackAlbumId);
    message.success(
      `导入完成，转码 ${result.transcodedPhotoCount} 张，AI 生成 ${result.generatedPhotoCount} 张`,
    );
    await loadAlbums();
    if (activeAlbum.value?.playbackAlbumId === album.playbackAlbumId) {
      await reloadActiveMembers();
    }
  } finally {
    albumImportingId.value = '';
  }
}

async function submitCreateAlbum() {
  const validationError = validatePlaybackAlbumCreateForm(createForm);
  if (validationError) {
    message.warning(validationError);
    return;
  }

  createSubmitting.value = true;
  try {
    await createPlaybackAlbumApi(buildPlaybackAlbumCreateInput(createForm));
    message.success('播放相册已创建');
    createModalVisible.value = false;
    await loadAlbums();
  } finally {
    createSubmitting.value = false;
  }
}

async function openMembers(albumRecord: PlaybackAlbum | Record<string, any>) {
  const album = albumRecord as PlaybackAlbum;
  activeAlbum.value = album;
  memberModalVisible.value = true;
  selectedMemberRowKeys.value = [];
  membersLoading.value = true;
  try {
    members.value = await getPlaybackAlbumItemsApi(album.playbackAlbumId);
  } finally {
    membersLoading.value = false;
  }
}

async function reloadActiveMembers() {
  if (!activeAlbum.value) return;
  membersLoading.value = true;
  try {
    members.value = await getPlaybackAlbumItemsApi(activeAlbum.value.playbackAlbumId);
    selectedMemberRowKeys.value = selectedMemberRowKeys.value.filter((key) =>
      members.value.some((item) => memberRowKey(item) === key),
    );
  } finally {
    membersLoading.value = false;
  }
}

async function refreshAfterAiTaskChanged() {
  await Promise.all([
    loadAlbums(),
    reloadActiveMembers(),
  ]);
}

async function refreshSelectedMembersAi() {
  const photos = selectedMemberRecords.value;
  if (photos.length === 0) {
    message.warning('请先选择需要重新识别的照片');
    return;
  }
  memberBatchRefreshing.value = true;
  try {
    await Promise.all(photos.map((photo) => createPhotoAiJobApi(photo.photoId)));
    aiTaskVisible.value = true;
    message.success(`已加入 ${photos.length} 张照片的 AI 重新识别任务，可在 AI 进度中查看`);
    selectedMemberRowKeys.value = [];
  } finally {
    memberBatchRefreshing.value = false;
  }
}

async function removeMember(record: PhotoCenterItem | Record<string, any>) {
  if (!activeAlbum.value || typeof record.photoId !== 'string') return;
  memberRemovingPhotoId.value = record.photoId;
  try {
    const result = await removePlaybackAlbumPhotoApi(
      activeAlbum.value.playbackAlbumId,
      record.photoId,
    );
    message.success(`已移除 ${result.removedPhotoCount} 张本地照片`);
    await Promise.all([
      loadAlbums(),
      reloadActiveMembers(),
    ]);
  } finally {
    memberRemovingPhotoId.value = '';
  }
}

function confirmRemoveMember(record: PhotoCenterItem | Record<string, any>) {
  Modal.confirm({
    content: '原始照片不会删除，只会从当前播放相册移除。',
    okText: '确认移除',
    okType: 'danger',
    title: '从播放相册移除这张本地照片？',
    onOk: () => removeMember(record),
  });
}

async function toggleAlbumAi(
  record: PlaybackAlbum | Record<string, any>,
  checked: boolean,
) {
  const album = record as PlaybackAlbum;
  aiTogglingAlbumId.value = album.playbackAlbumId;
  try {
    await updatePlaybackAlbumAiPolicyApi(album.playbackAlbumId, {
      aiEnabled: checked,
    });
    message.success(checked ? 'AI 策略已开启' : 'AI 策略已关闭');
    await loadAlbums();
    if (activeAlbum.value?.playbackAlbumId === album.playbackAlbumId) {
      await reloadActiveMembers();
    }
  } finally {
    aiTogglingAlbumId.value = '';
  }
}

async function updateAlbumPolicy(
  record: PlaybackAlbum | Record<string, any>,
  input: {
    aiDailyLimit?: number;
    aiRepeatIntervalMinutes?: number;
    pushBeautyScoreThreshold?: number;
    pushMemoryScoreThreshold?: number;
    pushScoreThreshold?: number;
  },
) {
  const album = record as PlaybackAlbum;
  const result = await updatePlaybackAlbumAiPolicyApi(album.playbackAlbumId, input);
  const updatedAlbum = result.album;
  albums.value = albums.value.map((item) =>
    item.playbackAlbumId === updatedAlbum.playbackAlbumId ? updatedAlbum : item,
  );
  if (activeAlbum.value?.playbackAlbumId === updatedAlbum.playbackAlbumId) {
    activeAlbum.value = updatedAlbum;
  }
  message.success('策略已更新');
}

async function generateAlbumAi(record: PlaybackAlbum | Record<string, any>) {
  const album = record as PlaybackAlbum;
  aiGeneratingAlbumId.value = album.playbackAlbumId;
  try {
    await createPlaybackAlbumAiJobApi(album.playbackAlbumId);
    aiTaskVisible.value = true;
    message.success('AI 补全任务已加入队列，可在 AI 进度中查看');
  } finally {
    aiGeneratingAlbumId.value = '';
  }
}

async function scanActiveAlbumNow() {
  if (!activeAlbum.value) return;
  memberScanningAlbumId.value = activeAlbum.value.playbackAlbumId;
  try {
    const result = await createPlaybackAlbumScanJobApi(activeAlbum.value.playbackAlbumId);
    const importedText = result.importedSourcePhotoCount > 0
      ? `，导入 ${result.importedSourcePhotoCount} 张`
      : '';
    message.success(
      `扫描完成，转码 ${result.transcodedPhotoCount} 张${importedText}，AI 生成 ${result.generatedPhotoCount} 张，跳过 ${result.skippedPhotoCount} 张`,
    );
    await Promise.all([
      loadAlbums(),
      reloadActiveMembers(),
    ]);
  } finally {
    memberScanningAlbumId.value = '';
  }
}

async function refreshMemberAi(record: PhotoCenterItem | Record<string, any>) {
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

function goToPhotoCenter() {
  void router.push('/photo-library/photos');
}

function albumRowKey(record: PlaybackAlbum) {
  return record.playbackAlbumId;
}

function memberRowKey(record: PhotoCenterItem) {
  return `${record.albumId}:${record.photoId}`;
}

function albumCoverUrl(record: PlaybackAlbum | Record<string, any>) {
  const coverPath = buildPlaybackAlbumCoverPath({
    coverPhotoId: typeof record.coverPhotoId === 'string' ? record.coverPhotoId : '',
  });
  return coverPath ? getPhotoAssetUrl(coverPath) : '';
}

function sourceColor(sourceType: PhotoCenterSourceType) {
  return sourceType === 'feiniu' ? 'purple' : 'blue';
}

function sourceLabel(sourceType: PhotoCenterSourceType) {
  return sourceType === 'feiniu' ? '飞牛' : '本地';
}

function albumSourceColor(sourceType: PlaybackAlbum['sourceType']) {
  return sourceType === 'feiniu_album' ? 'purple' : 'blue';
}

function albumSourceLabel(record: PlaybackAlbum | Record<string, any>) {
  if (record.sourceType === 'feiniu_album') {
    return record.sourceAlbumTitle || record.sourceAlbumId || '飞牛相册';
  }
  return '手动分拣';
}

function formatTagSummary(tags: string[] | undefined) {
  return tags?.length ? tags.join('、') : '';
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

function derivativeStatusColor(status: string) {
  if (status === 'ready') return 'success';
  if (status === 'failed') return 'error';
  if (status === 'remote_pending') return 'warning';
  return 'processing';
}

function derivativeStatusLabel(status: string) {
  if (status === 'ready') return '已转码';
  if (status === 'failed') return '失败';
  if (status === 'remote_pending') return '待下载';
  return '待转码';
}

function aiRecognitionLabel(record: PhotoCenterItem | Record<string, any>) {
  return record.aiCompleted ? '已完成' : '待补全';
}

function aiRecognitionColor(record: PhotoCenterItem | Record<string, any>) {
  return record.aiCompleted ? 'success' : 'warning';
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

function openMemberNarrationEdit(record: PhotoCenterItem | Record<string, any>) {
  const photo = record as PhotoCenterItem;
  aiNarrationEditRecord.value = photo;
  aiNarrationEditText.value = photo.aiComment || '';
  aiNarrationEditVisible.value = true;
}

async function openAiDetail(record: PhotoCenterItem | Record<string, any>) {
  const photo = record as PhotoCenterItem;
  const result = await getPhotoCenterItemsApi({
    keyword: photo.photoId,
    page: 1,
    pageSize: 1,
  });
  aiDetailRecord.value = result.items.find((item) => item.photoId === photo.photoId) ?? photo;
  aiDetailVisible.value = true;
}

async function syncAiDetail() {
  const photo = aiDetailRecord.value;
  if (!photo) return;
  aiDetailSyncing.value = true;
  try {
    aiDetailRecord.value = await syncPhotoAiDetailApi(photo.photoId);
    message.success('已从 AI 原始返回同步结构化数据');
    await reloadActiveMembers();
  } catch (error) {
    message.error(error instanceof Error ? error.message : '同步 AI 数据失败');
  } finally {
    aiDetailSyncing.value = false;
  }
}

function normalizeTagInput(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function visibleAiTags(record: PhotoCenterItem | Record<string, any>) {
  const tags = normalizeTagInput((record as PhotoCenterItem).aiTags);
  return tags.length > 6 ? tags.slice(0, 5) : tags.slice(0, 6);
}

function hiddenAiTags(record: PhotoCenterItem | Record<string, any>) {
  const tags = normalizeTagInput((record as PhotoCenterItem).aiTags);
  return tags.length > 6 ? tags.slice(5) : [];
}

function formatAiCommentPreview(value: string) {
  const text = value.trim();
  if (!text) return '点击填写旁白';
  return text
    .split(/\r?\n/)
    .flatMap((line) => {
      const chars = Array.from(line.trim());
      if (chars.length === 0) return [];
      const chunks: string[] = [];
      for (let index = 0; index < chars.length; index += 8) {
        chunks.push(chars.slice(index, index + 8).join(''));
      }
      return chunks;
    })
    .join('\n');
}

function narrationOptions(record: PhotoCenterItem | Record<string, any>) {
  return buildAiNarrationOptions(resolvedNarrationVariants(record));
}

function resolvedNarrationVariants(record: PhotoCenterItem | Record<string, any>) {
  return resolveAiNarrationVariants(record as PhotoCenterItem);
}

async function selectMemberNarration(
  record: PhotoCenterItem | Record<string, any>,
  value: unknown,
) {
  if (typeof value !== 'string') return;
  await saveMemberAiInsight(record, { aiComment: value });
}

function selectEditNarration(value: string) {
  aiNarrationEditText.value = value;
}

async function submitMemberNarrationEdit() {
  const photo = aiNarrationEditRecord.value;
  if (!photo) return;
  aiNarrationEditSaving.value = true;
  try {
    await saveMemberAiInsight(photo, {
      aiComment: aiNarrationEditText.value.trim(),
    });
    message.success('AI 旁白已修改');
    aiNarrationEditVisible.value = false;
  } finally {
    aiNarrationEditSaving.value = false;
  }
}

async function saveMemberAiInsight(
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
    members.value = members.value.map((item) =>
      item.photoId === updated.photoId ? { ...item, ...updated } : item,
    );
    if (aiDetailRecord.value?.photoId === updated.photoId) {
      aiDetailRecord.value = { ...aiDetailRecord.value, ...updated };
    }
  } finally {
    insightSavingPhotoId.value = '';
  }
}

onMounted(loadAlbums);
</script>

<template>
  <Page description="策展图包、AI 策略与 TV 展示准备" title="播放相册">
    <div class="album-metrics">
      <Card size="small">
        <span>播放相册</span>
        <strong>{{ albums.length }}</strong>
      </Card>
      <Card size="small">
        <span>已分拣照片</span>
        <strong>{{ totalPhotoCount }}</strong>
      </Card>
    </div>

    <Card>
      <div class="album-toolbar">
        <Space>
          <Button @click="aiTaskVisible = true">AI 进度</Button>
          <Button :loading="loading" @click="loadAlbums">刷新</Button>
          <Button @click="openCreateAlbumModal">新建播放相册</Button>
          <Button type="primary" @click="openSortDesk">快速分拣台</Button>
          <Button @click="goToPhotoCenter">照片列表</Button>
        </Space>
      </div>

      <Table
        :columns="compactAlbumColumns"
        :data-source="sortedAlbums"
        :loading="loading"
        :pagination="false"
        :row-key="albumRowKey"
        size="middle"
      >
        <template #emptyText>
          <Empty description="暂无播放相册">
            <Button type="primary" @click="goToPhotoCenter">
              去照片列表分拣
            </Button>
          </Empty>
        </template>

        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'coverPhotoId'">
            <img
              v-if="record.coverPhotoId"
              :alt="record.title"
              class="album-cover"
              loading="lazy"
              :src="albumCoverUrl(record)"
            />
            <div v-else class="album-cover album-cover-empty">无</div>
          </template>

          <template v-else-if="column.key === 'title'">
            <div class="album-title-cell">
              <strong>{{ record.title }}</strong>
              <span v-if="record.description">{{ record.description }}</span>
              <span>{{ record.playbackAlbumId }}</span>
            </div>
          </template>

          <template v-else-if="column.key === 'sourceType'">
            <div class="policy-cell">
              <Tag :color="albumSourceColor(record.sourceType)">
                {{ record.sourceType === 'feiniu_album' ? '飞牛相册' : '手动' }}
              </Tag>
              <span>{{ albumSourceLabel(record) }}</span>
            </div>
          </template>

          <template v-else-if="column.key === 'aiPolicy'">
            <div class="policy-cell">
              <Space size="small">
                <Switch
                  :checked="record.aiEnabled"
                  :loading="aiTogglingAlbumId === record.playbackAlbumId"
                  @change="(checked) => toggleAlbumAi(record, Boolean(checked))"
                />
                <Button
                  :disabled="!record.aiEnabled"
                  :loading="aiGeneratingAlbumId === record.playbackAlbumId"
                  size="small"
                  type="link"
                  @click="generateAlbumAi(record)"
                >
                  补全 AI
                </Button>
              </Space>
              <Space size="small">
                <span>检测间隔</span>
                <InputNumber
                  :min="5"
                  size="small"
                  :value="record.aiRepeatIntervalMinutes"
                  @change="(value) => updateAlbumPolicy(record, { aiRepeatIntervalMinutes: Number(value ?? record.aiRepeatIntervalMinutes) })"
                />
                <span>分钟</span>
              </Space>
              <Space size="small">
                <span>每日最多</span>
                <InputNumber
                  :min="0"
                  size="small"
                  :value="record.aiDailyLimit"
                  @change="(value) => updateAlbumPolicy(record, { aiDailyLimit: Number(value ?? 0) })"
                />
                <span>张</span>
              </Space>
              <span>
                今日 {{ record.aiDailyProcessedOn || '-' }} 已识别 {{ record.aiDailyProcessedCount }} 张
              </span>
              <span v-if="formatTagSummary(record.aiPriorityTags)">
                {{ formatTagSummary(record.aiPriorityTags) }}
              </span>
            </div>
          </template>

          <template v-else-if="column.key === 'pushPolicy'">
            <div class="policy-cell">
              <Tag :color="record.pushEnabled ? 'processing' : 'default'">
                {{ record.pushEnabled ? '推送' : '暂停' }}
              </Tag>
              <Space size="small">
                <span>回忆相关度</span>
                <InputNumber
                  :max="100"
                  :min="0"
                  size="small"
                  :value="record.pushMemoryScoreThreshold"
                  @change="(value) => updateAlbumPolicy(record, { pushMemoryScoreThreshold: Number(value ?? record.pushMemoryScoreThreshold) })"
                />
              </Space>
              <Space size="small">
                <span>美学水平</span>
                <InputNumber
                  :max="100"
                  :min="0"
                  size="small"
                  :value="record.pushBeautyScoreThreshold"
                  @change="(value) => updateAlbumPolicy(record, { pushBeautyScoreThreshold: Number(value ?? record.pushBeautyScoreThreshold) })"
                />
              </Space>
              <span v-if="formatTagSummary(record.pushPriorityTags)">
                {{ formatTagSummary(record.pushPriorityTags) }}
              </span>
            </div>
          </template>

          <template v-else-if="column.key === 'photoCount'">
            <Tag color="blue">
              {{ formatPlaybackAlbumPhotoCount(record.photoCount) }}
            </Tag>
          </template>

          <template v-else-if="column.key === 'updatedAt'">
            {{ record.updatedAt || '-' }}
          </template>

          <template v-else-if="column.key === 'actions'">
            <Dropdown :trigger="['click']">
              <Button size="small">操作</Button>
              <template #overlay>
                <Menu>
                  <Menu.Item key="photos" @click="openMembers(record)">
                    查看照片
                  </Menu.Item>
                  <Menu.Item key="edit" @click="openEditAlbum(record)">
                    编辑
                  </Menu.Item>
                  <Menu.Item
                    key="import"
                    :disabled="albumImportingId === record.playbackAlbumId"
                    @click="importAlbumPhotos(record)"
                  >
                    导入新照片
                  </Menu.Item>
                  <Menu.Item key="delete" danger @click="deleteAlbum(record)">
                    解除相册
                  </Menu.Item>
                </Menu>
              </template>
            </Dropdown>
            <Space class="legacy-row-actions">
              <Button size="small" type="link" @click="openMembers(record)">
                查看照片
              </Button>
              <Button size="small" type="link" @click="openEditAlbum(record)">
                编辑
              </Button>
              <Button
                size="small"
                type="link"
                :loading="albumImportingId === record.playbackAlbumId"
                @click="importAlbumPhotos(record)"
              >
                导入新照片
              </Button>
              <Popconfirm
                title="解除这个播放相册？原始照片不会删除。"
                @confirm="deleteAlbum(record)"
              >
                <Button danger size="small" type="link">解除</Button>
              </Popconfirm>
            </Space>
          </template>
        </template>
      </Table>
    </Card>

    <Modal
      v-model:open="createModalVisible"
      :confirm-loading="createSubmitting"
      title="新建播放相册"
      width="680px"
      @ok="submitCreateAlbum"
    >
      <div class="create-form">
        <label>
          <span>来源</span>
          <Select
            v-model:value="createForm.sourceType"
            :options="sourceTypeOptions"
          />
        </label>

        <label v-if="createForm.sourceType === 'feiniu_album'">
          <span>飞牛相册</span>
          <Select
            :loading="feiniuAlbumsLoading"
            placeholder="选择飞牛相册"
            :options="feiniuAlbumOptions"
            :value="createForm.sourceAlbumId"
            @change="handleSourceAlbumChange"
          />
        </label>

        <label>
          <span>名称</span>
          <Input v-model:value="createForm.title" placeholder="播放相册名称" />
        </label>

        <label>
          <span>说明</span>
          <Input v-model:value="createForm.description" placeholder="可选" />
        </label>

        <div class="policy-grid">
          <label>
            <span>AI 扫描评分</span>
            <Switch v-model:checked="createForm.aiEnabled" />
          </label>
          <label>
            <span>AI 检测间隔（分钟）</span>
            <InputNumber
              v-model:value="createForm.aiRepeatIntervalMinutes"
              :min="5"
              style="width: 100%"
            />
          </label>
          <label>
            <span>每日最大识别数量（0 使用系统默认）</span>
            <InputNumber
              v-model:value="createForm.aiDailyLimit"
              :min="0"
              style="width: 100%"
            />
          </label>
          <label>
            <span>AI 优先类型</span>
            <Select
              v-model:value="createForm.aiPriorityTags"
              mode="multiple"
              :options="playbackAlbumPriorityTagOptions"
              placeholder="人物、开心、场景等"
            />
          </label>
        </div>

        <div class="policy-grid">
          <label>
            <span>允许推送</span>
            <Switch v-model:checked="createForm.pushEnabled" />
          </label>
          <label>
            <span>回忆相关度</span>
            <InputNumber
              v-model:value="createForm.pushMemoryScoreThreshold"
              :max="100"
              :min="0"
              style="width: 100%"
            />
          </label>
          <label>
            <span>美学水平</span>
            <InputNumber
              v-model:value="createForm.pushBeautyScoreThreshold"
              :max="100"
              :min="0"
              style="width: 100%"
            />
          </label>
          <label>
            <span>优先推送类型</span>
            <Select
              v-model:value="createForm.pushPriorityTags"
              mode="multiple"
              :options="playbackAlbumPriorityTagOptions"
              placeholder="人物、开心、场景等"
            />
          </label>
        </div>
      </div>
    </Modal>

    <Modal
      v-model:open="editModalVisible"
      :confirm-loading="editSubmitting"
      title="编辑播放相册"
      width="680px"
      @ok="submitEditAlbum"
    >
      <div class="create-form">
        <label>
          <span>名称</span>
          <Input v-model:value="editForm.title" placeholder="播放相册名称" />
        </label>

        <label>
          <span>说明</span>
          <Input v-model:value="editForm.description" placeholder="可选" />
        </label>

        <label>
          <span>来源</span>
          <Select
            v-model:value="editForm.sourceType"
            :options="sourceTypeOptions"
          />
        </label>

        <label v-if="editForm.sourceType === 'feiniu_album'">
          <span>飞牛相册</span>
          <Select
            :loading="feiniuAlbumsLoading"
            placeholder="选择飞牛相册"
            :options="feiniuAlbumOptions"
            :value="editForm.sourceAlbumId"
            @change="handleEditSourceAlbumChange"
          />
        </label>

        <label>
          <span>每日最大识别数量（0 使用系统默认）</span>
          <InputNumber
            v-model:value="editForm.aiDailyLimit"
            :min="0"
            style="width: 100%"
          />
        </label>

        <div class="edit-section">
          <strong>AI 识别</strong>
          <div class="policy-grid">
            <label>
              <span>启用识别</span>
              <Switch v-model:checked="editForm.aiEnabled" />
            </label>
            <label>
              <span>检测间隔（分钟）</span>
              <InputNumber
                v-model:value="editForm.aiRepeatIntervalMinutes"
                :min="5"
                style="width: 100%"
              />
            </label>
            <label>
              <span>AI 优先类型</span>
              <Select
                v-model:value="editForm.aiPriorityTags"
                mode="multiple"
                :options="playbackAlbumPriorityTagOptions"
                placeholder="人物、开心、场景"
              />
            </label>
          </div>
        </div>

        <div class="edit-section">
          <strong>推送要求</strong>
          <div class="policy-grid">
            <label>
              <span>允许推送</span>
              <Switch v-model:checked="editForm.pushEnabled" />
            </label>
            <label>
              <span>回忆相关度</span>
              <InputNumber
                v-model:value="editForm.pushMemoryScoreThreshold"
                :max="100"
                :min="0"
                style="width: 100%"
              />
            </label>
            <label>
              <span>美学水平</span>
              <InputNumber
                v-model:value="editForm.pushBeautyScoreThreshold"
                :max="100"
                :min="0"
                style="width: 100%"
              />
            </label>
            <label>
              <span>优先推送类型</span>
              <Select
                v-model:value="editForm.pushPriorityTags"
                mode="multiple"
                :options="playbackAlbumPriorityTagOptions"
                placeholder="人物、开心、场景"
              />
            </label>
          </div>
        </div>

        <div class="edit-section">
          <strong>设备授权</strong>
          <label>
            <span>可观看设备</span>
            <Select
              v-model:value="editForm.authorizedDeviceIds"
              :loading="devicesLoading"
              mode="multiple"
              :options="deviceOptions"
              placeholder="选择授权给这台电视可见的相册"
            />
          </label>
        </div>
      </div>
    </Modal>

    <Modal
      v-model:open="sortDeskVisible"
      :footer="null"
      title="播放相册快速分拣台"
      width="1080px"
    >
      <div class="sort-desk" :class="{ 'feiniu-mode': isFeiniuSortMode }">
        <section class="sort-panel">
          <div class="sort-panel-head">
            <strong>照片池</strong>
            <Tag>{{ sortDeskPhotos.length }} 张</Tag>
          </div>
          <div class="sort-filters">
            <Select
              v-model:value="sortSourceType"
              :options="sortSourceOptions"
              style="width: 140px"
              @change="loadSortDeskPhotos"
            />
            <Button size="small" @click="selectAllSortPhotos">全选</Button>
            <Button
              size="small"
              :disabled="sortSelectedPhotoIds.length === 0"
              @click="clearSortSelection"
            >
              取消
            </Button>
            <span v-if="sortSelectedPhotoIds.length">
              已选 {{ sortSelectedPhotoIds.length }} 张
            </span>
          </div>

          <div class="sort-source-album-grid">
            <button
              v-for="album in feiniuAlbums"
              :key="album.albumId"
              class="sort-source-album-card"
              :class="{ selected: sortSelectedSourceAlbumSet.has(album.albumId) }"
              type="button"
              @click="toggleSortSourceAlbum(album.albumId)"
            >
              <img
                v-if="album.thumbnailUrl || album.coverImageUrl"
                :alt="album.title"
                loading="lazy"
                :src="getPhotoAssetUrl(album.thumbnailUrl || album.coverImageUrl)"
              />
              <span v-else class="sort-album-card-empty">无封面</span>
              <strong>{{ album.title }}</strong>
              <small>{{ album.photoCount }} 张 / {{ album.updatedAt || album.latestTakenAt || '-' }}</small>
            </button>
            <Empty
              v-if="!feiniuAlbumsLoading && feiniuAlbums.length === 0"
              description="暂无飞牛相册"
            />
          </div>

          <div class="sort-grid" :class="{ loading: sortDeskLoading }">
            <button
              v-for="photo in sortDeskPhotos"
              :key="photo.photoId"
              class="sort-thumb"
              :class="{ selected: sortSelectedSet.has(photo.photoId) }"
              type="button"
              @click="toggleSortPhoto(photo.photoId)"
            >
              <img
                :alt="photo.filename"
                loading="lazy"
                :src="getPhotoAssetUrl(photo.thumbnailUrl)"
              />
              <span>{{ photo.captionTitle || photo.filename }}</span>
            </button>
            <Empty v-if="!sortDeskLoading && sortDeskPhotos.length === 0" description="暂无照片" />
          </div>
        </section>

        <section class="sort-panel sort-target-panel">
          <div class="sort-panel-head">
            <strong>目标播放相册</strong>
            <Tag>{{ sortedAlbums.length }} 个</Tag>
          </div>
          <Select
            class="sort-target-select"
            v-model:value="sortTargetAlbumId"
            :options="sortTargetOptions"
            placeholder="选择目标播放相册"
          />
          <div class="sort-album-card-list">
            <button
              v-for="album in sortedAlbums"
              :key="album.playbackAlbumId"
              class="sort-album-card"
              :class="{ selected: sortTargetAlbumId === album.playbackAlbumId }"
              type="button"
              @click="sortTargetAlbumId = album.playbackAlbumId"
            >
              <img
                v-if="album.coverPhotoId"
                :alt="album.title"
                loading="lazy"
                :src="albumCoverUrl(album)"
              />
              <span v-else class="sort-album-card-empty">无封面</span>
              <strong>{{ album.title }}</strong>
              <small>{{ album.photoCount }} 张 / {{ albumSourceLabel(album) }}</small>
            </button>
          </div>
          <Button
            block
            type="primary"
            :disabled="sortSelectedPhotoIds.length === 0 || !sortTargetAlbumId"
            :loading="sortDeskSubmitting"
            @click="submitSortDesk"
          >
            移入播放相册
          </Button>
          <Button block @click="openCreateAlbumFromSortDesk">新建播放相册</Button>
        </section>
      </div>
    </Modal>

    <Modal
      v-model:open="memberModalVisible"
      :footer="null"
      width="1040px"
    >
      <template #title>
        <div class="member-modal-title">
          <span>{{ activeAlbum?.title || '播放相册照片' }}</span>
          <Space size="small">
            <Button
              v-if="selectedMemberCount > 0"
              size="small"
              :loading="memberBatchRefreshing"
              type="primary"
              @click.stop="refreshSelectedMembersAi"
            >
              重新识别选中 {{ selectedMemberCount }} 张
            </Button>
            <Button
              size="small"
              type="primary"
              :disabled="!activeAlbum"
              :loading="memberScanningAlbumId === activeAlbum?.playbackAlbumId"
              @click.stop="scanActiveAlbumNow"
            >
              立即扫描图片
            </Button>
          </Space>
        </div>
      </template>

      <Table
        :columns="memberColumns"
        :data-source="members"
        :loading="membersLoading"
        :pagination="{ pageSize: 8, showSizeChanger: false }"
        :row-key="memberRowKey"
        :row-selection="memberRowSelection"
        size="small"
      >
        <template #emptyText>
          <Empty description="暂无照片" />
        </template>

        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'thumbnailUrl'">
            <img
              :alt="record.filename"
              class="member-thumb"
              loading="lazy"
              :src="getPhotoAssetUrl(record.thumbnailUrl)"
            />
          </template>

          <template v-else-if="column.key === 'filename'">
            <div class="member-file-cell">
              <strong>{{ record.captionTitle || record.filename }}</strong>
              <span>{{ record.filename }}</span>
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
                      @change="(value) => saveMemberAiInsight(record, { aiMemoryScore: typeof value === 'number' ? value : null })"
                    />
                  </label>
                  <label>
                    <span>美学水平</span>
                    <InputNumber
                      :max="100"
                      :min="0"
                      size="small"
                      :value="record.aiBeautyScore"
                      @change="(value) => saveMemberAiInsight(record, { aiBeautyScore: typeof value === 'number' ? value : null })"
                    />
                  </label>
                  <label>
                    <span>AI 旁白</span>
                    <TextArea
                      :auto-size="{ minRows: 2, maxRows: 4 }"
                      :value="record.aiComment"
                      @input="(event) => updateInlineAiComment(record, event)"
                      @blur="(event) => saveMemberAiInsight(record, { aiComment: eventInputValue(event) })"
                    />
                    <Select
                      v-if="resolvedNarrationVariants(record).length > 1"
                      :options="narrationOptions(record)"
                      placeholder="选择其他识别旁白"
                      size="small"
                      style="margin-top: 6px; width: 100%"
                      @change="(value) => selectMemberNarration(record, value)"
                    />
                  </label>
                  <label>
                    <span>类型</span>
                    <Select
                      mode="tags"
                      size="small"
                      :value="record.aiTags"
                      @change="(value) => saveMemberAiInsight(record, { aiTags: normalizeTagInput(value) })"
                    />
                  </label>
                </div>
              </template>
              <Tag class="clickable-tag" :color="aiRecognitionColor(record)">
                {{ insightSavingPhotoId === record.photoId ? '保存中' : aiRecognitionLabel(record) }}
              </Tag>
            </Popover>
          </template>

          <template v-else-if="column.key === 'aiTags'">
            <div class="tag-cell">
              <Tag v-for="tag in visibleAiTags(record)" :key="tag" color="blue">
                {{ tag }}
              </Tag>
              <Popover
                v-if="hiddenAiTags(record).length > 0"
                placement="leftTop"
                trigger="click"
              >
                <template #content>
                  <div class="tag-cell tag-cell-expanded">
                    <Tag
                      v-for="tag in record.aiTags"
                      :key="tag"
                      color="blue"
                    >
                      {{ tag }}
                    </Tag>
                  </div>
                </template>
                <Tag class="tag-more" color="blue">
                  ...
                </Tag>
              </Popover>
              <span v-if="record.aiTags.length === 0">-</span>
            </div>
          </template>

          <template v-else-if="column.key === 'aiComment'">
            <span
              class="ai-comment-ready ai-comment-editable"
              role="button"
              tabindex="0"
              @click="openMemberNarrationEdit(record)"
              @keydown.enter="openMemberNarrationEdit(record)"
            >
              {{ formatAiCommentPreview(record.aiComment) }}
            </span>
          </template>

          <template v-else-if="column.key === 'actions'">
            <Dropdown :trigger="['click']">
              <Button
                size="small"
                :loading="
                  aiRefreshingPhotoId === record.photoId ||
                  memberRemovingPhotoId === record.photoId
                "
              >
                操作
              </Button>
              <template #overlay>
                <Menu>
                  <Menu.Item key="refresh-ai" @click="refreshMemberAi(record)">
                    重新识别
                  </Menu.Item>
                  <Menu.Item key="ai-detail" @click="openAiDetail(record)">
                    AI 详情
                  </Menu.Item>
                  <Menu.Item
                    v-if="record.removable"
                    key="remove"
                    danger
                    @click="confirmRemoveMember(record)"
                  >
                    移除
                  </Menu.Item>
                </Menu>
              </template>
            </Dropdown>
          </template>
        </template>
      </Table>
    </Modal>

    <Modal
      v-model:open="aiNarrationEditVisible"
      :confirm-loading="aiNarrationEditSaving"
      ok-text="确认修改"
      title="快速修改 AI 旁白"
      width="640px"
      @ok="submitMemberNarrationEdit"
    >
      <Space v-if="aiNarrationEditRecord" direction="vertical" size="middle" style="width: 100%">
        <TextArea
          v-model:value="aiNarrationEditText"
          :auto-size="{ minRows: 4, maxRows: 8 }"
          placeholder="输入当前播放使用的一条旁白"
        />
        <div
          v-if="resolvedNarrationVariants(aiNarrationEditRecord).length > 0"
          class="ai-narration-options"
        >
          <strong>从已识别旁白中选择（确认后会覆盖当前手工旁白）</strong>
          <Button
            v-for="(variant, index) in resolvedNarrationVariants(aiNarrationEditRecord)"
            :key="index"
            block
            size="small"
            style="height: auto; margin-top: 8px; white-space: pre-line; text-align: left"
            @click="selectEditNarration(formatAiNarrationVariant(variant))"
          >
            {{ index + 1 }}. {{ formatAiNarrationVariant(variant) }}
          </Button>
        </div>
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
            @click="saveMemberAiInsight(aiDetailRecord, { aiComment: formatAiNarrationVariant(variant) })"
          >
            {{ index + 1 }}. {{ formatAiNarrationVariant(variant) }}
          </Button>
        </div>
        <pre class="ai-detail-raw">{{ aiDetailRecord.aiDetail || aiDetailRecord.aiReason || '暂无 AI 原始返回' }}</pre>
      </div>
    </Modal>
    <AiTaskProgressModal
      v-model:visible="aiTaskVisible"
      @changed="refreshAfterAiTaskChanged"
    />
  </Page>
</template>

<style scoped>
.album-metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 180px));
  gap: 12px;
  margin-bottom: 16px;
}

.album-metrics :deep(.ant-card-body) {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 14px;
}

.album-metrics span {
  color: #64748b;
  font-size: 12px;
}

.album-metrics strong {
  font-size: 22px;
  line-height: 1.2;
}

.album-toolbar {
  display: flex;
  justify-content: flex-end;
  padding-bottom: 16px;
}

.album-cover,
.member-thumb {
  object-fit: cover;
  border-radius: 6px;
  background: #f1f5f9;
}

.album-cover {
  width: 64px;
  height: 48px;
}

.album-cover-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #94a3b8;
  font-size: 12px;
}

.create-form {
  display: grid;
  gap: 14px;
}

.create-form label {
  display: grid;
  gap: 6px;
}

.create-form label > span {
  color: #475569;
  font-size: 12px;
  font-weight: 600;
}

.policy-grid {
  display: grid;
  grid-template-columns: 120px 120px minmax(0, 1fr);
  gap: 12px;
}

.edit-section {
  display: grid;
  gap: 10px;
  padding: 12px;
  border: 1px solid rgb(148 163 184 / 22%);
  border-radius: 8px;
}

.legacy-row-actions {
  display: none;
}

.policy-cell > :deep(.ant-space:not(:first-child)),
.policy-cell > span {
  display: none;
}

.sort-desk {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 280px;
  gap: 16px;
}

.sort-panel {
  min-width: 0;
  padding: 14px;
  border: 1px solid rgb(148 163 184 / 22%);
  border-radius: 8px;
  background: #020817;
}

.sort-target-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.sort-panel-head,
.sort-filters {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sort-panel-head {
  justify-content: space-between;
  margin-bottom: 12px;
}

.sort-filters {
  flex-wrap: wrap;
  margin-bottom: 12px;
}

.sort-filters span {
  color: #64748b;
  font-size: 12px;
}

.sort-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(118px, 1fr));
  gap: 10px;
  align-content: start;
  min-height: 360px;
  max-height: 560px;
  overflow: auto;
  opacity: 1;
}

.sort-source-album-grid {
  display: none;
}

.sort-desk.feiniu-mode .sort-source-album-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(152px, 1fr));
  gap: 12px;
  align-content: start;
  min-height: 360px;
  max-height: 560px;
  overflow: auto;
}

.sort-desk.feiniu-mode .sort-grid {
  display: none;
}

.sort-grid.loading {
  opacity: 0.62;
}

.sort-thumb {
  display: grid;
  gap: 6px;
  width: 100%;
  min-height: 128px;
  padding: 6px;
  text-align: left;
  cursor: pointer;
  color: #dbeafe;
  background: #0f172a;
  border: 1px solid rgb(148 163 184 / 22%);
  border-radius: 8px;
}

.sort-thumb.selected {
  background: #0b2a5f;
  border-color: #2563eb;
  box-shadow: 0 0 0 2px rgb(37 99 235 / 14%);
}

.sort-source-album-card {
  display: grid;
  gap: 8px;
  width: 100%;
  padding: 8px;
  color: #dbeafe;
  text-align: left;
  cursor: pointer;
  background: #0f172a;
  border: 1px solid rgb(148 163 184 / 22%);
  border-radius: 8px;
}

.sort-source-album-card.selected {
  background: #0b2a5f;
  border-color: #2563eb;
  box-shadow: 0 0 0 2px rgb(37 99 235 / 14%);
}

.sort-source-album-card img {
  width: 100%;
  height: 92px;
  object-fit: cover;
  border-radius: 6px;
}

.sort-source-album-card strong,
.sort-source-album-card small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sort-source-album-card small {
  color: #8aa4c7;
}

.sort-thumb img {
  width: 100%;
  aspect-ratio: 4 / 3;
  object-fit: cover;
  border-radius: 6px;
  background: #e2e8f0;
}

.sort-thumb span {
  overflow: hidden;
  color: #bfdbfe;
  font-size: 12px;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sort-target-select {
  display: none;
}

.sort-album-card-list {
  display: grid;
  gap: 10px;
  max-height: 430px;
  overflow: auto;
}

.sort-album-card {
  display: grid;
  grid-template-columns: 56px minmax(0, 1fr);
  gap: 4px 10px;
  align-items: center;
  width: 100%;
  padding: 8px;
  text-align: left;
  cursor: pointer;
  color: #dbeafe;
  background: #0f172a;
  border: 1px solid rgb(148 163 184 / 22%);
  border-radius: 8px;
}

.sort-album-card.selected {
  border-color: #1677ff;
  box-shadow: 0 0 0 2px rgb(22 119 255 / 18%);
}

.sort-album-card img,
.sort-album-card-empty {
  grid-row: span 2;
  width: 56px;
  height: 42px;
  object-fit: cover;
  border-radius: 6px;
  background: #1e293b;
}

.sort-album-card-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #94a3b8;
  font-size: 12px;
}

.sort-album-card strong,
.sort-album-card small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sort-album-card small {
  color: #94a3b8;
}

.member-thumb {
  width: 64px;
  height: 64px;
  object-fit: contain;
  background: #0f172a;
  border: 1px solid rgb(148 163 184 / 24%);
  border-radius: 8px;
}

.member-modal-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-right: 28px;
}

.album-title-cell,
.member-file-cell,
.policy-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.album-title-cell span,
.member-file-cell span,
.policy-cell span {
  color: #64748b;
  font-size: 12px;
}

.clickable-tag {
  cursor: pointer;
}

.tag-cell {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 4px 6px;
  width: 140px;
  height: 70px;
  min-width: 0;
  overflow: hidden;
  align-content: start;
}

.tag-cell :deep(.ant-tag) {
  overflow: hidden;
  width: 100%;
  max-width: 67px;
  margin-inline-end: 0;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tag-cell-expanded {
  height: auto;
  width: 240px;
  overflow: visible;
}

.tag-cell-expanded :deep(.ant-tag) {
  max-width: 114px;
}

.tag-more {
  cursor: pointer;
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
  line-height: 1.45;
  white-space: pre-line;
}

.ai-comment-editable {
  cursor: pointer;
}

.ai-comment-editable:hover {
  color: #0958d9;
  text-decoration: underline;
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

.ai-detail-raw {
  overflow: auto;
  max-height: 360px;
  padding: 12px;
  border: 1px solid #1e293b;
  border-radius: 6px;
  background: #020617;
  color: #dbeafe;
  white-space: pre-wrap;
}
</style>
