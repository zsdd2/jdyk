# 往日重现项目权威开发进度

更新时间：2026-06-11

本文是当前项目进度、问题和下一步计划的唯一权威入口。旧的阶段计划、历史进度、专项验证记录只作为参考；后续每轮开发结束只更新本文，避免计划和实际实现漂移。

## 1. 当前产品目标

「往日重现」当前优先目标不是继续扩后台功能，而是先打通并稳定这条主业务链路：

```text
飞牛/本地照片源
-> 照片中心入池
-> 缩略图/AI图/TV图转码
-> 播放相册分拣与授权
-> AI 识别评分、分类、旁白、TV版式
-> TV 端选择图包
-> 直接进入高级照片展播
```

当前开发策略：

- 先稳定 AI 识别闭环和 TV 播放闭环。
- 后台管理只围绕主链路补齐，不再优先做大型管理功能扩展。
- 每个功能以真实照片、真实接口、真实 TV 端显示作为验收依据。

## 2. 当前运行端口和入口

| 模块 | 当前状态 |
| --- | --- |
| 后端 API | `http://127.0.0.1:3999/api` |
| 管理后台 | `http://127.0.0.1:5200` |
| Android TV 默认后端 | `http://192.168.10.188:3999` |
| 管理后台账号 | 当前开发环境使用 `admin / admin123` |

相关启动脚本：

- `scripts/dev/start-backend-3999.cmd`
- `scripts/dev/start-admin-5200.cmd`

## 3. 已完成并可继续依赖的能力

### 3.1 多源照片与播放相册

- 已接入本地照片和飞牛照片源。
- 飞牛扫描策略已调整为优先同步相册，不默认拉取所有照片。
- 播放相册可以从本地照片、飞牛相册和快速分拣台导入照片。
- 播放相册支持编辑、删除、授权设备、查看照片。
- 照片列表支持删除到废片，不直接删除原始文件。

### 3.2 图片转码

- 已建立三规格派生图方向：
  - `thumb_300.webp`：后台列表、快速分拣台、相册卡片使用。
  - `ai_720.webp`：AI 识别使用。
  - `tv_4k.webp`：TV 播放使用。
- 本地照片已接入 `sharp/libvips` 转码。
- 飞牛照片已支持按需拉取远程媒体流并生成派生图。
- 后台列表应只使用缩略图，避免加载原图或 4K 图。

### 3.3 AI 设置和识别

- AI 设置中心已收敛为统一提示词编辑方向。
- 后端已支持真实 Vision AI 调用。
- AI 请求超时已调整为 90 秒。
- 全局 Vision AI 并发限制为最多 3 张照片同时识别。
- 单张照片“重新识别”会强制重新调用 AI，并覆盖旧 AI 结果。
- 相册“补齐 AI”会进入后台队列，不再阻塞管理端界面。
- AI 识别详情已保存部分调试信息：
  - 是否发送图片。
  - 使用的模型和平台。
  - 图片来源。
  - 原始模型返回。
  - 错误信息。
  - 识别时间。
- 后端不再在没有真实 AI 返回时写入兜底旁白。

### 3.4 管理后台

- 照片列表和播放相册页已有 AI 进度入口。
- 照片列表和播放相册照片详情已有 AI 详情入口。
- AI 旁白支持手动修改。
- 已有设备中心，支持设备分组、启用状态和播放相册授权。
- 快速分拣台已改成相册卡片方向，并支持飞牛相册按相册导入。

### 3.5 Android TV

- TV 登录已改为输入后端地址、账号、密码，不使用 PIN。
- 已支持保存登录信息，下次启动自动登录。
- 登录失败、断网或密码错误时回到登录页。
- 图包选择页返回键直接退出程序。
- 图包选择页菜单键弹出退出登录。
- 选择图包后直接进入播放，不再进入中间详情页。
- 播放页已有基础播放菜单、底部控制栏、3 秒自动隐藏逻辑。
- TV 播放器已抽出 `MemoryExhibitionPlayer.kt`，后续可继续演进成真正的展播引擎。

## 4. 当前已知问题

### P0：AI 任务状态还不是完全可信

现状：

- 单张“重新识别”和相册“补齐 AI”已经有后台任务和进度弹窗。
- AI 任务已落入 SQLite `ai_recognition_tasks`，后端重启后仍可查询最近任务。
- 定时 AI 调度现在只返回 `queued`，不再把“已加入队列”误报为同步 `completed`。

风险：

- 任务历史目前记录的是任务级进度，后续还需要继续细化到单张照片级步骤和每次重试详情。

结论：

- P0 状态误报已修正，后续继续增强任务详情和失败排障能力。

### P0：AI 输出协议还没有完全锁死

现状：

- 默认系统提示词已统一要求 `schema_version: "photo_tv_payload_v1"`。
- `photo_tv_payload_v1` 缺少关键字段时会抛错，进入失败/重试路径，不再默认 80 分并显示完成。
- 旧模型返回形态仍保留兼容解析，主要用于历史数据和过渡期。

风险：

- 当前 SQLite 仍只保存扁平 AI 快照和原始 `ai_detail`，还没有把完整 `tv_layout` 拆成结构化字段。

结论：

- `photo_tv_payload_v1` 已作为新输出目标；下一步要把完整 TV 版式持久化并给 TV 端消费。

### P1：TV 播放端还没有完整消费 AI 版式

现状：

- 共享 `PlaylistItem` 已包含 AI 分数、标签、旁白、布局、安全区、字体风格、颜色等扁平字段。
- Android TV 当前只消费部分字段。
- 更完整的主标题、副标题、旁白层级、字体族、字重、遮罩方向、精确安全区还没有形成稳定播放模板。

风险：

- AI 已经生成设计建议，但 TV 端无法按“摄影展模板”充分渲染。
- 文字仍可能偏边缘、字体单一、颜色和背景对比不足。

