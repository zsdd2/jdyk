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

  const formData = new FormData();
  formData.append('file', apkFile);
  formData.append('versionName', form.versionName.trim());
  formData.append('versionCode', String(form.versionCode));
  formData.append('releaseNotes', form.releaseNotes.trim());
  formData.append('forceUpdate', String(form.forceUpdate));

  uploading.value = true;
  try {
    releaseInfo.value = await uploadTvReleasePackageApi(formData);
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
            <Switch v-model:checked="form.forceUpdate" />
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
</style>
