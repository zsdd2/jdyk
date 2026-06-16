import { describe, expect, it } from 'vitest';

import type { AiRecognitionTaskProgress } from '#/api/photo-library';

import {
  filterAiTasks,
  formatAiTaskTimestamp,
  getAiTaskProgressPercent,
  getAiTaskTypeLabel,
  isRecoveredInterruptedAiTask,
  summarizeAiTasks,
} from './ai-task-progress';

function task(
  patch: Partial<AiRecognitionTaskProgress>,
): AiRecognitionTaskProgress {
  return {
    activePhotoId: '',
    activePhotoName: '',
    albumId: '',
    albumTitle: '',
    completedPhotoCount: 0,
    createdAt: '2026-06-16T03:00:00.000Z',
    error: '',
    failedPhotoCount: 0,
    finishedAt: '',
    jobId: 'ai_task_test',
    lastUpdatedAt: '2026-06-16T03:00:00.000Z',
    requestedPhotoCount: 1,
    skippedPhotoCount: 0,
    status: 'queued',
    targetId: 'p_001',
    targetTitle: '_DSC6456',
    targetType: 'photo',
    ...patch,
  };
}

describe('ai task progress display helpers', () => {
  it('summarizes running, completed, failed, and restart-recovered tasks', () => {
    const summary = summarizeAiTasks([
      task({ status: 'completed' }),
      task({ status: 'running' }),
      task({ status: 'retrying' }),
      task({ status: 'failed' }),
      task({
        error: 'Backend restarted before the AI task finished. Please retry the task.',
        status: 'failed',
      }),
    ]);

    expect(summary).toEqual({
      completedCount: 1,
      failedCount: 2,
      recoveredInterruptedCount: 1,
      runningCount: 2,
      totalCount: 5,
    });
  });

  it('identifies backend restart recovery failures', () => {
    expect(
      isRecoveredInterruptedAiTask(task({
        error: 'Backend restarted before the AI task finished. Please retry the task.',
        status: 'failed',
      })),
    ).toBe(true);
    expect(
      isRecoveredInterruptedAiTask(task({
        error: 'Vision AI request failed: 401',
        status: 'failed',
      })),
    ).toBe(false);
  });

  it('formats progress and timestamps for compact table display', () => {
    expect(
      getAiTaskProgressPercent(task({
        completedPhotoCount: 3,
        failedPhotoCount: 1,
        requestedPhotoCount: 5,
        skippedPhotoCount: 1,
      })),
    ).toBe(100);
    expect(formatAiTaskTimestamp('2026-06-16T03:48:26.315Z')).toMatch(
      /^2026-06-16 \d{2}:48$/,
    );
    expect(formatAiTaskTimestamp('')).toBe('-');
  });

  it('filters tasks by operational status', () => {
    const completed = task({ jobId: 'completed', status: 'completed' });
    const running = task({ jobId: 'running', status: 'running' });
    const failed = task({ jobId: 'failed', status: 'failed' });
    const recovered = task({
      error: 'Backend restarted before the AI task finished. Please retry the task.',
      jobId: 'recovered',
      status: 'failed',
    });
    const tasks = [completed, running, failed, recovered];

    expect(filterAiTasks(tasks, 'all').map((item) => item.jobId)).toEqual([
      'completed',
      'running',
      'failed',
      'recovered',
    ]);
    expect(filterAiTasks(tasks, 'running').map((item) => item.jobId)).toEqual([
      'running',
    ]);
    expect(filterAiTasks(tasks, 'failed').map((item) => item.jobId)).toEqual([
      'failed',
      'recovered',
    ]);
    expect(filterAiTasks(tasks, 'recovered').map((item) => item.jobId)).toEqual([
      'recovered',
    ]);
  });

  it('labels backfill jobs separately from album and single-photo jobs', () => {
    expect(getAiTaskTypeLabel(task({ targetType: 'backfill' }))).toBe(
      '照片中心补齐',
    );
    expect(getAiTaskTypeLabel(task({ targetType: 'album' }))).toBe('相册补全');
    expect(getAiTaskTypeLabel(task({ targetType: 'photo' }))).toBe('单张刷新');
  });
});