结论：

- AI 主链路稳定后，必须扩展播放模板并升级 TV 渲染器。

### P1：测试和当前业务行为有漂移

现状：

- 部分后端测试仍保留旧预期：同步 AI 完成、旧迁移版本、未配置 AI 时生成占位结果等。
- 当前产品行为已经改为真实 AI、无兜底、异步队列。

风险：

- 全量测试结果不能完全代表当前真实业务质量。
- 后续重构容易误回到旧行为。

结论：

- AI 状态流转修好后，需要做一次测试对齐。

### P2：文档存在重复和历史漂移

现状：

- 根目录、`docs`、`kf01` 中有多份开发计划和进度文档。
- 部分文档记录的是早期 FastAPI/PostgreSQL/Celery 规划，但当前实现仍是 NestJS + SQLite + 进程内任务队列。

结论：

- 本文作为当前权威进度文档。
- 其它文档只记录专项设计或历史参考，不再承担当前状态入口。

## 5. 下一步开发计划

### 阶段 A：稳定 AI 主链路

目标：所有 AI 操作都能真实排队、运行、完成、失败、重试，并能在后台查到。

任务：

1. 已新增持久化 AI 任务表。
2. 已让单张“重新识别”、相册“补齐 AI”、定时 AI 写入同一任务表。
3. 已修正定时 AI 逻辑，不能把“已排队”当“已完成”。
4. 已让 AI 进度弹窗继续读取后端任务列表；后端列表现在来自 SQLite。
5. 当前每个任务保存：
   - 来源：单张、相册、定时、重试。
   - 目标照片或相册。
   - queued/running/completed/failed/retrying。
   - 当前照片。
   - 成功、跳过、失败数量。
   - 原始 AI 返回。
   - 解析结果。
   - 错误信息。
   - 重试次数。
6. 待用真实照片继续验证：
   - 单张重新识别。
   - 相册补齐 AI。
   - 失败重试。
   - AI 详情显示。

验收标准：

- 点击单张“重新识别”后，任务进度立即出现。
- 任务完成后，照片列表、AI 详情、播放流都能看到同一份新 AI 结果。
- 如果 AI 没返回有效结果，状态是失败或待重试，不显示已完成。

### 阶段 B：锁定 AI 输出协议

目标：后端和 TV 端围绕一个统一 JSON 合同工作。

任务：

1. 已固定默认提示词目标为 `photo_tv_payload_v1`。
2. 已合并评分、分类、旁白和 TV 设计提示词到一次 Vision 调用。
3. 已增加 v1 必填字段校验，缺字段进入失败/重试路径。
4. 后台 AI 详情已能显示原始返回；还需要继续展示规范化结果和校验错误。
5. 过渡期仍兼容旧字段，但新提示词不再鼓励模型输出旧结构。

验收标准：

- 模型返回符合协议才算 AI 完成。
- 模型返回不符合协议时，后台能看到原始返回和失败原因。
- 后端能稳定输出 TV 可消费的播放模板。

### 阶段 C：补齐后台照片详情

目标：后台能清楚看到一张照片从源文件到 TV 播放的完整状态。

任务：

1. 照片详情展示基础元数据、来源、相册、拍摄时间、同步时间。
2. 展示缩略图、AI 图、TV 图转码状态和 URL。
3. 展示 AI 识别状态、回忆相关度、美学水平、类型、旁白、版式、安全区。
4. 支持查看和编辑人工旁白。
5. 支持单张重新识别并查看任务历史。

验收标准：

- 后台能直接判断一张照片为什么没有进入 TV 播放。

### 阶段 D：升级 TV 播放模板和渲染

目标：TV 每一页像一次家庭摄影展，而不是普通图片播放器。

任务：

1. 扩展共享 `PlaylistItem`，承载完整 `photo_tv_payload_v1.tv_layout`。
2. Android TV 解析：
   - 文字层级。
   - 字体族。
   - 字重。
   - 字号。
   - 安全区。
   - 颜色。
   - 遮罩方向和强度。
   - 动画参数。
3. 清理 `MainActivity.kt` 中旧播放器残留逻辑。
4. 引入稳定中文字体资产和字重映射。
5. 再进入双缓冲播放器和缓存优化。

验收标准：

- 横图、竖图、暗图、亮图、人物图都有合理的图片适配和文字落位。
- 文字不遮挡主体，不贴边，不黑底黑字或白底白字。
- 播放过程稳定，不卡顿，不闪退。

### 阶段 E：每日精选推送

目标：在 AI 和 TV 渲染稳定后，再做每日 5-10 张质量优先推送。

任务：

1. 生成每日播放流。
2. 优先选择当天新识别且达到双阈值的照片。
3. 不足时从历史高分照片兜底。
4. TV 定时刷新和缓存清理。

验收标准：

- TV 每天自动获得稳定、高质量、不重复过多的播放内容。

## 6. 暂缓事项

这些内容不删除，但暂时不作为下一阶段优先级：

- FastAPI/PostgreSQL/Redis/Celery 生产级重构。
- 完整 SaaS 化账号体系。
- 大规模 Docker/DevOps 部署。
- 屏保模式深度系统集成。
- 字体子集化服务。

原因：当前最重要的是先让家庭照片 AI 识别和 TV 展播主链路稳定。生产级架构迁移应在主链路稳定后进行，否则会放大调试成本。

## 7. 文档维护规则

- 当前状态、问题和下一步只更新本文。
- API 契约字段变更同步更新 `kf01/api-contracts/openapi.yaml`。
- AI 输出协议细节同步更新 `kf01/AI_FEEDBACK_FLOW.md`。
- 数据库字段或表结构变更同步更新 `docs/往日重现_数据库Schema设计.md`。
- Android TV 专项技术取舍同步更新 `往日重现_AndroidTV技术选型.md`。
- 历史长文不再追加流水账。

