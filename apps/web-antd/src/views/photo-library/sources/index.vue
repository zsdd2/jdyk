<script lang="ts" setup>
import type {
  FeiniuConnectivityResult,
  FeiniuPhotoSyncJob,
  PhotoSourceConfig,
} from '#/api/photo-library';

import { computed, onMounted, ref } from 'vue';

import { Page } from '@vben/common-ui';

import {
  Button,
  Card,
  Checkbox,
  Descriptions,
  DescriptionsItem,
  Input,
  message,
  Space,
  Tag,
} from 'ant-design-vue';

import {
  createFeiniuPhotoSyncJobApi,
  getPhotoSourceConfigApi,
  testFeiniuConnectivityApi,
  updateFeiniuSettingsApi,
} from '#/api/photo-library';

const loading = ref(false);
const saveLoading = ref(false);
const syncLoading = ref(false);
const testLoading = ref(false);
const sourceConfig = ref<PhotoSourceConfig>();
const connectivityResult = ref<FeiniuConnectivityResult>();
const syncResult = ref<FeiniuPhotoSyncJob>();
const feiniuForm = ref({
  baseUrl: '',
  password: '',
  useConfiguredPassword: true,
  username: '',
});

const sourceLabel = computed(() => {
  const activeSourceId = sourceConfig.value?.activeSourceId;
  if (activeSourceId === 'mixed') return '本地 + 飞牛';
  if (activeSourceId === 'feiniu') return '飞牛相册';
  if (activeSourceId === 'sqlite') return '本地照片';
  return '未连接';
});

const feiniuMissingText = computed(() =>
  sourceConfig.value?.feiniu.missingFields.length
    ? sourceConfig.value.feiniu.missingFields.join('、')
    : '无',
);

async function loadConfig() {
  loading.value = true;
  try {
    sourceConfig.value = await getPhotoSourceConfigApi();
    feiniuForm.value.baseUrl = sourceConfig.value.feiniu.baseUrl ?? '';
    feiniuForm.value.username = sourceConfig.value.feiniu.username ?? '';
    feiniuForm.value.password = '';
    feiniuForm.value.useConfiguredPassword =
      sourceConfig.value.feiniu.passwordConfigured;
  } finally {
    loading.value = false;
  }
}

async function saveFeiniuSettings() {
  saveLoading.value = true;
  try {
    await updateFeiniuSettingsApi({
      baseUrl: feiniuForm.value.baseUrl,
      keepPassword: feiniuForm.value.useConfiguredPassword,
      password: feiniuForm.value.password,
      username: feiniuForm.value.username,
    });
    message.success('飞牛配置已保存');
    await loadConfig();
  } finally {
    saveLoading.value = false;
  }
}

async function testFeiniu() {
  testLoading.value = true;
  try {
    connectivityResult.value = await testFeiniuConnectivityApi(feiniuForm.value);
    if (connectivityResult.value.ok) {
      message.success(
        `飞牛连接成功：共 ${connectivityResult.value.totalAlbumCount ?? 0} 个相册`,
      );
    } else {
      message.warning('飞牛连接未通过');
    }
  } finally {
    testLoading.value = false;
  }
}

async function syncFeiniuAlbums() {
  syncLoading.value = true;
  try {
    syncResult.value = await createFeiniuPhotoSyncJobApi();
    if (syncResult.value.status === 'completed') {
      message.success(
        `飞牛相册清单同步完成：${syncResult.value.albumCount} 个相册`,
      );
    } else {
      message.warning('飞牛相册清单同步失败');
    }
  } finally {
    syncLoading.value = false;
  }
}

onMounted(loadConfig);
</script>

