# 往日重现

面向电视大屏的 NAS 家庭照片回忆播放器。

当前技术路线：

- `apps/web-antd`：Vben Admin 管理后台底座。
- `apps/backend-api`：NestJS 后端 API。
- `apps/android-tv`：Kotlin + Compose 原生 Android TV 播放器。
- `apps/tv-player-web`：电视端 Web 播放器。
- `packages/shared`：前后端共享 TypeScript 类型。

## 本地开发

```bash
corepack pnpm install
corepack pnpm dev:api
corepack pnpm dev:admin
corepack pnpm dev:tv
```

默认端口：

- 后端 API：`http://localhost:3999/api`
- 管理后台：`http://localhost:5200`
- 电视播放器：`http://localhost:5174`

## 当前闭环

后端已经提供最小播放接口：

- `GET /api/health`
- `GET /api/device/current-policy`
- `GET /api/device/playlist?limit=12`
- `POST /api/device/play-record`
- `GET /api/photos/:photoId/original`
- `GET /api/photos/:photoId/thumb`

电视端会拉取样例播放列表，自动全屏播放并上报播放记录。后续再把样例数据替换为真实 NAS 扫描结果。

## 部署与发布

- [开发规范、API 与固定流程](DEVELOPMENT_STANDARDS_API.md)
- [开发进度同步](PROJECT_DEVELOPMENT.md)