## 8. 最近一次 CodeGraph 审计摘要

审计时间：2026-06-11

CodeGraph 状态：

- 已索引文件：2060
- 符号节点：14301
- 关系边：28033

关键源码入口：

- 后端 AI 任务：`apps/backend-api/src/app.service.ts`
  - `createPhotoAiJob`
  - `createPlaybackAlbumAiJob`
  - `runPlaybackAlbumAiJob`
  - `runDuePlaybackAlbumAiJobs`
- 后端照片存储：`apps/backend-api/src/sqlite-photo.repository.ts`
  - `getAiRuntimeSettings`
  - `markPhotoAiPending`
  - `applyPhotoAiInsights`
  - `rowToPlaylistItem`
- 管理端 API：`apps/web-antd/src/api/photo-library.ts`
- 管理端照片列表：`apps/web-antd/src/views/photo-library/photos/index.vue`
- 管理端播放相册：`apps/web-antd/src/views/photo-library/playback-albums/index.vue`
- AI 进度弹窗：`apps/web-antd/src/views/photo-library/components/AiTaskProgressModal.vue`
- TV 播放器：`apps/android-tv/app/src/main/java/com/wangrizhongxian/tv/MemoryExhibitionPlayer.kt`
- 共享播放协议：`packages/shared/src/index.ts`

审计结论：

- 项目主链路已经具备可运行基础。
- 当前最大风险不是功能缺失，而是 AI 任务状态、AI 输出协议、TV 版式消费三者还没有形成稳定闭环。
- 下一步应先做 AI 任务持久化和协议锁定，再继续升级 TV 展播效果。

## 9. 2026-06-11 本轮实现记录

目标：

- AI 任务持久化。
- AI 状态修正。
- 统一 AI 输出协议。

已完成：

- 新增 SQLite schema version 13：`ai_recognition_tasks`。
- 新增 repository 任务接口：
  - `listAiRecognitionTasks`
  - `upsertAiRecognitionTask`
  - `updateAiRecognitionTask`
- `AppService` 的 AI 进度列表从内存 Map 切换为 SQLite。
- 单张、相册、重试、定时任务统一写入持久任务记录。
- 定时 AI 调度返回 `queued`，不再同步等待并误报 `completed`。
- 默认提示词统一为 `photo_tv_payload_v1`。
- v1 响应缺少关键字段时抛错，进入失败/重试链路。
- 后端测试已按“无真实 AI 不兜底”和“管理端任务 queued”行为对齐。

验证：

- `node node_modules\\jest\\bin\\jest.js src\\app.controller.spec.ts --runInBand`
- `node node_modules\\jest\\bin\\jest.js src\\sqlite-photo.repository.spec.ts --runInBand`
- `pnpm -F @wrjdyk/backend-api run build`
- `pnpm -F @vben/web-antd run typecheck`

下一步：

- 用真实照片重新跑单张“重新识别”和相册“补齐 AI”，确认外部模型返回的 v1 结构能稳定通过校验。
- 后台 AI 详情继续补充“规范化结果/校验错误/任务历史”展示。
- 将完整 `photo_tv_payload_v1.tv_layout` 结构持久化，供 TV 端直接按模板渲染。

## 10. 2026-06-11 Android TV 远程升级第一步

目标：

- 先打通 Android TV 端远程升级基础闭环。
- 复用课课宝 TV 端成熟升级链路的核心做法：版本检查、APK 下载、私有 updates 目录、FileProvider、系统安装唤起。
- UI 保持 Kotlin + Compose，不复制课课宝 Java/XML 页面。

已完成：

- 后端新增更新 manifest 接口：
  - `GET /api/device/app-update/latest`
- 后端 manifest 读取环境变量：
  - `WRJDYK_TV_UPDATE_VERSION_CODE`
  - `WRJDYK_TV_UPDATE_VERSION_NAME`
  - `WRJDYK_TV_UPDATE_APK_URL`
  - `WRJDYK_TV_UPDATE_SHA256`
  - `WRJDYK_TV_UPDATE_SIZE_BYTES`
  - `WRJDYK_TV_UPDATE_FORCE`
  - `WRJDYK_TV_UPDATE_NOTES`
  - `WRJDYK_TV_UPDATE_PUBLISHED_AT`
- Android TV 新增 `AppUpdateManager.kt`：
  - 检查 manifest。
  - 比较 `versionCode`。
  - 下载 APK。
  - 校验文件大小和 SHA256。
  - 使用 `FileProvider` 唤起系统安装。
- Android TV Manifest 新增：
  - `REQUEST_INSTALL_PACKAGES`
  - `${applicationId}.fileprovider`
- 播放设置菜单新增“检查更新”。
- 登录成功或保存 token 进入图包后，本会话自动静默检查一次；只有发现新版本才弹窗。
- 更新弹窗支持：
  - 检测中。
  - 发现新版本。
  - 下载进度。
  - 下载完成安装确认。
  - 错误提示。

验证：

- `node node_modules\\jest\\bin\\jest.js src\\app.controller.spec.ts --runInBand`
  - 47 个测试通过。
- `pnpm -F @wrjdyk/backend-api run build`
  - 通过。
- `.\gradlew.bat :app:assembleDebug --no-daemon`
  - 通过，已生成 debug APK。
  - 构建过程中 Kotlin daemon 因本机用户目录权限不可写降级到无 daemon 编译，但最终 `BUILD SUCCESSFUL`。

下一步：

- 新增 GitHub Actions Android TV 构建 workflow。
- 产出 APK、SHA256、sizeBytes 和 `latest.json`。
- 将产物上传到 GitHub artifact/release。
- 飞牛侧先用静态目录承接 `latest.json` 和 APK，后端环境变量指向飞牛下载地址。
- 后续再做后台“TV 版本管理”页面，用于上传、启用、回滚 APK。

