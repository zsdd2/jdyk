import { describe, expect, it } from 'vitest';

import routes from './routes/modules/photo-library';

describe('photo library routes', () => {
  it('includes the TV release management page in frontend access mode', () => {
    const photoLibraryRoute = routes.find(
      (route) => route.name === 'PhotoLibrary',
    );
    const tvReleaseRoute = photoLibraryRoute?.children?.find(
      (route) => route.name === 'PhotoLibraryTvRelease',
    );

    expect(tvReleaseRoute).toMatchObject({
      path: '/photo-library/tv-release',
    });
  });
});
