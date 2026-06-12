type VersionEnv = Record<string, unknown>;

function getAdminReleaseVersion(
  env: VersionEnv = import.meta.env as unknown as VersionEnv,
): string {
  const version = env.VITE_ADMIN_RELEASE_VERSION;
  return typeof version === 'string' && version.trim()
    ? version.trim()
    : '未标记';
}

export { getAdminReleaseVersion };