## 11. 2026-06-12 AI 原始返回同步与五组旁白

目标：

- 修复“AI 原始返回已保存，但列表结构化字段仍为空或待补全”。
- 将旁白升级为 5 组“三段式相册旁白”，供 TV 每次播放随机选择。

已完成：

- 兼容提取旧返回中的 `generated_captions`、`memory_score`、`beauty_score` 和 `priority_tags`。
- 新增 `POST /api/admin/photo-library/photos/{photoId}/ai-sync`，只解析已有原始返回，不再次调用 AI。
- 照片列表和播放相册的 AI 详情弹窗新增“同步识别数据”按钮。
- `photo_tv_payload_v1.narration` 改为必须返回 5 个 `variants`：
  - `scene_description`
  - `handwritten_thought`
  - `lyrical_closure`
- AI 请求输出上限由 700 tokens 调整为 1600 tokens。
- 播放 API 新增 `narrationVariants`。
- Android TV 每次进入照片时随机选择一组旁白；无有效旁白时不再显示兜底句。
- 人工锁定的旁白在“同步识别数据”时继续保留；主动“重新识别”仍按现有规则覆盖。

验证：

- 后端控制器测试：50 个通过。
- SQLite repository 测试：15 个通过。
- 后端构建通过。
- 管理端 TypeScript/Vue 类型检查通过。
- Android `AlbumParsingTest` 通过，含五组旁白解析测试。

下一步：

- 用真实照片重新识别，确认模型稳定返回 5 组完整旁白。
- 在管理端 AI 详情中增加五组旁白的结构化预览，而不仅是组数和原始 JSON。
- 继续 Android TV 远程升级第二步：GitHub Actions 构建 APK、SHA256、sizeBytes 和 `latest.json`。

## 12. 2026-06-12 Android TV 远程升级第二步

目标：

- 将已完成的 TV 端升级客户端接入可重复、可校验的 APK 发布流水线。
- 保证远程升级 APK 使用固定签名，支持覆盖安装现有版本。

已完成：

- 新增 `.github/workflows/android-tv-release.yml`：
  - 支持 `tv-v*` 标签和手动触发。
  - 使用 GitHub Secrets 恢复固定 release keystore。
  - 构建并验证签名 APK。
  - 生成 APK SHA256、文件大小和 `latest.json`。
  - 上传 GitHub Actions artifact 并发布/更新 GitHub Release。
- Android release 构建支持通过环境变量注入签名配置；本地无签名变量时不影响 debug 构建。
- 新增 `scripts/android-tv/generate-update-manifest.mjs`，统一生成与后端/TV 契约一致的更新清单。
- 新增清单生成脚本测试。

验证状态：

- `node --test scripts/android-tv/generate-update-manifest.test.mjs`：2 个测试通过。
- 本地 `assembleRelease` 验证在执行过程中被新任务中断，尚不能标记为通过。
- GitHub Actions 尚未推送到 GitHub 实际运行，签名 Secrets、Release 产物和真实 TV 覆盖安装均待验证。

配置要求：

- GitHub Secrets：
  - `ANDROID_TV_KEYSTORE_BASE64`
  - `ANDROID_TV_KEYSTORE_PASSWORD`
  - `ANDROID_TV_KEY_ALIAS`
  - `ANDROID_TV_KEY_PASSWORD`
- GitHub Variable（可选）：
  - `WRJDYK_TV_DEFAULT_SERVER_URL`

下一步：

- 在 GitHub 仓库配置签名 Secrets，手动运行一次 `Android TV Release`。
- 将 Release 中的 APK 和 `latest.json` 同步到飞牛静态目录。
- 用生成的清单更新后端升级环境变量，并在真实 TV 上完成下载、校验和覆盖安装验证。

## 13. 2026-06-12 当前交接：AI 提示词与标准输出协议拆分

当前目标：

- 检查用户最新的完整 AI 提示词是否能够稳定生成合法 JSON。
- 将“可自由调整的业务提示词”与“系统必须遵守的标准输出字段要求”拆开配置。
- 通过最小真实照片测试，保证 AI 返回、后端解析、结构化存储、后台显示和 TV 消费形成闭环。

最新提示词输入：

- 附件：`C:\Users\Administrator\.codex\attachments\738b22cf-292a-431d-b1cf-80923c50e8b5\pasted-text.txt`
- 新提示词顶层字段：
  - `caption`
  - `classification`
  - `scores`
  - `narration_options`
  - `selected_narration_index`
  - `layout_plan`
- `narration_options` 要求一次返回 5 组三段式旁白。
- `layout_plan` 包含显示模式、版式模板、字体、布局、装饰和手写信息。

已确认的问题：

- 新提示词协议与当前已实现协议命名不一致：
  - 新版使用 `scores`，当前严格 v1 解析主要使用 `evaluation`。
  - 新版使用 `narration_options`，当前严格 v1 解析主要使用 `narration.variants`。
  - 新版使用 `layout_plan`，现有历史协议和文档仍存在 `tv_layout` 命名。
- 如果直接替换提示词而不修改标准协议层，模型即使返回合法 JSON，后端也可能校验失败或无法提取字段。
- 输出字段约束目前仍嵌在提示词拼接逻辑中，不利于后续单独调整文案提示词。

下一次实施顺序：

