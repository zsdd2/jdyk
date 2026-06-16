import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppAccessGuard } from './app-access.guard';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppAccessGuard', () => {
  let app: INestApplication;
  const appService = {
    getHealth: jest.fn(() => ({ status: 'ok' })),
    getPhotoAsset: jest.fn(() => ({
      contentType: 'text/plain',
      filename: 'fixture.txt',
      path: __filename,
    })),
    getPhotoLibraryOverview: jest.fn(() => ({
      albumCount: 0,
      databasePath: ':memory:',
      migrationVersion: 0,
      photoCount: 0,
      photoRoot: 'test',
    })),
    validatePhotoAssetToken: jest.fn((path?: string, token?: string) =>
      path === '/photos/p_001/display' && token === 'signed-asset-token',
    ),
    refreshAdminToken: jest.fn((authorization?: string) =>
      authorization === 'Bearer admin-token' ? 'admin-token-refreshed' : null,
    ),
    validateAdminToken: jest.fn((authorization?: string) =>
      authorization === 'Bearer admin-token',
    ),
    validateDeviceToken: jest.fn((deviceToken?: string) =>
      deviceToken === 'device-token',
    ),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        {
          provide: AppService,
          useValue: appService,
        },
        AppAccessGuard,
        {
          provide: APP_GUARD,
          useExisting: AppAccessGuard,
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('keeps health public', async () => {
    await request(app.getHttpServer()).get('/health').expect(200);
  });

  it('rejects admin photo-library requests without an admin token', async () => {
    await request(app.getHttpServer())
      .get('/admin/photo-library/overview')
      .expect(401);

    expect(appService.getPhotoLibraryOverview).not.toHaveBeenCalled();
  });

  it('allows admin photo-library requests with an admin token', async () => {
    await request(app.getHttpServer())
      .get('/admin/photo-library/overview')
      .set('Authorization', 'Bearer admin-token')
      .expect(200);

    expect(appService.getPhotoLibraryOverview).toHaveBeenCalledTimes(1);
  });

  it('rejects admin token refresh without a current admin token', async () => {
    await request(app.getHttpServer()).post('/auth/refresh').expect(401);

    expect(appService.refreshAdminToken).not.toHaveBeenCalled();
  });

  it('allows admin token refresh with a current admin token', async () => {
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Authorization', 'Bearer admin-token')
      .expect(201)
      .expect(({ body }) => {
        expect(body).toEqual({
          code: 0,
          data: 'admin-token-refreshed',
        });
      });

    expect(appService.refreshAdminToken).toHaveBeenCalledWith('Bearer admin-token');
  });

  it('rejects photo assets without an admin or device token', async () => {
    await request(app.getHttpServer()).get('/photos/p_001/display').expect(401);

    expect(appService.getPhotoAsset).not.toHaveBeenCalled();
  });

  it('allows photo assets with a device token', async () => {
    await request(app.getHttpServer())
      .get('/photos/p_001/display')
      .set('X-Device-Token', 'device-token')
      .expect(200);

    expect(appService.getPhotoAsset).toHaveBeenCalledTimes(1);
  });

  it('allows photo assets with a signed asset token for browser image loading', async () => {
    await request(app.getHttpServer())
      .get('/photos/p_001/display?assetToken=signed-asset-token')
      .expect(200);

    expect(appService.validatePhotoAssetToken).toHaveBeenCalledWith(
      '/photos/p_001/display',
      'signed-asset-token',
    );
    expect(appService.getPhotoAsset).toHaveBeenCalledTimes(1);
  });
});