<template>
  <Page description="照片源状态与飞牛连通性" title="照片源配置">
    <Space class="mb-4" wrap>
      <Button :loading="loading" @click="loadConfig">刷新</Button>
      <Tag color="processing">{{ sourceLabel }}</Tag>
    </Space>

    <div class="source-grid">
      <Card :loading="loading" title="当前来源">
        <Descriptions :column="1" size="small" bordered>
          <DescriptionsItem label="TV 图包来源">
            <Tag color="blue">{{ sourceLabel }}</Tag>
          </DescriptionsItem>
          <DescriptionsItem label="本地照片">
            {{ sourceConfig?.local.albumCount ?? 0 }} 个相册 /
            {{ sourceConfig?.local.photoCount ?? 0 }} 张
          </DescriptionsItem>
          <DescriptionsItem label="飞牛相册">
            <Tag :color="sourceConfig?.feiniu.enabled ? 'success' : 'warning'">
              {{ sourceConfig?.feiniu.enabled ? '已配置' : '未完整配置' }}
            </Tag>
          </DescriptionsItem>
          <DescriptionsItem label="飞牛地址">
            {{ sourceConfig?.feiniu.baseUrl || '未配置' }}
          </DescriptionsItem>
          <DescriptionsItem label="飞牛账号">
            {{ sourceConfig?.feiniu.username || '未配置' }}
          </DescriptionsItem>
          <DescriptionsItem label="飞牛密码">
            {{
              sourceConfig?.feiniu.passwordConfigured
                ? '已配置，不显示明文'
                : '未配置'
            }}
          </DescriptionsItem>
          <DescriptionsItem label="缺少配置">
            {{ feiniuMissingText }}
          </DescriptionsItem>
        </Descriptions>
      </Card>

      <Card title="飞牛连通性检测">
        <Space class="feiniu-form" direction="vertical" size="middle">
          <Input
            v-model:value="feiniuForm.baseUrl"
            placeholder="飞牛 NAS 地址"
          />
          <Input v-model:value="feiniuForm.username" placeholder="飞牛账号" />
          <Input
            v-model:value="feiniuForm.password"
            placeholder="飞牛密码；留空可使用后端已配置密码"
            type="password"
          />
          <Checkbox v-model:checked="feiniuForm.useConfiguredPassword">
            密码留空时使用后端环境变量中的飞牛密码
          </Checkbox>
          <Button
            :loading="saveLoading"
            type="primary"
            @click="saveFeiniuSettings"
          >
            保存配置
          </Button>
          <Button :loading="testLoading" type="primary" @click="testFeiniu">
            检测连接
          </Button>
        </Space>

        <Descriptions
          v-if="connectivityResult"
          class="mt-4"
          :column="1"
          size="small"
          bordered
        >
          <DescriptionsItem label="检测结果">
            <Tag :color="connectivityResult.ok ? 'success' : 'error'">
              {{ connectivityResult.ok ? '通过' : '未通过' }}
            </Tag>
          </DescriptionsItem>
          <DescriptionsItem label="普通相册">
            {{ connectivityResult.albumCount ?? 0 }} 个
          </DescriptionsItem>
          <DescriptionsItem label="共享给我">
            {{ connectivityResult.sharedToMeCount ?? 0 }} 个
          </DescriptionsItem>
          <DescriptionsItem label="我共享的">
            {{ connectivityResult.sharedByMeCount ?? 0 }} 个
          </DescriptionsItem>
          <DescriptionsItem label="错误信息" v-if="connectivityResult.error">
            {{ connectivityResult.error }}
          </DescriptionsItem>
          <DescriptionsItem
            label="缺少配置"
            v-if="connectivityResult.missingFields?.length"
          >
            {{ connectivityResult.missingFields.join('、') }}
          </DescriptionsItem>
        </Descriptions>
      </Card>

      <Card title="飞牛相册同步">
        <Space class="feiniu-form" direction="vertical" size="middle">
          <Button
            :disabled="!sourceConfig?.feiniu.enabled"
            :loading="syncLoading"
            type="primary"
            @click="syncFeiniuAlbums"
          >
            同步飞牛相册清单
          </Button>
          <span class="sync-hint">
            当前只读取飞牛相册清单，不全量读取相册内照片。
          </span>
        </Space>

        <Descriptions
          v-if="syncResult"
          class="mt-4"
          :column="1"
          size="small"
          bordered
        >
          <DescriptionsItem label="同步状态">
            <Tag :color="syncResult.status === 'completed' ? 'success' : 'error'">
              {{ syncResult.status === 'completed' ? '完成' : '失败' }}
            </Tag>
          </DescriptionsItem>
          <DescriptionsItem label="相册">
            {{ syncResult.albumCount }} 个
          </DescriptionsItem>
          <DescriptionsItem label="同步时间">
            {{ syncResult.syncedAt }}
          </DescriptionsItem>
          <DescriptionsItem label="错误信息" v-if="syncResult.error">
            {{ syncResult.error }}
          </DescriptionsItem>
        </Descriptions>
      </Card>
    </div>
  </Page>
</template>

<style scoped>
.source-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
}

.feiniu-form {
  width: min(100%, 640px);
}

.sync-hint {
  color: hsl(var(--muted-foreground));
  font-size: 12px;
}
</style>