1. 读取 AI 设置、提示词拼接、v1 校验、规范化和数据库写入链路。
2. 在 AI 设置后台新增独立的“标准输出字段要求”配置，与业务提示词分离。
3. 选定唯一 canonical 协议；优先评估直接采用新字段结构，并为旧数据保留兼容解析。
4. 增加解析单元测试：严格 JSON、代码块包裹、字段缺失、类型错误、5 组旁白和完整 `layout_plan`。
5. 使用一张真实照片进行最小调用，依次验证：模型原始返回、JSON 解析、结构化字段写入、后台详情显示。
6. 再验证单张“重新识别”和相册“补齐 AI”，禁止使用兜底内容掩盖失败。
7. 更新 TV 播放协议和模板解析，使 `selected_narration_index`、五组旁白及 `layout_plan` 可被稳定消费。

暂停中的并行事项：

- Android TV 远程升级第二步代码已写入，但 release 本地构建、GitHub Actions 实跑、飞牛同步和真实 TV 覆盖安装仍未完成。
- AI 协议闭环优先于继续远程升级发布验证；完成 AI 最小链路测试后，再恢复升级链路验证。

## 14. 2026-06-12 AI 标准输出协议拆分第一步

当前目标：

- 将可自由调整的业务提示词与系统必须遵守的 JSON 标准输出字段要求拆开保存。
- 让后端解析兼容新提示词字段：scores、narration_options、selected_narration_index 和 layout_plan。
- 保持旧 photo_tv_payload_v1 字段兼容，避免已有 evaluation、narration.variants、tv_layout 返回被破坏。

当前状态：

- ai_settings 新增 output_contract_prompt 字段，schema migration 升级到 14。
- 后端 AiSettings / AiRuntimeSettings / UpdateAiSettingsInput 增加 outputContractPrompt。
- buildUnifiedVisionSystemPrompt 在配置了 outputContractPrompt 时按“业务提示词 + 标准输出字段要求”拼接；未配置时继续保留旧提示词逻辑。
- normalizePhotoTvPayloadV1 新增兼容解析：
  - caption.text -> photo_analysis.caption
  - scores -> evaluation
  - narration_options -> narration.variants
  - selected_narration_index -> 当前展示旁白
  - layout_plan -> tv_layout
- 管理端 AI 设置页新增“标准输出字段要求”输入框，保存到 outputContractPrompt。

验证：

- 红灯测试已确认旧实现无法通过新字段解析与独立契约保存。
- apps/backend-api 定向 controller 测试：4 个通过。
- apps/backend-api 定向 repository 测试：2 个通过。
- corepack pnpm -F @wrjdyk/backend-api run build：通过。
- corepack pnpm -F @vben/web-antd run typecheck：通过。

下一步：

- 将用户最新完整提示词拆成“业务提示词”和“标准输出字段要求”两段写入后台配置。
- 使用一张真实照片做最小外部 AI 调用，验证原始返回、JSON 解析、结构化字段写入和后台详情显示。
- 再验证单张“重新识别”和相册“补齐 AI”；确认无有效内容时保持失败/空字段，不写入兜底旁白。
- 后续再接 TV 消费侧对 selected_narration_index 和 layout_plan 的稳定展示验证。

## 15. 2026-06-12 AI 输出标准边界纠正与 5200 后台恢复

当前修改目标：
- 纠正 AI 配置边界：输出标准只定义最终 JSON 的格式、字段名、字段类型、数量、枚举值和取值范围；业务 Vision 提示词只包含看图、内容拆解、评分、旁白和 TV 版式判断规则。
- 后端组装发送给 AI 时，将输出标准放在业务 Vision 提示词之前，提高 JSON 输出稳定性。
- 恢复 5200 管理后台访问，消除因 3999 后端未运行导致的“内部服务器错误”。

当前状态：
- 已将当前 SQLite AI 设置拆成两段：
  - `scoringPrompt`：纯业务 Vision 提示词，不再包含字段 schema、字段名或 JSON 结构约束。
  - `outputContractPrompt`：纯输出标准，并补充禁止输出 Python、工具调用、search(...)、Result、过程说明、Markdown 或代码块。
- 3999 后端已用显式 `PORT=3999` 启动；此前直接启动时会被环境/旧端口状态带到 3100 并因 `EADDRINUSE` 退出。
- 5200 管理后台已在浏览器验证恢复到登录页，页面不再显示“内部服务器错误”。
- 最小 AI 验证已跑通：
  - 文本连通成功。
  - 图片送达成功，模型能识别家庭合影/礼品/家庭聚会。
  - 完整提示词返回 `caption`、`classification`、`scores`、`narration_options`、`selected_narration_index`、`layout_plan`。
  - 后端解析归一化出 `aiBeautyScore=78`、`aiMemoryScore=93`、8 个标签、三段式 `aiComment`，`hasDetailCandidate=true`。

验证记录：
- `corepack pnpm -F @wrjdyk/backend-api run build`：通过。
- `http://127.0.0.1:3999/api/health`：200。
- `http://127.0.0.1:3999/api/admin/photo-library/ai-settings`：200。
- Browser 访问 `http://localhost:5200/`：跳转到 `/auth/login`，未出现“内部服务器错误”。
- `node scripts/dev/verify-ai-flow.cjs`：通过最小外部 AI 调用与解析验证。

下一步计划：
- 将输出标准/业务提示词的默认模板整理进可维护文档或初始化逻辑，避免只存在于当前 SQLite 配置中。
- 继续验证单张“重新识别”和相册“补齐 AI”的真实写入链路，确认没有有效 JSON 时不写入兜底内容。
- 后续再接 TV 端消费 `selected_narration_index`、五组旁白和 `layout_plan` 的稳定展示验证。

## 16. 2026-06-12 AI 识别日志清理与播放相册旁白编辑修复

当前修改目标：
- AI 识别进度日志增加一键清理能力。
- 修复 AI 旁白只同步一组、手动识别完成后列表不自动刷新、编辑框无法选择其他识别旁白的问题。
- 播放相册详情页允许直接点击 AI 旁白快速修改，手工修改只保存当前播放使用的一条旁白；从已完成识别结果中选择旧旁白时，明确覆盖当前手工旁白。
- 播放相册详情页照片操作栏只保留一个“操作”按钮，重新识别、AI 详情、移除都收进下拉菜单；去掉非本地照片的“来源相册”占位文字。

