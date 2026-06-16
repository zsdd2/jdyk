<script lang="ts" setup>
import type {
  AiRecognitionTaskProgress,
  AiRecognitionTaskStatus,
} from '#/api/photo-library';
import type { AiTaskFilter } from './ai-task-progress';

import { computed, onBeforeUnmount, ref, watch } from 'vue';

import {
  Alert,
  Button,
  Empty,
  message,
  Modal,
  Progress,
  Space,
  Table,
  Tag,
  Tooltip,
} from 'ant-design-vue';

import {
  clearAiRecognitionTasksApi,
  getAiRecognitionTasksApi,
} from '#/api/photo-library';

import {
  filterAiTasks,
  formatAiTaskTimestamp,
  getAiTaskProgressPercent,
  getAiTaskTypeLabel,
  isRecoveredInterruptedAiTask,
  isRunningAiTask,
  summarizeAiTasks,
} from './ai-task-progress';

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
const activeFilter = ref<AiTaskFilter>('all');
let pollTimer: ReturnType<typeof setInterval> | undefined;
let lastProgressSignature = '';

const columns = [
  { dataIndex: 'status', key: 'status', title: '状态', width: 96 },
  { dataIndex: 'targetTitle', key: 'targetTitle', title: '任务', width: 260 },
  { dataIndex: 'progress', key: 'progress', title: '进度', width: 190 },
  {
    dataIndex: 'activePhotoName',
    key: 'activePhotoName',
    title: '当前照片',
    width: 190,
  },
  { dataIndex: 'error', key: 'error', title: '失败原因', width: 300 },
  {
    dataIndex: 'lastUpdatedAt',
    key: 'lastUpdatedAt',
    title: '更新时间',
    width: 180,
  },
];

const taskSummary = computed(() => summarizeAiTasks(tasks.value));
const filteredTasks = computed(() => filterAiTasks(tasks.value, activeFilter.value));

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
  return getAiTaskTypeLabel(task);
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

function taskRowClassName(record: AiRecognitionTaskProgress) {
  return isRecoveredInterruptedAiTask(record) ? 'task-row-recovered' : '';
}

function filterLabel(filter: AiTaskFilter) {
  if (filter === 'running') return '进行中';
  if (filter === 'failed') return '失败';
  if (filter === 'recovered') return '重启恢复';
  return '全部';
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
    width="1240px"
    @cancel="close"
  >
    <div class="ai-task-toolbar">
      <div class="task-summary">
        <div class="task-summary-item">
          <span>全部</span>
          <strong>{{ taskSummary.totalCount }}</strong>
        </div>
        <div class="task-summary-item running">
          <span>进行中</span>
          <strong>{{ taskSummary.runningCount }}</strong>
        </div>
        <div class="task-summary-item completed">
          <span>已完成</span>
          <strong>{{ taskSummary.completedCount }}</strong>
        </div>
        <div class="task-summary-item failed">
          <span>失败</span>
          <strong>{{ taskSummary.failedCount }}</strong>
        </div>
        <div class="task-summary-item recovered">
          <span>重启恢复</span>
          <strong>{{ taskSummary.recoveredInterruptedCount }}</strong>
        </div>
      </div>
      <Space class="task-actions">
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
    <div class="task-filter-bar">
      <Button
        :type="activeFilter === 'all' ? 'primary' : 'default'"
        size="small"
        @click="activeFilter = 'all'"
      >
        全部 {{ taskSummary.totalCount }}
      </Button>
      <Button
        :type="activeFilter === 'running' ? 'primary' : 'default'"
        size="small"
        @click="activeFilter = 'running'"
      >
        进行中 {{ taskSummary.runningCount }}
      </Button>
      <Button
        :type="activeFilter === 'failed' ? 'primary' : 'default'"
        size="small"
        @click="activeFilter = 'failed'"
      >
        失败 {{ taskSummary.failedCount }}
      </Button>
      <Button
        :type="activeFilter === 'recovered' ? 'primary' : 'default'"
        size="small"
        @click="activeFilter = 'recovered'"
      >
        重启恢复 {{ taskSummary.recoveredInterruptedCount }}
      </Button>
    </div>
    <Alert
      v-if="taskSummary.recoveredInterruptedCount > 0"
      class="task-recovery-alert"
      show-icon
      type="warning"
      :message="`后端重启中断了 ${taskSummary.recoveredInterruptedCount} 个 AI 任务，已标记为失败，可重新触发对应照片或相册识别。`"
    />
    <Table
      v-if="filteredTasks.length > 0"
      :columns="columns"
      :data-source="filteredTasks"
      :loading="loading"
      :pagination="{ pageSize: 8 }"
      :row-class-name="taskRowClassName"
      :scroll="{ x: 1236 }"
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
            :percent="getAiTaskProgressPercent(asTask(record))"
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
          <span v-if="isRunningAiTask(asTask(record).status)">
            {{ asTask(record).activePhotoName || asTask(record).activePhotoId || '-' }}
          </span>
          <span v-else class="task-muted">-</span>
        </template>
        <template v-else-if="column.key === 'error'">
          <div v-if="asTask(record).error" class="task-error-wrap">
            <Tag
              v-if="isRecoveredInterruptedAiTask(asTask(record))"
              color="orange"
            >
              重启中断
            </Tag>
            <Tooltip :title="asTask(record).error">
              <span class="task-error">{{ asTask(record).error }}</span>
            </Tooltip>
          </div>
          <span v-else class="task-muted">-</span>
        </template>
        <template v-else-if="column.key === 'lastUpdatedAt'">
          <div class="task-time">
            <strong>
              {{ formatAiTaskTimestamp(asTask(record).lastUpdatedAt || asTask(record).createdAt) }}
            </strong>
            <span v-if="asTask(record).finishedAt">
              完成 {{ formatAiTaskTimestamp(asTask(record).finishedAt) }}
            </span>
          </div>
        </template>
      </template>
    </Table>
    <Empty v-else :description="`暂无${filterLabel(activeFilter)} AI 识别任务`" />
  </Modal>
</template>

<style scoped>
.ai-task-toolbar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 16px;
  margin-bottom: 12px;
}

