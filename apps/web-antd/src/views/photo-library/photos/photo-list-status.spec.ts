import { describe, expect, it } from 'vitest';

import {
  buildPhotoReadinessSummary,
  formatBackfillJobFeedback,
  isPhotoReadyForPlayback,
} from './photo-list-status';

describe('photo list status helpers', () => {
  it('marks a photo ready only when derivatives and both AI outputs are completed', () => {
    expect(
      isPhotoReadyForPlayback({
        aiCommentStatus: 'completed',
        aiScoreStatus: 'completed',
        derivativeStatus: 'ready',
      }),
    ).toBe(true);

    expect(
      isPhotoReadyForPlayback({
        aiCommentStatus: 'pending',
        aiScoreStatus: 'completed',
        derivativeStatus: 'ready',
      }),
    ).toBe(false);
  });

  it('summarizes the current page readiness for operator scanning', () => {
    expect(
      buildPhotoReadinessSummary([
        {
          aiCommentStatus: 'completed',
          aiScoreStatus: 'completed',
          derivativeStatus: 'ready',
        },
        {
          aiCommentStatus: 'pending',
          aiScoreStatus: 'pending',
          derivativeStatus: 'pending',
        },
        {
          aiCommentStatus: 'failed',
          aiScoreStatus: 'completed',
          derivativeStatus: 'ready',
        },
      ]),
    ).toEqual({
      failedCount: 1,
      pendingCount: 1,
      readyCount: 1,
      totalCount: 3,
    });
  });

  it('formats backfill feedback with requested, completed, skipped and failed counts', () => {
    expect(
      formatBackfillJobFeedback({
        failedPhotoCount: 1,
        generatedPhotoCount: 8,
        jobId: 'backfill_001',
        requestedPhotoCount: 10,
        skippedPhotoCount: 1,
        transcodedPhotoCount: 7,
      }),
    ).toBe('补齐任务 backfill_001 已完成：请求 10 张，转码 7 张，AI 生成 8 张，跳过 1 张，失败 1 张');
  });
});
