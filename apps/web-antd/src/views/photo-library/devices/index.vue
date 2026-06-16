<script lang="ts" setup>
import type { PlaybackAlbum, TvDevice } from '#/api/photo-library';

import { computed, onMounted, reactive, ref } from 'vue';

import { Page } from '@vben/common-ui';

import { Button, Card, Input, message, Modal, Select, Switch, Table, Tag } from 'ant-design-vue';

import {
  getPlaybackAlbumsApi,
  getTvDevicesApi,
  updateTvDeviceApi,
} from '#/api/photo-library';

import { getDeviceAlbumAuthorizationSummary } from '../playback-albums/playback-album-view';

const loading = ref(false);
const saving = ref(false);
const modalVisible = ref(false);
const devices = ref<TvDevice[]>([]);
const albums = ref<PlaybackAlbum[]>([]);
const activeDevice = ref<TvDevice>();
const form = reactive({
  authorizedPlaybackAlbumIds: [] as string[],
  deviceName: '',
  enabled: true,
  groupName: '',
});

const albumOptions = computed(() =>
  albums.value.map((album) => ({
    label: `${album.title} / ${album.photoCount} 张`,
    value: album.playbackAlbumId,
  })),
);
const enabledDeviceCount = computed(() =>
  devices.value.filter((device) => device.enabled).length,
);
const allAlbumPolicyDeviceCount = computed(
  () =>
    devices.value.filter(
      (device) => device.enabled && device.authorizedPlaybackAlbumIds.length === 0,
    ).length,
);

const columns = [
  { dataIndex: 'deviceName', key: 'deviceName', title: '设备' },
  { dataIndex: 'groupName', key: 'groupName', title: '分组', width: 140 },
  { dataIndex: 'enabled', key: 'enabled', title: '状态', width: 100 },
  { dataIndex: 'authorizedPlaybackAlbumIds', key: 'albums', title: '授权相册', width: 240 },
  { dataIndex: 'lastLoginAt', key: 'lastLoginAt', title: '最后登录', width: 200 },
  { dataIndex: 'actions', key: 'actions', title: '操作', width: 100 },
];

async function loadData() {
  loading.value = true;
  try {
    const [deviceItems, albumItems] = await Promise.all([
      getTvDevicesApi(),
      getPlaybackAlbumsApi(),
    ]);
    devices.value = deviceItems;
    albums.value = albumItems;
  } finally {
    loading.value = false;
  }
}

function openEdit(record: TvDevice | Record<string, any>) {
  const device = record as TvDevice;
  activeDevice.value = device;
  form.deviceName = device.deviceName;
  form.groupName = device.groupName;
  form.enabled = device.enabled;
  form.authorizedPlaybackAlbumIds = [...device.authorizedPlaybackAlbumIds];
  modalVisible.value = true;
}

async function submitEdit() {
  if (!activeDevice.value) return;
  saving.value = true;
  try {
    const updated = await updateTvDeviceApi(activeDevice.value.deviceId, {
      authorizedPlaybackAlbumIds: form.authorizedPlaybackAlbumIds,
      deviceName: form.deviceName,
      enabled: form.enabled,
      groupName: form.groupName,
    });
    devices.value = devices.value.map((device) =>
      device.deviceId === updated.deviceId ? updated : device,
    );
    message.success('设备授权已更新');
    modalVisible.value = false;
  } finally {
    saving.value = false;
  }
}

function rowKey(record: TvDevice) {
  return record.deviceId;
}

function albumAuthorizationSummary(record: TvDevice | Record<string, any>) {
  return getDeviceAlbumAuthorizationSummary(record as TvDevice, albums.value);
}

onMounted(loadData);
</script>

<template>
  <Page description="管理 TV 设备分组和播放相册授权" title="设备中心">
    <div class="device-metrics">
      <Card size="small">
        <span>设备</span>
        <strong>{{ devices.length }}</strong>
      </Card>
      <Card size="small">
        <span>启用设备</span>
        <strong>{{ enabledDeviceCount }}</strong>
      </Card>
      <Card size="small">
        <span>全部相册权限</span>
        <strong>{{ allAlbumPolicyDeviceCount }}</strong>
      </Card>
    </div>

    <Card>
      <div class="device-toolbar">
        <Button :loading="loading" @click="loadData">刷新</Button>
      </div>

      <Table
        :columns="columns"
        :data-source="devices"
        :loading="loading"
        :pagination="false"
        :row-key="rowKey"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'deviceName'">
            <div class="device-main">
              <strong>{{ record.deviceName }}</strong>
              <span>{{ record.deviceUniqueId }}</span>
              <span>{{ record.platform }} {{ record.appVersion }}</span>
            </div>
          </template>

          <template v-else-if="column.key === 'groupName'">
            {{ record.groupName || '未分组' }}
          </template>

          <template v-else-if="column.key === 'enabled'">
            <Tag :color="record.enabled ? 'success' : 'default'">
              {{ record.enabled ? '启用' : '停用' }}
            </Tag>
          </template>

          <template v-else-if="column.key === 'albums'">
            <div class="album-auth-cell">
              <Tag :color="albumAuthorizationSummary(record).color">
                {{ albumAuthorizationSummary(record).label }}
              </Tag>
              <span>{{ albumAuthorizationSummary(record).description }}</span>
            </div>
          </template>

          <template v-else-if="column.key === 'lastLoginAt'">
            {{ record.lastLoginAt || '-' }}
          </template>

          <template v-else-if="column.key === 'actions'">
            <Button size="small" type="link" @click="openEdit(record)">编辑</Button>
          </template>
        </template>
      </Table>
    </Card>

    <Modal
      v-model:open="modalVisible"
      :confirm-loading="saving"
      title="编辑设备"
      width="640px"
      @ok="submitEdit"
    >
      <div class="device-form">
        <div class="device-form-row device-name-row">
          <label>
            <span>设备名称</span>
            <Input v-model:value="form.deviceName" />
          </label>
          <label class="device-enabled-field">
            <span>启用</span>
            <Switch v-model:checked="form.enabled" />
          </label>
        </div>
        <label>
          <span>分组</span>
          <Input v-model:value="form.groupName" placeholder="客厅、卧室、父母家" />
        </label>
        <label>
          <span>可观看播放相册</span>
          <Select
            v-model:value="form.authorizedPlaybackAlbumIds"
            mode="multiple"
            :options="albumOptions"
            placeholder="不选择时默认可观看全部播放相册"
          />
        </label>
      </div>
    </Modal>
  </Page>
</template>

<style scoped>
.device-metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 180px));
  gap: 12px;
  margin-bottom: 16px;
}

.device-metrics :deep(.ant-card-body) {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 14px;
}

.device-metrics span {
  color: #64748b;
  font-size: 12px;
}

.device-metrics strong {
  font-size: 22px;
  line-height: 1.2;
}

.device-toolbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 16px;
}

.device-main,
.device-form,
.device-form label {
  display: grid;
  gap: 6px;
}

.album-auth-cell {
  display: grid;
  gap: 4px;
}

.album-auth-cell span {
  overflow: hidden;
  color: #64748b;
  font-size: 12px;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.device-form-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 96px;
  gap: 12px;
  align-items: end;
}

.device-enabled-field {
  align-content: end;
}

.device-enabled-field :deep(.ant-switch) {
  width: fit-content;
  min-width: 44px;
}

.device-main span,
.device-form label > span {
  color: #64748b;
  font-size: 12px;
}
</style>
