import { describe, expect, it } from 'vitest';

import { overridesPreferences } from './preferences';

describe('application preferences', () => {
  it('opens the photo library instead of the template analytics page', () => {
    expect(overridesPreferences.app?.defaultHomePath).toBe(
      '/photo-library/photos',
    );
  });
});
