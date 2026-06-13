import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'fs';
import { join } from 'path';
import { DatabaseSync } from 'node:sqlite';
import { SqlitePhotoRepository } from './sqlite-photo.repository';

describe('SqlitePhotoRepository', () => {
  const testDataDir = join(process.cwd(), '.test-data');
  const databasePath = join(testDataDir, 'wrjdyk-test.sqlite');
  const photoRoot = join(__dirname, '..', '..', '..', 'ceshi');
  let repository: SqlitePhotoRepository | undefined;

  beforeEach(() => {
    mkdirSync(testDataDir, { recursive: true });
    rmSync(databasePath, { force: true });
  });

  afterEach(() => {
    repository?.close();
    repository = undefined;
    rmSync(databasePath, { force: true });
    rmSync(join(testDataDir, 'derivatives'), { force: true, recursive: true });
  });

  it('creates a sqlite database seeded from the ceshi photos', () => {
    repository = new SqlitePhotoRepository({
      databasePath,
      photoRoot,
    });

    repository.initialize();

    const albums = repository.listAlbums();
    const playlist = repository.listPlaylistItems();
    const weekendItems = repository.listPlaylistItems('weekend-daily');
    const firstAsset = repository.getPhotoAsset('p_001');

    expect(existsSync(databasePath)).toBe(true);
    expect(albums).toHaveLength(3);
    expect(albums[0]).toMatchObject({
      albumId: 'family-travel',
      coverPhotoId: 'p_001',
      photoCount: 3,
      title: '家庭旅行',
    });
    expect(playlist).toHaveLength(9);
    expect(playlist[0]).toMatchObject({
      ai: {
        comment: '',
        commentStatus: 'pending',
        locked: false,
        score: null,
        scoreStatus: 'pending',
        tags: [],
      },
      albumId: 'family-travel',
      displayImageUrl: '/api/photos/p_001/display?source=ceshi',
      display: {
        animationTemplateId: 'cinematic_soft',
        captionStyle: 'warm_memory',
        layoutTemplateId: 'bottom_gradient',
        templateId: 'classic-memory-v1',
      },
      photoId: 'p_001',
    });
    expect(weekendItems.map((item) => item.photoId)).toEqual([
      'p_004',
      'p_005',
      'p_006',
    ]);
    expect(firstAsset).toMatchObject({
      contentType: 'image/jpeg',
      filename: '_DSC6456.jpg',
    });
  });

  it('records the applied schema migration version', () => {
    repository = new SqlitePhotoRepository({
      databasePath,
      photoRoot,
    });

    repository.initialize();
    repository.close();

    const database = new DatabaseSync(databasePath, { readOnly: true });
    try {
      const rows = database
        .prepare(
          `
            SELECT version, name
            FROM schema_migrations
            ORDER BY version ASC
          `,
        )
        .all() as unknown as Array<{ name: string; version: number }>;

      expect(rows).toEqual([
        {
          name: 'initial_photo_library',
          version: 1,
        },
        {
          name: 'photo_center_metadata',
          version: 2,
        },
        {
          name: 'photo_center_external_index',
          version: 3,
        },
        {
          name: 'playback_album_curation',
          version: 4,
        },
        {
          name: 'playback_album_ai_push_policy',
          version: 5,
        },
        {
          name: 'ai_settings_center',
          version: 6,
        },
        {
          name: 'photo_derivatives_and_unified_ai',
          version: 7,
        },
        {
          name: 'ai_policy_schedule_controls',
          version: 8,
        },
        {
          name: 'ai_layout_prompt_and_push_thresholds',
          version: 9,
        },
        {
          name: 'ai_daily_limit_controls',
          version: 10,
        },
        {
          name: 'tv_device_authorizations',
          version: 11,
        },
        {
          name: 'photo_ai_recognition_details',
          version: 12,
        },
        {
          name: 'ai_recognition_tasks',
          version: 13,
        },
        {
          name: 'ai_output_contract_prompt',
          version: 14,
        },
        {
          name: 'default_ai_output_contract_prompt',
          version: 15,
        },
        {
          name: 'feiniu_settings',
          version: 16,
        },
        {
          name: 'photo_media_dimensions',
          version: 17,
        },
        {
          name: 'refresh_bundled_ai_prompts',
          version: 18,
        },
      ]);
    } finally {
      database.close();
    }
  });

  it('persists Feiniu connection settings without exposing the password', () => {
    repository = new SqlitePhotoRepository({
      databasePath,
      photoRoot,
    });

    repository.initialize();

    expect(repository.getFeiniuSettings()).toMatchObject({
      baseUrl: '',
      passwordConfigured: false,
      username: '',
    });

    const saved = repository.updateFeiniuSettings({
      baseUrl: ' http://nas.local:60000/ ',
      password: ' secret ',
      username: ' fn-user ',
    });

    expect(saved).toMatchObject({
      baseUrl: 'http://nas.local:60000/',
      passwordConfigured: true,
      username: 'fn-user',
    });
    expect(repository.getFeiniuRuntimeSettings()).toMatchObject({
      baseUrl: 'http://nas.local:60000/',
      password: 'secret',
      username: 'fn-user',
    });

    const updated = repository.updateFeiniuSettings({
      baseUrl: 'http://nas.local:60001',
      keepPassword: true,
      password: '',
      username: 'fn-user-2',
    });

    expect(updated).toMatchObject({
      baseUrl: 'http://nas.local:60001',
      passwordConfigured: true,
      username: 'fn-user-2',
    });
    expect(repository.getFeiniuRuntimeSettings().password).toBe('secret');
  });

  it('does not seed demo photo records when the demo files are missing', () => {
    const emptyPhotoRoot = join(testDataDir, 'empty-photo-root');
    mkdirSync(emptyPhotoRoot, { recursive: true });
    repository = new SqlitePhotoRepository({
      databasePath,
      photoRoot: emptyPhotoRoot,
    });

    repository.initialize();

    expect(repository.listPhotoCenterItems({ page: 1, pageSize: 20 })).toMatchObject({
      items: [],
      total: 0,
    });
    expect(repository.listAlbums()).toEqual([]);
  });

  it('persists a separate AI output contract prompt', () => {
    repository = new SqlitePhotoRepository({
      databasePath,
      photoRoot,
    });

    repository.initialize();
    const saved = repository.updateAiSettings({
      outputContractPrompt: '必须返回 scores、narration_options 和 layout_plan。',
      scoringPrompt: '只写可自由调整的业务提示词。',
    });

    expect(saved.scoringPrompt).toBe('只写可自由调整的业务提示词。');
    expect(saved.outputContractPrompt).toBe('必须返回 scores、narration_options 和 layout_plan。');
    expect(repository.getAiRuntimeSettings().outputContractPrompt).toBe(
      '必须返回 scores、narration_options 和 layout_plan。',
    );
  });

  it('provides the standard AI output contract by default', () => {
    repository = new SqlitePhotoRepository({
      databasePath,
      photoRoot,
    });

    repository.initialize();
    const settings = repository.getAiSettings();

    expect(settings.scoringPrompt).toContain('按家庭记忆价值');
    expect(settings.outputContractPrompt).toContain('photo_tv_payload_v1');
    expect(settings.outputContractPrompt).toContain('narration_options');
    expect(settings.outputContractPrompt).toContain('layout_plan');
  });

  it('loads the default AI prompts from the local prompt files', () => {
    repository = new SqlitePhotoRepository({
      databasePath,
      photoRoot,
    });

    repository.initialize();
    const settings = repository.getAiSettings();
    const businessVisionPrompt = readFileSync(
      join(process.cwd(), 'prompts', '业务 Vision 提示词.md'),
      'utf8',
    ).trim();
    const outputContractPrompt = readFileSync(
      join(process.cwd(), 'prompts', '标准输出字段要求.md'),
      'utf8',
    ).trim();

    expect(settings.scoringPrompt).toBe(businessVisionPrompt);
    expect(settings.outputContractPrompt).toBe(outputContractPrompt);
    expect(settings.outputContractPrompt).toContain('photo_analysis.observed_meta');
    expect(settings.outputContractPrompt).toContain('没有明确证据时必须返回空字符串');
  });

  it('refreshes bundled AI prompts when upgrading an existing database', () => {
    repository = new SqlitePhotoRepository({
      databasePath,
      photoRoot,
    });
    repository.initialize();
    repository.close();
    repository = null;

    const database = new DatabaseSync(databasePath);
    try {
      database.prepare(
        `
          UPDATE ai_settings
          SET scoring_prompt = 'old business prompt',
              output_contract_prompt = 'old output contract'
          WHERE id = 1
        `,
      ).run();
      database.prepare('DELETE FROM schema_migrations WHERE version = 18').run();
    } finally {
      database.close();
    }

    repository = new SqlitePhotoRepository({
      databasePath,
      photoRoot,
    });
    repository.initialize();

    const settings = repository.getAiSettings();
    expect(settings.scoringPrompt).toContain('为家庭电视播放生成 5 组三段式中文旁白');
    expect(settings.outputContractPrompt).toContain('photo_analysis.observed_meta');
  });

  it('persists AI recognition task progress across repository instances', () => {
    repository = new SqlitePhotoRepository({
      databasePath,
      photoRoot,
    });

    repository.upsertAiRecognitionTask({
      activePhotoId: 'p_001',
      activePhotoName: '_DSC6456.jpg',
      albumId: 'family-travel',
      albumTitle: '家庭旅行',
      completedPhotoCount: 0,
      createdAt: '2026-06-11T10:00:00.000Z',
      error: '',
      failedPhotoCount: 0,
      finishedAt: '',
      jobId: 'ai_task_test',
      lastUpdatedAt: '2026-06-11T10:00:00.000Z',
      requestedPhotoCount: 1,
      skippedPhotoCount: 0,
      status: 'running',
      targetId: 'p_001',
      targetTitle: '_DSC6456',
      targetType: 'photo',
    });
    repository.updateAiRecognitionTask('ai_task_test', {
      activePhotoId: '',
      activePhotoName: '',
      completedPhotoCount: 1,
      finishedAt: '2026-06-11T10:00:30.000Z',
      lastUpdatedAt: '2026-06-11T10:00:30.000Z',
      status: 'completed',
    });
    repository.close();

    repository = new SqlitePhotoRepository({
      databasePath,
      photoRoot,
    });

    expect(repository.listAiRecognitionTasks()).toEqual([
      expect.objectContaining({
        activePhotoId: '',
        activePhotoName: '',
        completedPhotoCount: 1,
        createdAt: '2026-06-11T10:00:00.000Z',
        finishedAt: '2026-06-11T10:00:30.000Z',
        jobId: 'ai_task_test',
        lastUpdatedAt: '2026-06-11T10:00:30.000Z',
        requestedPhotoCount: 1,
        status: 'completed',
        targetId: 'p_001',
        targetType: 'photo',
      }),
    ]);
  });

  it('clears AI recognition task progress logs', () => {
    repository = new SqlitePhotoRepository({
      databasePath,
      photoRoot,
    });

    repository.upsertAiRecognitionTask({
      activePhotoId: 'p_001',
      activePhotoName: '_DSC6456.jpg',
      albumId: 'family-travel',
      albumTitle: '家庭旅行',
      completedPhotoCount: 1,
      createdAt: '2026-06-11T10:00:00.000Z',
      error: '',
      failedPhotoCount: 0,
      finishedAt: '2026-06-11T10:00:30.000Z',
      jobId: 'ai_task_clear_test',
      lastUpdatedAt: '2026-06-11T10:00:30.000Z',
      requestedPhotoCount: 1,
      skippedPhotoCount: 0,
      status: 'completed',
      targetId: 'p_001',
      targetTitle: '_DSC6456',
      targetType: 'photo',
    });

    expect(repository.clearAiRecognitionTasks()).toEqual({
      deletedTaskCount: 1,
    });
    expect(repository.listAiRecognitionTasks()).toEqual([]);
  });

  it('lists photo center items with source, album, and AI statuses', () => {
    repository = new SqlitePhotoRepository({
      databasePath,
      photoRoot,
    });

    const result = repository.listPhotoCenterItems({
      page: 1,
      pageSize: 4,
    });
    const filteredByAlbum = repository.listPhotoCenterItems({
      albumId: 'weekend-daily',
      page: 1,
      pageSize: 20,
    });
    const pendingComment = repository.listPhotoCenterItems({
      aiCommentStatus: 'pending',
      page: 1,
      pageSize: 20,
    });

    expect(result).toMatchObject({
      page: 1,
      pageSize: 4,
      total: 9,
    });
    expect(result.items).toHaveLength(4);
    expect(result.items[0]).toMatchObject({
      aiCommentStatus: 'pending',
      aiScoreStatus: 'pending',
      albumId: 'family-travel',
      albumName: '家庭旅行',
      importAlbumTitle: '家庭旅行',
      photoId: 'p_001',
      sourceType: 'local',
      thumbnailUrl: '/api/photos/p_001/thumb?source=ceshi',
    });
    expect(filteredByAlbum.items.map((item) => item.photoId)).toEqual([
      'p_004',
      'p_005',
      'p_006',
    ]);
    expect(pendingComment.total).toBe(9);
  });

  it('rebuilds the sqlite photo index from the configured photo root', () => {
    const scanRoot = join(testDataDir, 'scan-root');
    mkdirSync(scanRoot, { recursive: true });
    writeFileSync(join(scanRoot, 'first.jpg'), 'fake jpg');
    writeFileSync(join(scanRoot, 'second.png'), 'fake png');
    writeFileSync(join(scanRoot, 'ignore.txt'), 'not a photo');

    repository = new SqlitePhotoRepository({
      databasePath,
      photoRoot: scanRoot,
    });

    const result = repository.rebuildFromPhotoRoot();
    const overview = repository.getOverview();
    const albums = repository.listAlbums();
    const playlist = repository.listPlaylistItems();

    expect(result).toEqual({
      discoveredPhotoCount: 2,
      importedPhotoCount: 2,
    });
    expect(overview).toMatchObject({
      albumCount: 1,
      photoCount: 2,
      photoRoot: scanRoot,
    });
    expect(albums).toHaveLength(1);
    expect(albums[0]).toMatchObject({
      albumId: 'local-scan',
      photoCount: 2,
      title: '本地扫描',
    });
    expect(playlist.map((item) => item.photoId)).toEqual([
      'scan_001',
      'scan_002',
    ]);
    expect(repository.getPhotoAsset('scan_001')).toMatchObject({
      filename: 'first.jpg',
    });
  });

  it('persists Feiniu photos into the photo center index without exposing them through the local TV source', () => {
    repository = new SqlitePhotoRepository({
      databasePath,
      photoRoot,
    });

    const result = repository.syncExternalPhotoCenterItems(
      [
        {
          albumDescription: '共享给我的飞牛相册，所有者：zsdd',
          albumId: 'feiniu-shared-to-me-47',
          albumName: '阿乎精修图',
          captionText: '共享相册照片',
          captionTitle: '飞牛照片',
          displayImageUrl: '/api/photos/feiniu-41001/display',
          filename: 'feiniu-41001.jpg',
          imageUrl: '/api/photos/feiniu-41001/original',
          location: '飞牛',
          photoId: 'feiniu-41001',
          sourceAlbumId: 'feiniu-shared-to-me-47',
          sourceAlbumKind: 'shared_to_me',
          sourceOwnerName: 'zsdd',
          sourceType: 'feiniu',
          takenAt: '2026-06-06',
          thumbnailUrl: '/api/photos/feiniu-41001/thumb',
        },
      ],
      {
        syncedAt: '2026-06-07T00:00:00.000Z',
      },
    );

    const feiniuItems = repository.listPhotoCenterItems({
      page: 1,
      pageSize: 10,
      sourceType: 'feiniu',
    });
    const tvAlbums = repository.listAlbums();

    expect(result).toEqual({
      albumCount: 1,
      discoveredPhotoCount: 1,
      importedPhotoCount: 1,
      syncedAt: '2026-06-07T00:00:00.000Z',
      updatedPhotoCount: 0,
    });
    expect(feiniuItems).toMatchObject({
      total: 1,
      items: [
        expect.objectContaining({
          albumId: 'feiniu-shared-to-me-47',
          importAlbumTitle: '阿乎精修图',
          importedAt: '2026-06-07T00:00:00.000Z',
          photoId: 'feiniu-41001',
          sourceAlbumId: 'feiniu-shared-to-me-47',
          sourceAlbumKind: 'shared_to_me',
          sourceOwnerName: 'zsdd',
          sourceType: 'feiniu',
          syncedAt: '2026-06-07T00:00:00.000Z',
          thumbnailUrl: '/api/photos/feiniu-41001/thumb',
        }),
      ],
    });
    expect(tvAlbums.map((album) => album.albumId)).not.toContain(
      'feiniu-shared-to-me-47',
    );
  });

  it('stores AI settings without exposing the API key', () => {
    repository = new SqlitePhotoRepository({
      databasePath,
      photoRoot,
    });

    const defaults = repository.getAiSettings();
    const updated = repository.updateAiSettings({
      apiKey: 'sk-test-secret',
      aiCheckIntervalMinutes: 45,
      baseUrl: 'https://api.example.com/v1',
      classificationPrompt: '识别照片类型，返回人物、开心、场景等标签。',
      commentPrompt: '为家庭电视播放写一句有温度的评语。',
      layoutPrompt: '分析电视文字安全区。',
      model: 'gpt-4o-mini',
      provider: 'openai_compatible',
      scoringPrompt: '按家庭回忆价值给照片打 0-100 分。',
    });
    const preserved = repository.updateAiSettings({
      apiKey: '',
      model: 'vision-next',
    });

    expect(defaults).toMatchObject({
      apiKeyConfigured: false,
      aiCheckIntervalMinutes: 60,
      provider: 'openai_compatible',
    });
    expect(updated).toMatchObject({
      apiKeyConfigured: true,
      aiCheckIntervalMinutes: 45,
      baseUrl: 'https://api.example.com/v1',
      classificationPrompt: '识别照片类型，返回人物、开心、场景等标签。',
      commentPrompt: '为家庭电视播放写一句有温度的评语。',
      layoutPrompt: '分析电视文字安全区。',
      model: 'gpt-4o-mini',
      provider: 'openai_compatible',
      scoringPrompt: '按家庭回忆价值给照片打 0-100 分。',
    });
    expect(updated).not.toHaveProperty('apiKey');
    expect(preserved).toMatchObject({
      apiKeyConfigured: true,
      model: 'vision-next',
    });
  });

  it('persists derivative asset urls and unified AI design metadata', async () => {
    repository = new SqlitePhotoRepository({
      databasePath,
      photoRoot,
    });

    await repository.ensurePhotoDerivatives('p_001');
    const result = repository.applyPhotoAiInsights([
      {
        aiBeautyScore: 82,
        aiComment: '那天的笑容还在',
        aiFontStyle: 'handwriting',
        aiIsTrash: false,
        aiLayoutPosition: 'bottom_right',
        aiMemoryScore: 91,
        aiReason: '人物清晰，情绪自然，适合电视回忆播放。',
        aiSafeArea: { h: 0.18, w: 0.34, x: 0.58, y: 0.7 },
        aiScore: 88,
        aiTags: ['人物', '开心', '家庭'],
        aiTextColor: '#FFFFFF',
        photoId: 'p_001',
      },
    ]);
    const playlist = repository.listPlaylistItems('family-travel');
    const photo = repository.listPhotoCenterItems({
      page: 1,
      pageSize: 1,
    }).items[0];

    expect(result).toEqual({
      generatedPhotoCount: 1,
      requestedPhotoCount: 1,
      skippedPhotoCount: 0,
    });
    expect(photo).toMatchObject({
      derivativeStatus: 'ready',
      thumbnailUrl: '/api/derivatives/p_001/thumb_300.webp',
    });
    expect(playlist[0]).toMatchObject({
      ai: expect.objectContaining({
        beautyScore: 82,
        comment: '那天的笑容还在',
        isTrash: false,
        memoryScore: 91,
        reason: '人物清晰，情绪自然，适合电视回忆播放。',
        tags: ['人物', '开心', '家庭'],
      }),
      display: expect.objectContaining({
        aiImageUrl: '/api/derivatives/p_001/ai_720.webp',
        fontStyle: 'handwriting',
        textColor: '#FFFFFF',
        tvImageUrl: '/api/derivatives/p_001/tv_blur_fill.webp',
      }),
      displayImageUrl: '/api/derivatives/p_001/tv_blur_fill.webp',
      layout: expect.objectContaining({
        position: 'right_bottom',
        safeArea: { h: 0.18, w: 0.34, x: 0.58, y: 0.7 },
      }),
      thumbnailUrl: '/api/derivatives/p_001/thumb_300.webp',
    });
  });

  it('keeps manually locked AI narration when later AI results are applied', () => {
    repository = new SqlitePhotoRepository({
      databasePath,
      photoRoot,
    });

    repository.updatePhotoAiInsight('p_001', {
      aiComment: '人工修改后的旁白',
      aiLocked: true,
    });
    repository.applyPhotoAiInsights([
      {
        aiBeautyScore: 80,
        aiComment: '模型重新生成的旁白',
        aiMemoryScore: 86,
        aiScore: 84,
        aiTags: ['回忆'],
        photoId: 'p_001',
      },
    ]);

    const photo = repository.listPhotoCenterItems({
      keyword: 'p_001',
      page: 1,
      pageSize: 1,
    }).items[0];

    expect(photo).toMatchObject({
      aiBeautyScore: 80,
      aiComment: '人工修改后的旁白',
      aiLocked: true,
      aiMemoryScore: 86,
      aiScore: 84,
    });
  });

  it('overwrites manually locked AI narration for forced single-photo recognition', () => {
    repository = new SqlitePhotoRepository({
      databasePath,
      photoRoot,
    });

    repository.updatePhotoAiInsight('p_001', {
      aiComment: '人工修改后的旁白',
      aiLocked: true,
    });
    repository.applyPhotoAiInsights([
      {
        aiBeautyScore: 82,
        aiComment: '模型重新生成的旁白',
        aiDetail: '{"imageSent":true}',
        aiMemoryScore: 88,
        aiRecognizedAt: '2026-06-11T00:00:00.000Z',
        aiScore: 86,
        aiTags: ['回忆'],
        photoId: 'p_001',
      },
    ], { forceOverwriteLockedComment: true });

    const photo = repository.listPhotoCenterItems({
      keyword: 'p_001',
      page: 1,
      pageSize: 1,
    }).items[0];

    expect(photo).toMatchObject({
      aiComment: '模型重新生成的旁白',
      aiDetail: '{"imageSent":true}',
      aiLocked: false,
      aiRecognizedAt: '2026-06-11T00:00:00.000Z',
    });
  });

  it('keeps AI narration empty and pending when the model returns no comment', () => {
    repository = new SqlitePhotoRepository({
      databasePath,
      photoRoot,
    });

    repository.applyPhotoAiInsights([
      {
        aiBeautyScore: 80,
        aiComment: '',
        aiDetail: '{"imageSent":true,"raw":{}}',
        aiMemoryScore: 82,
        aiScore: 81,
        aiTags: ['回忆'],
        photoId: 'p_001',
      },
    ], { forceOverwriteLockedComment: true });

    const photo = repository.listPhotoCenterItems({
      keyword: 'p_001',
      page: 1,
      pageSize: 1,
    }).items[0];

    expect(photo).toMatchObject({
      aiComment: '',
      aiCommentStatus: 'pending',
      aiCompleted: false,
      aiDetail: '{"imageSent":true,"raw":{}}',
      aiScoreStatus: 'completed',
    });
  });

  it('projects legacy AI detail raw content when flattened AI fields are incomplete', () => {
    repository = new SqlitePhotoRepository({
      databasePath,
      photoRoot,
    });

    repository.applyPhotoAiInsights([
      {
        aiBeautyScore: 80,
        aiComment: '',
        aiDetail: JSON.stringify({
          imageSent: true,
          raw: {
            analysis: {
              beauty_score: 86,
              memory_score: 94,
              tags: ['family', 'children'],
              caption_candidates: [
                'Growing together is the warmest memory.',
              ],
              memory_score_reason: 'High family memory value.',
            },
            push_decision: {
              push_reason: 'Meets memory and beauty thresholds.',
            },
          },
        }),
        aiMemoryScore: 80,
        aiScore: 80,
        aiTags: ['memory'],
        photoId: 'p_001',
      },
    ], { forceOverwriteLockedComment: true });

    const photo = repository.listPhotoCenterItems({
      keyword: 'p_001',
      page: 1,
      pageSize: 1,
    }).items[0];

    expect(photo).toMatchObject({
      aiBeautyScore: 86,
      aiComment: 'Growing together is the warmest memo',
      aiCommentStatus: 'completed',
      aiCompleted: true,
      aiMemoryScore: 94,
      aiReason: 'Meets memory and beauty thresholds.',
      aiScore: 91,
      aiScoreStatus: 'completed',
      aiTags: ['family', 'children'],
    });
  });

  it('projects current narration_options variants from stored AI detail', () => {
    repository = new SqlitePhotoRepository({
      databasePath,
      photoRoot,
    });

    repository.applyPhotoAiInsights([
      {
        aiBeautyScore: 78,
        aiComment: '',
        aiDetail: JSON.stringify({
          raw: {
            caption: { text: '一家人在客厅里合影' },
            classification: {
              category: '家庭,合影',
              scene_tags: ['家庭', '合影'],
              tv_suitability: 'high',
            },
            scores: {
              beauty_score: 78,
              memory_score: 93,
              reason: '家庭团聚感强，人物关系清晰。',
            },
            narration_options: Array.from({ length: 5 }, (_, index) => ({
              closing_line: `收束 ${index + 1}`,
              handwritten_line: `手写 ${index + 1}`,
              scene_line: `场景 ${index + 1}`,
            })),
            selected_narration_index: 3,
            layout_plan: {
              layout: {
                position_anchor: 'bottom_left',
                safe_area: { h: 0.2, w: 0.4, x: 0.08, y: 0.7 },
                text_color: '#FFFFFF',
              },
            },
          },
        }),
        aiMemoryScore: 93,
        aiScore: 88,
        aiTags: ['家庭'],
        photoId: 'p_001',
      },
    ], { forceOverwriteLockedComment: true });

    const photo = repository.listPhotoCenterItems({
      keyword: 'p_001',
      page: 1,
      pageSize: 1,
    }).items[0];

    expect(photo.aiNarrationVariants).toHaveLength(5);
    expect(photo.aiNarrationVariants[2]).toEqual({
      handwrittenThought: '手写 3',
      lyricalClosure: '收束 3',
      sceneDescription: '场景 3',
    });
  });

  it('clears previous AI narration when forced recognition is marked pending', () => {
    repository = new SqlitePhotoRepository({
      databasePath,
      photoRoot,
    });

    repository.applyPhotoAiInsights([
      {
        aiBeautyScore: 80,
        aiComment: 'old narration',
        aiDetail: '{"imageSent":true}',
        aiMemoryScore: 82,
        aiScore: 81,
        aiTags: ['memory'],
        photoId: 'p_001',
      },
    ]);
    repository.markPhotoAiPending('p_001', { clearAiComment: true });

    const photo = repository.listPhotoCenterItems({
      keyword: 'p_001',
      page: 1,
      pageSize: 1,
    }).items[0];

    expect(photo).toMatchObject({
      aiBeautyScore: null,
      aiComment: '',
      aiCommentStatus: 'pending',
      aiDetail: '',
      aiError: '',
      aiMemoryScore: null,
      aiReason: '',
      aiScore: null,
      aiScoreStatus: 'pending',
      aiTags: [],
    });
  });

  it('generates real derivative image files for backend, AI, and TV usage', async () => {
    const derivativeRoot = join(testDataDir, 'derivatives');
    repository = new SqlitePhotoRepository({
      databasePath,
      derivativeRoot,
      photoRoot,
    });

    const assets = await repository.ensurePhotoDerivatives('p_001');
    const playlist = repository.listPlaylistItems('family-travel');
    const photo = repository.listPhotoCenterItems({
      page: 1,
      pageSize: 1,
    }).items[0];

    expect(assets).toEqual({
      aiImageUrl: '/api/derivatives/p_001/ai_720.webp',
      derivativeStatus: 'ready',
      thumbImageUrl: '/api/derivatives/p_001/thumb_300.webp',
      tvImageUrl: '/api/derivatives/p_001/tv_blur_fill.webp',
    });
    expect(existsSync(join(derivativeRoot, 'p_001', 'thumb_300.webp'))).toBe(
      true,
    );
    expect(existsSync(join(derivativeRoot, 'p_001', 'ai_720.webp'))).toBe(true);
    expect(existsSync(join(derivativeRoot, 'p_001', 'tv_blur_fill.webp'))).toBe(true);
    expect(statSync(join(derivativeRoot, 'p_001', 'tv_blur_fill.webp')).size).toBeGreaterThan(0);
    expect(statSync(join(derivativeRoot, 'p_001', 'thumb_300.webp')).size).toBeGreaterThan(0);
    expect(photo).toMatchObject({
      derivativeStatus: 'ready',
      thumbnailUrl: '/api/derivatives/p_001/thumb_300.webp',
    });
    expect(playlist[0]).toMatchObject({
      display: expect.objectContaining({
        aiImageUrl: '/api/derivatives/p_001/ai_720.webp',
        tvImageUrl: '/api/derivatives/p_001/tv_blur_fill.webp',
      }),
      displayImageUrl: '/api/derivatives/p_001/tv_blur_fill.webp',
      thumbnailUrl: '/api/derivatives/p_001/thumb_300.webp',
    });
  });

  it('persists portrait source dimensions for TV playlist layout selection', async () => {
    const derivativeRoot = join(testDataDir, 'derivatives');
    repository = new SqlitePhotoRepository({
      databasePath,
      derivativeRoot,
      photoRoot,
    });

    await repository.ensurePhotoDerivatives('p_003');
    const portraitItem = repository
      .listPlaylistItems('family-travel')
      .find((item) => item.photoId === 'p_003');

    expect(portraitItem?.media).toEqual({
      height: 4930,
      orientation: 'portrait',
      width: 3698,
    });
  });

  it('creates playback albums and adds photo center photos without duplicates', () => {
    repository = new SqlitePhotoRepository({
      databasePath,
      photoRoot,
    });

    const album = repository.createPlaybackAlbum({
      description: '每天给客厅电视播放的精选照片。',
      title: '每日精选',
    });
    const addResult = repository.addPhotosToPlaybackAlbum(album.playbackAlbumId, [
      'p_001',
      'p_002',
      'missing_photo',
      'p_001',
    ]);
    const albums = repository.listPlaybackAlbums();
    const members = repository.listPlaybackAlbumItems(album.playbackAlbumId);

    expect(album).toMatchObject({
      coverPhotoId: '',
      description: '每天给客厅电视播放的精选照片。',
      photoCount: 0,
      title: '每日精选',
    });
    expect(album.playbackAlbumId).toMatch(/^play_/);
    expect(addResult).toEqual({
      addedPhotoCount: 2,
      requestedPhotoCount: 4,
      skippedPhotoCount: 2,
      totalPhotoCount: 2,
    });
    expect(albums).toEqual([
      expect.objectContaining({
        coverPhotoId: 'p_001',
        photoCount: 2,
        playbackAlbumId: album.playbackAlbumId,
        title: '每日精选',
      }),
    ]);
    expect(members.map((item) => item.photoId)).toEqual(['p_001', 'p_002']);
  });

  it('deletes playback album device authorizations when deleting an album', () => {
    repository = new SqlitePhotoRepository({
      databasePath,
      photoRoot,
    });

    const album = repository.createPlaybackAlbum({
      title: 'TV 授权播放相册',
    });
    const device = repository.upsertTvDevice({
      deviceId: 'tv_delete_playback_album',
      deviceName: '客厅电视',
      deviceToken: 'token-delete-playback-album',
      deviceUniqueId: 'unique-delete-playback-album',
    });

    repository.updatePlaybackAlbumDeviceAuthorizations(
      album.playbackAlbumId,
      [device.deviceId],
    );

    expect(repository.deletePlaybackAlbum(album.playbackAlbumId)).toEqual({
      deletedAlbumCount: 1,
      removedPhotoCount: 0,
    });
    expect(repository.listTvDevices()[0]?.authorizedPlaybackAlbumIds).toEqual([]);
    expect(repository.listPlaybackAlbums()).toEqual([]);
  });
});
