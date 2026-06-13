<script lang="ts" setup>
import type { TvReleaseInfo } from '#/api/photo-library';
import type { UploadFile } from 'ant-design-vue';

import { computed, onMounted, reactive, ref } from 'vue';

import { Page } from '@vben/common-ui';

import {
  Button,
  Card,
  Descriptions,
  Form,
  Input,
  InputNumber,
  message,
  Switch,
  Table,
  Tag,
  Upload,
} from 'ant-design-vue';

import {
  getTvReleaseInfoApi,
  uploadTvReleasePackageApi,
} from '#/api/photo-library';

const loading = ref(false);
const uploading = ref(false);
const releaseInfo = ref<TvReleaseInfo>();
const fileList = ref<UploadFile[]>([]);
const form = reactive({
  forceUpdate: false,
  releaseNotes: '',
  versionCode: undefined as number | undefined,
  versionName: '',
});

const manifest = computed(() => releaseInfo.value?.manifest);
const releaseVersions = computed(() => releaseInfo.value?.versions ?? []);
const releaseColumns = [
  { dataIndex: 'versionName', key: 'versionName', title: '版本号', width: 140 },
  { dataIndex: 'versionCode', key: 'versionCode', title: '版本码', width: 100 },
  { dataIndex: 'forceUpdate', key: 'forceUpdate', title: '强制更新', width: 110 },
  { dataIndex: 'fileExists', key: 'fileExists', title: '文件状态', width: 110 },
  { dataIndex: 'sizeBytes', key: 'sizeBytes', title: '文件大小', width: 110 },
  { dataIndex: 'publishedAt', key: 'publishedAt', title: '发布时间', width: 190 },
  { dataIndex: 'fileName', key: 'fileName', title: 'APK 文件', width: 220 },
  { dataIndex: 'sha256', key: 'sha256', title: 'SHA256', width: 320 },
];

async function loadReleaseInfo() {
  loading.value = true;
  try {
    releaseInfo.value = await getTvReleaseInfoApi();
  } finally {
    loading.value = false;
  }
}

function beforeUpload(file: UploadFile) {
  if (!file.name?.toLowerCase().endsWith('.apk')) {
    message.error('请选择 APK 安装包');
    return Upload.LIST_IGNORE;
  }
  fileList.value = [file];
  return false;
}

async function uploadRelease() {
  const file = fileList.value[0] as (UploadFile & { originFileObj?: File }) | undefined;
  const apkFile = file?.originFileObj ?? (file as unknown as File | undefined);
  if (!form.versionName.trim()) {
    message.warning('请填写版本号，例如 1.0.2');
    return;
  }
  if (!form.versionCode || form.versionCode <= 0) {
    message.warning('请填写大于 0 的 versionCode');
    return;
  }
  if (!apkFile) {
    message.warning('请选择 APK 安装包');
    return;
  }

  uploading.value = true;
  try {
    releaseInfo.value = await uploadTvReleasePackageApi({
      file: apkFile,
      forceUpdate: form.forceUpdate,
      releaseNotes: form.releaseNotes.trim(),
      versionCode: form.versionCode,
      versionName: form.versionName.trim(),
    });
    fileList.value = [];
    message.success('TV 升级包已上传并设为最新版本');
  } finally {
    uploading.value = false;
  }
}

