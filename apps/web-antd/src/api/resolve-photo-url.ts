export function resolvePhotoAssetUrl(url: string, apiBaseUrl = '') {
  if (!url) return url;
  if (/^https?:\/\//i.test(url)) return url;
  if (!url.startsWith('/api/')) return url;
  if (!/^https?:\/\//i.test(apiBaseUrl)) return url;

  return `${new URL(apiBaseUrl).origin}${url}`;
}
