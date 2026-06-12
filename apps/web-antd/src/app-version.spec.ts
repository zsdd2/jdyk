import { describe, expect, it } from 'vitest';

import { getAdminReleaseVersion } from './app-version';

describe('admin release version', () => {
  it('uses the configured product release version', () => {
    expect(getAdminReleaseVersion({ VITE_ADMIN_RELEASE_VERSION: '1.0.6' })).toBe(
      '1.0.6',
    );
  });

  it('falls back when the version is not configured', () => {
    expect(getAdminReleaseVersion({})).toBe('未标记');
  });
});
