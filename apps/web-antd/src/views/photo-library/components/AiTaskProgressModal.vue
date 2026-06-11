<script lang="ts" setup>
import type {
  AiRecognitionTaskProgress,
  AiRecognitionTaskStatus,
} from '#/api/photo-library';

import { computed, onBeforeUnmount, ref, watch } from 'vue';

import {
  Button,
  Empty,
  message,
  Modal,
  Progress,
  Space,
  Table,
  Tag,
} from 'ant-design-vue';

import {
  clearAiRecognitionTasksApi,
  getAiRecognitionTasksApi,
} from '#/api/photo-library';

const props = defineProps<{
  visible: boolean;
}>();

const emit = defineEmits<{
  changed: [];
  'update:visible': [value: boolean];
}>();

const loading = ref(false);
const clearing = ref(false);
const tasks = ref<AiRecognitionTaskProgress[]>([]);
let pollTimer: ReturnType<typeof setInterval> | undefined;
let lastProgressSignature = '';

const columns = [
  { dataIndex: 'status', key: 'status', title: '状态', width: 92 },
  { dataIndex: 'targetTitle', key: 'targetTitle', title: '任务' },
  { dataIndex: 'progress', key: 'progress', title: '进度', width: 190 },
  {
    dataIndex: 'activePhotoName',
    key: 'activePhotoName',
    title: '当前照片',
    width: 190,
  },
  { dataIndex: 'error', key: 'error', title: '错误', width: 240 },
  {
    dataIndex: 'lastUpdatedAt',
    key: 'lastUpdatedAt',
    title: '更新时间',
    width: 180,
  },
];

const runningCount = computed(
  () =>
    tasks.value.filter((task) =>
      ['queued', 'retrying', 'running'].includes(task.status),
    ).length,
);

function asTask(record: Record<string, any>) {
  return record as AiRecognitionTaskProgress;
}

function statusColor(status: AiRecognitionTaskStatus) {
  if (status === 'completed') return 'green';
  if (status === 'failed') return 'red';
  if (status === 'retrying') return 'orange';
  if (status === 'running') return 'blue';
  return 'default';
}

function statusLabel(status: AiRecognitionTaskStatus) {
  if (status === 'completed') return '已完成';
  if (status === 'failed') return '失败';
  if (status === 'retrying') return '重试中';
  if (status === 'running') return '识别中';
  return '排队中';
}

function taskTypeLabel(task: AiRecognitionTaskProgress) {
  if (task.targetType === 'album') return '相册补全';
  if (task.targetType === 'retry') return '失败重试';
  return '单张刷新';
}

function progressPercent(task: AiRecognitionTaskProgress) {
  const total = Math.max(task.requestedPhotoCount, 1);
  const done =
    task.completedPhotoCount + task.failedPhotoCount + task.skippedPhotoCount;
  return Math.min(100, Math.round((done / total) * 100));
}

async function loadTasks() {
  loading.value = true;
  try {
    const nextTasks = await getAiRecognitionTasksApi();
    const nextSignature = nextTasks
      .map((task) => [
        task.jobId,
        task.status,
        task.completedPhotoCount,
        task.failedPhotoCount,
        task.skippedPhotoCount,
        task.lastUpdatedAt,
      ].join(':'))
      .join('|');
    if (lastProgressSignature && nextSignature !== lastProgressSignature) {
      emit('changed');
    }
    lastProgressSignature = nextSignature;
    tasks.value = nextTasks;
  } finally {
    loading.value = false;
  }
}

function clearTasks() {
  Modal.confirm({
    content: '清理后只会删除 AI 识别进度日志，不会删除照片、AI 结果或旁白。',
    okButtonProps: { danger: true },
    okText: '清理日志',
    title: '清理 AI 识别进度日志？',
    async onOk() {
      clearing.value = true;
      try {
        const result = await clearAiRecognitionTasksApi();
        tasks.value = [];
        lastProgressSignature = '';
        message.success(`已清理 ${result.deletedTaskCount} 条识别进度日志`);
      } finally {
        clearing.value = false;
      }
    },
  });
}

function stopPolling() {
  if (!pollTimer) return;
  clearInterval(pollTimer);
  pollTimer = undefined;
}

function startPolling() {
  stopPolling();
  void loadTasks();
  pollTimer = setInterval(() => {
    void loadTasks();
  }, 3000);
}

function close() {
  emit('update:visible', false);
}

watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      startPolling();
    } else {
      stopPolling();
    }
  },
  { immediate: true },
);

onBeforeUnmount(stopPolling);
</script>

<template>
  <Modal
    :footer="null"
    :open="visible"
    title="AI 识别进度"
    width="1120px"
    @cancel="close"
  >
    <div class="ai-task-toolbar">
      <Space>
        <Tag color="blue">进行中 {{ runningCount }}</Tag>
        <Button :loading="loading" size="small" @click="loadTasks">刷新</Button>
        <Button
          danger
          :disabled="tasks.length === 0"
          :loading="clearing"
          size="small"
          @click="clearTasks"
        >
          清理日志
        </Button>
      </Space>
    </div>
    <Table
      v-if="tasks.length > 0"
      :columns="columns"
      :data-source="tasks"
      :loading="loading"
      :pagination="{ pageSize: 8 }"
      row-key="jobId"
      size="small"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'status'">
          <Tag :color="statusColor(asTask(record).status)">
            {{ statusLabel(asTask(record).status) }}
          </Tag>
        </template>
        <template v-else-if="column.key === 'targetTitle'">
          <div class="task-title">
            <strong>{{ asTask(record).targetTitle || asTask(record).targetId }}</strong>
            <span>
              {{ taskTypeLabel(asTask(record)) }} /
              {{ asTask(record).albumTitle || asTask(record).albumId || '未关联相册' }}
            </span>
          </div>
        </template>
        <template v-else-if="column.key === 'progress'">
          <Progress
            :percent="progressPercent(asTask(record))"
            size="small"
            :status="
              asTask(record).status === 'failed'
                ? 'exception'
                : asTask(record).status === 'completed'
                  ? 'success'
                  : 'active'
            "
          />
          <div class="task-counts">
            完成 {{ asTask(record).completedPhotoCount }} / 跳过
            {{ asTask(record).skippedPhotoCount }} / 失败
            {{ asTask(record).failedPhotoCount }}
          </div>
        </template>
        <template v-else-if="column.key === 'activePhotoName'">
          {{ asTask(record).activePhotoName || asTask(record).activePhotoId || '-' }}
        </template>
        <template v-else-if="column.key === 'error'">
          <span class="task-error">{{ asTask(record).error || '-' }}</span>
        </template>
        <template v-else-if="column.key === 'lastUpdatedAt'">
          {{ asTask(record).lastUpdatedAt || asTask(record).createdAt }}
        </template>
      </template>
    </Table>
    <Empty v-else description="暂无 AI 识别任务" />
  </Modal>
</template>

<style scoped>
.ai-task-toolbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 12px;
}

.task-title {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.task-title span,
.task-counts {
  color: #8b9bb4;
  font-size: 12px;
}

.task-error {
  color: #ff7875;
}
</style>
