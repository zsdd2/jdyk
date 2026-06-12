import { describe, expect, it } from 'vitest';

describe('admin request client', () => {
  it(
    'falls back to the same-origin API prefix in production',
    async () => {
      window._VBEN_ADMIN_PRO_APP_CONF_ = {
        VITE_GLOB_API_URL: '',
        VITE_GLOB_AUTH_DINGDING_CLIENT_ID: '',
        VITE_GLOB_AUTH_DINGDING_CORP_ID: '',
      };

      const { requestClient } = await import('./request');

      expect(requestClient.getBaseUrl()).toBe('/api');
    },
    15_000,
  );
});