function formatSize(value?: number) {
  if (!value) return '-';
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(2)} MB`;
}

function formatTableValue(record: Record<string, unknown>, dataIndex: unknown) {
  if (typeof dataIndex !== 'string') return '-';
  const value = record[dataIndex];
  return value === undefined || value === null || value === '' ? '-' : String(value);
}

onMounted(loadReleaseInfo);
</script>

<template>
  <Page
    description="上传 TV APK 并生成设备远程升级 manifest，电视端会从当前后台地址下载最新包"
    title="TV 版本管理"
  >
    <div class="tv-release-page">
      <Card title="当前发布状态">
        <template #extra>
          <Button :loading="loading" @click="loadReleaseInfo">刷新</Button>
        </template>

        <Descriptions bordered :column="2" size="small">
          <Descriptions.Item label="当前版本">
            {{ manifest?.versionName || '-' }}
          </Descriptions.Item>
          <Descriptions.Item label="versionCode">
            {{ manifest?.versionCode || '-' }}
          </Descriptions.Item>
          <Descriptions.Item label="APK 文件">
            <Tag :color="releaseInfo?.fileExists ? 'success' : 'error'">
              {{ releaseInfo?.fileExists ? '文件存在' : '文件缺失' }}
            </Tag>
            <span>{{ releaseInfo?.fileName || '-' }}</span>
          </Descriptions.Item>
          <Descriptions.Item label="文件大小">
            {{ formatSize(manifest?.sizeBytes) }}
          </Descriptions.Item>
          <Descriptions.Item label="下载地址" :span="2">
            {{ manifest?.apkUrl || '-' }}
          </Descriptions.Item>
          <Descriptions.Item label="SHA256" :span="2">
            {{ manifest?.sha256 || '-' }}
          </Descriptions.Item>
          <Descriptions.Item label="发布时间">
            {{ manifest?.publishedAt || '-' }}
          </Descriptions.Item>
          <Descriptions.Item label="强制更新">
            {{ manifest?.forceUpdate ? '是' : '否' }}
          </Descriptions.Item>
          <Descriptions.Item label="发布目录" :span="2">
            {{ releaseInfo?.releasesDirectory || '-' }}
          </Descriptions.Item>
          <Descriptions.Item label="更新说明" :span="2">
            {{ manifest?.releaseNotes || '-' }}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title="已上传版本">
        <Table
          :columns="releaseColumns"
          :data-source="releaseVersions"
          :loading="loading"
          :pagination="false"
          :row-key="(record) => record.fileName"
          :scroll="{ x: 1300 }"
          size="small"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'versionName'">
              <span>{{ record.versionName || '-' }}</span>
              <Tag v-if="record.isLatest" class="latest-tag" color="blue">
                最新
              </Tag>
            </template>
            <template v-else-if="column.key === 'forceUpdate'">
              <Tag :color="record.forceUpdate ? 'red' : 'default'">
                {{ record.forceUpdate ? '开启' : '关闭' }}
              </Tag>
            </template>
            <template v-else-if="column.key === 'fileExists'">
              <Tag :color="record.fileExists ? 'success' : 'error'">
                {{ record.fileExists ? '存在' : '缺失' }}
              </Tag>
            </template>
            <template v-else-if="column.key === 'sizeBytes'">
              {{ formatSize(record.sizeBytes) }}
            </template>
            <template v-else-if="column.key === 'sha256'">
              <span class="sha-text">{{ record.sha256 || '-' }}</span>
            </template>
            <template v-else>
              {{ formatTableValue(record, column.dataIndex) }}
            </template>
          </template>
        </Table>
      </Card>

      <Card title="上传新版本">
        <Form layout="vertical">
          <Form.Item label="版本号 versionName" required>
            <Input v-model:value="form.versionName" placeholder="例如 1.0.2" />
          </Form.Item>
          <Form.Item label="版本码 versionCode" required>
            <InputNumber
              v-model:value="form.versionCode"
              :min="1"
              :precision="0"
              class="version-code-input"
              placeholder="必须大于当前电视端 versionCode"
            />
          </Form.Item>
          <Form.Item label="强制更新">
            <div class="force-update-row">
              <Switch
                v-model:checked="form.forceUpdate"
                checked-children="开启"
                un-checked-children="关闭"
              />
              <Tag :color="form.forceUpdate ? 'red' : 'default'">
                {{ form.forceUpdate ? '已开启' : '已关闭' }}
              </Tag>
            </div>
          </Form.Item>
          <Form.Item label="更新说明">
            <Input.TextArea
              v-model:value="form.releaseNotes"
              :rows="4"
              placeholder="本次更新内容，会显示在 TV 更新提示里"
            />
          </Form.Item>
          <Form.Item label="APK 安装包" required>
            <Upload
              v-model:file-list="fileList"
              accept=".apk"
              :before-upload="beforeUpload"
              :max-count="1"
            >
              <Button>选择 APK</Button>
            </Upload>
          </Form.Item>
          <Button type="primary" :loading="uploading" @click="uploadRelease">
            上传并设为最新版本
          </Button>
        </Form>
      </Card>
    </div>
  </Page>
</template>

<style scoped>
.tv-release-page {
  display: grid;
  gap: 16px;
}

.version-code-input {
  width: 260px;
}

.force-update-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.latest-tag {
  margin-left: 8px;
}

.sha-text {
  display: inline-block;
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  vertical-align: bottom;
  white-space: nowrap;
}
</style>
