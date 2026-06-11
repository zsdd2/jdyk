import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import {
  createReadStream,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'fs';
import { join } from 'path';
import { AppController } from './app.controller';
import {
  AppService,
  buildUnifiedVisionSystemPrompt,
  buildUnifiedVisionUserPrompt,
  normalizeStoredAiDetail,
  normalizeUnifiedVisionResult,
  parseAiJsonContent,
} from './app.service';
import { CompositePhotoSource } from './photo-sources/composite-photo-source';
import type { PhotoSource } from './photo-sources/photo-source';
import { SqlitePhotoSource } from './photo-sources/sqlite-photo-source';
import { SqlitePhotoRepository } from './sqlite-photo.repository';
import type { PlaylistItem } from '@wrjdyk/shared';

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
    return;
  }
  process.env[key] = value;
}

describe('AppController', () => {
  const testDataDir = join(process.cwd(), '.test-data', 'app-controller');
  const derivativeRoot = join(testDataDir, 'derivatives');
  const photoRoot = join(__dirname, '..', '..', '..', 'ceshi');
  let databasePath: string;
  let appController: AppController;
  let appService: AppService;

  beforeEach(async () => {
    mkdirSync(testDataDir, { recursive: true });
    databasePath = join(
      testDataDir,
      `wrjdyk-controller-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`,
    );

    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        {
          provide: AppService,
          useFactory: () => {
            const service = new AppService();
            service.replacePhotoRepositoryForTesting(
              new SqlitePhotoRepository({
                databasePath,
                derivativeRoot,
                photoRoot,
              }),
            );
            return service;
          },
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
    appService = app.get<AppService>(AppService);
  });

  afterEach(() => {
    appService.close();
    rmSync(databasePath, { force: true });
    rmSync(derivativeRoot, { force: true, recursive: true });
  });

  describe('root', () => {
    it('should return health status', () => {
      expect(appController.getHealth().status).toBe('ok');
    });

    it('returns TV app update manifest from runtime env', () => {
      const previousEnv = {
        apkUrl: process.env.WRJDYK_TV_UPDATE_APK_URL,
        force: process.env.WRJDYK_TV_UPDATE_FORCE,
        notes: process.env.WRJDYK_TV_UPDATE_NOTES,
        publishedAt: process.env.WRJDYK_TV_UPDATE_PUBLISHED_AT,
        sha256: process.env.WRJDYK_TV_UPDATE_SHA256,
        sizeBytes: process.env.WRJDYK_TV_UPDATE_SIZE_BYTES,
        versionCode: process.env.WRJDYK_TV_UPDATE_VERSION_CODE,
        versionName: process.env.WRJDYK_TV_UPDATE_VERSION_NAME,
      };

      process.env.WRJDYK_TV_UPDATE_APK_URL = 'https://nas.example.com/releases/wrjdyk-tv.apk';
      process.env.WRJDYK_TV_UPDATE_FORCE = 'true';
      process.env.WRJDYK_TV_UPDATE_NOTES = '升级远程更新能力';
      process.env.WRJDYK_TV_UPDATE_PUBLISHED_AT = '2026-06-11T13:00:00.000Z';
      process.env.WRJDYK_TV_UPDATE_SHA256 = 'abc123';
      process.env.WRJDYK_TV_UPDATE_SIZE_BYTES = '123456';
      process.env.WRJDYK_TV_UPDATE_VERSION_CODE = '5';
      process.env.WRJDYK_TV_UPDATE_VERSION_NAME = '0.1.4';

      expect(appController.getTvAppUpdateManifest()).toEqual({
        code: 0,
        data: {
          apkUrl: 'https://nas.example.com/releases/wrjdyk-tv.apk',
          forceUpdate: true,
          publishedAt: '2026-06-11T13:00:00.000Z',
          releaseNotes: '升级远程更新能力',
          sha256: 'abc123',
          sizeBytes: 123456,
          versionCode: 5,
          versionName: '0.1.4',
        },
      });

      restoreEnv('WRJDYK_TV_UPDATE_APK_URL', previousEnv.apkUrl);
      restoreEnv('WRJDYK_TV_UPDATE_FORCE', previousEnv.force);
      restoreEnv('WRJDYK_TV_UPDATE_NOTES', previousEnv.notes);
      restoreEnv('WRJDYK_TV_UPDATE_PUBLISHED_AT', previousEnv.publishedAt);
      restoreEnv('WRJDYK_TV_UPDATE_SHA256', previousEnv.sha256);
      restoreEnv('WRJDYK_TV_UPDATE_SIZE_BYTES', previousEnv.sizeBytes);
      restoreEnv('WRJDYK_TV_UPDATE_VERSION_CODE', previousEnv.versionCode);
      restoreEnv('WRJDYK_TV_UPDATE_VERSION_NAME', previousEnv.versionName);
    });

    it('streams an APK from the configured releases directory', async () => {
      const previousReleaseDir = process.env.WRJDYK_RELEASES_DIR;
      const releaseDir = join(testDataDir, 'releases');
      mkdirSync(releaseDir, { recursive: true });
      writeFileSync(join(releaseDir, 'wangri-tv-1.0.apk'), 'apk-content');
      process.env.WRJDYK_RELEASES_DIR = releaseDir;
      const response = { set: jest.fn() };

      try {
        const file = appController.getReleaseApk(
          'wangri-tv-1.0.apk',
          response as never,
        );

        expect(file).toBeDefined();
        expect(response.set).toHaveBeenCalledWith({
          'Cache-Control': 'public, max-age=300',
          'Content-Disposition': 'attachment; filename="wangri-tv-1.0.apk"',
          'Content-Type': 'application/vnd.android.package-archive',
        });
        const chunks: Buffer[] = [];
        for await (const chunk of file.getStream()) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        expect(Buffer.concat(chunks).toString()).toBe('apk-content');
      } finally {
        restoreEnv('WRJDYK_RELEASES_DIR', previousReleaseDir);
        rmSync(releaseDir, { force: true, recursive: true });
      }
    });

    it.each([
      '../secret.apk',
      'latest.json',
      'missing.apk',
    ])('rejects unsafe or missing release file %s', (fileName) => {
      const previousReleaseDir = process.env.WRJDYK_RELEASES_DIR;
      const releaseDir = join(testDataDir, 'releases-empty');
      mkdirSync(releaseDir, { recursive: true });
      process.env.WRJDYK_RELEASES_DIR = releaseDir;

      try {
        expect(() =>
          appController.getReleaseApk(fileName, { set: jest.fn() } as never),
        ).toThrow(NotFoundException);
      } finally {
        restoreEnv('WRJDYK_RELEASES_DIR', previousReleaseDir);
        rmSync(releaseDir, { force: true, recursive: true });
      }
    });
  });

  describe('admin auth', () => {
    it('returns Vben-compatible login data for the admin console', () => {
      const login = appController.loginAdmin({
        password: 'admin123',
        username: 'admin',
      });

      expect(login).toEqual({
        code: 0,
        data: {
          accessToken: 'wrjdyk_admin_admin',
        },
      });
    });

    it('returns Vben-compatible user info and menus', () => {
      expect(appController.getAdminUserInfo()).toEqual({
        code: 0,
        data: expect.objectContaining({
          homePath: '/dashboard/analytics',
          realName: '往日重现管理员',
          username: 'admin',
        }),
      });
      expect(appController.getAdminAccessCodes()).toEqual({
        code: 0,
        data: ['AC_100100', 'AC_100110', 'AC_100120'],
      });
      expect(appController.getAdminMenus()).toEqual({
        code: 0,
        data: expect.arrayContaining([
          expect.objectContaining({
            name: 'Dashboard',
            path: '/dashboard',
          }),
          expect.objectContaining({
            children: expect.arrayContaining([
              expect.objectContaining({
                name: 'PhotoLibraryPhotos',
                path: '/photo-library/photos',
              }),
              expect.objectContaining({
                name: 'PhotoLibraryPlaybackAlbums',
                path: '/photo-library/playback-albums',
              }),
              expect.objectContaining({
                name: 'PhotoLibraryAiSettings',
                path: '/photo-library/ai-settings',
              }),
              expect.objectContaining({
                name: 'PhotoLibraryScan',
                path: '/photo-library/scan',
              }),
              expect.objectContaining({
                name: 'PhotoLibrarySources',
                path: '/photo-library/sources',
              }),
            ]),
            name: 'PhotoLibrary',
            path: '/photo-library',
          }),
        ]),
      });
    });

    it('returns a photo library overview for the admin console', () => {
      const overview = appController.getAdminPhotoLibraryOverview();

      expect(overview).toEqual({
        code: 0,
        data: expect.objectContaining({
          albumCount: 3,
          databasePath: expect.stringContaining('.sqlite'),
          migrationVersion: 14,
          photoCount: 9,
          photoRoot: expect.stringContaining('ceshi'),
        }),
      });
    });

    it('creates a photo scan job for the admin console', () => {
      const overview = appController.getAdminPhotoLibraryOverview().data;
      const expectedPhotoCount = countPhotoFiles(overview.photoRoot);
      const scanJob = appController.createAdminPhotoLibraryScanJob({
        photoRoot: overview.photoRoot,
      });

      expect(scanJob).toEqual({
        code: 0,
        data: expect.objectContaining({
          discoveredPhotoCount: expectedPhotoCount,
          importedPhotoCount: expectedPhotoCount,
          photoRoot: overview.photoRoot,
          status: 'completed',
        }),
      });
      expect(scanJob.data.jobId).toMatch(/^scan_/);
      expect(scanJob.data.finishedAt).toBeTruthy();
      expect(appController.getAdminPhotoLibraryOverview().data.lastScanJob).toMatchObject({
        jobId: scanJob.data.jobId,
        status: 'completed',
      });
    });

    it('returns Feiniu source config status for the admin console', () => {
      const sourceConfig = appController.getAdminPhotoSourceConfig();

      expect(sourceConfig).toEqual({
        code: 0,
        data: expect.objectContaining({
          activeSourceId: 'sqlite',
          feiniu: expect.objectContaining({
            enabled: false,
            passwordConfigured: false,
          }),
          local: expect.objectContaining({
            albumCount: 3,
            enabled: true,
            photoCount: 9,
          }),
        }),
      });
    });

    it('returns a safe Feiniu connectivity result when config is incomplete', async () => {
      await expect(
        appController.testAdminFeiniuConnectivity({}),
      ).resolves.toEqual({
        code: 0,
        data: expect.objectContaining({
          missingFields: expect.arrayContaining(['baseUrl', 'username', 'password']),
          ok: false,
        }),
      });
    });

    it('returns a paged photo center list for curation', () => {
      const result = appController.getAdminPhotoCenterItems({
        albumId: 'family-travel',
        page: '1',
        pageSize: '2',
      });

      expect(result).toEqual({
        code: 0,
        data: expect.objectContaining({
          page: 1,
          pageSize: 2,
          total: 3,
          items: [
            expect.objectContaining({
              aiCommentStatus: 'pending',
              aiScoreStatus: 'pending',
              albumId: 'family-travel',
              photoId: 'p_001',
              sourceType: 'local',
            }),
            expect.objectContaining({
              photoId: 'p_002',
            }),
          ],
        }),
      });
    });

    it('creates playback albums and adds selected photo center photos', () => {
      const created = appController.createAdminPlaybackAlbum({
        aiEnabled: true,
        aiPriorityTags: ['人物', '开心'],
        aiScoreThreshold: 82,
        description: '客厅电视每日播放。',
        pushEnabled: true,
        pushPriorityTags: ['人物'],
        pushScoreThreshold: 88,
        sourceAlbumId: 'feiniu-shared-to-me-47',
        sourceAlbumTitle: '阿乎精修图',
        sourceType: 'feiniu_album',
        title: '客厅每日精选',
      });
      const added = appController.addAdminPlaybackAlbumPhotos(
        created.data.playbackAlbumId,
        {
          photoIds: ['p_001', 'p_002', 'missing_photo', 'p_001'],
        },
      );
      const albums = appController.getAdminPlaybackAlbums();
      const members = appController.getAdminPlaybackAlbumItems(
        created.data.playbackAlbumId,
      );

      expect(created).toEqual({
        code: 0,
        data: expect.objectContaining({
          photoCount: 0,
          playbackAlbumId: expect.stringMatching(/^play_/),
          aiEnabled: true,
          aiPriorityTags: ['人物', '开心'],
          aiScoreThreshold: 82,
          pushEnabled: true,
          pushPriorityTags: ['人物'],
          pushScoreThreshold: 88,
          sourceAlbumId: 'feiniu-shared-to-me-47',
          sourceAlbumTitle: '阿乎精修图',
          sourceType: 'feiniu_album',
          title: '客厅每日精选',
        }),
      });
      expect(added).toEqual({
        code: 0,
        data: {
          addedPhotoCount: 2,
          requestedPhotoCount: 4,
          skippedPhotoCount: 2,
          totalPhotoCount: 2,
        },
      });
      expect(albums).toEqual({
        code: 0,
        data: [
          expect.objectContaining({
            coverPhotoId: 'p_001',
            photoCount: 2,
            playbackAlbumId: created.data.playbackAlbumId,
            title: '客厅每日精选',
          }),
        ],
      });
      expect(members).toEqual({
        code: 0,
        data: [
          expect.objectContaining({ photoId: 'p_001' }),
          expect.objectContaining({ photoId: 'p_002' }),
        ],
      });
    });

    it('lists mounted Feiniu album photos together with removable local members', async () => {
      const sqliteSource = new SqlitePhotoSource(
        new SqlitePhotoRepository({
          databasePath,
          derivativeRoot,
          photoRoot,
        }),
      );
      const listPlaylistItems = jest.fn(async (albumId?: string) =>
        albumId === 'feiniu-shared-to-me-47'
          ? [playlistItem('feiniu-shared-to-me-47', 'feiniu-95629')]
          : [],
      );
      const feiniuSource: PhotoSource = {
        getAlbum: async () => null,
        getPhotoAsset: async (photoId) =>
          photoId === 'feiniu-95629'
            ? {
              contentType: 'image/jpeg',
              filename: 'feiniu-95629.jpg',
              kind: 'remote',
              stream: createReadStream(join(photoRoot, '_DSC6456.jpg')),
            }
            : null,
        id: 'feiniu',
        listAlbums: async () => [
          {
            albumId: 'feiniu-shared-to-me-47',
            coverImageUrl: '/api/photos/feiniu-95629/display',
            coverPhotoId: 'feiniu-95629',
            description: '共享给我的飞牛相册',
            photoCount: 4,
            thumbnailUrl: '/api/photos/feiniu-95629/thumb',
            title: '阿乎精修图',
            updatedAt: '2025-09-05',
          },
        ],
        listPlaylistItems,
      };
      appService.replacePhotoSourceForTesting(
        new CompositePhotoSource([sqliteSource, feiniuSource]),
      );
      appService.replaceVisionAiForTesting({
        analyze: async () => ({
          aiBeautyScore: 84,
          aiComment: '那天的笑容还在',
          aiFontStyle: 'handwriting',
          aiIsTrash: false,
          aiLayoutPosition: 'bottom_right',
          aiMemoryScore: 92,
          aiReason: '人物清晰，家庭记忆价值高。',
          aiSafeArea: { h: 0.18, w: 0.34, x: 0.58, y: 0.7 },
          aiScore: 89,
          aiTags: ['回忆', '人物'],
          aiTextColor: '#FFFFFF',
        }),
      });

      const created = appController.createAdminPlaybackAlbum({
        sourceAlbumId: 'feiniu-shared-to-me-47',
        sourceAlbumTitle: '阿乎精修图',
        sourceType: 'feiniu_album',
        title: '阿乎精修图',
      });
      appController.addAdminPlaybackAlbumPhotos(created.data.playbackAlbumId, {
        photoIds: ['p_001'],
      });

      const albums = await Promise.resolve(appController.getAdminPlaybackAlbums());
      const members = await Promise.resolve(
        appController.getAdminPlaybackAlbumItems(created.data.playbackAlbumId),
      );
      const removed = appController.removeAdminPlaybackAlbumPhoto(
        created.data.playbackAlbumId,
        'p_001',
      );
      const membersAfterRemove = await Promise.resolve(
        appController.getAdminPlaybackAlbumItems(created.data.playbackAlbumId),
      );

      expect(listPlaylistItems).toHaveBeenCalledWith('feiniu-shared-to-me-47');
      expect(albums).toEqual({
        code: 0,
        data: [
          expect.objectContaining({
            photoCount: 5,
            playbackAlbumId: created.data.playbackAlbumId,
            sourceAlbumId: 'feiniu-shared-to-me-47',
          }),
        ],
      });
      expect(members).toEqual({
        code: 0,
        data: [
          expect.objectContaining({
            photoId: 'p_001',
            removable: true,
            sourceType: 'local',
          }),
          expect.objectContaining({
            albumId: 'feiniu-shared-to-me-47',
            photoId: 'feiniu-95629',
            removable: false,
            sourceType: 'feiniu',
          }),
        ],
      });
      expect(removed).toEqual({
        code: 0,
        data: {
          removedPhotoCount: 1,
          totalPhotoCount: 0,
        },
      });
      expect(membersAfterRemove).toEqual({
        code: 0,
        data: [
          expect.objectContaining({
            photoId: 'feiniu-95629',
            removable: false,
            sourceType: 'feiniu',
          }),
        ],
      });
    });

    it('imports mounted Feiniu album photos on demand and persists AI insights', async () => {
      const sqliteSource = new SqlitePhotoSource(
        new SqlitePhotoRepository({
          databasePath,
          derivativeRoot,
          photoRoot,
        }),
      );
      const listPlaylistItems = jest.fn(async (albumId?: string) =>
        albumId === 'feiniu-shared-to-me-47'
          ? [playlistItem('feiniu-shared-to-me-47', 'feiniu-95629')]
          : [],
      );
      const feiniuSource: PhotoSource = {
        getAlbum: async () => null,
        getPhotoAsset: async (photoId) =>
          photoId === 'feiniu-95629'
            ? {
              contentType: 'image/jpeg',
              filename: 'feiniu-95629.jpg',
              kind: 'remote',
              stream: createReadStream(join(photoRoot, '_DSC6456.jpg')),
            }
            : null,
        id: 'feiniu',
        listAlbums: async () => [
          {
            albumId: 'feiniu-shared-to-me-47',
            coverImageUrl: '/api/photos/feiniu-95629/display',
            coverPhotoId: 'feiniu-95629',
            description: '共享给我的飞牛相册',
            photoCount: 1,
            thumbnailUrl: '/api/photos/feiniu-95629/thumb',
            title: '阿乎精修图',
            updatedAt: '2025-09-05',
          },
        ],
        listPlaylistItems,
      };
      appService.replacePhotoSourceForTesting(
        new CompositePhotoSource([sqliteSource, feiniuSource]),
      );
      appService.replaceVisionAiForTesting({
        analyze: async () => ({
          aiBeautyScore: 84,
          aiComment: '那天的笑容还在',
          aiFontStyle: 'handwriting',
          aiIsTrash: false,
          aiLayoutPosition: 'bottom_right',
          aiMemoryScore: 92,
          aiReason: '人物清晰，家庭记忆价值高。',
          aiSafeArea: { h: 0.18, w: 0.34, x: 0.58, y: 0.7 },
          aiScore: 89,
          aiTags: ['回忆', '人物'],
          aiTextColor: '#FFFFFF',
        }),
      });

      const created = appController.createAdminPlaybackAlbum({
        aiEnabled: false,
        sourceAlbumId: 'feiniu-shared-to-me-47',
        sourceAlbumTitle: '阿乎精修图',
        sourceType: 'feiniu_album',
        title: '阿乎精修图',
      });

      const enabled = await Promise.resolve(
        appController.updateAdminPlaybackAlbumAiPolicy(
          created.data.playbackAlbumId,
          {
            aiEnabled: true,
          },
        ),
      );
      const job = await Promise.resolve(
        appService.createPlaybackAlbumAiJob(created.data.playbackAlbumId),
      );
      const repeatedJob = await Promise.resolve(
        appService.createPlaybackAlbumAiJob(created.data.playbackAlbumId),
      );
      const members = await Promise.resolve(
        appController.getAdminPlaybackAlbumItems(created.data.playbackAlbumId),
      );
      const feiniuCenterItems = await Promise.resolve(
        appController.getAdminPhotoCenterItems({
          albumId: 'feiniu-shared-to-me-47',
          page: '1',
          pageSize: '10',
          sourceType: 'feiniu',
        }),
      );

      expect(listPlaylistItems).toHaveBeenCalledWith('feiniu-shared-to-me-47');
      expect(enabled).toEqual({
        code: 0,
        data: {
          album: expect.objectContaining({
            aiEnabled: true,
            playbackAlbumId: created.data.playbackAlbumId,
          }),
        },
      });
      expect(enabled.data).not.toHaveProperty('aiJob');
      expect(job).toEqual(expect.objectContaining({
        generatedPhotoCount: 1,
        importedSourcePhotoCount: 1,
        requestedPhotoCount: 1,
        status: 'completed',
      }));
      expect(repeatedJob).toEqual(expect.objectContaining({
        generatedPhotoCount: 0,
        requestedPhotoCount: 0,
        status: 'completed',
      }));
      expect(members).toEqual({
        code: 0,
        data: [
          expect.objectContaining({
            aiCompleted: true,
            aiCommentStatus: 'completed',
            aiScoreStatus: 'completed',
            aiTags: expect.arrayContaining(['回忆']),
            photoId: 'feiniu-95629',
            removable: false,
            sourceType: 'feiniu',
          }),
        ],
      });
      expect(members.data[0]).toMatchObject({
        derivativeStatus: 'ready',
        thumbnailUrl: '/api/derivatives/feiniu-95629/thumb_300.webp',
      });
      expect(
        existsSync(join(derivativeRoot, 'feiniu-95629', 'thumb_300.webp')),
      ).toBe(true);
      expect(
        existsSync(join(derivativeRoot, 'feiniu-95629', 'ai_720.webp')),
      ).toBe(true);
      expect(
        existsSync(join(derivativeRoot, 'feiniu-95629', 'tv_4k.webp')),
      ).toBe(true);
      expect(feiniuCenterItems).toEqual({
        code: 0,
        data: expect.objectContaining({
          items: [
            expect.objectContaining({
              aiCommentStatus: 'completed',
              aiScoreStatus: 'completed',
              photoId: 'feiniu-95629',
              sourceAlbumId: 'feiniu-shared-to-me-47',
              sourceType: 'feiniu',
            }),
          ],
          total: 1,
        }),
      });
    });

    it('keeps playback album members pending when real AI is not configured', async () => {
      const created = appController.createAdminPlaybackAlbum({
        aiEnabled: true,
        aiPriorityTags: ['人物'],
        title: 'AI 每日精选',
      });
      appController.addAdminPlaybackAlbumPhotos(created.data.playbackAlbumId, {
        photoIds: ['p_001'],
      });

      const job = await Promise.resolve(
        appService.createPlaybackAlbumAiJob(created.data.playbackAlbumId),
      );
      const members = appController.getAdminPlaybackAlbumItems(
        created.data.playbackAlbumId,
      );
      const login = appController.loginDevice({
        password: 'admin123',
        username: 'admin',
      });
      const playlist = appController.getPlaylist(
        undefined,
        login.deviceToken,
        undefined,
        'family-travel',
      );
      const tvItem = playlist.items.find((item) => item.photoId === 'p_001');

      expect(job).toEqual(expect.objectContaining({
        generatedPhotoCount: 0,
        requestedPhotoCount: 1,
        skippedPhotoCount: 1,
        status: 'completed',
      }));
      expect(members).toEqual({
        code: 0,
        data: [
          expect.objectContaining({
            aiComment: '',
            aiCommentStatus: 'pending',
            aiScore: null,
            aiScoreStatus: 'pending',
            aiTags: [],
            photoId: 'p_001',
          }),
        ],
      });
      expect(tvItem).toMatchObject({
        ai: expect.objectContaining({
          commentStatus: 'pending',
          scoreStatus: 'pending',
          tags: [],
        }),
        caption: expect.objectContaining({
          text: expect.stringContaining('有些快乐不用解释'),
        }),
      });
    });

    it('manually scans a playback album by transcoding missing photos before AI completion', async () => {
      const created = appController.createAdminPlaybackAlbum({
        aiEnabled: true,
        title: '手动扫描相册',
      });
      appController.addAdminPlaybackAlbumPhotos(created.data.playbackAlbumId, {
        photoIds: ['p_001'],
      });

      const job = await Promise.resolve(
        appController.createAdminPlaybackAlbumScanJob(
          created.data.playbackAlbumId,
        ),
      );
      const members = appController.getAdminPlaybackAlbumItems(
        created.data.playbackAlbumId,
      );

      expect(job).toEqual({
        code: 0,
        data: expect.objectContaining({
          generatedPhotoCount: 0,
          requestedPhotoCount: 1,
          status: 'completed',
          transcodedPhotoCount: 1,
        }),
      });
      expect(members.data[0]).toMatchObject({
        aiCompleted: false,
        derivativeStatus: 'ready',
        thumbnailUrl: '/api/derivatives/p_001/thumb_300.webp',
      });
    });

    it('does not enumerate Feiniu photos while listing the photo center', async () => {
      const listPlaylistItems = jest.fn(async () => {
        throw new Error('should not read Feiniu photos while listing photo center');
      });
      const feiniuSource: PhotoSource = {
        getAlbum: async () => null,
        id: 'feiniu',
        listAlbums: async () => [],
        listPlaylistItems,
      };
      appService.replacePhotoSourceForTesting(
        new CompositePhotoSource([
          new SqlitePhotoSource(
            new SqlitePhotoRepository({
              databasePath,
              photoRoot,
            }),
          ),
          feiniuSource,
        ]),
      );

      const result = await Promise.resolve(
        appController.getAdminPhotoCenterItems({
          page: '1',
          pageSize: '10',
          sourceType: 'feiniu',
        }),
      );

      expect(result).toEqual({
        code: 0,
        data: expect.objectContaining({
          page: 1,
          pageSize: 10,
          total: 0,
          items: [],
        }),
      });
      expect(listPlaylistItems).not.toHaveBeenCalled();
    });

    it('lists Feiniu albums for playback album mounting without reading all photos', async () => {
      const listPlaylistItems = jest.fn(async () => {
        throw new Error('should not read Feiniu photos while listing albums');
      });
      const feiniuSource: PhotoSource = {
        getAlbum: async () => null,
        id: 'feiniu',
        listAlbums: async () => [
          {
            albumId: 'feiniu-shared-to-me-47',
            coverImageUrl: '/api/photos/feiniu-shared-to-me-47-cover/display',
            coverPhotoId: 'feiniu-shared-to-me-47-cover',
            description: '共享给我的飞牛相册，所有者：zsdd',
            latestTakenAt: '2026-06-06',
            photoCount: 1,
            thumbnailUrl: '/api/photos/feiniu-shared-to-me-47-cover/thumb',
            title: '阿乎精修图',
            updatedAt: '2026-06-06',
          },
        ],
        listPlaylistItems,
      };
      appService.replacePhotoSourceForTesting(
        new CompositePhotoSource([
          new SqlitePhotoSource(
            new SqlitePhotoRepository({
              databasePath,
              photoRoot,
            }),
          ),
          feiniuSource,
        ]),
      );

      const feiniuAlbums = await appController.getAdminFeiniuAlbums();
      const syncJob = await appController.createAdminFeiniuPhotoSyncJob();
      const feiniuItems = await Promise.resolve(
        appController.getAdminPhotoCenterItems({
          page: '1',
          pageSize: '10',
          sourceType: 'feiniu',
        }),
      );
      const login = appController.loginDevice({
        password: 'admin123',
        username: 'admin',
      });
      const albums = await Promise.resolve(appController.getAlbums(login.deviceToken));

      expect(feiniuAlbums).toEqual({
        code: 0,
        data: [
          expect.objectContaining({
            albumId: 'feiniu-shared-to-me-47',
            photoCount: 1,
            title: '阿乎精修图',
          }),
        ],
      });
      expect(syncJob).toEqual({
        code: 0,
        data: expect.objectContaining({
          albumCount: 1,
          discoveredPhotoCount: 0,
          importedPhotoCount: 0,
          status: 'completed',
          updatedPhotoCount: 0,
        }),
      });
      expect(feiniuItems).toEqual({
        code: 0,
        data: expect.objectContaining({
          total: 0,
          items: [],
        }),
      });
      expect(
        albums.albums.filter((album) => album.albumId === 'feiniu-shared-to-me-47'),
      ).toHaveLength(1);
      expect(listPlaylistItems).not.toHaveBeenCalled();
    });

    it('stores AI settings for scoring, comments, and photo type recognition', () => {
      const defaults = appController.getAdminAiSettings();
      const updated = appController.updateAdminAiSettings({
        apiKey: 'sk-test-secret',
        baseUrl: 'https://api.example.com/v1',
        classificationPrompt: '识别照片类型，返回人物、开心、场景等标签。',
        commentPrompt: '为家庭电视播放写一句有温度的评语。',
        layoutPrompt: '分析 16:9 电视安全区，输出文字位置、字体、颜色和归一化坐标。',
        model: 'gpt-4o-mini',
        provider: 'openai_compatible',
        scoringPrompt: '按家庭回忆价值给照片打 0-100 分。',
      });
      const reloaded = appController.getAdminAiSettings();

      expect(defaults).toEqual({
        code: 0,
        data: expect.objectContaining({
          apiKeyConfigured: false,
          provider: 'openai_compatible',
        }),
      });
      expect(updated).toEqual({
        code: 0,
        data: expect.objectContaining({
          apiKeyConfigured: true,
          baseUrl: 'https://api.example.com/v1',
          classificationPrompt: '识别照片类型，返回人物、开心、场景等标签。',
          commentPrompt: '为家庭电视播放写一句有温度的评语。',
          layoutPrompt: '分析 16:9 电视安全区，输出文字位置、字体、颜色和归一化坐标。',
          model: 'gpt-4o-mini',
          provider: 'openai_compatible',
          scoringPrompt: '按家庭回忆价值给照片打 0-100 分。',
        }),
      });
      expect(updated.data).not.toHaveProperty('apiKey');
      expect(reloaded.data.apiKeyConfigured).toBe(true);
    });

    it('updates photo AI recognition fields and filters photo center by AI type', () => {
      const updated = appController.updateAdminPhotoAiInsight('p_001', {
        aiBeautyScore: 76,
        aiComment: '厨房灯火还亮着',
        aiMemoryScore: 91,
        aiTags: ['家庭', '美食'],
      });
      const filtered = appController.getAdminPhotoCenterItems({
        aiTag: '家庭',
        page: '1',
        pageSize: '10',
      });

      expect(updated).toEqual({
        code: 0,
        data: expect.objectContaining({
          aiBeautyScore: 76,
          aiComment: '厨房灯火还亮着',
          aiCommentStatus: 'completed',
          aiCompleted: true,
          aiMemoryScore: 91,
          aiScoreStatus: 'completed',
          aiTags: ['家庭', '美食'],
          photoId: 'p_001',
        }),
      });
      expect(filtered.data.items).toEqual([
        expect.objectContaining({
          aiTags: ['家庭', '美食'],
          photoId: 'p_001',
        }),
      ]);
    });

    it('edits photo metadata and soft-deletes photos into the trash pool', () => {
      const created = appController.createAdminPlaybackAlbum({
        title: 'Soft delete album',
      });
      appController.addAdminPlaybackAlbumPhotos(created.data.playbackAlbumId, {
        photoIds: ['p_001'],
      });

      const updated = appController.updateAdminPhotoMetadata('p_001', {
        captionTitle: 'Edited family photo',
        importAlbumTitle: 'Edited source album',
        sourceAlbumKind: 'owned',
        sourceOwnerName: 'admin',
      });
      const trashed = appController.trashAdminPhoto('p_001');
      const center = appController.getAdminPhotoCenterItems({
        keyword: 'p_001',
        page: '1',
        pageSize: '10',
      });
      const members = appController.getAdminPlaybackAlbumItems(
        created.data.playbackAlbumId,
      );

      expect(updated.data).toMatchObject({
        captionTitle: 'Edited family photo',
        importAlbumTitle: 'Edited source album',
        photoId: 'p_001',
        sourceAlbumKind: 'owned',
        sourceOwnerName: 'admin',
      });
      expect(trashed).toEqual({
        code: 0,
        data: { trashedPhotoCount: 1 },
      });
      expect(center.data.items).toEqual([]);
      expect(members.data).toEqual([]);
    });

    it('edits and unbinds playback albums without deleting source photos', () => {
      const created = appController.createAdminPlaybackAlbum({
        sourceType: 'manual',
        title: 'Original playback album',
      });
      appController.addAdminPlaybackAlbumPhotos(created.data.playbackAlbumId, {
        photoIds: ['p_001', 'p_002'],
      });

      const updated = appController.updateAdminPlaybackAlbum(
        created.data.playbackAlbumId,
        {
          description: 'Edited description',
          sourceAlbumId: 'feiniu-100',
          sourceAlbumTitle: 'Feiniu source',
          sourceType: 'feiniu_album',
          title: 'Edited playback album',
        },
      );
      const deleted = appController.deleteAdminPlaybackAlbum(
        created.data.playbackAlbumId,
      );
      const albums = appController.getAdminPlaybackAlbums();
      const center = appController.getAdminPhotoCenterItems({
        keyword: 'p_001',
        page: '1',
        pageSize: '10',
      });

      expect(updated.data).toMatchObject({
        description: 'Edited description',
        playbackAlbumId: created.data.playbackAlbumId,
        sourceAlbumId: 'feiniu-100',
        sourceAlbumTitle: 'Feiniu source',
        sourceType: 'feiniu_album',
        title: 'Edited playback album',
      });
      expect(deleted).toEqual({
        code: 0,
        data: {
          deletedAlbumCount: 1,
          removedPhotoCount: 2,
        },
      });
      expect(albums.data).toEqual([]);
      expect(center.data.items).toEqual([
        expect.objectContaining({ photoId: 'p_001' }),
      ]);
    });

    it('keeps the playback album AI switch separate from AI generation', async () => {
      const created = appController.createAdminPlaybackAlbum({
        aiEnabled: false,
        title: 'AI 开关相册',
      });
      appController.addAdminPlaybackAlbumPhotos(created.data.playbackAlbumId, {
        photoIds: ['p_001'],
      });

      const enabled = await Promise.resolve(
        appController.updateAdminPlaybackAlbumAiPolicy(
          created.data.playbackAlbumId,
          {
            aiEnabled: true,
          },
        ),
      );
      const membersBeforeJob = appController.getAdminPlaybackAlbumItems(
        created.data.playbackAlbumId,
      );
      const job = await Promise.resolve(
        appService.createPlaybackAlbumAiJob(created.data.playbackAlbumId),
      );
      const members = appController.getAdminPlaybackAlbumItems(
        created.data.playbackAlbumId,
      );
      const disabled = await Promise.resolve(
        appController.updateAdminPlaybackAlbumAiPolicy(
          created.data.playbackAlbumId,
          {
            aiEnabled: false,
          },
        ),
      );

      expect(enabled).toEqual({
        code: 0,
        data: {
          album: expect.objectContaining({
            aiEnabled: true,
            playbackAlbumId: created.data.playbackAlbumId,
          }),
        },
      });
      expect(enabled.data).not.toHaveProperty('aiJob');
      expect(membersBeforeJob).toEqual({
        code: 0,
        data: [
          expect.objectContaining({
            aiCommentStatus: 'pending',
            aiScoreStatus: 'pending',
            photoId: 'p_001',
          }),
        ],
      });
      expect(job).toEqual(expect.objectContaining({
        generatedPhotoCount: 0,
        requestedPhotoCount: 1,
        status: 'completed',
      }));
      expect(members).toEqual({
        code: 0,
        data: [
          expect.objectContaining({
            aiCommentStatus: 'pending',
            aiScoreStatus: 'pending',
            aiTags: [],
            photoId: 'p_001',
          }),
        ],
      });
      expect(disabled).toEqual({
        code: 0,
        data: {
          album: expect.objectContaining({
            aiEnabled: false,
            playbackAlbumId: created.data.playbackAlbumId,
          }),
        },
      });
    });

    it('queues due playback album AI jobs without reporting them as synchronously completed', async () => {
      const created = appController.createAdminPlaybackAlbum({
        aiEnabled: true,
        aiRepeatIntervalMinutes: 30,
        title: 'AI 定时相册',
      });
      appController.addAdminPlaybackAlbumPhotos(created.data.playbackAlbumId, {
        photoIds: ['p_001'],
      });

      const firstRun = await appController.runAdminPlaybackAlbumAiScheduler();
      const secondRun = await appController.runAdminPlaybackAlbumAiScheduler();

      expect(firstRun).toEqual({
        code: 0,
        data: expect.objectContaining({
          dueAlbumCount: 1,
          jobResults: [
            expect.objectContaining({
              generatedPhotoCount: 0,
              jobId: expect.stringMatching(/^ai_album_/),
              playbackAlbumId: created.data.playbackAlbumId,
              requestedPhotoCount: 0,
              status: 'queued',
            }),
          ],
          skippedAlbumCount: 0,
          status: 'completed',
        }),
      });
      expect(appController.getAdminAiRecognitionTasks()).toEqual({
        code: 0,
        data: expect.arrayContaining([
          expect.objectContaining({
            albumId: created.data.playbackAlbumId,
            jobId: firstRun.data.jobResults[0]?.jobId,
            status: expect.stringMatching(/queued|running|completed/),
            targetType: 'album',
          }),
        ]),
      });
      expect(appController.clearAdminAiRecognitionTasks()).toEqual({
        code: 0,
        data: expect.objectContaining({
          deletedTaskCount: expect.any(Number),
        }),
      });
      expect(appController.getAdminAiRecognitionTasks()).toEqual({
        code: 0,
        data: [],
      });
      expect(secondRun).toEqual({
        code: 0,
        data: expect.objectContaining({
          dueAlbumCount: 0,
          jobResults: [],
          skippedAlbumCount: 1,
          status: 'completed',
        }),
      });
    });

    it('stores separate memory and beauty push thresholds for playback albums', async () => {
      const created = appController.createAdminPlaybackAlbum({
        aiEnabled: true,
        pushBeautyScoreThreshold: 72,
        pushMemoryScoreThreshold: 85,
        title: '双阈值相册',
      });
      const updated = await Promise.resolve(
        appController.updateAdminPlaybackAlbumAiPolicy(
          created.data.playbackAlbumId,
          {
            pushBeautyScoreThreshold: 76,
            pushMemoryScoreThreshold: 88,
          },
        ),
      );

      expect(created.data).toMatchObject({
        pushBeautyScoreThreshold: 72,
        pushMemoryScoreThreshold: 85,
      });
      expect(updated.data.album).toMatchObject({
        pushBeautyScoreThreshold: 76,
        pushMemoryScoreThreshold: 88,
      });
    });

    it('merges scoring, comment, classification, and layout prompts into one strict JSON contract', () => {
      const settings = {
        aiCheckIntervalMinutes: 60,
        apiKey: 'sk-test',
        apiKeyConfigured: true,
        baseUrl: 'https://api.example.com/v1',
        classificationPrompt: '类型识别提示词：人物、孩子、家庭。',
        commentPrompt: '点评中心提示词：只输出一句中文短句。',
        layoutPrompt: '版式提示词：文字必须避开人脸，输出安全区坐标。',
        model: 'vision-model',
        outputContractPrompt: '',
        provider: 'openai_compatible' as const,
        scoringPrompt: '评分中心提示词：输出 caption、type、memory_score、beauty_score、reason。',
        updatedAt: '2026-06-09T00:00:00.000Z',
      };
      const album = {
        aiEnabled: true,
        aiPriorityTags: [],
        aiRepeatIntervalMinutes: 1440,
        aiScoreThreshold: 80,
        coverPhotoId: 'p_001',
        createdAt: '2026-06-09T00:00:00.000Z',
        description: '',
        lastAiCheckedAt: '',
        photoCount: 1,
        playbackAlbumId: 'play_test',
        pushBeautyScoreThreshold: 70,
        pushEnabled: true,
        pushMemoryScoreThreshold: 85,
        pushPriorityTags: ['人物'],
        sourceAlbumId: '',
        sourceAlbumTitle: '',
        sourceType: 'manual' as const,
        title: '测试相册',
        updatedAt: '2026-06-09T00:00:00.000Z',
      };
      const item = {
        albumName: '家庭旅行',
        captionTitle: '午后',
        location: '家',
        takenAt: '2026-06-09',
      } as any;

      const systemPrompt = buildUnifiedVisionSystemPrompt(settings);
      const userPrompt = buildUnifiedVisionUserPrompt({
        album,
        derivative: {
          aiImageUrl: 'data:image/webp;base64,AA==',
          derivativeStatus: 'ready',
          thumbImageUrl: '/thumb.webp',
          tvImageUrl: '/tv.webp',
        },
        item,
        settings,
      });

      expect(systemPrompt).toContain('评分中心提示词');
      expect(systemPrompt).toContain('点评中心提示词');
      expect(systemPrompt).toContain('类型识别提示词');
      expect(systemPrompt).toContain('版式提示词');
      expect(systemPrompt).toContain('"caption"');
      expect(systemPrompt).toContain('"type"');
      expect(systemPrompt).toContain('"layout"');
      expect(userPrompt).toContain('回忆相关度阈值：85');
      expect(userPrompt).toContain('美学水平阈值：70');
    });

    it('uses one unified Vision AI call for score, comment, category, and TV design metadata', async () => {
      const analyze = jest.fn(async () => ({
        aiBeautyScore: 84,
        aiComment: '那天的笑容还在',
        aiFontStyle: 'handwriting' as const,
        aiIsTrash: false,
        aiLayoutPosition: 'bottom_right' as const,
        aiMemoryScore: 92,
        aiReason: '人物清晰，情绪自然，适合电视回忆播放。',
        aiSafeArea: { h: 0.18, w: 0.34, x: 0.58, y: 0.7 },
        aiScore: 90,
        aiTags: ['人物', '开心', '家庭'],
        aiTextColor: '#FFFFFF' as const,
      }));
      appService.replaceVisionAiForTesting({ analyze });
      const created = appController.createAdminPlaybackAlbum({
        aiEnabled: true,
        title: '统一 AI 相册',
      });
      appController.addAdminPlaybackAlbumPhotos(created.data.playbackAlbumId, {
        photoIds: ['p_001'],
      });

      const job = await Promise.resolve(
        appService.createPlaybackAlbumAiJob(created.data.playbackAlbumId),
      );
      const login = appController.loginDevice({
        password: 'admin123',
        username: 'admin',
      });
      const playlist = appController.getPlaylist(
        undefined,
        login.deviceToken,
        undefined,
        'family-travel',
      );

      expect(analyze).toHaveBeenCalledTimes(1);
      expect(analyze).toHaveBeenCalledWith(
        expect.objectContaining({
          album: expect.objectContaining({ title: '统一 AI 相册' }),
          derivative: expect.objectContaining({
            aiImageUrl: expect.stringMatching(/^data:image\/webp;base64,/),
            tvImageUrl: '/api/derivatives/p_001/tv_4k.webp',
          }),
          item: expect.objectContaining({ photoId: 'p_001' }),
        }),
      );
      expect(job).toEqual(expect.objectContaining({
        generatedPhotoCount: 1,
        requestedPhotoCount: 1,
        status: 'completed',
      }));
      expect(playlist.items[0]).toMatchObject({
        ai: expect.objectContaining({
          beautyScore: 84,
          comment: '那天的笑容还在',
          isTrash: false,
          memoryScore: 92,
          tags: ['人物', '开心', '家庭'],
        }),
        display: expect.objectContaining({
          aiImageUrl: '/api/derivatives/p_001/ai_720.webp',
          fontStyle: 'handwriting',
          textColor: '#FFFFFF',
          tvImageUrl: '/api/derivatives/p_001/tv_4k.webp',
        }),
        displayImageUrl: '/api/derivatives/p_001/tv_4k.webp',
        layout: expect.objectContaining({
          position: 'right_bottom',
          safeArea: { h: 0.18, w: 0.34, x: 0.58, y: 0.7 },
        }),
      });
    });

    it('normalizes the latest TV layout prompt typography shape for playback metadata', () => {
      const insight = normalizeUnifiedVisionResult({
        beauty_score: 86.4,
        caption: 'A warm family moment',
        categories: ['family', 'daily'],
        comment: '灯火还亮，笑声很长',
        is_trash: false,
        layout: {
          mask_gradient: 'left_dark',
          position_anchor: 'left_center',
          safe_area: {
            x_max: 46,
            x_min: 8,
            y_max: 62,
            y_min: 30,
          },
          text_align: 'left',
          text_color: '#FFFFFF',
        },
        memory_score: 92.6,
        reason: 'Family subject is clear and emotionally valuable.',
        typography: {
          primary_text: {
            content: '那年午后的光',
            font_family: 'LXGW WenKai Screen',
            weight: 'regular',
          },
          secondary_text: {
            content: '轻轻落在旧沙发上',
            font_family: 'Source Han Serif CJK',
            weight: 'light',
          },
        },
        type: 'family,daily',
      });

      expect(insight).toEqual(
        expect.objectContaining({
          aiBeautyScore: 86,
          aiComment: '灯火还亮，笑声很长',
          aiFontStyle: 'handwriting',
          aiLayoutPosition: 'center_safe',
          aiMemoryScore: 93,
          aiSafeArea: { h: 0.32, w: 0.38, x: 0.08, y: 0.3 },
          aiTags: ['family', 'daily'],
          aiTextColor: '#FFFFFF',
        }),
      );
    });

    it('builds a single strict photo_tv_payload_v1 prompt contract by default', () => {
      const prompt = buildUnifiedVisionSystemPrompt({
        aiCheckIntervalMinutes: 60,
        apiKey: 'test-key',
        apiKeyConfigured: true,
        baseUrl: 'https://example.test/v1',
        classificationPrompt: '识别类型。',
        commentPrompt: '生成旁白。',
        dailyAiLimit: 100,
        layoutPrompt: '生成 TV 版式。',
        model: 'gpt-test',
        outputContractPrompt: '',
        provider: 'openai_compatible',
        scoringPrompt: '进行评分。',
        updatedAt: '2026-06-11T00:00:00.000Z',
      });

      expect(prompt).toContain('schema_version');
      expect(prompt).toContain('photo_tv_payload_v1');
      expect(prompt).toContain('photo_analysis');
      expect(prompt).toContain('evaluation');
      expect(prompt).toContain('classification');
      expect(prompt).toContain('narration');
      expect(prompt).toContain('tv_layout');
    });

    it('appends the standard output contract separately from the business prompt', () => {
      const prompt = buildUnifiedVisionSystemPrompt({
        aiCheckIntervalMinutes: 60,
        apiKey: 'test-key',
        apiKeyConfigured: true,
        baseUrl: 'https://example.test/v1',
        classificationPrompt: '',
        commentPrompt: '',
        dailyAiLimit: 100,
        layoutPrompt: '',
        model: 'gpt-test',
        outputContractPrompt: '必须返回 scores、narration_options、selected_narration_index 和 layout_plan。',
        provider: 'openai_compatible',
        scoringPrompt: '请按家庭相册的审美口径自由分析这张照片。',
        updatedAt: '2026-06-12T00:00:00.000Z',
      });

      expect(prompt).toContain('【业务提示词】');
      expect(prompt).toContain('请按家庭相册的审美口径自由分析这张照片。');
      expect(prompt).toContain('【标准输出字段要求】');
      expect(prompt).toContain('必须返回 scores、narration_options、selected_narration_index 和 layout_plan。');
      expect(prompt.indexOf('【标准输出字段要求】')).toBeLessThan(
        prompt.indexOf('【业务提示词】'),
      );
    });

    it('rejects malformed photo_tv_payload_v1 responses instead of defaulting to completed AI', () => {
      expect(() =>
        normalizeUnifiedVisionResult({
          evaluation: {
            memory_score: 91,
          },
          schema_version: 'photo_tv_payload_v1',
        }),
      ).toThrow(/photo_tv_payload_v1/i);
    });

    it('parses fenced JSON returned by the AI provider', () => {
      expect(parseAiJsonContent('```json\n{"ok":true,"message":"pong"}\n```')).toEqual({
        message: 'pong',
        ok: true,
      });
    });

    it('parses fenced JSON after provider preamble text', () => {
      expect(parseAiJsonContent(`
> search("请根据图片返回 JSON：{\\"seen_image\\": true}")

\`\`\`json
{
  "seen_image": true,
  "summary": "一家人在客厅准备传统节日礼品",
  "category": "家庭聚会"
}
\`\`\`
`)).toEqual({
        category: '家庭聚会',
        seen_image: true,
        summary: '一家人在客厅准备传统节日礼品',
      });
    });

    it('parses trailing JSON after provider tool preamble JSON', () => {
      expect(parseAiJsonContent(`
> {"prompt":"分析上传的图像内容，输出JSON: {\\"seen_image\\": true}","size":"512x512"}

{"seen_image": true, "summary": "家庭团聚，摆放礼品", "category": "家庭聚会"}
`)).toEqual({
        category: '家庭聚会',
        seen_image: true,
        summary: '家庭团聚，摆放礼品',
      });
    });

    it('normalizes provider payloads that use caption text and priority tags', () => {
      const insight = normalizeUnifiedVisionResult(parseAiJsonContent(`\`\`\`json
{
  "photo_id": "feiniu-127678",
  "push_qualified": true,
  "beauty_score": 75,
  "memory_score": 85,
  "priority_tags": ["人物", "家庭", "庆祝", "生日"],
  "caption": {
    "text": "一家人围坐桌旁，为孩子庆祝生日",
    "position": "bottom_left",
    "text_color": "#FFFFFF"
  }
}
\`\`\``));

      expect(insight).toEqual(
        expect.objectContaining({
          aiBeautyScore: 75,
          aiComment: '一家人围坐桌旁，为孩子庆祝生日',
          aiLayoutPosition: 'bottom_left',
          aiMemoryScore: 85,
          aiScore: 82,
          aiTags: ['人物', '家庭', '庆祝', '生日'],
          aiTextColor: '#FFFFFF',
        }),
      );
    });

    it('normalizes five three-part narration variants from photo_tv_payload_v1', () => {
      const variants = Array.from({ length: 5 }, (_, index) => ({
        handwritten_thought: `那天读过的故事，还在慢慢长大${index + 1}`,
        lyrical_closure: `午后的光没有走远${index + 1}`,
        scene_description: `小手翻开彩色绘本${index + 1}`,
      }));
      const insight = normalizeUnifiedVisionResult({
        classification: {
          category: '人物,儿童,家庭',
          scene_tags: ['人物', '儿童', '家庭'],
          tv_suitability: 'high',
        },
        evaluation: {
          beauty_score: 84,
          is_trash: false,
          memory_score: 91,
          reason: '生活场景自然，光线柔和，具有家庭记录价值。',
        },
        narration: { variants },
        photo_analysis: {
          caption: '孩子坐在床边翻看绘本，午后的光落在粉色床单和玩具上。',
        },
        push_decision: {
          push_reason: '达到双阈值。',
          should_push: true,
        },
        schema_version: 'photo_tv_payload_v1',
        tv_layout: {
          layout: {
            position_anchor: 'bottom_left',
            safe_area: { h: 0.28, w: 0.42, x: 0.08, y: 0.62 },
            text_color: '#FFFFFF',
          },
          typography: {
            primary_text: {
              content: variants[0].handwritten_thought,
              font_family: 'handwriting',
              weight: 'regular',
            },
          },
        },
      });

      expect(insight.aiComment).toBe(
        '小手翻开彩色绘本1\n那天读过的故事，还在慢慢长大1\n午后的光没有走远1',
      );
      expect(insight.aiNarrationVariants).toHaveLength(5);
      expect(insight.aiNarrationVariants?.[4]).toEqual({
        handwrittenThought: '那天读过的故事，还在慢慢长大5',
        lyricalClosure: '午后的光没有走远5',
        sceneDescription: '小手翻开彩色绘本5',
      });
    });

    it('normalizes the new canonical scores narration_options and layout_plan fields', () => {
      const narrationOptions = Array.from({ length: 5 }, (_, index) => ({
        handwritten_thought: `旧院里的笑声，轻轻落在心上${index + 1}`,
        lyrical_closure: `风把那天慢慢收好${index + 1}`,
        scene_description: `院中亲友围坐合影${index + 1}`,
      }));
      const insight = normalizeUnifiedVisionResult({
        caption: {
          text: '亲友在院子里围坐合影，桌上摆着水果和茶水，背景有绿植和午后的自然光。',
        },
        classification: {
          category: '人物,家庭聚会',
          scene_tags: ['人物', '家庭', '聚会'],
          tv_suitability: 'high',
        },
        layout_plan: {
          layout: {
            position_anchor: 'top_right',
            safe_area: { h: 0.22, w: 0.4, x: 0.52, y: 0.18 },
            text_color: '#000000',
          },
          typography: {
            primary_text: {
              content: narrationOptions[2]?.handwritten_thought,
              font_family: 'handwriting',
              weight: 'regular',
            },
          },
        },
        narration_options: narrationOptions,
        schema_version: 'photo_tv_payload_v1',
        scores: {
          beauty_score: 88,
          is_trash: false,
          memory_score: 94,
          reason: '人物关系自然，场景具有家庭回忆价值。',
        },
        selected_narration_index: 3,
      });

      expect(insight).toEqual(
        expect.objectContaining({
          aiBeautyScore: 88,
          aiComment: '院中亲友围坐合影3\n旧院里的笑声，轻轻落在心上3\n风把那天慢慢收好3',
          aiFontStyle: 'handwriting',
          aiLayoutPosition: 'top_right',
          aiMemoryScore: 94,
          aiReason: '人物关系自然，场景具有家庭回忆价值。',
          aiSafeArea: { h: 0.22, w: 0.4, x: 0.52, y: 0.18 },
          aiTags: ['人物', '家庭聚会', '家庭', '聚会'],
          aiTextColor: '#000000',
        }),
      );
      expect(insight.aiNarrationVariants).toHaveLength(5);
    });

    it('normalizes current prompt output without schema_version and with line-based narration fields', () => {
      const narrationOptions = Array.from({ length: 5 }, (_, index) => ({
        closing_line: `日子也跟着亮起来${index + 1}`,
        scene_line: `红色礼篮摆在地上${index + 1}`,
        handwritten_line: `大家站在一起，热闹就有了形状${index + 1}`,
        style: index === 2 ? '生活口语' : '自然真实',
      }));
      const insight = normalizeUnifiedVisionResult({
        caption: '明亮的室内客厅里，几位家人并排站在礼篮和竹编礼盒后方，墙面有红色喜庆装饰。',
        classification: {
          category: '家庭,人物,日常',
          orientation: 'landscape',
          scene_tags: ['室内', '合照', '礼品', '庆祝'],
          subject_type: 'group_people',
          tv_suitability: 'high',
        },
        layout_plan: {
          layout: {
            position_anchor: 'top_left',
            safe_area: { x_min: 10, x_max: 90, y_min: 10, y_max: 90 },
            text_color: '#F0D3A0',
          },
          typography: {
            handwriting_text: {
              content: narrationOptions[2]?.handwritten_line,
              font_family: '3type Xishan',
              weight: 'regular',
            },
          },
        },
        narration_options: narrationOptions,
        scores: {
          beauty_score: 80,
          memory_score: 88.5,
          reason: '人物自然，礼品和红色装饰带来家庭庆祝氛围。',
        },
        selected_narration_index: 3,
      });

      expect(insight).toEqual(
        expect.objectContaining({
          aiBeautyScore: 80,
          aiComment: '红色礼篮摆在地上3\n大家站在一起，热闹就有了形状3\n日子也跟着亮起来3',
          aiFontStyle: 'handwriting',
          aiLayoutPosition: 'top_left',
          aiMemoryScore: 89,
          aiReason: '人物自然，礼品和红色装饰带来家庭庆祝氛围。',
          aiTags: ['家庭', '人物', '日常', '室内', '合照', '礼品', '庆祝'],
          aiTextColor: '#FFFFFF',
        }),
      );
      expect(insight.aiNarrationVariants).toHaveLength(5);
    });

    it('normalizes legacy generated captions for stored AI result synchronization', () => {
      const insight = normalizeUnifiedVisionResult({
        beauty_score: 78,
        generated_captions: [
          {
            confidence: 0.95,
            position: 'bottom_left',
            text: '两个孩子靠在玩具旁，午后的光落在身边。',
          },
        ],
        memory_score: 83,
        priority_tags: ['人物', '儿童', '玩具', '家庭'],
      });

      expect(insight).toEqual(
        expect.objectContaining({
          aiBeautyScore: 78,
          aiComment: '两个孩子靠在玩具旁，午后的光落在身边。',
          aiLayoutPosition: 'bottom_left',
          aiMemoryScore: 83,
          aiTags: ['人物', '儿童', '玩具', '家庭'],
        }),
      );
    });

    it('extracts and preserves the stored AI detail envelope during synchronization', () => {
      const aiDetail = JSON.stringify({
        imageSent: true,
        model: 'gpt-4o-all',
        raw: {
          beauty_score: 78,
          generated_captions: [
            {
              position: 'bottom_left',
              text: '两个孩子靠在玩具旁，午后的光落在身边。',
            },
          ],
          memory_score: 83,
          priority_tags: ['人物', '儿童', '玩具', '家庭'],
        },
      });

      expect(normalizeStoredAiDetail(aiDetail)).toEqual(
        expect.objectContaining({
          aiBeautyScore: 78,
          aiComment: '两个孩子靠在玩具旁，午后的光落在身边。',
          aiDetail,
          aiMemoryScore: 83,
        }),
      );
    });

    it('normalizes nested analysis and push decision payloads from the AI provider', () => {
      const insight = normalizeUnifiedVisionResult({
        analysis: {
          beauty_score: 86,
          beauty_score_reason: '光线柔和通透，背景干净。',
          caption_candidates: [
            '一起长大的时光，都藏在这张照片里。',
          ],
          memory_score: 94,
          memory_score_reason: '多名儿童同框，具备家庭纪念意义。',
          tags: ['家庭', '儿童', '成长记录'],
        },
        push_decision: {
          beauty_score: 86,
          memory_score: 94,
          push_reason: '同时满足美学水平阈值与回忆相关度阈值。',
          should_push: true,
        },
      });

      expect(insight).toEqual(
        expect.objectContaining({
          aiBeautyScore: 86,
          aiComment: '一起长大的时光，都藏在这张照片里。',
          aiMemoryScore: 94,
          aiReason: '同时满足美学水平阈值与回忆相关度阈值。',
          aiScore: 91,
          aiTags: ['家庭', '儿童', '成长记录'],
        }),
      );
    });

    it('normalizes ai_analysis payloads from the AI provider', () => {
      const insight = normalizeUnifiedVisionResult({
        ai_analysis: {
          beauty_score: 85,
          caption: 'Four children sit together in a warm family scene.',
          memory_score: 92,
          tags: ['family', 'children'],
        },
        push_decision: true,
      });

      expect(insight).toEqual(
        expect.objectContaining({
          aiBeautyScore: 85,
          aiComment: 'Four children sit together in a warm',
          aiMemoryScore: 92,
          aiScore: 90,
          aiTags: ['family', 'children'],
        }),
      );
    });

    it('serves playback albums and AI-designed derivative items to TV devices', async () => {
      const created = appController.createAdminPlaybackAlbum({
        aiEnabled: true,
        title: 'TV 播放闭环相册',
      });
      appController.addAdminPlaybackAlbumPhotos(created.data.playbackAlbumId, {
        photoIds: ['p_001'],
      });
      appService.replaceVisionAiForTesting({
        analyze: async () => ({
          aiBeautyScore: 84,
          aiComment: '那天的笑容还在',
          aiFontStyle: 'handwriting',
          aiIsTrash: false,
          aiLayoutPosition: 'bottom_right',
          aiMemoryScore: 92,
          aiReason: '人物清晰，家庭记忆价值高。',
          aiSafeArea: { h: 0.18, w: 0.34, x: 0.58, y: 0.7 },
          aiScore: 89,
          aiTags: ['回忆', '人物'],
          aiTextColor: '#FFFFFF',
        }),
      });
      await Promise.resolve(
        appService.createPlaybackAlbumAiJob(created.data.playbackAlbumId),
      );
      const login = appController.loginDevice({
        password: 'admin123',
        username: 'admin',
      });

      const albums = appController.getAlbums(login.deviceToken);
      const playlist = appController.getPlaylist(
        undefined,
        login.deviceToken,
        undefined,
        created.data.playbackAlbumId,
      );
      const albumDetail = appController.getAlbum(
        created.data.playbackAlbumId,
        login.deviceToken,
      );

      expect(albums.albums).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            albumId: created.data.playbackAlbumId,
            photoCount: 1,
            title: 'TV 播放闭环相册',
          }),
        ]),
      );
      expect(playlist.items).toHaveLength(1);
      expect(albumDetail).toMatchObject({
        albumId: created.data.playbackAlbumId,
        photoCount: 1,
        title: 'TV 播放闭环相册',
      });
      expect(albumDetail.items).toHaveLength(1);
      expect(albumDetail.items[0]?.displayImageUrl).toBe('/api/derivatives/p_001/tv_4k.webp');
      expect(playlist.items[0]).toMatchObject({
        ai: expect.objectContaining({
          commentStatus: 'completed',
          scoreStatus: 'completed',
        }),
        caption: expect.objectContaining({
          text: expect.any(String),
        }),
        display: expect.objectContaining({
          aiImageUrl: '/api/derivatives/p_001/ai_720.webp',
          tvImageUrl: '/api/derivatives/p_001/tv_4k.webp',
        }),
        displayImageUrl: '/api/derivatives/p_001/tv_4k.webp',
        layout: expect.objectContaining({
          safeArea: expect.any(Object),
        }),
      });
    });

    it('updates a photo AI comment for manual curation', () => {
      const updated = appController.updateAdminPhotoAiComment('p_001', {
        aiComment: '那天的笑容还在灯光里',
        aiLocked: true,
      });

      expect(updated).toEqual({
        code: 0,
        data: expect.objectContaining({
          aiComment: '那天的笑容还在灯光里',
          aiCommentStatus: 'completed',
          aiLocked: true,
          photoId: 'p_001',
        }),
      });
    });
  });

  describe('device playlist auth', () => {
    it('rejects playlist requests without a device token', () => {
      expect(() => appController.getPlaylist()).toThrow(UnauthorizedException);
    });

    it('rejects playlist requests with an invalid device token', () => {
      expect(() => appController.getPlaylist(undefined, 'bad-token')).toThrow(
        UnauthorizedException,
      );
    });

    it('accepts the account-login device token', () => {
      const login = appController.loginDevice({
        password: 'admin123',
        username: 'admin',
      });

      const playlist = appController.getPlaylist(undefined, login.deviceToken);

      expect(playlist.items).toHaveLength(9);
      expect(playlist.items[0]?.displayImageUrl).toBe('/api/photos/p_001/display?source=ceshi');
    });

    it('returns protected album list for a valid device token', () => {
      const login = appController.loginDevice({
        password: 'admin123',
        username: 'admin',
      });

      const albums = appController.getAlbums(login.deviceToken);

      expect(albums.total).toBe(3);
      expect(albums.albums[0]).toMatchObject({
        albumId: 'family-travel',
        coverPhotoId: 'p_001',
        photoCount: 3,
        title: '家庭旅行',
      });
    });

    it('keeps the sqlite-backed TV album contract synchronous after source abstraction', () => {
      const login = appController.loginDevice({
        password: 'admin123',
        username: 'admin',
      });

      const albums = appController.getAlbums(login.deviceToken);
      const album = appController.getAlbum('family-travel', login.deviceToken);
      const playlist = appController.getPlaylist(
        undefined,
        login.deviceToken,
        undefined,
        'family-travel',
      );

      expect(albums).not.toBeInstanceOf(Promise);
      expect(album).not.toBeInstanceOf(Promise);
      expect(playlist).not.toBeInstanceOf(Promise);
      expect(albums.albums[0]?.albumId).toBe('family-travel');
      expect(album.items.map((item) => item.photoId)).toEqual([
        'p_001',
        'p_002',
        'p_003',
      ]);
      expect(playlist.items.map((item) => item.photoId)).toEqual([
        'p_001',
        'p_002',
        'p_003',
      ]);
    });

    it('returns protected album detail for a valid device token', () => {
      const login = appController.loginDevice({
        password: 'admin123',
        username: 'admin',
      });

      const album = appController.getAlbum('old-photos', login.deviceToken);

      expect(album.albumId).toBe('old-photos');
      expect(album.items).toHaveLength(3);
      expect(album.items[0]?.photoId).toBe('p_007');
    });

    it('serves the real photos from the ceshi folder for TV playback', () => {
      const asset = appService.getPhotoAsset('p_001');

      expect(asset).toMatchObject({
        contentType: 'image/jpeg',
        filename: '_DSC6456.jpg',
      });
      expect(asset?.path.endsWith('ceshi\\_DSC6456.jpg') || asset?.path.endsWith('ceshi/_DSC6456.jpg')).toBe(true);
    });

    it('can return an empty album list for TV empty-state validation', () => {
      const login = appController.loginDevice({
        password: 'admin123',
        username: 'admin',
      });

      const albums = appController.getAlbums(
        login.deviceToken,
        undefined,
        'empty-albums',
      );

      expect(albums.total).toBe(0);
      expect(albums.albums).toEqual([]);
    });

    it('can return an empty album detail and playlist for TV empty-state validation', () => {
      const login = appController.loginDevice({
        password: 'admin123',
        username: 'admin',
      });

      const album = appController.getAlbum(
        'empty-demo',
        login.deviceToken,
        undefined,
        'empty-playlist',
      );
      const playlist = appController.getPlaylist(
        undefined,
        login.deviceToken,
        undefined,
        'empty-demo',
        'empty-playlist',
      );

      expect(album.albumId).toBe('empty-demo');
      expect(album.photoCount).toBe(0);
      expect(album.items).toEqual([]);
      expect(playlist.playlistId).toBe('pl_demo_empty-demo');
      expect(playlist.items).toEqual([]);
    });

    it('filters playlist by album id', () => {
      const login = appController.loginDevice({
        password: 'admin123',
        username: 'admin',
      });

      const playlist = appController.getPlaylist(
        undefined,
        login.deviceToken,
        undefined,
        'weekend-daily',
      );

      expect(playlist.playlistId).toBe('pl_demo_weekend-daily');
      expect(playlist.items).toHaveLength(3);
      expect(playlist.items[0]?.photoId).toBe('p_004');
    });

    it('rejects missing album detail requests', () => {
      const login = appController.loginDevice({
        password: 'admin123',
        username: 'admin',
      });

      expect(() =>
        appController.getAlbum('missing-album', login.deviceToken),
      ).toThrow(NotFoundException);
    });

    it('rejects missing album detail requests from async photo sources', async () => {
      const asyncSource: PhotoSource = {
        getAlbum: async () => null,
        id: 'async-test',
        listAlbums: async () => [],
        listPlaylistItems: async () => [],
      };
      appService.replacePhotoSourceForTesting(asyncSource);
      const login = appController.loginDevice({
        password: 'admin123',
        username: 'admin',
      });

      await expect(
        Promise.resolve(appController.getAlbum('missing-album', login.deviceToken)),
      ).rejects.toThrow(NotFoundException);
    });

    it('accepts a bearer token from a confirmed device binding', () => {
      const session = appController.createDeviceBindSession({});
      const bound = appController.confirmDeviceBindSession(session.bindCode, {
        deviceName: '测试电视',
      });

      const playlist = appController.getPlaylist(
        '1',
        undefined,
        `Bearer ${bound.deviceToken}`,
      );

      expect(playlist.items).toHaveLength(1);
      expect(playlist.items[0]?.photoId).toBe('p_001');
    });
  });
});

