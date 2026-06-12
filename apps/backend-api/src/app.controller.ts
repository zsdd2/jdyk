import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
  StreamableFile,
  UnauthorizedException,
} from '@nestjs/common';
import { createReadStream, existsSync, statSync } from 'fs';
import { join, resolve } from 'path';
import type { Request, Response } from 'express';
import type {
  AlbumDetailResponse,
  AlbumListResponse,
  DeviceBindConfirmInput,
  DeviceBindSessionCreateInput,
  DeviceBindSessionResponse,
  DeviceLoginInput,
  DeviceLoginResponse,
  DevicePolicyResponse,
  HealthResponse,
  PlayRecordInput,
  PlayRecordResponse,
  PlaylistResponse,
} from '@wrjdyk/shared';
import { AppService } from './app.service';
import type { FeiniuConnectivityInput } from './photo-sources/feiniu/feiniu-config';
import { isPromiseLike } from './photo-sources/photo-source';
import type {
  CreatePlaybackAlbumInput,
  UpdateAiSettingsInput,
  UpdatePhotoAiCommentInput,
  UpdatePhotoAiInsightInput,
  UpdatePhotoMetadataInput,
  UpdatePlaybackAlbumInput,
  UpdatePlaybackAlbumAiPolicyInput,
  UpdateTvDeviceInput,
} from './sqlite-photo.repository';
import type {
  MaybePromise,
  PhotoAssetVariant,
  PhotoSourceAsset,
} from './photo-sources/photo-source';

function getRequestProtocol(request?: Request): string {
  const forwardedProtocol = request?.get('x-forwarded-proto')?.split(',')[0]?.trim();
  return forwardedProtocol || request?.protocol || 'http';
}

