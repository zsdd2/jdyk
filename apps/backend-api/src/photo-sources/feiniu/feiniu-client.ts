import {
  generateFeiniuAuthX,
  loginToFeiniu,
  normalizeFeiniuBaseUrl,
} from './feiniu-auth';
import type { FeiniuLoginInput, FeiniuSession } from './feiniu-auth';
import { Readable } from 'stream';
import type { RemotePhotoAsset } from '../photo-source';

export interface FeiniuClientConfig {
  baseUrl: string;
  password: string;
  token?: string;
  username: string;
}

export interface FeiniuClientDependencies {
  fetch?: (url: string, init?: RequestInit) => Promise<Response>;
  login?: (input: FeiniuLoginInput) => Promise<FeiniuSession>;
}

export type FeiniuAlbumSourceKind = 'owned' | 'shared_by_me' | 'shared_to_me';

export interface FeiniuAlbum {
  albumId: number;
  albumName: string;
  endDateTime?: string;
  ownerName?: string;
  photoCount?: number;
  posterImgUrl?: string;
  posterUrl?: string;
  sourceKind?: FeiniuAlbumSourceKind;
  startDateTime?: string;
  videoCount?: number;
}

export interface FeiniuGalleryPhoto {
  additional?: {
    thumbnail?: {
      mUrl?: string;
      originalUrl?: string;
      sUrl?: string;
      videoUrl?: string;
      xsUrl?: string;
      xxsUrl?: string;
    };
  };
  category?: string;
  dateTime?: string;
  description?: string;
  fileName?: string;
  geo?: string;
  id: number;
  photoDateTime?: string;
}

interface FeiniuListResponse<T> {
  code?: number;
  data?: T | T[] | {
    list?: T[];
  };
  msg?: string;
}

type QueryValue = boolean | number | string | undefined;

export class FeiniuClient {
  private session?: FeiniuSession;
  private readonly baseUrl: string;
  private readonly fetchImpl: (url: string, init?: RequestInit) => Promise<Response>;
  private readonly loginImpl: (input: FeiniuLoginInput) => Promise<FeiniuSession>;

  constructor(
    private readonly config: FeiniuClientConfig,
    dependencies: FeiniuClientDependencies = {},
  ) {
    this.baseUrl = normalizeFeiniuBaseUrl(config.baseUrl);
    this.fetchImpl = dependencies.fetch ?? globalThis.fetch.bind(globalThis);
    this.loginImpl = dependencies.login ?? loginToFeiniu;
    if (config.token) {
      this.session = {
        token: config.token,
      };
    }
  }

  async listAlbums(limit = 50, offset = 0): Promise<FeiniuAlbum[]> {
    const response = await this.get<FeiniuListResponse<FeiniuAlbum>>(
      '/p/api/v1/album/list',
      [
        ['sort_direction', 'desc'],
        ['sort_by', 'date_time'],
        ['offset', offset],
        ['limit', limit],
      ],
    );
    return tagAlbumSource(extractFeiniuList(response), 'owned');
  }

  async listSharedAlbumsToMe(limit = 1000, offset = 0): Promise<FeiniuAlbum[]> {
    const response = await this.get<FeiniuListResponse<FeiniuAlbum>>(
      '/p/api/v1/album_grant/list_to_me',
      [
        ['offset', offset],
        ['limit', limit],
        ['sort_by', 'share_mod_time'],
        ['sort_direction', 'desc'],
      ],
    );
    return tagAlbumSource(extractFeiniuList(response), 'shared_to_me');
  }

  async listSharedAlbumsMine(limit = 1000, offset = 0): Promise<FeiniuAlbum[]> {
    const response = await this.get<FeiniuListResponse<FeiniuAlbum>>(
      '/p/api/v1/album_grant/list_mine',
      [
        ['offset', offset],
        ['limit', limit],
        ['sort_by', 'share_mod_time'],
        ['sort_direction', 'desc'],
      ],
    );
    return tagAlbumSource(extractFeiniuList(response), 'shared_by_me');
  }

