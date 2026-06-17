import { beforeEach, describe, expect, it, vi } from 'vitest';

const storageMock = {
  clear: vi.fn(),
  getItem: vi.fn(),
  key: vi.fn(),
  removeItem: vi.fn(),
  setItem: vi.fn(),
};

vi.stubGlobal('sessionStorage', storageMock);

const requestClientMock = {
  post: vi.fn(),
};

vi.mock('#/api/request', () => ({
  requestClient: requestClientMock,
}));

describe('auth API', () => {
  beforeEach(() => {
    requestClientMock.post.mockReset();
  });

  it('posts admin password changes to the auth password endpoint', async () => {
    requestClientMock.post.mockResolvedValue({ mustChangePassword: false });
    const { changeAdminPasswordApi } = await import('./auth');

    await changeAdminPasswordApi({
      currentPassword: 'admin123',
      newPassword: 'changed-secret',
    });

    expect(requestClientMock.post).toHaveBeenCalledWith('/auth/password', {
      currentPassword: 'admin123',
      newPassword: 'changed-secret',
    });
  });
});
