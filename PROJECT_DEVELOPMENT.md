# 往日重现开发进度同步

更新时间：2026-06-13

本文是项目计划、完成状态、风险和后续步骤的唯一权威入口。开发规范、API 目录和固定发布流程统一维护在 `DEVELOPMENT_STANDARDS_API.md`。

## 快速目录

- [1. 当前产品目标](#1-当前产品目标)
- [2. CodeGraph 项目审计](#2-codegraph-项目审计)
- [3. 主业务流程评估](#3-主业务流程评估)
- [4. 代码质量评估](#4-代码质量评估)
- [5. 构建与发布体系评估](#5-构建与发布体系评估)
- [6. 已完成能力](#6-已完成能力)
- [7. 当前问题与注意事项](#7-当前问题与注意事项)
- [8. 优化总计划](#8-优化总计划)
- [9. 新计划第一步](#9-新计划第一步)
- [10. 最近验证记录](#10-最近验证记录)

## 1. 当前产品目标

当前主线不是扩展泛后台功能，而是稳定家庭照片到电视展播的完整闭环：

```text
飞牛/本地照片源
-> 照片中心入池
-> 缩略图/AI图/TV图派生
-> 播放相册分拣与设备授权
-> AI 识别评分、分类、旁白、TV 展示建议
-> TV 端选择图包
-> 高质量大屏照片展播
-> 远程 APK 更新闭环
```

优先级已经调整为：

1. 先处理电视端播放效果问题。
2. 再优化后台长期稳定问题。
3. 最后做后端和管理端界面对齐与整体体验统一。

## 2. CodeGraph 项目审计

审计时间：2026-06-13。

索引状态：

- 文件：1521
- 符号节点：14060
- 关系边：28886
- 主要语言：TypeScript、Vue、Kotlin、Java、YAML

关键入口：

- 后端控制器：`apps/backend-api/src/app.controller.ts`
- 后端业务服务：`apps/backend-api/src/app.service.ts`
- SQLite 照片仓储：`apps/backend-api/src/sqlite-photo.repository.ts`
- 管理端照片中心 API：`apps/web-antd/src/api/photo-library.ts`
- 管理端照片中心路由：`apps/web-antd/src/router/routes/modules/photo-library.ts`
- TV 版本管理页面：`apps/web-antd/src/views/photo-library/tv-release/index.vue`
- Android TV 播放器：`apps/android-tv/app/src/main/java/com/wangrizhongxian/tv/MemoryExhibitionPlayer.kt`
- Android TV 播放器测试：`apps/android-tv/app/src/test/java/com/wangrizhongxian/tv/MemoryExhibitionPlayerTest.kt`
- 共享播放协议：`packages/shared/src/index.ts`
- 完整本地发布验证：`scripts/release/verify-local-release.ps1`

审计结论：

- 项目已经形成真实可运行闭环，不再是样例播放器阶段。
- 当前最大产品风险集中在 TV 播放效果是否稳定、可读、够高级。
- 当前最大工程风险集中在后端长期运行能力：SQLite 单机可用，但任务调度、AI 重试、文件缓存、日志观测仍需要加强。
- 当前最大体验风险集中在管理端与后端数据契约不够集中，部分页面逻辑、接口类型和运行文档曾经分散。
- 文档风险已经处理为两份权威入口：本文和 `DEVELOPMENT_STANDARDS_API.md`。

## 3. 主业务流程评估

### 3.1 照片入池与派生图

现状：

- 支持本地照片和飞牛照片源。
- 支持缩略图、AI 图、TV 展示图/模糊填充图派生。
- 后台列表使用轻量缩略图，避免加载原图或 4K 图。

问题：

- 派生图补齐依赖扫描/AI 流程触发，长期需要独立的健康检查与重建任务。
- 飞牛远程源失败时，用户侧可见诊断还不够清晰。

### 3.2 AI 识别与任务

现状：

- 已统一为 `photo_tv_payload_v1` 方向。
- 已有 AI 任务进度、失败/重试、详情记录、无真实 AI 不写兜底结果的规则。
- 管理端可以查看 AI 进度和 AI 详情。

问题：

- TV 尚未完整消费结构化 `tv_layout`，当前播放模板先固定为设计稿三行字幕。
- 任务历史、失败原因聚合、后台重启后的恢复能力仍需加强。

### 3.3 播放相册与设备授权

现状：

- 播放相册支持照片导入、AI 补齐、设备授权。
- TV 可登录、选择图包并进入播放。

问题：

- 设备策略、播放记录、图包授权的管理端提示还可以更直观。
- TV 端播放设置菜单已有框架，但部分菜单项仍是占位。

### 3.4 TV 远程更新

现状：

- 后端提供 `GET /api/device/app-update/latest`。
- 管理端提供 TV APK 上传页面。
- Android TV 支持下载、大小校验、SHA256 校验和系统安装唤起。
- 当前 Android TV 最新版本是 `versionName 1.0.3`、`versionCode 8`。

问题：

- 生产侧仍需要在飞牛实际设备上完成一次端到端升级验证。
- 回滚和多版本保留能力还没有做成管理端列表。

## 4. 代码质量评估

优点：

- 后端、管理端、Android TV 都已有针对当前关键问题的集中测试。
- 管理端 API 类型集中在 `photo-library.ts`，便于当前业务追踪。
- Android TV 播放器已从 `MainActivity` 抽到 `MemoryExhibitionPlayer.kt`，并有专门单测锁定字幕规格。
- 发布验证脚本已经覆盖后端测试、管理端类型检查/build、Compose 展开、Android 测试/build、APK 元数据。

主要风险：

- `app.controller.ts` 路由仍集中，长期会变成照片中心、设备、发布、认证混杂的大文件。
- `app.service.ts` 承载照片源、AI、播放相册、设备、发布等多类业务，长期稳定性优化前需要拆分服务边界。
- SQLite 单机适合当前家庭 NAS 场景，但需要更明确的备份、迁移、任务恢复和损坏排查流程。
- 多套 Web app 模板仍在仓库中，当前业务只主用 `web-antd`，后续质量检查要避免被模板噪音误导。
- Android TV 播放效果目前靠设计稿坐标和系统字体 fallback，实际不同电视系统的字体形态仍可能漂移。

## 5. 构建与发布体系评估

已稳定：

- 后端/管理端 GHCR 多架构镜像已验证到 `1.0.6/latest`，本轮准备发布 `1.0.7/latest` 修复管理端 nginx 上传限制。
- `docker-compose.latest.yml` 已提供通用最新版本拉取方式。
- `docker-compose.feiniu.yml` 保留飞牛固定目录部署方式。
- Android TV GitHub Release 使用 `tv-v<versionName>` tag 发布正式签名 APK。
- `verify-local-release.ps1` 已经成为本地发布前固定入口。

仍需优化：

- GHCR 偶发 layer 上传失败时需要自动重试或明确重跑策略。
- 飞牛部署后还缺少持续健康检查/日志轮转/磁盘空间预警说明。
- 管理端关于页已显示版本号，但后端自身版本、构建 SHA、镜像 digest 还没有统一暴露。

## 6. 已完成能力

- 后端 API 默认端口统一为 `3999`。
- 管理端默认端口统一为 `5200`。
- Android TV 默认后端为 `http://192.168.10.188:3999`。
- 后台首页进入照片中心，不再默认进入模板分析页。
- 管理端已有照片列表、播放相册、AI 设置、AI 进度、设备中心、TV 版本管理。
- TV 版本管理上传已修复，前端使用 `requestClient.upload()` 发送 multipart。
- 管理端关于页版本已提升到 `1.0.7`，用于发布 TV APK 上传 413 修复。
- GHCR 后端/管理端 `1.0.6` 和 `latest` 已发布并验证多架构 manifest；`1.0.7/latest` 待本轮推送后由 Actions 发布验证。
- Android TV `1.0.3 / versionCode 8` 已生成、上传本地后端并验证更新 manifest。
- Android TV 播放器已实现固定三行电影字幕模板、底部暗场、字幕阴影和菜单 overlay。
- 文档已收敛为两份权威文件：`DEVELOPMENT_STANDARDS_API.md` 与 `PROJECT_DEVELOPMENT.md`。

## 7. 当前问题与注意事项

P0：

- TV 播放效果还需要真实设备截图验收。当前单测能锁定布局坐标，但不能替代电视面板上的视觉判断。
- 字体仍依赖系统 `Serif/Cursive` fallback。若要完全贴近设计稿，需要引入可发布的中文字体资源并显式加载。

P1：

- 后端任务调度与 AI 队列需要更强的可恢复性和诊断能力。
- 后端服务边界需要拆分，避免 `AppService` 继续成为长期稳定性的瓶颈。
- 飞牛部署需要补充生产侧健康检查、日志、磁盘空间和备份策略。

P2：

- 管理端与后端的部分契约仍靠手写类型同步，后续应统一从共享类型或 OpenAPI 生成/校验。
- TV 版本管理后续需要版本列表、激活、回滚，不应只保留 latest。

## 8. 优化总计划

### 阶段 A：电视端播放效果

目标：让每一张照片在 TV 上像家庭摄影展，而不是普通图片播放器。

任务：

1. 建立播放效果基线测试：字幕可读性、暗场、阴影、三行模板、关键坐标。
2. 用真实 TV/模拟器截图验收横图、竖图、暗图、亮图、人像图。
3. 引入明确授权可随 APK 发布的中文字体资源，替代系统 fallback。
4. 调整图片运动、背景模糊、遮罩强度和字幕进出场动画。
5. 再考虑多模板，不直接把 AI 返回版式当播放器布局输入。

验收：

- 字幕不贴边、不遮挡主体、亮暗图都可读。
- 播放过程不闪退、不黑屏、不明显卡顿。
- 4K 坐标缩放到 1080p/720p 仍保持版式关系。

### 阶段 B：后台长期稳定

目标：让家庭 NAS 长期运行时，AI、扫描、派生图和发布都可观察、可恢复、可排障。

任务：

1. 拆分 `AppService`：照片源、AI 任务、播放相册、设备、发布包管理分别成服务。
2. 为 AI 任务建立更明确的持久化状态机和重启恢复策略。
3. 增加派生图健康检查和缺失重建任务。
4. 增加日志分级、关键错误定位和生产健康检查说明。
5. 明确 SQLite 备份、迁移和损坏恢复流程。

验收：

- 后端重启后任务状态可解释。
- 用户能在管理端看出照片为什么未进入 TV 播放。
- 飞牛部署长期运行不依赖手工翻日志定位基础问题。

### 阶段 C：后端与管理端界面对齐

目标：让管理端页面、后端 API 和共享契约保持一致，减少手工同步错误。

任务：

1. 统一照片中心 API 类型来源。
2. 拆分管理端照片中心页面中的高风险复杂逻辑。
3. 增加后端版本/build 信息接口，并在管理端关于页展示后端版本。
4. 对齐 TV 版本管理：上传、列表、激活、回滚、当前设备可见版本。
5. 更新核心页面的空状态、错误状态和长任务状态。

验收：

- 管理端看到的状态与后端真实状态一致。
- 关键接口都有对应类型和测试。
- 发布版本、后端版本、TV 版本能在一个管理入口查清楚。

## 9. 新计划第一步

当前第一步已完成：播放效果基线可验证化。

本轮完成内容：

- `MemoryExhibitionPlayerTest` 新增字幕可读性基线，锁定阴影透明度和模糊半径。
- `MemoryExhibitionPlayer` 将字幕阴影从 `alpha=0.58 / blurRadius=10` 提升到 `alpha=0.70 / blurRadius=16`，同时将 Y 偏移从 `3f` 提升到 `4f`。
- 改动只影响字幕绘制样式，不改变播放业务、图包协议、自动播放和菜单逻辑。
- 定向单测已通过。

验证命令：

```powershell
.\gradlew.bat :app:testDebugUnitTest --tests com.wangrizhongxian.tv.MemoryExhibitionPlayerTest --no-daemon
```

验证结果：通过。Kotlin daemon 仍因为 `C:\Users\Administrator\AppData\Local\kotlin` 权限输出警告，但 Gradle 已自动 fallback，最终 `BUILD SUCCESSFUL`。

下一步：

- 用真实 TV/ADB 截图验证暗图、亮图、人像图、横图、竖图的字幕可读性。
- 如果截图确认字体形态仍偏离设计稿，再进入字体资源引入步骤。

## 10. 最近验证记录

2026-06-13 TV APK 上传 413 修复：

- 问题：飞牛/生产管理端通过 `http://<host>:5200/api/admin/photo-library/tv-release/upload` 上传 APK 时返回 `413 Request Entity Too Large`。
- 根因：请求先经过管理端 nginx，`deploy/nginx.conf` 未配置 `client_max_body_size`，nginx 默认限制在请求到达 Nest 后端前拒绝了 APK；后端自身 `FileInterceptor` 已允许 300MB。
- 修复：在 `deploy/nginx.conf` 的 server 级别增加 `client_max_body_size 350m`，并将管理端/后端镜像固定版本提升到 `1.0.7`。
- 防回归：`scripts/release/verify-local-release.ps1` 增加 nginx 上传限制检查。
- 发布注意：该修复需要重新构建并发布管理端镜像，飞牛侧重新拉取 `jdyk-admin:latest` 并重建容器后才会生效。
- 本地验证：`.\scripts\release\verify-local-release.ps1 -ImageVersion 1.0.7 -TvVersionCode 8 -TvVersionName 1.0.3` 通过。
- GitHub 发布：提交 `042a47b` 已推送到 `main`，`Publish GHCR Images` run `27451911957` 中 `Publish admin` 已成功。
- GHCR 验证：`ghcr.io/zsdd2/jdyk-admin:1.0.7` 和 `ghcr.io/zsdd2/jdyk-admin:latest` digest 一致，均包含 `linux/amd64` 与 `linux/arm64`。
- 截至本记录更新时，`Publish backend` 仍在 `Build and push image` 阶段；这不影响 TV APK 上传 413 修复，因为问题位于 admin nginx 镜像。

2026-06-13 发布验证：

- `.\scripts\release\verify-local-release.ps1`：通过。
- Android manifest 测试：通过。
- 后端 Jest 重点用例：通过。
- 管理端 Vitest 重点用例：通过。
- 管理端 typecheck 和 production build：通过。
- 后端 build：通过。
- `docker compose -f docker-compose.feiniu.yml config`：通过。
- `docker compose -f docker-compose.latest.yml config`：通过。
- Android `testDebugUnitTest`、`assembleDebug`、`assembleRelease`：通过。
- APK 元数据：`versionCode=8`、`versionName=1.0.3`。
- 管理端浏览器验证：`/photo-library/tv-release` 页面正常显示，无控制台错误。
- 本地后端 TV APK multipart 上传：HTTP 201，通过。
- GHCR run `27435875499`：成功。
- `ghcr.io/zsdd2/jdyk-admin:1.0.6` / `latest`：多架构 manifest 验证通过。
- `ghcr.io/zsdd2/jdyk-backend:1.0.6` / `latest`：多架构 manifest 验证通过。

剩余未验证：

- 飞牛真实部署拉取 `latest` 后的管理端关于页显示。
- 实体 Android TV 设备从飞牛后端下载并安装 `1.0.3`。
- 实体 TV 面板播放效果截图验收。