function getRequestHostname(request?: Request): string {
  const forwardedHost = request?.get('x-forwarded-host')?.split(',')[0]?.trim();
  const host = forwardedHost || request?.get('host')?.trim() || 'localhost';

  try {
    return new URL(`http://${host}`).hostname;
  } catch {
    return host.replace(/:\d+$/, '');
  }
}

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  private assertValidDeviceToken(
    deviceToken?: string,
    authorization?: string,
  ): void {
    if (!this.appService.validateDeviceToken(deviceToken, authorization)) {
      throw new UnauthorizedException('Invalid device token');
    }
  }

  @Get()
  getRoot(@Req() request?: Request) {
    const protocol = getRequestProtocol(request);
    const hostname = getRequestHostname(request);
    const adminPort = process.env.WRJDYK_ADMIN_PUBLIC_PORT?.trim() || '5200';
    return {
      adminUrl: `${protocol}://${hostname}:${adminPort}`,
      apiBaseUrl: '/api',
      healthUrl: '/api/health',
      name: 'wangri-zhongxian-backend',
      status: 'ok',
    };
  }

  @Get('health')
  getHealth(): HealthResponse {
    return this.appService.getHealth();
  }

  @Get('device/app-update/latest')
  getTvAppUpdateManifest(@Req() request?: Request) {
    const manifest = this.appService.getTvAppUpdateManifest();
    const protocol = getRequestProtocol(request);
    const hostname = getRequestHostname(request);
    const backendPort =
      process.env.WRJDYK_BACKEND_PUBLIC_PORT?.trim() || '3999';
    return {
      code: 0,
      data: {
        ...manifest,
        apkUrl:
          manifest.apkUrl ||
          `${protocol}://${hostname}:${backendPort}/releases/wangri-tv-1.0.apk`,
      },
    };
  }

  @Get('releases/:fileName')
  getReleaseApk(
    @Param('fileName') fileName: string,
    @Res({ passthrough: true }) response: Response,
  ): StreamableFile {
    if (!/^[A-Za-z0-9._-]+\.apk$/.test(fileName)) {
      throw new NotFoundException('Release not found');
    }

    const releasesDirectory = resolve(
      process.env.WRJDYK_RELEASES_DIR?.trim() || join(process.cwd(), 'releases'),
    );
    const releasePath = resolve(releasesDirectory, fileName);
    if (
      !releasePath.startsWith(`${releasesDirectory}\\`) &&
      !releasePath.startsWith(`${releasesDirectory}/`)
    ) {
      throw new NotFoundException('Release not found');
    }
    if (!existsSync(releasePath) || !statSync(releasePath).isFile()) {
      throw new NotFoundException('Release not found');
    }

    response.set({
      'Cache-Control': 'public, max-age=300',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Content-Type': 'application/vnd.android.package-archive',
    });

    return new StreamableFile(createReadStream(releasePath), {
      type: 'application/vnd.android.package-archive',
    });
  }

  @Post('auth/login')
  loginAdmin(@Body() input: DeviceLoginInput) {
    const result = this.appService.authenticateDevice(input);
    if (!result) throw new UnauthorizedException('Invalid username or password');

    return {
      code: 0,
      data: {
        accessToken: `wrjdyk_admin_${input.username.trim().toLowerCase()}`,
      },
    };
  }

  @Post('auth/refresh')
  refreshAdminToken() {
    return {
      code: 0,
      data: 'wrjdyk_admin_admin',
    };
  }

  @Post('auth/logout')
  logoutAdmin() {
    return {
      code: 0,
      data: null,
    };
  }

  @Get('auth/codes')
  getAdminAccessCodes() {
    return {
      code: 0,
      data: ['AC_100100', 'AC_100110', 'AC_100120'],
    };
  }

  @Get('user/info')
  getAdminUserInfo() {
    return {
      code: 0,
      data: {
        avatar: '',
        desc: '往日重现本地管理后台',
        homePath: '/analytics',
        realName: '往日重现管理员',
        roles: ['admin'],
        token: 'wrjdyk_admin_admin',
        userId: 'admin',
        username: 'admin',
      },
    };
  }

  @Get('menu/all')
  getAdminMenus() {
    return {
      code: 0,
      data: [
        {
          meta: {
            icon: 'lucide:layout-dashboard',
            order: -1,
            title: '仪表盘',
          },
          name: 'Dashboard',
          path: '/dashboard',
          children: [
            {
              component: '/dashboard/analytics/index',
              meta: {
                affixTab: true,
                icon: 'lucide:area-chart',
                title: '分析页',
              },
              name: 'Analytics',
              path: '/analytics',
            },
            {
              component: '/dashboard/workspace/index',
              meta: {
                icon: 'carbon:workspace',
                title: '工作台',
              },
              name: 'Workspace',
              path: '/workspace',
            },
          ],
        },
        {
          meta: {
            icon: 'lucide:images',
            order: 10,
            title: '照片中心',
          },
          name: 'PhotoLibrary',
          path: '/photo-library',
          children: [
            {
              component: '/photo-library/photos/index',
              meta: {
                affixTab: true,
                icon: 'lucide:images',
                title: '照片列表',
              },
              name: 'PhotoLibraryPhotos',
              path: '/photo-library/photos',
            },
            {
              component: '/photo-library/playback-albums/index',
              meta: {
                icon: 'lucide:folder-heart',
                title: '播放相册',
              },
              name: 'PhotoLibraryPlaybackAlbums',
              path: '/photo-library/playback-albums',
            },
            {
              component: '/photo-library/ai-settings/index',
              meta: {
                icon: 'lucide:brain-circuit',
                title: 'AI 设置',
              },
              name: 'PhotoLibraryAiSettings',
              path: '/photo-library/ai-settings',
            },
            {
              component: '/photo-library/devices/index',
              meta: {
                icon: 'lucide:monitor-check',
                title: '设备中心',
              },
              name: 'PhotoLibraryDevices',
              path: '/photo-library/devices',
            },
            {
              component: '/photo-library/scan/index',
              meta: {
                icon: 'lucide:folder-search',
                title: '照片扫描',
              },
              name: 'PhotoLibraryScan',
              path: '/photo-library/scan',
            },
            {
              component: '/photo-library/sources/index',
              meta: {
                icon: 'lucide:plug',
                title: '照片源配置',
              },
              name: 'PhotoLibrarySources',
              path: '/photo-library/sources',
            },
          ],
        },
        {
          component: '/_core/profile/index',
          meta: {
            hideInMenu: true,
            icon: 'lucide:user',
            title: '个人中心',
          },
          name: 'Profile',
          path: '/profile',
        },
      ],
    };
  }

  @Get('admin/photo-library/overview')
  getAdminPhotoLibraryOverview() {
    return {
      code: 0,
      data: this.appService.getPhotoLibraryOverview(),
    };
  }

  @Get('admin/photo-library/photos')
  getAdminPhotoCenterItems(
    @Query()
    query: {
      aiCommentStatus?: string;
      aiScoreStatus?: string;
      albumId?: string;
      keyword?: string;
      page?: string;
      pageSize?: string;
      sourceType?: string;
    } = {},
  ) {
    const data = this.appService.getPhotoCenterItems(query);
    if (isPromiseLike(data)) {
      return data.then((resolvedData) => ({
        code: 0,
        data: resolvedData,
      }));
    }
    return {
      code: 0,
      data,
    };
  }

  @Patch('admin/photo-library/photos/:photoId/ai-comment')
  updateAdminPhotoAiComment(
    @Param('photoId') photoId: string,
    @Body() input: UpdatePhotoAiCommentInput,
  ) {
    return {
      code: 0,
      data: this.appService.updatePhotoAiComment(photoId, input),
    };
  }

  @Patch('admin/photo-library/photos/:photoId/ai-insight')
  updateAdminPhotoAiInsight(
    @Param('photoId') photoId: string,
    @Body() input: UpdatePhotoAiInsightInput,
  ) {
    return {
      code: 0,
      data: this.appService.updatePhotoAiInsight(photoId, input),
    };
  }

  @Post('admin/photo-library/photos/:photoId/ai-sync')
  syncAdminPhotoAiDetail(
    @Param('photoId') photoId: string,
  ) {
    return {
      code: 0,
      data: this.appService.syncPhotoAiDetail(photoId),
    };
  }

  @Patch('admin/photo-library/photos/:photoId/metadata')
  updateAdminPhotoMetadata(
    @Param('photoId') photoId: string,
    @Body() input: UpdatePhotoMetadataInput,
  ) {
    return {
      code: 0,
      data: this.appService.updatePhotoMetadata(photoId, input),
    };
  }

  @Delete('admin/photo-library/photos/:photoId')
  trashAdminPhoto(
    @Param('photoId') photoId: string,
  ) {
    return {
      code: 0,
      data: this.appService.trashPhoto(photoId),
    };
  }

  @Post('admin/photo-library/photos/:photoId/ai-jobs')
  createAdminPhotoAiJob(
    @Param('photoId') photoId: string,
  ) {
    const startedAt = new Date().toISOString();
    const jobId = `ai_photo_${Date.now().toString(36)}`;
    void this.appService.createPhotoAiJob(photoId, { jobId }).catch((error) => {
      console.warn('photo-ai-job failed', {
        error: error instanceof Error ? error.message : String(error),
        jobId,
        photoId,
      });
    });
    return {
      code: 0,
      data: {
        finishedAt: '',
        generatedPhotoCount: 0,
        importedSourcePhotoCount: 0,
        jobId,
        requestedPhotoCount: 1,
        skippedPhotoCount: 0,
        startedAt,
        status: 'queued',
      },
    };
  }

  @Get('admin/photo-library/ai-tasks')
  getAdminAiRecognitionTasks() {
    return {
      code: 0,
      data: this.appService.listAiRecognitionTasks(),
    };
  }

  @Delete('admin/photo-library/ai-tasks')
  clearAdminAiRecognitionTasks() {
    return {
      code: 0,
      data: this.appService.clearAiRecognitionTasks(),
    };
  }

  @Get('admin/photo-library/playback-albums')
  getAdminPlaybackAlbums() {
    const data = this.appService.listPlaybackAlbums();
    if (isPromiseLike(data)) {
      return data.then((resolvedData) => ({
        code: 0,
        data: resolvedData,
      }));
    }
    return {
      code: 0,
      data,
    };
  }

  @Post('admin/photo-library/playback-albums')
  createAdminPlaybackAlbum(
    @Body() input: CreatePlaybackAlbumInput,
  ) {
    return {
      code: 0,
      data: this.appService.createPlaybackAlbum(input),
    };
  }

  @Patch('admin/photo-library/playback-albums/:playbackAlbumId')
  updateAdminPlaybackAlbum(
    @Param('playbackAlbumId') playbackAlbumId: string,
    @Body() input: UpdatePlaybackAlbumInput,
  ) {
    return {
      code: 0,
      data: this.appService.updatePlaybackAlbum(playbackAlbumId, input),
    };
  }

  @Delete('admin/photo-library/playback-albums/:playbackAlbumId')
  deleteAdminPlaybackAlbum(
    @Param('playbackAlbumId') playbackAlbumId: string,
  ) {
    return {
      code: 0,
      data: this.appService.deletePlaybackAlbum(playbackAlbumId),
    };
  }

  @Get('admin/photo-library/devices')
  getAdminTvDevices() {
    return {
      code: 0,
      data: this.appService.listTvDevices(),
    };
  }

  @Patch('admin/photo-library/devices/:deviceId')
  updateAdminTvDevice(
    @Param('deviceId') deviceId: string,
    @Body() input: UpdateTvDeviceInput,
  ) {
    return {
      code: 0,
      data: this.appService.updateTvDevice(deviceId, input),
    };
  }

  @Get('admin/photo-library/ai-settings')
  getAdminAiSettings() {
    return {
      code: 0,
      data: this.appService.getAiSettings(),
    };
  }

  @Put('admin/photo-library/ai-settings')
  updateAdminAiSettings(
    @Body() input: UpdateAiSettingsInput = {},
  ) {
    return {
      code: 0,
      data: this.appService.updateAiSettings(input),
    };
  }

  @Get('admin/photo-library/playback-albums/:playbackAlbumId/photos')
  getAdminPlaybackAlbumItems(
    @Param('playbackAlbumId') playbackAlbumId: string,
  ) {
    const data = this.appService.listPlaybackAlbumItems(playbackAlbumId);
    if (isPromiseLike(data)) {
      return data.then((resolvedData) => ({
        code: 0,
        data: resolvedData,
      }));
    }
    return {
      code: 0,
      data,
    };
  }

  @Post('admin/photo-library/playback-albums/:playbackAlbumId/photos')
  addAdminPlaybackAlbumPhotos(
    @Param('playbackAlbumId') playbackAlbumId: string,
    @Body() input: { photoIds?: string[]; sourceAlbumIds?: string[] } = {},
  ) {
    const data = Array.isArray(input.sourceAlbumIds) && input.sourceAlbumIds.length > 0
      ? this.appService.addFeiniuAlbumsToPlaybackAlbum(
        playbackAlbumId,
        input.sourceAlbumIds,
      )
      : this.appService.addPhotosToPlaybackAlbum(
        playbackAlbumId,
        Array.isArray(input.photoIds) ? input.photoIds : [],
      );
    if (isPromiseLike(data)) {
      return data.then((resolvedData) => ({
        code: 0,
        data: resolvedData,
      }));
    }
    return {
      code: 0,
      data,
    };
  }

  @Delete('admin/photo-library/playback-albums/:playbackAlbumId/photos/:photoId')
  removeAdminPlaybackAlbumPhoto(
    @Param('playbackAlbumId') playbackAlbumId: string,
    @Param('photoId') photoId: string,
  ) {
    return {
      code: 0,
      data: this.appService.removePhotoFromPlaybackAlbum(
        playbackAlbumId,
        photoId,
      ),
    };
  }

  @Patch('admin/photo-library/playback-albums/:playbackAlbumId/ai-policy')
  updateAdminPlaybackAlbumAiPolicy(
    @Param('playbackAlbumId') playbackAlbumId: string,
    @Body() input: UpdatePlaybackAlbumAiPolicyInput = {},
  ) {
    const data = this.appService.updatePlaybackAlbumAiPolicy(
      playbackAlbumId,
      input,
    );
    if (isPromiseLike(data)) {
      return data.then((resolvedData) => ({
        code: 0,
        data: resolvedData,
      }));
    }
    return {
      code: 0,
      data,
    };
  }

  @Post('admin/photo-library/playback-albums/:playbackAlbumId/ai-jobs')
  createAdminPlaybackAlbumAiJob(
    @Param('playbackAlbumId') playbackAlbumId: string,
  ) {
    const startedAt = new Date().toISOString();
    const jobId = `ai_album_${Date.now().toString(36)}`;
    void Promise.resolve(
      this.appService.createPlaybackAlbumAiJob(playbackAlbumId, { jobId }),
    ).catch((error) => {
      console.warn('playback-album-ai-job failed', {
        error: error instanceof Error ? error.message : String(error),
        jobId,
        playbackAlbumId,
      });
    });
    return {
      code: 0,
      data: {
        finishedAt: '',
        generatedPhotoCount: 0,
        importedSourcePhotoCount: 0,
        jobId,
        requestedPhotoCount: 0,
        skippedPhotoCount: 0,
        startedAt,
        status: 'queued',
      },
    };
  }

  @Post('admin/photo-library/playback-albums/:playbackAlbumId/scan-jobs')
  createAdminPlaybackAlbumScanJob(
    @Param('playbackAlbumId') playbackAlbumId: string,
  ) {
    const data = this.appService.createPlaybackAlbumScanJob(playbackAlbumId);
    if (isPromiseLike(data)) {
      return data.then((resolvedData) => ({
        code: 0,
        data: resolvedData,
      }));
    }
    return {
      code: 0,
      data,
    };
  }

  @Post('admin/photo-library/ai-scheduler/run')
  runAdminPlaybackAlbumAiScheduler() {
    return this.appService.runDuePlaybackAlbumAiJobs().then((data) => ({
      code: 0,
      data,
    }));
  }

  @Post('admin/photo-library/scan-jobs')
  createAdminPhotoLibraryScanJob(@Body() input: { photoRoot?: string } = {}) {
    return {
      code: 0,
      data: this.appService.createPhotoLibraryScanJob(input),
    };
  }

  @Get('admin/photo-library/source-config')
  getAdminPhotoSourceConfig() {
    return {
      code: 0,
      data: this.appService.getPhotoSourceConfig(),
    };
  }

  @Post('admin/photo-library/feiniu/connectivity')
  async testAdminFeiniuConnectivity(
    @Body() input: FeiniuConnectivityInput = {},
  ) {
    return {
      code: 0,
      data: await this.appService.testFeiniuConnectivity(input),
    };
  }

  @Get('admin/photo-library/feiniu/albums')
  getAdminFeiniuAlbums() {
    const data = this.appService.listFeiniuAlbumsForCuration();
    if (isPromiseLike(data)) {
      return data.then((resolvedData) => ({
        code: 0,
        data: resolvedData,
      }));
    }
    return {
      code: 0,
      data,
    };
  }

  @Post('admin/photo-library/feiniu/sync-jobs')
  async createAdminFeiniuPhotoSyncJob() {
    return {
      code: 0,
      data: await this.appService.createFeiniuPhotoSyncJob(),
    };
  }

  @Get('device/current-policy')
  getCurrentPolicy(): DevicePolicyResponse {
    return this.appService.getCurrentPolicy();
  }

  @Post('device/login')
  loginDevice(@Body() input: DeviceLoginInput): DeviceLoginResponse {
    const result = this.appService.authenticateDevice(input);
    if (!result) throw new UnauthorizedException('Invalid username or password');
    return result;
  }

  @Post('device/bind-sessions')
  createDeviceBindSession(
    @Body() input: DeviceBindSessionCreateInput,
  ): DeviceBindSessionResponse {
    return this.appService.createDeviceBindSession(input);
  }

  @Get('device/bind-sessions/:bindCode')
  getDeviceBindSession(
    @Param('bindCode') bindCode: string,
  ): DeviceBindSessionResponse {
    return this.appService.getDeviceBindSession(bindCode);
  }

  @Post('device/bind-sessions/:bindCode/confirm')
  confirmDeviceBindSession(
    @Param('bindCode') bindCode: string,
    @Body() input: DeviceBindConfirmInput,
  ): DeviceBindSessionResponse {
    return this.appService.confirmDeviceBindSession(bindCode, input);
  }

  @Get('device/playlist')
  getPlaylist(
    @Query('limit') limit?: string,
    @Headers('x-device-token') deviceToken?: string,
    @Headers('authorization') authorization?: string,
    @Query('albumId') albumId?: string,
    @Query('demoScenario') demoScenario?: string,
  ): MaybePromise<PlaylistResponse> {
    this.assertValidDeviceToken(deviceToken, authorization);

    return this.appService.getPlaylist(
      limit,
      albumId,
      demoScenario,
      deviceToken,
      authorization,
    );
  }

  @Get('device/albums')
  getAlbums(
    @Headers('x-device-token') deviceToken?: string,
    @Headers('authorization') authorization?: string,
    @Query('demoScenario') demoScenario?: string,
  ): MaybePromise<AlbumListResponse> {
    this.assertValidDeviceToken(deviceToken, authorization);

    return this.appService.getAlbums(demoScenario, deviceToken, authorization);
  }

  @Get('device/albums/:albumId')
  getAlbum(
    @Param('albumId') albumId: string,
    @Headers('x-device-token') deviceToken?: string,
    @Headers('authorization') authorization?: string,
    @Query('demoScenario') demoScenario?: string,
  ): MaybePromise<AlbumDetailResponse> {
    this.assertValidDeviceToken(deviceToken, authorization);

    const album = this.appService.getAlbum(
      albumId,
      demoScenario,
      deviceToken,
      authorization,
    );
    if (isPromiseLike(album)) {
      return album.then((resolvedAlbum) => {
        if (!resolvedAlbum) throw new NotFoundException('Album not found');
        return resolvedAlbum;
      });
    }
    if (!album) throw new NotFoundException('Album not found');
    return album;
  }

  @Post('device/play-record')
  createPlayRecord(@Body() input: PlayRecordInput): PlayRecordResponse {
    return this.appService.createPlayRecord(input);
  }

  @Get('derivatives/:photoId/:filename')
  getDerivativePhoto(
    @Param('photoId') photoId: string,
    @Param('filename') filename: string,
    @Res({ passthrough: true }) response: Response,
  ): StreamableFile {
    return this.createPhotoStream(
      this.appService.getDerivativeAsset(photoId, filename),
      response,
    );
  }

  @Get('photos/:photoId/original')
  getOriginalPhoto(
    @Param('photoId') photoId: string,
    @Res({ passthrough: true }) response: Response,
  ): MaybePromise<StreamableFile> {
    return this.streamPhoto(photoId, response, 'original');
  }

  @Get('photos/:photoId/display')
  getDisplayPhoto(
    @Param('photoId') photoId: string,
    @Res({ passthrough: true }) response: Response,
  ): MaybePromise<StreamableFile> {
    return this.streamPhoto(photoId, response, 'display');
  }

  @Get('photos/:photoId/thumb')
  getThumbnail(
    @Param('photoId') photoId: string,
    @Res({ passthrough: true }) response: Response,
  ): MaybePromise<StreamableFile> {
    return this.streamPhoto(photoId, response, 'thumb');
  }

  private streamPhoto(
    photoId: string,
    response: Response,
    variant: PhotoAssetVariant,
  ): MaybePromise<StreamableFile> {
    const asset = this.appService.getPhotoAsset(photoId, variant);
    if (isPromiseLike(asset)) {
      return asset.then((resolvedAsset) => this.createPhotoStream(resolvedAsset, response));
    }
    return this.createPhotoStream(asset, response);
  }

  private createPhotoStream(
    asset: PhotoSourceAsset | null,
    response: Response,
  ): StreamableFile {
    if (!asset) throw new NotFoundException('Photo not found');

    response.set({
      'Cache-Control': 'public, max-age=3600',
      'Content-Disposition': `inline; filename="${asset.filename}"`,
      'Content-Type': asset.contentType,
    });

    const stream = asset.kind === 'remote'
      ? asset.stream
      : createReadStream(asset.path);

    return new StreamableFile(stream, {
      type: asset.contentType,
    });
  }
}
