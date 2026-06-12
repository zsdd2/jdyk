import { beforeEach, describe, expect, it, vi } from 'vitest';

const requestClientMock = {
  post: vi.fn(),
  upload: vi.fn(),
};

vi.mock('#/api/request', () => ({
  requestClient: requestClientMock,
}));

describe('TV release API', () => {
  beforeEach(() => {
    requestClientMock.post.mockReset();
    requestClientMock.upload.mockReset();
  });

  it('uses the multipart uploader for APK uploads', async () => {
    requestClientMock.upload.mockResolvedValue({ ok: true });
    const { uploadTvReleasePackageApi } = await import('./photo-library');
    const file = new File(['apk'], 'wangri-tv-1.0.3.apk', {
      type: 'application/vnd.android.package-archive',
    });

    await uploadTvReleasePackageApi({
      file,
      forceUpdate: true,
      releaseNotes: 'Android TV 1.0.3',
      versionCode: 8,
      versionName: '1.0.3',
    });

    expect(requestClientMock.upload).toHaveBeenCalledWith(
      '/admin/photo-library/tv-release/upload',
      {
        file,
        forceUpdate: true,
        releaseNotes: 'Android TV 1.0.3',
        versionCode: 8,
        versionName: '1.0.3',
      },
    );
    expect(requestClientMock.post).not.toHaveBeenCalled();
  });
});
