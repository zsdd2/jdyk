import { createDefaultPhotoSourceRegistry } from './photo-source-registry';

describe('createDefaultPhotoSourceRegistry', () => {
  it('uses sqlite as the default photo source when Feiniu is not configured', () => {
    const registry = createDefaultPhotoSourceRegistry({});

    expect(registry.getActiveSource().id).toBe('sqlite');

    registry.close();
  });

  it('combines sqlite and Feiniu sources when the Feiniu environment is configured', () => {
    const registry = createDefaultPhotoSourceRegistry({
      WRJDYK_FEINIU_BASE_URL: 'http://nas.local',
      WRJDYK_FEINIU_PASSWORD: 'secret',
      WRJDYK_FEINIU_USERNAME: 'alice',
      WRJDYK_PHOTO_SOURCE: 'feiniu',
    });

    expect(registry.getActiveSource().id).toBe('mixed');
    expect(registry.getSourceById('sqlite')?.id).toBe('sqlite');
    expect(registry.getSourceById('feiniu')?.id).toBe('feiniu');

    registry.close();
  });
});