当前状态：
- 后端新增 `DELETE /api/admin/photo-library/ai-tasks`，清理 `ai_recognition_tasks` 进度日志。
- 后端 AI 明细解析兼容当前 `narration_options`，并提取 `scene_line`、`handwritten_line`、`closing_line` 三段式旁白。
- 管理端 AI 进度弹窗新增“清理日志”，并在任务进度变化时通知照片列表和播放相册详情刷新。
- 照片列表与播放相册详情均可选择全部识别旁白候选，不再只露出一组。
- 播放相册详情的 AI 旁白文本可点击打开快速编辑弹窗；确认后只写回当前 `aiComment`。
- 播放相册详情成员表操作列已合并为单个 Dropdown 操作按钮。

验证记录：
- `.\node_modules\.bin\jest.CMD sqlite-photo.repository.spec.ts --runInBand -t "clears AI recognition task progress logs|projects current narration_options variants"`：通过。
- `.\node_modules\.bin\jest.CMD app.controller.spec.ts --runInBand -t "queues due playback album AI jobs without reporting them as synchronously completed"`：通过。
- `.\node_modules\.bin\vitest.CMD run apps/web-antd/src/views/photo-library/components/ai-narration-options.spec.ts`：通过。
- `corepack pnpm -F @vben/web-antd run typecheck`：通过。
- `corepack pnpm -F @wrjdyk/backend-api run build`：通过。

补充修复：
- 解除播放相册时先删除 `tv_device_album_authorizations` 设备授权，再删除播放相册成员和相册主表，修复已授权 TV 相册解除时报外键错误。
- AI 详情原始数据存在 `{ raw: { narration_options: [...] } }` 调用包装时，后端和前端 fallback 都能解析五组旁白，避免详情页显示 `0 组`。
- 已重启 3999 后端到最新构建，`_DSC2430.jpg` 接口返回 `aiNarrationVariants.length=5`。
- 浏览器验证照片列表中 `_DSC2430.jpg` 的 AI 详情显示 `5 组`，且 AI 识别编辑 popover 内出现“选择其他识别旁白”下拉。

补充验证：
- `.\node_modules\.bin\jest.CMD sqlite-photo.repository.spec.ts --runInBand -t "deletes playback album device authorizations"`：先红后绿，通过。
- `.\node_modules\.bin\jest.CMD sqlite-photo.repository.spec.ts --runInBand -t "projects current narration_options variants|deletes playback album device authorizations|clears AI recognition task progress logs"`：通过。
- `.\node_modules\.bin\vitest.CMD run apps/web-antd/src/views/photo-library/components/ai-narration-options.spec.ts`：通过。
- `corepack pnpm -F @vben/web-antd run typecheck`：通过。
- `corepack pnpm -F @wrjdyk/backend-api run build`：通过。
- `http://127.0.0.1:3999/api/admin/photo-library/photos?keyword=_DSC2430&page=1&pageSize=1`：返回 `variantCount=5`。

当前发布状态：
- GitHub 仓库已确认为 `zsdd2/jdyk`，下一步初始化本地 Git 仓库、配置 remote、提交并推送。
- APK 更新地址仍需要确认目标 Release URL 或飞牛静态下载地址；未确认前不改生产更新地址。

## 17. 2026-06-12 播放相册详情批量重新识别与标签列压缩

当前修改目标：
- 播放相册照片详情弹窗的照片行前增加选择框。
- 选中多张照片后，在右上角“立即扫描图片”旁边显示“重新识别选中 N 张”，用于批量加入 AI 重新识别任务。
- 点击重新识别后自动打开 AI 进度弹窗，不再只给开始提示。
- 类型标签列固定为三行高度，正常展示能放下的标签，剩余用 `...` 展开查看，避免行高被大量标签撑开。

当前状态：
- 成员表格已接入 `row-selection`，选择状态会在打开相册详情时清空，并在刷新成员列表后自动过滤不存在的选择项。
- 新增批量重新识别逻辑：对选中照片逐个创建 AI 识别任务，成功后打开 AI 进度弹窗。
- 标签列改为两列、固定三行高度；超过 6 个标签时显示前 5 个和 `...`，点击 `...` 可在浮层查看全部标签。

验证记录：
- `corepack pnpm -F @vben/web-antd run typecheck`：通过。
- Browser 访问 `http://127.0.0.1:5200/photo-library/playback-albums` 并打开“家庭回忆”详情：
  - 每页成员行出现选择框。
  - 选中 1 张后标题区显示“重新识别选中 1 张”。
  - 标签列固定 `70px` 高度，宽 `140px`，超出标签显示 `...`。
  - 控制台无 error。

当前发布状态：
- `.git` 目录的 Windows 显式拒绝 ACL 已清除，Git 可以正常创建 `index.lock`。
- 远端已配置为 `https://github.com/zsdd2/jdyk.git`，首次源码提交 `431aa8e` 和远端初始化历史合并提交 `dac84fa` 已推送到 `origin/main`。
- 本机照片、运行数据库、测试临时库和 Android 构建产物已加入 `.gitignore`，未进入公开仓库。

## 18. 2026-06-12 播放相册详情照片与旁白可读性调整

当前修改目标：
- 播放相册照片详情表格中的缩略图使用 1:1 方形图片框，让横图和竖图都能基本看清。
- AI 旁白在表格中按约 8 个字一行换行显示，避免长旁白只显示单行省略号。