function countPhotoFiles(photoRoot: string): number {
  if (!existsSync(photoRoot)) return 0;
  if (!statSync(photoRoot).isDirectory()) return 0;

  return readdirSync(photoRoot, { withFileTypes: true }).reduce((count, entry) => {
    const entryPath = join(photoRoot, entry.name);
    if (entry.isDirectory()) return count + countPhotoFiles(entryPath);
    return /\.(jpe?g|png|webp)$/i.test(entry.name) ? count + 1 : count;
  }, 0);
}

function playlistItem(albumId: string, photoId: string): PlaylistItem {
  return {
    ai: {
      comment: '',
      commentStatus: 'pending',
      locked: false,
      score: null,
      scoreStatus: 'pending',
      tags: [],
    },
    albumId,
    albumName: '阿乎精修图',
    animation: {
      imageTransition: 'ken_burns_fade',
      textEnter: 'fade_up',
      textExit: 'fade_out',
      textIdle: 'soft_float',
    },
    animationTemplateId: 'cinematic_soft',
    caption: {
      style: 'minimal',
      text: '来自飞牛相册的照片。',
      title: '飞牛照片',
    },
    display: {
      animationTemplateId: 'cinematic_soft',
      captionStyle: 'minimal',
      layoutTemplateId: 'bottom_gradient',
      templateId: 'classic-memory-v1',
    },
    displayImageUrl: `/api/photos/${photoId}/display`,
    dominantColor: '#6b7280',
    durationMs: 12_000,
    imageFitMode: 'cover_safe',
    imageUrl: `/api/photos/${photoId}/original`,
    layout: {
      position: 'left_bottom',
      type: 'bottom_gradient',
    },
    layoutTemplateId: 'bottom_gradient',
    location: '',
    performanceHint: 'standard',
    photoId,
    takenAt: '2025-09-05',
    thumbnailUrl: `/api/photos/${photoId}/thumb`,
  };
}
