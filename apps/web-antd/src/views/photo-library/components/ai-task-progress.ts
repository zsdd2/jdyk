import type {
  AiRecognitionTaskProgress,
  AiRecognitionTaskStatus,
} from '#/api/photo-library';

export const restartedTaskError =
  'Backend restarted before the AI task finished. Please retry the task.';

export interface AiTaskSummary {
  completedCount: number;
  failedCount: number;
  recoveredInterruptedCount: number;
  runningCount: number;
  totalCount: number;
}

export type AiTaskFilter = 'all' | 'failed' | 'recovered' | 'running';

export function isRunningAiTask(status: AiRecognitionTaskStatus) {
  return status === 'queued' || status === 'retrying' || status === 'running';
}

export function isRecoveredInterruptedAiTask(task: AiRecognitionTaskProgress) {
  return task.status === 'failed' && task.error === restartedTaskError;
}

export function summarizeAiTasks(
  tasks: AiRecognitionTaskProgress[],
): AiTaskSummary {
  return tasks.reduce<AiTaskSummary>(
    (summary, task) => {
      summary.totalCount += 1;
      if (task.status === 'completed') summary.completedCount += 1;
      if (task.status === 'failed') summary.failedCount += 1;
      if (isRunningAiTask(task.status)) summary.runningCount += 1;
      if (isRecoveredInterruptedAiTask(task)) {
        summary.recoveredInterruptedCount += 1;
      }
      return summary;
    },
    {
      completedCount: 0,
      failedCount: 0,
      recoveredInterruptedCount: 0,
      runningCount: 0,
      totalCount: 0,
    },
  );
}

export function filterAiTasks(
  tasks: AiRecognitionTaskProgress[],
  filter: AiTaskFilter,
) {
  if (filter === 'running') {
    return tasks.filter((task) => isRunningAiTask(task.status));
  }
  if (filter === 'failed') {
    return tasks.filter((task) => task.status === 'failed');
  }
  if (filter === 'recovered') {
    return tasks.filter(isRecoveredInterruptedAiTask);
  }
  return tasks;
}

export function getAiTaskProgressPercent(task: AiRecognitionTaskProgress) {
  const total = Math.max(task.requestedPhotoCount, 1);
  const done =
    task.completedPhotoCount + task.failedPhotoCount + task.skippedPhotoCount;
  return Math.min(100, Math.round((done / total) * 100));
}

export function getAiTaskTypeLabel(task: AiRecognitionTaskProgress) {
  if (task.targetType === 'album') return '相册补全';
  if (task.targetType === 'backfill') return '照片中心补齐';
  if (task.targetType === 'retry') return '失败重试';
  return '单张刷新';
}

export function formatAiTaskTimestamp(value: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  const hour = `${date.getHours()}`.padStart(2, '0');
  const minute = `${date.getMinutes()}`.padStart(2, '0');
  return `${year}-${month}-${day} ${hour}:${minute}`;
}