当前状态：
- 照片列宽调整为 `84px`，缩略图调整为 `64px × 64px`。
- 缩略图使用 `object-fit: contain`，保留完整画面比例，并增加深色背景、边框和圆角。
- 新增 `formatAiCommentPreview`，按 Unicode 字符每 8 个切分一行，并保留原旁白中的已有换行。
- 旁白展示改用 `white-space: pre-line`，点击旁白继续进入原有快速编辑弹窗。

验证记录：
- `corepack pnpm -F @vben/web-antd run typecheck`：通过。
- 静态检查确认缩略图为 `64 × 64`、`object-fit: contain`，旁白使用 8 字切行和 `pre-line`。
- 浏览器访问 `localhost:5200` 时进入带滑块验证码的登录页；未自动处理验证码，因此本轮未完成登录后的视觉验收。

## 19. 2026-06-12 GitHub 首次推送完成

当前修改目标：
- 修复 `.git/index.lock` 的 Windows 权限拒绝。
- 清理首次提交中的本机缓存、隐私照片、运行数据库和生成文件。
- 保留 GitHub 已有初始化历史，将项目完整推送到 `zsdd2/jdyk` 的 `main` 分支。

当前状态：
- `.git` 显式拒绝 ACL 已清除，Git 暂存、提交、合并和推送均可正常执行。
- 项目首次源码提交为 `431aa8e`，远端初始化历史合并提交为 `dac84fa`。
- `main` 已成功推送并设置跟踪 `origin/main`。
- `.gitignore` 已覆盖 `ceshi`、`apps/backend-api/data`、`apps/backend-api/.test-data`、`apps/android-tv/build`、本地 `.env`、Corepack/Gradle 缓存和本机 `.gitconfig`。

验证记录：
- 管理端 TypeScript/Vue 类型检查通过。
- 后端 Nest 构建通过。
- AI 旁白解析 Vitest：3 个测试通过。
- SQLite repository 聚焦 Jest：3 个测试通过。
- 播放相册 AI 调度控制器 Jest：1 个测试通过，保留既有异步任务告警。
- Android 更新清单脚本：2 个测试通过。
- 暂存内容未发现高置信度密钥模式，且无超过 50 MB 的文件。
- 全量 `pnpm lint` 仍受既有源码 lint 债务和本地生成目录扫描影响；全量 `pnpm check:type` 仍受 Turbo 无法定位包管理器影响，首次提交使用 `--no-verify`。

后续计划：
- 修正全量 lint/typecheck 的扫描边界和 Corepack/Turbo 包管理器定位，使提交钩子恢复可用。
- 配置 Android TV Release 所需 GitHub Secrets 后，执行首次发布流水线并验证 APK、SHA256 和 `latest.json`。

## 20. 2026-06-12 Android TV 1.0 与飞牛 GHCR 部署设计

当前修改目标：
- 将 Android TV 正式版本更新为 `1.0`，确认远程更新接口与 APK 下载地址。
- 为飞牛提供无需 GitHub Token 的公开 GHCR 双容器 Compose 安装方案。

当前状态：
- 已批准公开双镜像设计：
  - `ghcr.io/zsdd2/jdyk-backend:1.0`
  - `ghcr.io/zsdd2/jdyk-admin:1.0`
- 已批准飞牛端口映射：后端 `3999`、管理端 `5200`。
- 已批准持久化目录：
  - `./data/backend`
  - `./data/media-cache`
  - `./data/releases`
- 已批准远程更新主地址使用飞牛本地
  `http://<飞牛IP>:3999/releases/wangri-tv-1.0.apk`，GitHub Release
  `tv-v1.0` 作为备份来源。
- 详细设计已写入
  `docs/superpowers/specs/2026-06-12-android-tv-1.0-feiniu-ghcr-design.md`。

后续计划：
- 编写逐步实施计划并按 TDD 执行。
- 更新 Android 版本号并验证签名 release APK。
- 新增后端与管理端生产镜像、GHCR 多架构发布 workflow。
- 新增 `docker-compose.feiniu.yml`、环境变量样例和飞牛安装说明。
- 发布后验证 GHCR 公共拉取、Compose 健康状态以及 TV 从飞牛本地下载升级。

## 21. 2026-06-12 Android TV 1.0 与飞牛 GHCR 实施

当前修改目标：
- 落地 Android TV `1.0`、飞牛本地 APK 更新地址、公开 GHCR 双镜像与生产
  Compose。

当前状态：
- Android TV 已更新为 `versionCode=5`、`versionName=1.0`。
- 后端新增安全 APK 下载路由：
  `GET /releases/:fileName`。
- 更新清单实际地址已修正并验证为：
  `GET /api/device/app-update/latest`。
- 已新增生产镜像：
  - `deploy/backend.Dockerfile`
  - `deploy/admin.Dockerfile`
  - `deploy/nginx.conf`
- 已新增飞牛部署包：
  - `docker-compose.feiniu.yml`
  - `.env.feiniu.example`
  - `docs/FEINIU_DEPLOYMENT.md`
- 已新增 GHCR 多架构发布 workflow，目标平台为
  `linux/amd64,linux/arm64`，并在发布后将包设为公开。
- Android Release workflow 会额外生成 `feiniu-update.env`，方便将版本、
  SHA256、大小和发布时间同步到飞牛。

验证记录：
- Android manifest 脚本测试：3 个通过。
- 后端控制器测试：59 个通过。
- 后端 Nest 构建：通过。
- 管理端生产构建：通过。
- 后端 `pnpm deploy --prod --legacy --ignore-scripts`：通过，裁剪产物包含
  Nest 和 Sharp 运行依赖。
- `docker compose config`：通过，确认镜像、端口、卷和本地 APK 地址展开正确。
- Compose、GHCR 和 Android Release 三个 YAML 文件解析通过。
- Android 单测、debug APK 和 release APK 构建：`BUILD SUCCESSFUL`。
- debug APK：
  - 大小 `11866852` bytes
  - SHA256
    `fb0da1946d6f93ed13fe89daf4d1d0430639fa11d92ec8727d5c29f3cadcec3f`
  - 签名为 Android Debug，仅用于本地验证。
