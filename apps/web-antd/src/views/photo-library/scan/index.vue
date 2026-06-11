<script lang="ts" setup>
import type { PhotoLibraryOverview } from '#/api/photo-library';

import { computed, onMounted, ref } from 'vue';

import { Page } from '@vben/common-ui';

import {
  Button,
  Card,
  Descriptions,
  DescriptionsItem,
  Empty,
  message,
  Space,
  Statistic,
  Tag,
} from 'ant-design-vue';

import {
  createPhotoScanJobApi,
  getPhotoLibraryOverviewApi,
} from '#/api/photo-library';

const loading = ref(false);
const scanLoading = ref(false);
const overview = ref<PhotoLibraryOverview>();
const lastScanJob = computed(() => overview.value?.lastScanJob);

async function loadOverview() {
  loading.value = true;
  try {
    overview.value = await getPhotoLibraryOverviewApi();
  } finally {
    loading.value = false;
  }
}

async function startScan() {
  scanLoading.value = true;
  try {
    const scanJob = await createPhotoScanJobApi({
      photoRoot: overview.value?.photoRoot,
    });
    message.success(`扫描完成：发现 ${scanJob.discoveredPhotoCount} 张照片`);
    await loadOverview();
  } finally {
    scanLoading.value = false;
  }
}

onMounted(loadOverview);
</script>

<template>
  <Page description="本地照片目录索引任务" title="照片扫描">
    <Space class="mb-4" wrap>
      <Button :loading="loading" @click="loadOverview">刷新</Button>
      <Button :loading="scanLoading" type="primary" @click="startScan">
        开始扫描
      </Button>
    </Space>

    <div v-if="overview" class="scan-grid">
      <Card :loading="loading" title="照片库">
        <div class="stats-grid">
          <Statistic title="相册" :value="overview.albumCount" suffix="个" />
          <Statistic title="照片" :value="overview.photoCount" suffix="张" />
          <Statistic title="数据版本" :value="overview.migrationVersion" prefix="v" />
        </div>
      </Card>

      <Card :loading="loading" title="存储位置">
        <Descriptions :column="1" size="small" bordered>
          <DescriptionsItem label="照片目录">
            {{ overview.photoRoot }}
          </DescriptionsItem>
          <DescriptionsItem label="SQLite 数据库">
            {{ overview.databasePath }}
          </DescriptionsItem>
        </Descriptions>
      </Card>

      <Card :loading="loading || scanLoading" title="最近扫描">
        <Descriptions v-if="lastScanJob" :column="1" size="small" bordered>
          <DescriptionsItem label="任务编号">
            {{ lastScanJob.jobId }}
          </DescriptionsItem>
          <DescriptionsItem label="状态">
            <Tag color="success">{{ lastScanJob.status }}</Tag>
          </DescriptionsItem>
          <DescriptionsItem label="发现照片">
            {{ lastScanJob.discoveredPhotoCount }} 张
          </DescriptionsItem>
          <DescriptionsItem label="导入照片">
            {{ lastScanJob.importedPhotoCount }} 张
          </DescriptionsItem>
          <DescriptionsItem label="完成时间">
            {{ lastScanJob.finishedAt }}
          </DescriptionsItem>
        </Descriptions>
        <Empty v-else description="暂无扫描记录" />
      </Card>
    </div>

    <Card v-else :loading="loading">
      <Empty description="暂无照片库状态" />
    </Card>
  </Page>
</template>

<style scoped>
.scan-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}

@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }
}
</style>
