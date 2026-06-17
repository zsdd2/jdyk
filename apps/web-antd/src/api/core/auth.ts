import { baseRequestClient, requestClient } from '#/api/request';
import { useAccessStore } from '@vben/stores';

export namespace AuthApi {
  /** 登录接口参数 */
  export interface LoginParams {
    password?: string;
    username?: string;
  }

  /** 登录接口返回值 */
  export interface LoginResult {
    accessToken: string;
    mustChangePassword?: boolean;
  }

  export interface RefreshTokenResult {
    data: string;
    status: number;
  }

  export interface ChangePasswordParams {
    currentPassword: string;
    newPassword: string;
  }

  export interface ChangePasswordResult {
    mustChangePassword: boolean;
  }
}

/**
 * 登录
 */
export async function loginApi(data: AuthApi.LoginParams) {
  return requestClient.post<AuthApi.LoginResult>('/auth/login', data);
}

export async function changeAdminPasswordApi(data: AuthApi.ChangePasswordParams) {
  return requestClient.post<AuthApi.ChangePasswordResult>('/auth/password', data);
}

/**
 * 刷新accessToken
 */
export async function refreshTokenApi() {
  const accessStore = useAccessStore();
  const accessToken = accessStore.accessToken;
  return baseRequestClient.post<AuthApi.RefreshTokenResult>(
    '/auth/refresh',
    undefined,
    {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      withCredentials: true,
    },
  );
}

/**
 * 退出登录
 */
export async function logoutApi() {
  return baseRequestClient.post('/auth/logout', {
    withCredentials: true,
  });
}

/**
 * 获取用户权限码
 */
export async function getAccessCodesApi() {
  return requestClient.get<string[]>('/auth/codes');
}
