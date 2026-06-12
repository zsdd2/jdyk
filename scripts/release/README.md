# Release Workflow

Use this checklist for every backend/admin image and Android TV release. It is written for the Windows checkout at `F:\xinxiangmu\jdyk`.

## 1. Version Bump

- Update `.github/workflows/ghcr-images.yml` raw image tag.
- Update `apps/android-tv/app/build.gradle` `versionCode` and `versionName`.
- Update Compose/env examples and Android TV docs.
- Update `PROJECT_DEVELOPMENT.md` with goal, current status, and next plan.

## 2. Local Verification

Run the fixed local verification path:

```powershell
.\scripts\release\verify-local-release.ps1 `
  -ImageVersion 1.0.5 `
  -TvVersionCode 7 `
  -TvVersionName 1.0.2
```

Important constraints:

- Keep `ANDROID_USER_HOME` inside the repo. Do not let Android tools write to `C:\Android\.android` or the locked user profile.
- Keep Docker config inside `.docker-config` for local `docker compose config`; do not depend on `C:\Users\Administrator\.docker\config.json`.
- Run web Vitest from `apps/web-antd` with `..\..\node_modules\.bin\vitest.CMD`.
- Run Vite production build from `apps/web-antd` with `..\..\node_modules\.bin\vite.CMD`.
- Treat `app-release-unsigned.apk` as compile evidence only. Never publish it for remote update.

## 3. Push Backend And Admin

```powershell
git status --short
git add .
git commit -m "Release backend 1.0.5 and TV 1.0.2"
git push origin main
```

The main push publishes:

- `ghcr.io/zsdd2/jdyk-backend:1.0.5`
- `ghcr.io/zsdd2/jdyk-backend:latest`
- `ghcr.io/zsdd2/jdyk-admin:1.0.5`
- `ghcr.io/zsdd2/jdyk-admin:latest`

## 4. Publish Android TV

```powershell
git tag tv-v1.0.2
git push origin tv-v1.0.2
```

The Android TV workflow must create a GitHub Release containing:

- `wangri-tv-1.0.2.apk`
- `latest.json`
- `feiniu-update.env`

## 5. Verify Remote Artifacts

- Confirm GHCR workflow succeeded for backend and admin.
- Confirm Android TV workflow succeeded and `apksigner verify` passed in Actions.
- Download `latest.json` and `wangri-tv-1.0.2.apk`.
- Verify APK size and SHA256 match `latest.json`.
- Verify APK package metadata is `versionCode=7` and `versionName=1.0.2`.
- Save the signed APK locally under `apps/android-tv/build/release/wangri-tv-1.0.2.apk`.

## 6. Verify Update Endpoint

Use the signed GitHub Release APK, not the local unsigned APK.

1. Upload the signed APK on `http://127.0.0.1:5200/photo-library/tv-release`, or call the backend upload API.
2. Check `GET http://127.0.0.1:3999/api/device/app-update/latest`.
3. Confirm `versionCode`, `versionName`, `sha256`, `sizeBytes`, and download URL match the uploaded APK.
4. Check the download URL returns `application/vnd.android.package-archive`.

## 7. Feiniu Rollout

On Feiniu, pull the new `latest` images and recreate containers:

```sh
docker compose --env-file .env.feiniu -f docker-compose.feiniu.yml pull
docker compose --env-file .env.feiniu -f docker-compose.feiniu.yml up -d --force-recreate
```

Then upload or place the signed TV APK and verify the TV device can download, hash-check, and open the system installer.
