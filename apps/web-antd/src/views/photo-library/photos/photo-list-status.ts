import type { PhotoCenterAiStatus } from '#/api/photo-library';

export interface PhotoReadinessItem {
  aiCommentStatus: PhotoCenterAiStatus;
  aiScoreStatus: PhotoCenterAiStatus;
  derivativeStatus: string;
}

export interface PhotoReadinessSummary {
  failedCount: number;
  pendingCount: number;
  readyCount: number;
  totalCount: number;
}

export interface BackfillJobFeedbackItem {
  failedPhotoCount: number;
  generatedPhotoCount: number;
  jobId: string;
  requestedPhotoCount: number;
  skippedPhotoCount: number;
  transcodedPhotoCount: number;
}

export function isPhotoReadyForPlayback(photo: PhotoReadinessItem) {
  return (
    photo.derivativeStatus === 'ready' &&
    photo.aiScoreStatus === 'completed' &&
    photo.aiCommentStatus === 'completed'
  );
}

function isPhotoFailed(photo: PhotoReadinessItem) {
  return (
    photo.derivativeStatus === 'failed' ||
    photo.aiScoreStatus === 'failed' ||
    photo.aiCommentStatus === 'failed'
  );
}

export function buildPhotoReadinessSummary(
  photos: PhotoReadinessItem[],
): PhotoReadinessSummary {
  const failedCount = photos.filter(isPhotoFailed).length;
  const readyCount = photos.filter(isPhotoReadyForPlayback).length;
  return {
    failedCount,
    pendingCount: photos.length - readyCount - failedCount,
    readyCount,
    totalCount: photos.length,
  };
}

export function formatBackfillJobFeedback(job: BackfillJobFeedbackItem) {
  return `补齐任务 ${job.jobId} 已完成：请求 ${job.requestedPhotoCount} 张，转码 ${job.transcodedPhotoCount} 张，AI 生成 ${job.generatedPhotoCount} 张，跳过 ${job.skippedPhotoCount} 张，失败 ${job.failedPhotoCount} 张`;
}