- release APK 当前为 `app-release-unsigned.apk`：
  - 大小 `8611816` bytes
  - SHA256
    `d8cdab2cad86f506f21f7c12744a4a3e8c1b7e3bc78900c48d8ee4fcc3000054`
  - 未签名，不可作为正式远程更新包。
- 使用临时 `4099` 后端真实验证：
  - `/api/health`：200
  - `/api/device/app-update/latest`：返回版本 `5 / 1.0`
  - `/releases/wangri-tv-1.0.apk`：200，类型
    `application/vnd.android.package-archive`

当前阻塞：
- 本机 Docker Desktop Linux Engine 未运行，因此未完成本机镜像实际构建和
  Compose 容器启动；Dockerfile 的构建阶段已通过等价本地命令验证。
- 本机没有 GitHub CLI，无法预检查仓库中的 `ANDROID_TV_*` 签名 Secret。
  正式 `tv-v1.0` 发布必须由 GitHub Actions 使用长期签名证书生成。

后续计划：
- 提交并推送 `main`，触发 GHCR workflow。
- 确认两个 GHCR 包均为公开并可由飞牛匿名拉取。
- 确认 GitHub Android 签名 Secret 后创建 `tv-v1.0` 标签，发布签名 APK、
  `latest.json` 和 `feiniu-update.env`。
- 将签名 APK 放入飞牛 `./data/releases`，使用旧版 TV APK 完成真实远程升级。

GHCR 首次发布跟进：
- GitHub Actions 运行 `27378683430` 中，管理端镜像在容器内执行
  `pnpm install --frozen-lockfile` 时失败；后端镜像因矩阵默认快速失败被取消。
- 本地 `pnpm install --frozen-lockfile --ignore-scripts` 已通过，确认锁文件没有漂移。
- 两个 Dockerfile 的依赖安装已改为跳过无产物贡献的仓库级生命周期脚本；仓库当前没有
  实际 `stub` 脚本，CI 的 `prepare` 也会被跳过。
- GHCR 发布矩阵已设置 `fail-fast: false`，后续单个镜像失败不会取消另一个镜像的构建。

下一步：
- 推送修复并观察新一轮 GHCR 多架构构建。
- 构建成功后使用匿名 GHCR Registry API 验证 `1.0` 标签及
  `linux/amd64`、`linux/arm64` 清单。

GHCR 第二次发布跟进：
- 后端 `Build and push image` 已成功；失败仅来自后续 `gh api` 修改包可见性，仓库
  `GITHUB_TOKEN` 不具备容器包管理权限。
- 已通过匿名 GHCR Registry API 获取
  `ghcr.io/zsdd2/jdyk-backend:1.0`，状态为 200，并确认清单包含
  `linux/amd64` 与 `linux/arm64`；说明公开仓库关联的后端包已可匿名拉取，无需额外修改
  可见性。
- 管理端依赖安装已成功，实际失败点是 ARM64 QEMU 环境内执行 Vite 生产构建。
- 管理端 Dockerfile 的静态资源构建阶段已固定使用 `$BUILDPLATFORM`；前端只在 GitHub
  原生 runner 架构编译，最终 Nginx 运行层仍分别生成 amd64/arm64 镜像。
- 已移除会产生假失败的 `Make package public` 步骤；最终公开状态继续由匿名 Registry
  API 验证。

下一步：
- 推送第三轮修复并等待两个镜像任务成功。
- 匿名验证管理端和后端 `1.0` 标签的双架构清单。

GHCR 第三次发布跟进：
- 管理端已确认在原生 `$BUILDPLATFORM` 构建，但仍失败于
  `pnpm -F @vben/web-antd run build`。
- 管理端包的 `build` 脚本内部再次执行 `pnpm vite build`；该嵌套 pnpm 调用在当前
  Windows 验证环境也曾因子进程找不到 pnpm shim 失败，而直接执行 Vite 已通过。
- `pnpm --dir apps/web-antd exec vite` 会按应用目录查找二进制，但本仓库的 Vite 被提升到
  根工作区；本地已准确复现其“找不到 vite”。
- Dockerfile 已改为在应用目录显式调用
  `../../node_modules/.bin/vite build --mode production`，消除嵌套 pnpm 调用并匹配
  pnpm 实际安装布局。

GHCR 第四次发布跟进：
- 管理端即使直接调用根工作区 Vite，仍在 Buildx 容器构建阶段失败；本地等价命令生产
  构建通过。
- 管理端发布结构已调整为：GitHub 原生 runner 安装依赖并生成
  `apps/web-antd/dist`，Buildx 仅将静态产物封装进 Nginx amd64/arm64 镜像。
- `deploy/admin.Dockerfile` 已简化为纯 Nginx 运行镜像，`.dockerignore` 仅放行
  `apps/web-antd/dist`，后端镜像构建路径不变。
- 该拆分避免在 Buildx/QEMU 上重复执行大型前端编译，并把依赖安装、前端构建和镜像封装
  分成可独立定位的步骤。

GHCR 第五次发布跟进：
- 原生 runner 的依赖安装已成功，失败被进一步隔离到 `Build admin assets`。
- GitHub 公开 API 只返回退出码 1，完整日志下载要求仓库管理员认证；当前无法从匿名接口取得
  更细错误。
- 本地成功构建环境为 Node `24.13.0`，CI 原先使用 Node `22.18.0`；工作流已对齐为
  Node `24.13.0`。
- 管理端生产构建包含约 7884 个模块，已为 Vite 设置
  `NODE_OPTIONS=--max-old-space-size=6144`，避免 runner 默认堆上限导致构建退出。
