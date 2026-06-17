# 往日重现开发规范、API 与固定流程

更新时间：2026-06-16

本文是项目开发规范、接口目录和固定工作流的唯一权威入口。所有进度、风险和计划只写入 `PROJECT_DEVELOPMENT.md`；所有规范、API、发布、验证流程只写入本文。

## 快速目录

- [1. 开发宪法](#1-开发宪法)
- [2. 项目地图](#2-项目地图)
- [3. 端口与运行入口](#3-端口与运行入口)
- [4. 主要业务 API](#4-主要业务-api)
- [5. 共享播放协议](#5-共享播放协议)
- [6. 固定开发流程](#6-固定开发流程)
- [7. 固定发布流程](#7-固定发布流程)
- [8. 验证矩阵](#8-验证矩阵)
- [9. 部署与更新](#9-部署与更新)
- [10. 文档维护规则](#10-文档维护规则)

## 1. 开发宪法

- 先理解再编码：修改前读取现有代码、数据流、契约、测试和项目惯例。
- 小步可验证：每次只做一个可独立验证的变化，改完就运行对应测试、构建或真实接口。
- 简单优先：优先使用已有框架、目录结构、请求封装和脚本，不为假设需求新增复杂抽象。
- 外科化修改：只改为达成当前目标必须修改的文件；跨端、跨服务、跨数据库、跨部署边界前先给出计划。
- 人类方向优先：产品方向、验收标准、架构取舍和发布节奏由用户确认。
- 目标驱动：每个改动都要能追溯到用户目标、已复现缺陷或必要质量约束。
- 验证属于改动：不能只看代码判断完成，必须报告已验证项、未验证项和剩余风险。
- 控制上下文增长：清理重复文档、临时诊断和无用分支，避免把历史流水账当当前计划。

## 2. 项目地图

CodeGraph 审计时间：2026-06-13。

- 索引状态：1521 个文件、14060 个符号节点、28886 条关系边。
- 后端：`apps/backend-api`，NestJS + SQLite 文件库 + Sharp 派生图 + 进程内/SQLite AI 任务记录。
- 管理端：`apps/web-antd`，Vben Admin + Ant Design Vue，照片中心、AI 设置、设备中心、TV 版本管理。
- Android TV：`apps/android-tv`，Kotlin + Compose 原生播放器，正式 APK，不使用 WebView 作为主播放层。
- Web TV 试验端：`apps/tv-player-web`，保留为 Web 播放器方向，不作为当前 TV 主线验收端。
- 共享协议：`packages/shared/src/index.ts`，设备登录、播放列表、相册、播放记录等跨端类型。
- 发布与部署：`.github/workflows/ghcr-images.yml`、`.github/workflows/android-tv-release.yml`、`docker-compose.feiniu.yml`、`docker-compose.latest.yml`、`scripts/release/verify-local-release.ps1`。

## 3. 端口与运行入口

| 模块 | 当前入口 |
| --- | --- |
| 后端 API | `http://127.0.0.1:3999/api` |
| 管理后台 | `http://127.0.0.1:5200` |
| Android TV 默认后端 | `http://192.168.10.188:3999` |
| 管理后台账号 | 本地开发默认 `admin / admin123`；生产首次未配置密码时也可用 `admin / admin123` 登录，但必须立即修改初始密码 |

固定启动脚本：

- `scripts/dev/start-backend-3999.cmd`
- `scripts/dev/start-admin-5200.cmd`

### 管理员初始密码

- 管理员用户名默认 `admin`。
- 生产环境未配置 `WRJDYK_ADMIN_PASSWORD` 且 SQLite 尚未保存管理员密码时，首次管理端登录允许 `admin / admin123`，并返回 `mustChangePassword=true`。
- 初始密码状态下的 token 只能调用 `POST /api/auth/password`；普通后台 API 和 TV 设备登录会在改密完成前被阻止。
- 修改初始密码后，新密码写入 SQLite，`admin123` 失效。
- `WRJDYK_AUTH_SECRET` 可选，但生产环境建议固定配置，避免 token secret 随密码变化导致已有 token 异常失效。

账号与口令约定：

- 管理端登录 `/api/auth/login` 与 TV 设备登录 `/api/device/login` 共用管理员账号体系。
- 未设置 `WRJDYK_ADMIN_PASSWORD` 且 SQLite 尚未保存管理员密码时，生产首次管理端登录允许 `admin / admin123`，但 token 只允许访问 `POST /api/auth/password`。
- 修改初始密码后，新密码写入 SQLite，`admin123` 失效；TV 设备登录在初始密码修改完成前不可用。

## 4. 主要业务 API

### 4.1 基础与账号

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| `GET` | `/api/health` | 后端健康检查 |
| `POST` | `/api/auth/login` | 管理端登录 |
| `POST` | `/api/auth/password` | 修改初始管理员密码 |
| `POST` | `/api/auth/refresh` | 管理端刷新令牌 |
| `POST` | `/api/auth/logout` | 管理端退出 |
| `GET` | `/api/user/info` | 管理端用户信息、首页路径 |
| `GET` | `/api/menu/all` | 管理端菜单 |

### 4.2 照片中心与 AI

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| `GET` | `/api/admin/photo-library/overview` | 照片中心概览 |
| `GET` | `/api/admin/photo-library/photos` | 照片列表 |
| `DELETE` | `/api/admin/photo-library/photos/:photoId` | 移入废片 |
| `POST` | `/api/admin/photo-library/photos/:photoId/ai-jobs` | 单张照片重新识别 |
| `POST` | `/api/admin/photo-library/photos/:photoId/ai-sync` | 同步照片 AI 详情 |
| `PUT` | `/api/admin/photo-library/photos/:photoId/ai-insight` | 人工修正 AI 旁白/标签/评分 |
| `PUT` | `/api/admin/photo-library/photos/:photoId/metadata` | 更新照片元数据 |
| `GET` | `/api/admin/photo-library/ai-tasks` | AI 任务进度 |
| `DELETE` | `/api/admin/photo-library/ai-tasks` | 清理 AI 任务进度 |
| `GET` | `/api/admin/photo-library/ai-settings` | AI 设置 |
| `PUT` | `/api/admin/photo-library/ai-settings` | 更新 AI 设置 |
| `POST` | `/api/admin/photo-library/ai-scheduler/run` | 手动触发定时 AI |

### 4.3 播放相册与设备

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| `GET` | `/api/admin/photo-library/playback-albums` | 管理端播放相册列表 |
| `POST` | `/api/admin/photo-library/playback-albums` | 创建播放相册 |
| `DELETE` | `/api/admin/photo-library/playback-albums/:playbackAlbumId` | 删除播放相册 |
| `GET` | `/api/admin/photo-library/playback-albums/:playbackAlbumId/photos` | 相册照片 |
| `POST` | `/api/admin/photo-library/playback-albums/:playbackAlbumId/photos` | 添加相册照片 |
| `DELETE` | `/api/admin/photo-library/playback-albums/:playbackAlbumId/photos/:photoId` | 移除相册照片 |
| `POST` | `/api/admin/photo-library/playback-albums/:playbackAlbumId/ai-jobs` | 相册补全 AI |
| `POST` | `/api/admin/photo-library/playback-albums/:playbackAlbumId/scan-jobs` | 相册扫描/补图 |
| `PUT` | `/api/admin/photo-library/playback-albums/:playbackAlbumId/ai-policy` | 更新相册 AI 策略 |
| `GET` | `/api/admin/photo-library/devices` | TV 设备列表 |
| `PUT` | `/api/admin/photo-library/devices/:deviceId` | 更新设备分组/启用/授权 |

### 4.4 照片源与飞牛

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| `GET` | `/api/admin/photo-library/source-config` | 照片源配置 |
| `PUT` | `/api/admin/photo-library/feiniu/settings` | 更新飞牛设置 |
| `POST` | `/api/admin/photo-library/feiniu/connectivity` | 测试飞牛连接 |
| `GET` | `/api/admin/photo-library/feiniu/albums` | 飞牛相册选项 |
| `POST` | `/api/admin/photo-library/feiniu/sync-jobs` | 创建飞牛同步任务 |

### 4.5 Android TV 设备端

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| `GET` | `/api/device/current-policy` | 当前设备策略 |
| `POST` | `/api/device/login` | TV 账号登录 |
| `POST` | `/api/device/bind-sessions` | 创建绑定会话 |
| `GET` | `/api/device/bind-sessions/:bindCode` | 查询绑定会话 |
| `POST` | `/api/device/bind-sessions/:bindCode/confirm` | 确认绑定 |
| `GET` | `/api/device/albums` | TV 可播放图包 |
| `GET` | `/api/device/albums/:albumId` | TV 图包详情 |
| `GET` | `/api/device/playlist` | TV 播放列表 |
| `POST` | `/api/device/play-record` | 上报播放记录 |
| `GET` | `/api/device/app-update/latest` | TV 远程升级 manifest |

### 4.6 文件与 TV 版本管理

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| `GET` | `/api/derivatives/:photoId/:filename` | 派生图访问 |
| `GET` | `/api/photos/:photoId/original` | 原图访问 |
| `GET` | `/api/photos/:photoId/display` | 展示图访问 |
| `GET` | `/api/photos/:photoId/thumb` | 缩略图访问 |
| `GET` | `/api/releases/:fileName` | APK 下载 |
| `GET` | `/api/admin/photo-library/tv-release` | 管理端读取 TV 发布状态 |
| `POST` | `/api/admin/photo-library/tv-release/upload` | 管理端上传 TV APK，必须走 multipart upload |

## 5. 共享播放协议

`packages/shared/src/index.ts` 是 TV 播放协议的入口。重点类型：

- `DeviceLoginInput` / `DeviceLoginResponse`：TV 登录。
- `AlbumSummary` / `AlbumDetailResponse` / `AlbumListResponse`：图包列表和详情。
- `PlaylistItem` / `PlaylistResponse`：TV 播放列表。
- `PlaylistDisplayConfig`、`PlaylistCaption`、`PlaylistLayout`、`PlaylistAnimation`、`PlaylistNarrationVariant`：AI 到 TV 渲染的结构化字段。
- `PlayRecordInput` / `PlayRecordResponse`：播放记录。

当前 TV 播放效果以 `apps/android-tv/app/src/main/java/com/wangrizhongxian/tv/MemoryExhibitionPlayer.kt` 为准。字幕模板暂时固定为 4K 设计稿三行居中模板，不直接消费 AI 的左右版式建议。

## 6. 固定开发流程

1. 开始项目前先用 CodeGraph 建立项目地图。
2. 读取相关源码、测试、脚本和本文档，再决定修改范围。
3. 如果改动跨 Android TV、管理端、后端、共享协议、数据库或部署配置，先说明跨范围计划。
4. 先写或调整最小测试，再改实现。
5. 修改后运行对应验证，不把未验证代码堆到下一步。
6. 每轮结束更新 `PROJECT_DEVELOPMENT.md`。
7. 前端可见改动需要用浏览器或 gstack 验证；Android TV 原生改动需要 Gradle 测试/构建，必要时用 ADB 截图验收。

## 7. 固定发布流程

### 7.1 版本修改

- 后端/管理端镜像版本：修改 `.github/workflows/ghcr-images.yml` 的 raw tag。
- 管理端关于页版本：修改 `apps/web-antd/.env.production` 中 `VITE_ADMIN_RELEASE_VERSION`。
- Android TV 版本：修改 `apps/android-tv/app/build.gradle` 的 `versionCode` 和 `versionName`。
- 同步 Compose/env 默认 TV 版本：`docker-compose.feiniu.yml`、`docker-compose.latest.yml`、`.env.feiniu.example`。
- 同步 Android TV 说明：`apps/android-tv/README.md`。

### 7.2 本地发布验证

固定入口：

```powershell
.\scripts\release\verify-local-release.ps1 `
  -ImageVersion 1.0.8 `
  -TvVersionCode 9 `
  -TvVersionName 1.0.4
```

约束：

- `ANDROID_USER_HOME` 固定在仓库内，不写入锁权限的系统用户目录。
- Docker 本地配置固定使用仓库内 `.docker-config`。
- `app-release-unsigned.apk` 只能作为编译证据，不能用于远程升级。
- Web Vitest 从 `apps/web-antd` 使用 `..\..\node_modules\.bin\vitest.CMD`。
- Vite production build 从 `apps/web-antd` 使用 `..\..\node_modules\.bin\vite.CMD`。

### 7.3 推送后端与管理端

```powershell
git status --short
git add <本次修改文件>
git commit -m "Release admin 1.0.8"
git push origin main
```

`main` 推送发布：

- `ghcr.io/zsdd2/jdyk-backend:<version>`
- `ghcr.io/zsdd2/jdyk-backend:latest`
- `ghcr.io/zsdd2/jdyk-admin:<version>`
- `ghcr.io/zsdd2/jdyk-admin:latest`

发布后必须用 manifest inspect 确认 `linux/amd64` 和 `linux/arm64` 都存在，不能只看 Actions 绿色。

### 7.4 发布 Android TV

```powershell
git tag tv-v1.0.4
git push origin tv-v1.0.4
```

GitHub Release 必须包含：

- `wangri-tv-1.0.4.apk`
- `latest.json`
- `feiniu-update.env`

正式 APK 必须由 GitHub Actions 使用 `ANDROID_TV_*` 签名 secrets 生成并通过 `apksigner verify`。

## 8. 验证矩阵

| 改动类型 | 必跑验证 |
| --- | --- |
| 后端 API/仓储 | `corepack pnpm -F @wrjdyk/backend-api test -- --runInBand app.controller.spec.ts sqlite-photo.repository.spec.ts`，再跑 `corepack pnpm -F @wrjdyk/backend-api run build` |
| 管理端 API/页面 | 对应 Vitest，`corepack pnpm -F @vben/web-antd run typecheck`，必要时 `vite build --mode production` |
| Android TV 播放 | `:app:testDebugUnitTest --tests com.wangrizhongxian.tv.MemoryExhibitionPlayerTest`，必要时 `:app:assembleRelease` 和 ADB 截图 |
| Android TV 升级 | manifest 脚本测试、APK metadata、SHA256/size、`GET /api/device/app-update/latest` |
| Compose/部署 | `docker compose -f docker-compose.feiniu.yml config` 和 `docker compose -f docker-compose.latest.yml config` |
| 完整发布 | `scripts/release/verify-local-release.ps1` |

TV APK 上传经过管理端 nginx 代理，`deploy/nginx.conf` 必须保留 `client_max_body_size 350m`；后端 `FileInterceptor` 当前限制为 300MB，nginx 需要为 multipart 开销留余量。

## 9. 部署与更新

### 9.1 飞牛固定目录

```sh
docker compose --env-file .env.feiniu -f docker-compose.feiniu.yml pull
docker compose --env-file .env.feiniu -f docker-compose.feiniu.yml up -d --force-recreate
docker compose --env-file .env.feiniu -f docker-compose.feiniu.yml ps
```

### 9.2 通用 latest Compose

```sh
docker compose -f docker-compose.latest.yml up -d
```

该文件使用 `latest` 镜像、`pull_policy: always` 和 Docker 命名卷，适合每次启动都拉取最新版本。

### 9.3 发布后接口检查

```sh
curl -f http://127.0.0.1:3999/api/health
curl -f http://127.0.0.1:5200/healthz
curl -f http://127.0.0.1:5200/api/health
curl -f http://127.0.0.1:3999/api/device/app-update/latest
curl -I http://127.0.0.1:3999/releases/wangri-tv-1.0.4.apk
```

TV APK 的 `versionCode`、`versionName`、`sha256`、`sizeBytes` 必须与 `latest.json` 和后台接口一致。

## 10. 文档维护规则

- 本文只维护规范、API、固定流程。
- `PROJECT_DEVELOPMENT.md` 只维护当前计划、完成状态、风险和后续步骤。
- 不再新增 `PROJECT_DEVELOPMENT_*`、独立 release guide、独立部署 guide 等重复入口。
- 需要长期保留的命令必须收敛到本文；一次性验证细节写入 `PROJECT_DEVELOPMENT.md` 的当日记录。