.task-summary {
  display: grid;
  flex: 1;
  grid-template-columns: repeat(5, minmax(92px, 1fr));
  gap: 8px;
}

.task-summary-item {
  border: 1px solid rgb(148 163 184 / 28%);
  border-radius: 6px;
  padding: 8px 10px;
  background: rgb(148 163 184 / 8%);
}

.task-summary-item span {
  display: block;
  color: #64748b;
  font-size: 12px;
  line-height: 18px;
}

.task-summary-item strong {
  color: currentcolor;
  font-size: 20px;
  line-height: 24px;
}

.task-summary-item.running {
  border-color: rgb(64 150 255 / 55%);
  background: rgb(64 150 255 / 12%);
}

.task-summary-item.completed {
  border-color: rgb(82 196 26 / 55%);
  background: rgb(82 196 26 / 12%);
}

.task-summary-item.failed {
  border-color: rgb(255 77 79 / 55%);
  background: rgb(255 77 79 / 12%);
}

.task-summary-item.recovered {
  border-color: rgb(250 173 20 / 60%);
  background: rgb(250 173 20 / 14%);
}

.task-actions {
  flex-shrink: 0;
}

.task-filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.task-recovery-alert {
  margin-bottom: 12px;
}

.task-title {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.task-title span,
.task-counts,
.task-muted,
.task-time span {
  color: #8b9bb4;
  font-size: 12px;
}

.task-time {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.task-time strong {
  white-space: nowrap;
}

.task-error {
  display: inline-block;
  max-width: 220px;
  overflow: hidden;
  color: #ff7875;
  text-overflow: ellipsis;
  vertical-align: bottom;
  white-space: nowrap;
}

.task-error-wrap {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 6px;
}

:deep(.task-row-recovered) td,
:deep(.task-row-recovered:hover) td,
:deep(.task-row-recovered .ant-table-cell-fix-left),
:deep(.task-row-recovered .ant-table-cell-fix-right) {
  background: rgb(250 173 20 / 9%);
}

@media (max-width: 900px) {
  .ai-task-toolbar {
    align-items: stretch;
    flex-direction: column;
  }

  .task-summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
