# 往日重现端口调整进度

## 2026-06-10

### 当前修改目标

- 管理后台前端端口调整为 `5200`。
- 后端 API 默认端口从 `3100` 调整为 `3999`。
- Android TV 默认后端地址同步为 `http://192.168.10.188:3999`。

### 当前状态

- `apps/backend-api/src/main.ts` 默认监听端口已改为 `3999`。
- `apps/web-antd/.env.development` 的 `VITE_PORT` 已改为 `5200`。
- Vben dev proxy 和 production API 地址已指向 `http://localhost:3999/api`。
- Android TV 默认地址、最近地址提示和测试用例已同步到 `3999`。
- Android TV 版本已提升到 `0.1.3`。

### 后续计划

- 构建后端、管理后台和 Android TV。
- 重启运行态服务到 `3999` / `5200`。
- 安装 TV 新 APK，验证登录、相册列表和播放页。
## 2026-06-10 runtime login verification

### Current Modification Goal

- Keep backend API on `3999` and Vben Admin on `5200`.
- Verify Android TV login flow end to end against the new backend port.
- Provide stable local startup scripts so services do not exit with the Codex command process.

### Current Status

- Added `scripts/dev/start-backend-3999.cmd` for backend startup.
- Added `scripts/dev/start-admin-5200.cmd` for admin startup.
- Backend is listening on `0.0.0.0:3999`; `GET /api/health` returns 200.
- Admin is listening on `0.0.0.0:5200`; page request returns 200.
- `POST /api/device/login` succeeds with `admin / admin123`.
- TV device token can fetch `GET /api/device/albums`, returning 2 playback albums.
- Android TV installed APK is `versionCode=4`, `versionName=0.1.3`.
- TV DataStore currently stores `http://192.168.10.188:3999`, not the legacy `3100` or `3101` address.

### Future Plan

- If TV still reports login failure, check whether the user entered the backend device password `admin123` rather than the Feiniu password.
- For emulator-only testing, keep `adb reverse tcp:3999 tcp:3999` available and allow using `http://localhost:3999`.
- Next UI/backend change should add a clearer login error message distinguishing connection failure from bad credentials.