  async listAlbumPhotos(
    albumId: number,
    limit = 200,
    offset = 0,
  ): Promise<FeiniuGalleryPhoto[]> {
    const response = await this.get<FeiniuListResponse<FeiniuGalleryPhoto>>(
      '/p/api/v1/album/photos',
      [
        ['album_id', albumId],
        ['sort_by', 'date_time'],
        ['sort_direction', 'desc'],
        ['offset', offset],
        ['limit', limit],
      ],
    );
    return extractFeiniuList(response);
  }

  async fetchMedia(mediaUrl: string, retryOnUnauthorized = true): Promise<RemotePhotoAsset> {
    const session = await this.ensureSession();
    const resolvedUrl = this.resolveMediaUrl(mediaUrl);
    const parsedUrl = new URL(resolvedUrl);
    const authPayload = parsedUrl.search ? parsedUrl.search.slice(1) : undefined;
    const headers = new Headers({
      accesstoken: session.token,
      authx: generateFeiniuAuthX(parsedUrl.pathname, 'GET', authPayload),
    });
    const response = await this.fetchImpl(resolvedUrl, {
      headers,
      method: 'GET',
    });

    if (response.status === 401 && retryOnUnauthorized) {
      await this.ensureSession(true);
      return this.fetchMedia(mediaUrl, false);
    }

    if (!response.ok) {
      throw new Error(`Feiniu media request failed: ${response.status}`);
    }

    return {
      contentType: response.headers.get('content-type') ?? 'application/octet-stream',
      filename: filenameFromUrl(parsedUrl),
      kind: 'remote',
      stream: response.body
        ? Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0])
        : Readable.from(Buffer.from(await response.arrayBuffer())),
    };
  }

  resolveMediaUrl(path: string): string {
    const trimmed = path.trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }
    return `${this.baseUrl}${trimmed.startsWith('/') ? '' : '/'}${trimmed}`;
  }

  private async get<T>(
    path: string,
    queryEntries: Array<[string, QueryValue]>,
    retryOnUnauthorized = true,
  ): Promise<T> {
    const session = await this.ensureSession();
    const query = buildQueryString(queryEntries);
    const headers = new Headers({
      accesstoken: session.token,
      authx: generateFeiniuAuthX(path, 'GET', query),
    });
    const url = `${this.baseUrl}${path}${query ? `?${query}` : ''}`;
    const response = await this.fetchImpl(url, {
      headers,
      method: 'GET',
    });

    if (response.status === 401 && retryOnUnauthorized) {
      await this.ensureSession(true);
      return this.get(path, queryEntries, false);
    }

    if (!response.ok) {
      throw new Error(`Feiniu request failed: ${response.status}`);
    }

    const json = (await response.json()) as T & { code?: number; msg?: string };
    if (json.code != null && json.code !== 0) {
      throw new Error(`Feiniu API failed: ${json.code} ${json.msg ?? ''}`.trim());
    }
    return json;
  }

  private async ensureSession(forceRefresh = false): Promise<FeiniuSession> {
    if (this.session && !forceRefresh) return this.session;

    this.session = await this.loginImpl({
      password: this.config.password,
      url: this.baseUrl,
      username: this.config.username,
    });
    return this.session;
  }
}

function buildQueryString(entries: Array<[string, QueryValue]>): string {
  const params = new URLSearchParams();
  for (const [key, value] of entries) {
    if (value == null) continue;
    params.append(key, String(value));
  }
  return params.toString();
}

function extractFeiniuList<T>(response: FeiniuListResponse<T>): T[] {
  const data = response.data;
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (typeof data === 'object' && Array.isArray((data as { list?: T[] }).list)) {
    return (data as { list: T[] }).list;
  }
  if (typeof data === 'object' && ('albumId' in data || 'id' in data)) {
    return [data as T];
  }
  return [];
}

function tagAlbumSource(
  albums: FeiniuAlbum[],
  sourceKind: FeiniuAlbumSourceKind,
): FeiniuAlbum[] {
  return albums.map((album) => ({
    ...album,
    sourceKind,
  }));
}

function filenameFromUrl(url: URL): string {
  const filename = decodeURIComponent(url.pathname.split('/').filter(Boolean).pop() ?? '');
  return filename || 'feiniu-media';
}
