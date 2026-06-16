import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AppService } from './app.service';

@Injectable()
export class AppAccessGuard implements CanActivate {
  constructor(private readonly appService: AppService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const method = request.method.toUpperCase();
    const path = normalizePath(request.path || request.url || '/');

    if (isPublicRoute(method, path)) return true;

    if (isAdminRoute(path)) {
      return this.requireAdmin(request);
    }

    if (isPhotoAssetRoute(path)) {
      return this.requireAdminOrDevice(request);
    }

    if (isDeviceProtectedRoute(method, path)) {
      return this.requireDevice(request);
    }

    return true;
  }

  private requireAdmin(request: Request): boolean {
    if (this.appService.validateAdminToken(getAuthorization(request))) {
      return true;
    }
    throw new UnauthorizedException('Invalid admin token');
  }

  private requireAdminOrDevice(request: Request): boolean {
    const path = normalizePath(request.path || request.url || '/');
    const assetToken = getPhotoAssetToken(request);
    if (
      assetToken &&
      this.appService.validatePhotoAssetToken(path, assetToken)
    ) {
      return true;
    }
    if (this.appService.validateAdminToken(getAuthorization(request))) {
      return true;
    }
    if (
      this.appService.validateDeviceToken(
        getHeader(request, 'x-device-token'),
        getAuthorization(request),
      )
    ) {
      return true;
    }
    throw new UnauthorizedException('Invalid photo asset token');
  }

  private requireDevice(request: Request): boolean {
    if (
      this.appService.validateDeviceToken(
        getHeader(request, 'x-device-token'),
        getAuthorization(request),
      )
    ) {
      return true;
    }
    throw new UnauthorizedException('Invalid device token');
  }
}

function getAuthorization(request: Request): string | undefined {
  return getHeader(request, 'authorization');
}

function getHeader(request: Request, name: string): string | undefined {
  const value = request.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function getPhotoAssetToken(request: Request): string | undefined {
  const token = request.query.assetToken;
  return Array.isArray(token) ? String(token[0] ?? '') : typeof token === 'string' ? token : undefined;
}

function normalizePath(value: string): string {
  const path = value.split('?', 1)[0] || '/';
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return normalized.startsWith('/api/')
    ? normalized.slice('/api'.length)
    : normalized;
}

function isPublicRoute(method: string, path: string): boolean {
  if (method === 'GET' && (path === '/' || path === '/health')) return true;
  if (method === 'POST' && path === '/auth/login') return true;
  if (method === 'GET' && path === '/device/current-policy') return true;
  if (method === 'POST' && path === '/device/login') return true;
  if (method === 'POST' && path === '/device/bind-sessions') return true;
  if (method === 'GET' && /^\/device\/bind-sessions\/[^/]+$/.test(path)) return true;
  if (method === 'GET' && path === '/device/app-update/latest') return true;
  if (method === 'GET' && /^\/releases\/[^/]+\.apk$/.test(path)) return true;
  return false;
}

function isAdminRoute(path: string): boolean {
  return (
    path.startsWith('/admin/') ||
    path === '/auth/codes' ||
    path === '/auth/logout' ||
    path === '/auth/refresh' ||
    path === '/menu/all' ||
    path === '/user/info' ||
    /^\/device\/bind-sessions\/[^/]+\/confirm$/.test(path)
  );
}

function isPhotoAssetRoute(path: string): boolean {
  return path.startsWith('/photos/') || path.startsWith('/derivatives/');
}

function isDeviceProtectedRoute(method: string, path: string): boolean {
  if (method === 'GET' && (path === '/device/albums' || path.startsWith('/device/albums/'))) {
    return true;
  }
  if (method === 'GET' && path === '/device/playlist') return true;
  if (method === 'POST' && path === '/device/play-record') return true;
  return false;
}
