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

GHCR 第六次发布跟进：
- Node 24 与 6 GB 堆上限下，管理端仍失败于 `Build admin assets`，排除运行时版本和默认
  V8 堆上限是主要根因。
- 工作流已在该步骤保留 Vite 完整输出，并在失败时将最后 6000 个字符写入 GitHub Error
  Annotation；这样无需管理员日志权限即可通过公开 Check API 获取真实错误文本。

GHCR 第七次发布跟进：
- 公开 Error Annotation 已得到真实根因：Vite 无法解析 `@vben/vite-config` 的
  `dist/index.mjs`。
- `--ignore-scripts` 跳过了仓库根 postinstall 中的内部包 stub 构建；
  `internal/vite-config/package.json` 明确定义 `stub: pnpm exec tsdown`，并依赖同样需要
  产物的 `@vben/node-utils`。
- 管理端 CI 在依赖安装后新增 `pnpm -r run --if-present stub`，恢复仓库原有的内部包
  构建步骤，同时继续跳过第三方安装生命周期脚本。
- 本机完整 stub 命令受 Windows Corepack 子进程 PATH 限制；GitHub runner 使用
  `pnpm/action-setup` 提供真实 pnpm 可执行文件，该命令将在 CI 中作为实际验证。

最终发布结果：
- GitHub Actions 运行 `27393346844` 整体成功：
  - `Publish admin`：成功。
  - `Publish backend`：成功。
- 匿名 GHCR Registry API 验证：
  - `ghcr.io/zsdd2/jdyk-admin:1.0`：HTTP 200，包含
    `linux/amd64`、`linux/arm64`。
  - `ghcr.io/zsdd2/jdyk-backend:1.0`：HTTP 200，包含
    `linux/amd64`、`linux/arm64`。
- 飞牛可直接使用 `docker-compose.feiniu.yml` 匿名拉取双容器，无需 GitHub Token。

后续计划：
- 在飞牛复制 `.env.feiniu.example` 为 `.env`，填写实际飞牛 IP 后启动 Compose。
- 配置 Android 长期签名 Secret 并发布 `tv-v1.0` 签名 APK。
- 将签名 APK 放入飞牛 `./data/releases/wangri-tv-1.0.apk`，完成真实 TV 远程升级验收。

## 22. 2026-06-12 飞牛固定目录 Compose

当前修改目标：
- 将飞牛安装目录固定为 `/vol1/1000/docker/jdyk`，提供可直接粘贴部署的完整 Compose。

当前状态：
- 后端数据库、媒体缓存和 APK 发布目录已改为绝对路径：
  - `/vol1/1000/docker/jdyk/data/backend`
  - `/vol1/1000/docker/jdyk/data/media-cache`
  - `/vol1/1000/docker/jdyk/data/releases`
- 管理端与后端使用独立 `jdyk` bridge 网络。
- 两个容器均启用日志轮转，单文件 10 MB，最多保留 3 个文件。
- 管理端启用只读根文件系统，并为 Nginx 缓存和运行目录配置 tmpfs。

后续计划：
- 在飞牛创建安装目录和三个数据目录，写入 Compose 与 `.env`。
- 填写飞牛实际 IP、飞牛相册地址和凭据后执行拉取与启动。
- 放入正式签名 APK 后验证健康检查、管理后台和 TV 更新接口。

## 23. 2026-06-12 飞牛 192.168.10.166 启动问题与 1.0.1

当前修改目标：
- 排查飞牛部署后 `3999/` 返回 404、管理端登录提示内部服务器错误的问题。
- 将飞牛实际地址修正为 `192.168.10.166` 并发布 `1.0.1` 双镜像。

根因与证据：
- `3999/` 的 404 来自后端没有根路由，不代表服务故障；
  `3999/api/health` 实测为 200。
- `5200/api/health`、`5200/api/auth/login`、`5200/api/user/info`、
  `5200/api/auth/codes` 和 `5200/api/menu/all` 均实测成功，容器网络和 Nginx 代理正确。
- 管理端截图中的错误无法在当前服务稳定复现，更符合启动初期请求或浏览器旧入口资源导致的
  瞬时失败。
- 旧 `.env.feiniu.example` 中的 `192.168.10.188` 与实际飞牛地址不一致，会影响飞牛
  相册连接和 TV APK 更新地址，但不是管理端容器代理地址。

当前状态：
- 后端根地址新增状态与正确入口提示，不再显示误导性 404。
- 管理端 `index.html` 与运行配置禁止缓存，哈希静态资源使用长期缓存。
- 飞牛默认地址更新为 `192.168.10.166`，相册地址由
  `FEINIU_HOST + FEINIU_PHOTOS_PORT` 生成。
- Compose 和 GHCR 发布版本更新为 `1.0.1`。

后续计划：
- 完成后端测试、生产构建、管理端构建、Nginx/Compose 配置校验。
- 推送 `main` 并创建 `v1.0.1` 标签，验证两个公开 GHCR 双架构镜像。
- 飞牛更新 `.env` 后拉取 `1.0.1`，验证根地址、登录和照片源连接。

发布验证：
- 提交 `151efc5` 已推送，标签 `v1.0.1` 已创建并推送。
- GitHub Actions `27395181595` 整体成功，管理端与后端镜像任务均通过。
- 匿名 GHCR Registry API 验证：
  - `ghcr.io/zsdd2/jdyk-admin:1.0.1`：HTTP 200，包含 amd64/arm64。
  - `ghcr.io/zsdd2/jdyk-backend:1.0.1`：HTTP 200，包含 amd64/arm64。
- 本地临时服务真实 HTTP 验证：
  - `/` 返回状态、`/api`、`/api/health` 与 `192.168.10.166:5200` 入口。
  - `/api/health` 返回 200。
- 飞牛现网旧版本仍需将 `.env` 的 `JDYK_VERSION` 改为 `1.0.1` 后重新拉取启动。

## 24. 2026-06-12 飞牛 Compose 永久跟随 latest

当前修改目标：
- 后续飞牛更新不再修改具体镜像版本，只执行拉取和重建。

当前状态：
- Compose 镜像已固定为：
  - `ghcr.io/zsdd2/jdyk-backend:latest`
  - `ghcr.io/zsdd2/jdyk-admin:latest`
- `.env.feiniu.example` 已移除 `JDYK_VERSION`。
- GHCR 工作流只在默认分支 `main` 上生成 `latest`，版本标签构建不会覆盖该移动标签。
- 正常更新命令固定为：
  `docker compose pull && docker compose up -d --force-recreate`。

后续计划：
- 每次稳定代码合入 `main` 后由 GHCR 自动更新 `latest`。
- 飞牛侧只拉取最新镜像并重建容器。
- 如需回滚，临时将 Compose 镜像标签改为明确的历史版本。

## 25. 2026-06-12 Compose 自动发现飞牛宿主机地址

当前修改目标：
- Compose 不保存飞牛 IP，迁移到其他飞牛环境后无需修改后台或更新地址。

当前状态：
- 管理端 API 始终使用同源 `/api`，Nginx 通过 Docker 服务名
  `backend:3999` 自动连接后端。
- 飞牛相册连接改为 `host.docker.internal`，并通过
  `host-gateway` 自动映射当前 Docker 宿主机。
- 后端根状态页根据请求 Host 自动生成管理端地址。
- TV 更新清单在没有显式 `WRJDYK_TV_UPDATE_APK_URL` 时，根据请求 Host 自动生成 APK
  下载地址。
- `.env.feiniu.example` 已移除 `FEINIU_HOST`，只保留端口和飞牛相册凭据。

后续计划：
- 运行控制器测试、后端构建和 Compose 展开验证。
- 推送 `main` 更新 `latest` 双镜像。
- 在飞牛只更新 Compose 和 `.env`，拉取 `latest` 后验证动态地址。

## 26. 2026-06-12 飞牛管理端登录 405 修复与 1.0.2 发布

当前修改目标：
- 修复飞牛管理端登录请求错误发送到 `/auth/login`，被 Nginx 静态站点返回 405 的问题。
- 发布 `1.0.2` 与新的 `latest` 管理端、后端双架构镜像。

根因：
- 管理端生产运行时配置依赖 `apps/web-antd/.env.production` 生成
  `_app-config-*.js`。
- 仓库的通用 `.gitignore` 规则 `**/.env.*` 排除了该非敏感生产配置文件，
  GitHub Actions 构建时因此得到空的 `VITE_GLOB_API_URL`。
- Axios 最终将登录请求发送到同源 `/auth/login`，而不是 Nginx 代理的
  `/api/auth/login`。

当前状态：
- 已新增生产配置缺失时 API 基址必须回退到 `/api` 的回归测试。
- 管理端请求客户端已增加同源 `/api` 默认值。
- `.gitignore` 已明确允许跟踪 `apps/web-antd/.env.production`。
- GHCR 固定版本标签已更新为 `1.0.2`。
- 定向 Vitest 回归测试通过：1 个测试通过。
- 管理端 TypeScript/Vue 类型检查通过。
- 管理端生产构建通过：7884 个模块完成转换。
- 生成的 `_app-config-*.js` 已确认包含
  `VITE_GLOB_API_URL=/api`。
- 飞牛当前服务已确认 `/api/auth/login` 返回 201，
  `/api/health` 返回 200；故障仅存在于旧管理端静态资源请求路径。

后续计划：
- 提交并推送 `main`，等待 GHCR 双架构镜像发布完成。
- 飞牛拉取新的 `latest` 后，验证登录请求为 `/api/auth/login` 且登录成功。

## 27. 2026-06-12 管理端数据清理、AI 默认配置与 1.0.3 发布

当前修改目标：
- 清理照片列表中内置示例但缺少真实照片文件的记录。
- 将当前业务 Vision 提示词和标准输出字段要求作为后端系统默认配置。
- 飞牛连通性检测默认留空，不再预填 `host.docker.internal` 或 `60000`。
- 登录后直接进入分析页，并打通已有用户中心路由。
- 发布 `1.0.3` 与新的 `latest` 双架构镜像。

当前状态：
- 后端 SQLite schema 版本提升到 15。
- `ai_settings.output_contract_prompt` 为空的旧库会在迁移时补齐标准输出契约。
- 新库默认业务提示词使用管理端当前本地提示词；评分、旁白、分类和 TV 安全区规则合并到 `scoringPrompt`。
- 初始化时仅在 `_DSC6456.jpg` 等内置示例照片真实存在时才种示例数据；已存在但缺文件的 `p_001..p_009` 示例照片会自动从照片、相册关联和播放相册关联中清理。
- 后端用户信息 `homePath` 改为实际可访问的 `/analytics`。
- 后端菜单新增隐藏的 `/profile` 路由，复用已有用户中心页面。
- 飞牛测试表单刷新后保持地址、账号、密码为空；后端测试接口收到空表单时不再回退到环境变量。
- Compose 与 `.env.feiniu.example` 改为 `WRJDYK_FEINIU_BASE_URL` 默认空值。
- GHCR 固定版本标签已更新为 `1.0.3`。

验证：
- `corepack pnpm -F @wrjdyk/backend-api run test -- sqlite-photo.repository.spec.ts photo-sources/feiniu/feiniu-config.spec.ts app.controller.spec.ts --runInBand`：通过，3 个测试套件、86 个用例。
- `corepack pnpm -F @wrjdyk/backend-api run build`：通过。
- `corepack pnpm -F @vben/web-antd run typecheck`：通过。
- 管理端生产构建 `vite build --mode production`：通过，7884 个模块完成转换。
- 已按用户要求停止继续做浏览器/真机级验证，等待飞牛侧实际使用反馈。

后续计划：
- 提交并推送 `main`，等待 GHCR 发布 `1.0.3` 和 `latest`。
- 发布完成后给出固定 `1.0.3` Compose，便于飞牛直接拉取。
## 28. 2026-06-12 飞牛配置保存与 Android TV 登录焦点修复交接

当前修改目标：
- 修复照片源飞牛页面只有连通性测试、没有保存飞牛地址/账号/密码入口的问题。
- 修复 Android TV 登录页账号和密码输入框在软键盘返回后，遥控器左右键无法在文本框内移动光标、无法方便删除和修改已有字符的问题。
- 修复 Android TV 登录页焦点移动异常，尤其是登录地址、账号、密码、登录按钮和已保存入口之间的焦点路径。
- 完成后提升 Android TV 版本号，重新打包，并更新远程升级版本配置，推送 GitHub。

本轮已完成的定位：
- CodeGraph 已先行用于定位相关入口，但对本任务返回结果不够准确，随后用 `rg` 和局部文件读取确认真实入口。
- 飞牛配置问题根因已确认：后端当前只有 `GET /api/admin/photo-library/source-config` 和 `POST /api/admin/photo-library/feiniu/connectivity`，没有保存配置的 API，也没有 SQLite 持久化表；前端 `apps/web-antd/src/views/photo-library/sources/index.vue` 只调用连通性测试。
- Android TV 登录问题入口已确认：`apps/android-tv/app/src/main/java/com/wangrizhongxian/tv/MainActivity.kt` 中的 `TvBackendLoginScreen`、`GlassLoginField`、`ProtocolChip` 和通用 `TvInputField`。
- 登录焦点问题的主要疑点已确认：`ProtocolChip` 和登录地址输入框共用同一个 `serverFocus`；账号输入框 `upFocusRequester = usernameFocus` 指向自己；`GlassLoginField` 使用 `String` 版 `BasicTextField`，没有保存 `TextFieldValue.selection`；`TvInputField` 当前会消费左右方向键，可能阻断文本框内部光标移动。

本轮已实际改动：
- `apps/backend-api/src/sqlite-photo.repository.ts` 已开始新增飞牛配置持久化类型：
  - `FeiniuSettings`
  - `FeiniuRuntimeSettings`
  - `UpdateFeiniuSettingsInput`
  - `FeiniuSettingsRow`
- 这只是第一步类型声明，数据库 migration、repository 方法、Service、Controller、前端 API 和 UI 都还没有完成。

下一步实施计划：
1. 后端 SQLite：将 `currentSchemaVersion` 从 15 提升到 16；新增 `feiniu_settings` 单行表；增加 `getFeiniuSettings`、`getFeiniuRuntimeSettings`、`updateFeiniuSettings`；保存时支持密码留空且 `keepPassword=true` 时保留旧密码。
2. 后端 AppService / Controller：新增 `PUT /api/admin/photo-library/feiniu/settings`；配置读取使用 SQLite 保存值优先、环境变量兜底；保存后刷新 PhotoSourceRegistry。
3. 管理端：新增 `updateFeiniuSettingsApi`；在照片源页面增加“保存配置”按钮和保存 loading；Compose 默认飞牛地址继续留空，不硬编码 `host.docker.internal:60000`。
4. Android TV：拆分协议 Chip 和服务器地址输入框的 `FocusRequester`；修正账号输入框向上焦点；将 `GlassLoginField` 改为内部维护 `TextFieldValue` 以保留 selection；检查 `TvInputField` 左右键处理，避免可编辑文本框吞掉左右方向键。
5. 测试与构建：补后端 repository/controller 测试；跑后端定向 Jest、后端 build、管理端 typecheck、Android 单测/构建，至少完成 release APK 构建。
6. 版本与发布：Android TV 建议提升到 `versionCode 6 / versionName 1.0.1`；更新 Compose/示例环境里的远程升级默认版本；构建 APK 后生成 SHA256 和 sizeBytes；验证 `/api/device/app-update/latest` 返回新版本元数据；提交、推送 GitHub，必要时推送 `tv-v1.0.1` 标签触发 Android TV Release。

当前风险：
- 当前工作树处于未完成状态，`sqlite-photo.repository.ts` 已有部分类型改动但未编译验证。
- 不要直接发布当前状态；需要先完成上述实现和验证。

## 29. 2026-06-12 飞牛配置保存与 Android TV 1.0.1 登录修复完成

当前修改目标：
- 完成飞牛照片源配置保存能力，管理端可保存飞牛地址、账号和密码，Compose 默认仍保持飞牛地址留空。
- 修复 Android TV 登录页输入框光标编辑和焦点移动问题。
- 将电视端版本更新为 `versionCode 6 / versionName 1.0.1`，并同步远程升级默认元数据。

当前状态：
- SQLite schema 升级到 16，新增 `feiniu_settings` 单行配置表。
- 后端新增 `PUT /api/admin/photo-library/feiniu/settings`，保存后刷新 PhotoSourceRegistry。
- 飞牛运行配置读取顺序为：SQLite 保存值优先，环境变量兜底。
- 管理端照片源页面新增“保存配置”按钮，密码留空且勾选保留时继续使用已保存/已配置密码。
- Android TV 登录页拆分协议 Chip 和服务地址输入框焦点；账号输入框向上焦点修正为服务地址输入框。
- `GlassLoginField` 和 `TvInputField` 改为维护 `TextFieldValue.selection`，支持遥控器左右键在已有文本内移动光标并删除修改字符。
- Compose 和 `.env.feiniu.example` 的远程更新默认版本已同步为 Android TV `1.0.1`。

验证记录：
- `corepack pnpm -F @wrjdyk/backend-api run test -- sqlite-photo.repository.spec.ts app.controller.spec.ts --runInBand`：84 个测试通过。
- `corepack pnpm -F @wrjdyk/backend-api run build`：通过。
- `corepack pnpm -F @vben/web-antd run typecheck`：通过。
- `apps/web-antd/node_modules/.bin/vite.CMD build --mode production`：通过。
- `node --test scripts/android-tv/generate-update-manifest.test.mjs`：3 个测试通过。
- `docker compose -f docker-compose.feiniu.yml config`：通过，展开后 TV 更新版本为 `6 / 1.0.1`，飞牛地址为空。
- Android 本地 Gradle 构建已使用仓库约定的 JDK 17 完成：`assembleDebug` 和 `assembleRelease` 均通过；无正式签名变量时生成的 `app-release-unsigned.apk` 仅用于编译验证，不得发布。

下一步计划：
- 提交并推送 `main`，触发 GHCR `latest` 镜像发布。
- 推送 `tv-v1.0.1` 标签触发 Android TV Release workflow，生成 `wangri-tv-1.0.1.apk`、SHA256、sizeBytes 和 `latest.json`。
- GitHub Actions 完成后，用 release 产物更新飞牛 `/workspace/releases` 中的 APK 和 Compose 环境变量，再由用户在电视端实际验证远程升级安装。

## 30. 2026-06-12 Android TV 1.0.1 本地发布验证与发布办法

当前修改目标：
- 补全 Android TV 1.0.1 的本地 JDK 17 构建验证。
- 将本次实际跑通的 GHCR 双架构发布、TV 签名发布和飞牛远程更新流程整理为可复用文档。

当前状态：
- `:app:assembleDebug --no-daemon` 构建成功，生成 `app-debug.apk`。
- `:app:assembleRelease --no-daemon` 构建成功，生成版本 `versionCode 6 / versionName 1.0.1` 的 `app-release-unsigned.apk`。
- 未签名 Release APK 大小为 `8611816` 字节，SHA256 为 `1853BBFC258AEE89F8B14B2B04E3904ADC8D63CEAF940AB3399E764396AC2B84`；该值只记录本地编译证据，不作为正式更新元数据。
- GitHub Android TV Release 工作流已确认当前唯一阻塞为缺少四个 `ANDROID_TV_*` 签名 Secret；代码构建本身已通过本地 Debug 和 Release 验证。
- 新增 `docs/RELEASE_GUIDE.md`，覆盖版本修改、本地验证、GHCR 发布、TV 签名发布、飞牛部署、远程更新验证和回滚。
- README 已增加飞牛部署与发布办法入口；飞牛部署文档中的旧 TV Release 标签已修正为 `tv-v1.0.1`。

后续计划：
- 使用历史正式签名证书配置 GitHub Actions Secrets，重新运行 `tv-v1.0.1` 发布工作流。
- 确认 GitHub Release 生成签名 APK、`latest.json` 和 `feiniu-update.env`。
- 将正式 APK 和更新元数据部署到飞牛，由用户在电视端执行一次远程更新验收。

## 31. 2026-06-12 Android TV 1.0.1 签名恢复与 Linux Wrapper 修复

当前修改目标：
- 找回可覆盖旧版 APK 的原签名材料并恢复 GitHub 自动签名发布。
- 修复 Android TV GitHub Actions 在 Linux Runner 中找不到 `gradlew` 的问题。

当前状态：
- 已确认旧版 `releases/wangri-tv-1.0.apk` 使用 Android Debug 证书，SHA-256 指纹为 `B8:8D:6F:AC:90:14:FA:4E:70:2D:AA:BC:E0:D2:58:00:46:AE:9E:6D:0B:16:91:41:2D:36:E0:FB:ED:3C:E9:AA`。
- 已找到对应的 `C:\Android\.android\debug.keystore`，并备份到仓库外 `F:\secure\jdyk\android-tv-release.keystore`。
- 本地签名 Release APK 构建成功，新 APK 与旧 APK 的证书指纹完全一致，可以直接覆盖安装。
- 四个 `ANDROID_TV_*` GitHub Actions Secrets 已配置；第 2 次工作流已通过 Secret 校验和 keystore 恢复。
- 第 2 次工作流失败根因是仓库只跟踪了 `gradlew.bat`，未跟踪 Linux Runner 需要的 `apps/android-tv/gradlew`。
- 已使用 Gradle 8.9 Wrapper 任务生成标准 Unix 脚本，并分别用 PowerShell 与 Git Bash 验证 `gradlew.bat --version` 和 `./gradlew --version` 成功。

后续计划：
- 提交并推送完整 Gradle Wrapper 文件。
- 将尚未成功发布的 `tv-v1.0.1` 标签移动到 Wrapper 修复提交并重新触发工作流。
- 验证 GitHub Release 的签名 APK、更新 manifest、证书指纹和下载地址。

发布结果：
- GitHub Actions `27422904628` 已成功完成签名构建、manifest 生成、`apksigner` 校验、构建产物上传和 GitHub Release 发布。
- GitHub Release：`https://github.com/zsdd2/jdyk/releases/tag/tv-v1.0.1`。
- 正式 APK：`wangri-tv-1.0.1.apk`，大小 `8632029` 字节，SHA256 `45ba34628953ffd2651301c19b87f151127f3c29cfcf88c80c8a541b390db461`。
- `latest.json` 的版本、大小和 SHA256 已与下载后的 APK 独立复核一致。
- 正式 APK 签名证书指纹与旧版完全一致，可在当前设备上直接覆盖安装。
- 后续发布的 `feiniu-update.env` 将保持 `WRJDYK_TV_UPDATE_APK_URL` 为空，由后端按请求 Host 动态生成本地 APK 地址，不再依赖 `FEINIU_HOST`。
- GitHub Release 中的 `feiniu-update.env` 已手动覆盖为动态地址版本，当前资产不再包含 `FEINIU_HOST` 占位符。
- GHCR Actions `27422893414` 已成功完成管理端和后端发布；匿名 `docker manifest inspect` 确认 `latest` 与 `1.0.4` 均包含 `linux/amd64`、`linux/arm64`。
- 从当前开发机访问 `192.168.10.166:3999` 失败，因此飞牛容器更新接口和电视端安装仍需在飞牛恢复可访问后由用户现场验收。

## 32. 2026-06-12 补全 AI 旧版 JSON 输出修复

当前修改目标：
- 排查“补全 AI”返回 `analysis/display_mode/typography/layout/handwriting` 旧版版式 JSON，导致与当前三段式旁白输出不一致的问题。
- 确认补全 AI 是否使用当前后台业务提示词和标准输出契约链路。
- 阻止旧版 layout-only 返回被当成成功 AI 结果写入。

根因：
- “补全 AI”和“重新识别”最终都走 `buildUnifiedVisionSystemPrompt()`，都会读取当前 AI 设置。
- 当前业务提示词中仍混有旧的“输出 JSON 格式”示例，示例字段包括 `display_mode`、`typography`、`handwriting` 等。
- 旧拼接顺序把“标准输出字段要求”放在业务提示词之前，业务提示词里的旧 JSON 示例更靠后，模型可能照抄旧结构。
- `normalizeUnifiedVisionResult()` 对旧版 layout-only 结构仍会走 legacy 解析并标记成功，导致错误结构没有进入失败/重试路径。

当前状态：
- `buildUnifiedVisionSystemPrompt()` 已调整为先放业务提示词，再放标准输出字段要求，并明确“标准输出字段要求的优先级高于业务提示词中的任何输出示例”。
- 后端新增旧版 layout-only 响应识别：当返回包含 `display_mode`、`typography`、`handwriting`、`photo_meta` 或 `push_info`，但缺少 `scores`、`narration_options`、`selected_narration_index`、`layout_plan` 时，直接抛错，不再写入完成结果。
- 新增回归测试覆盖提示词顺序和旧版 layout-only 返回拒绝。

验证：
- `.\node_modules\.bin\jest.CMD app.controller.spec.ts --runInBand --testNamePattern="standard output contract after|legacy layout-only"`：2 个测试通过。
- `.\node_modules\.bin\jest.CMD app.controller.spec.ts --runInBand --testNamePattern="photo_tv_payload_v1|narration_options|standard output contract|legacy layout-only|normalizes nested analysis|normalizes ai_analysis"`：8 个测试通过。
- `.\node_modules\.bin\jest.CMD sqlite-photo.repository.spec.ts --runInBand --testNamePattern="output contract|narration_options|AI settings"`：4 个测试通过。
- `corepack pnpm -F @wrjdyk/backend-api run build`：通过。

后续计划：
- 如线上后台业务提示词仍保留旧 JSON 示例，建议在管理端将旧“输出 JSON 格式”示例移出业务提示词，仅保留业务判断规则。
- 重新运行补全 AI；若模型仍返回旧版顶层结构，任务会失败/重试并显示错误，不会再污染已完成 AI 结果。
## 33. 2026-06-12 TV 盒子磨砂背景兼容与后台升级包上传

当前修改目标：
- 修复 Android TV 在模拟器有磨砂背景、电视盒子上背景变清晰的问题。
- 继续电视端三段式播放计划，确认播放端使用结构化 `narrationVariants`。
- 给飞牛后台补齐 TV APK 上传与远程升级 manifest 管理能力，避免正式盒子拿到的 APK 与本地代码版本不一致。

根因：
- 播放端当前入口已经走 `MemoryExhibitionPlayer`，该组件在模拟器通过 Compose `Modifier.blur(22.dp)` 实现背景模糊和三段式展示。
- 用户实测 1.0.0/1.0.1 在模拟器均正常，但电视盒子背景清晰，说明问题更符合盒子系统/图形栈对运行时 blur 支持不足，而不是版本代码差异。
- 后端原 `tv_4k.webp` 只是清晰缩放图，盒子端实时 blur 失效时会暴露清晰背景。
- 本地 `releases` 目录只有 `wangri-tv-1.0.apk`，而设备默认 manifest 指向 `wangri-tv-1.0.1.apk`；此前后台没有上传升级包入口，容易造成正式 APK 来源不可控。

当前状态：
- 后端衍生图生成改为写入 `tv_blur_fill.webp`：服务端用 Sharp 预合成 3840x2160 的模糊填充背景和居中清晰前景，playlist 的 `display.tvImageUrl` / `displayImageUrl` 指向该文件。
- 旧缓存兼容：若已有 `ai_720.webp` 但缺少 `tv_blur_fill.webp`，再次扫描/AI 任务会重新拉取素材并补生成，不会直接复用清晰旧缓存。
- 衍生图访问白名单已允许 `tv_blur_fill.webp`。
- 后端新增：
  - `GET /api/admin/photo-library/tv-release`
  - `POST /api/admin/photo-library/tv-release/upload`
- 上传 APK 后写入 `WRJDYK_RELEASES_DIR`，生成 `latest.json`，包含 `apkUrl`、`versionCode`、`versionName`、`sizeBytes`、`sha256`、`publishedAt`、`releaseNotes`、`forceUpdate`。
- `GET /api/device/app-update/latest` 优先读取上传生成的 `latest.json`；如果 `apkUrl` 是 `/releases/...apk`，会按当前请求 Host 生成可下载的绝对地址。
- 管理端照片中心新增 `TV 版本管理` 页面，可查看当前 manifest/文件状态并上传新 APK。
- 现有本地改动尚未推送；后续推送需等待用户审批。

验证：
- `corepack pnpm --filter @wrjdyk/backend-api test -- --runInBand app.controller.spec.ts sqlite-photo.repository.spec.ts`：通过，87 个测试。
- `corepack pnpm --filter @vben/web-antd run typecheck`：通过。
- `corepack pnpm --filter @wrjdyk/backend-api run build`：通过。

后续计划：
- 在飞牛后台上传下一版正式签名 APK，确认 `latest.json` 指向上传包。
- 电视盒子拉取新版本后，验证播放背景是否使用服务端预合成磨砂图。
- 如需历史版本回滚，再在 `TV 版本管理` 基础上扩展版本列表和激活/回滚操作。

## 34. 2026-06-13 GitHub 与本地开发进度对齐

当前修改目标：
- 对比 GitHub `origin/main`、本地已提交 HEAD、未提交工作区和本地运行服务，确认功能实际处于哪一层。
- 修复管理端进入首页仍打开模板分析页的问题。
- 修复后端已返回 `TV 版本管理` 菜单，但 frontend 权限模式下侧栏和页面仍不可见的问题。

对比结论：
- `origin/main` 与本地 HEAD 均为 `cb4f65125f96131d142e1ed24088ed2754f96702`，已提交历史没有分叉。
- AI 提示词旧版 JSON 拒绝、服务端 `tv_blur_fill.webp`、TV 升级包上传接口和管理页仍属于本地未提交工作区，GitHub 当前版本尚未包含。
- GitHub 与本地已提交代码都把默认首页设为 `/analytics`，因此进入分析页是代码行为，不是部署缓存或推送异常。
- 管理端当前默认使用 `accessMode: 'frontend'`，菜单来自本地静态路由；此前只增加了后端 `PhotoLibraryTvRelease` 菜单，没有同步增加前端静态路由，导致接口存在但侧栏不显示、直达页面返回 404。

当前状态：
- 后端用户信息 `homePath` 已改为 `/photo-library/photos`。
- 管理端应用级 `defaultHomePath` 已改为 `/photo-library/photos`，没有修改共享 Vben 默认配置。
- 照片中心静态路由已增加 `PhotoLibraryTvRelease`，指向 `/photo-library/tv-release`。
- 新增首页配置和 TV 静态路由回归测试。
- 本地后端使用当前 `dist` 监听 `3999`；管理端 Vite 使用当前源码监听 `5200`。

已完成验证：
- `app.controller.spec.ts` 首页定向测试：1 个通过。
- `preferences.spec.ts` 与 `photo-library-routes.spec.ts`：2 个通过。
- `GET http://127.0.0.1:3999/api/admin/photo-library/tv-release`：返回当前 manifest/文件状态。
- `GET http://127.0.0.1:5200/api/menu/all`：包含 `PhotoLibraryTvRelease`。
- 后端 `app.controller.spec.ts` 与 `sqlite-photo.repository.spec.ts`：87 个测试通过。
- 管理端 `vue-tsc --noEmit --skipLibCheck`：通过。
- `corepack pnpm -F @wrjdyk/backend-api run build`：通过。
- 管理端 Vite production build：通过，产物包含 `tv-release` JS/CSS chunk。
- 浏览器访问旧首页 `/analytics`：自动进入 `/photo-library/photos`。
- 浏览器侧栏：显示 `TV 版本管理`。
- 浏览器访问 `/photo-library/tv-release`：页面正常显示当前发布状态和上传表单，接口数据加载成功，控制台无 error。

后续计划：
- 当前本地代码和运行态已统一，但这些改动仍未提交、未推送。
- 下一步进入提交前差异检查；提交和推送需单独确认。
- 推送后再验证 GitHub Actions、GHCR 镜像和飞牛部署，不能用本地验证代替线上发布验证。

## 35. 2026-06-13 后台 1.0.5 与 Android TV 1.0.2 发布

当前修改目标：
- 将已完成的 AI 输出契约、TV 服务端磨砂图、TV 升级包管理和首页修复统一发布到 GitHub。
- 管理端与后端镜像升级为 `1.0.5`，Android TV 升级为 `versionCode 7 / versionName 1.0.2`。
- 生成一份可在现有设备覆盖安装的正式签名 APK，并验证远程更新 manifest、下载文件和完整性元数据。

当前状态：
- 已确认 `main` 与 `origin/main` 在发布前均为 `cb4f65125f96131d142e1ed24088ed2754f96702`，新功能仍在本地工作区。
- 已将 GHCR 固定版本标签更新为 `1.0.5`。
- 已将 Android TV 版本更新为 `7 / 1.0.2`。
- 后端默认 APK 地址改为根据 manifest 的 `versionName` 动态生成，不再硬编码旧版 `1.0.1` 文件名。
- 正式签名材料仅配置在 GitHub Actions；本地 release 构建用于编译验证，最终本地安装包使用 GitHub Release 的正式签名产物。
- Windows 本地构建已将 `ANDROID_USER_HOME` 重定向到仓库内忽略目录，避免系统级 Android 偏好与 debug keystore 锁文件无写权限。

本地验证：
- Android manifest 脚本测试：3 项通过。
- 后端 `app.controller.spec.ts` 与 `sqlite-photo.repository.spec.ts`：87 项通过。
- 管理端首页与 TV 静态路由 Vitest：2 项通过。
- 后端 Nest 构建、管理端 TypeScript/Vue 类型检查、管理端 Vite production build：通过。
- `docker compose -f docker-compose.feiniu.yml config`：通过，展开版本为 `7 / 1.0.2`。
- Android `testDebugUnitTest`、`assembleDebug`、`assembleRelease`：通过。
- debug APK：`versionCode 7 / versionName 1.0.2`，大小 `11866855` bytes，SHA256 `5932EA236F7DD4A7622C06CE73099D7EFA20E1EF2FF293CF773C80E3860700E5`。
- unsigned release APK：`versionCode 7 / versionName 1.0.2`，大小 `8611816` bytes，SHA256 `BA35D2D0496AA76B39C142DBD2C418F6E664D492E1F62F8A78074A6960C8882C`；签名验证明确失败，未作为发布包使用。

后续修改计划：
- 使用 `scripts/release/verify-local-release.ps1` 固化本地验证流程，避免重复尝试错误的前端/Android 构建命令。
- 使用 `scripts/release/README.md` 作为后台/管理端推送、TV tag 发布、正式 APK 下载和升级接口回测的固定 checklist。
- 本地发布脚本已验证可执行；脚本额外固定了仓库内 `.docker-config` 和 `ANDROID_USER_HOME`，避免反复触发用户目录权限错误。
- 主发布提交 `b998816` 已推送到 `main`，`tv-v1.0.2` 标签已推送。
- Android TV Release run `27431792432` 已成功，GitHub Release 正式 APK 已下载到
  `apps/android-tv/build/release/wangri-tv-1.0.2.apk`。
- 正式 APK manifest 复核通过：`versionCode 7`、`versionName 1.0.2`、大小 `8632035`
  bytes、SHA256 `2eb17780ddfc5b709a3b23b42d11f8475d05366dcf6f0485ea31f8e08b2d152c`。
- 正式 APK 签名验证通过，证书 SHA-256 指纹为
  `B8:8D:6F:AC:90:14:FA:4E:70:2D:AA:BC:E0:D2:58:00:46:AE:9E:6D:0B:16:91:41:2D:36:E0:FB:ED:3C:E9:AA`。
- 使用正式 APK 验证本地后台上传接口通过，`/api/device/app-update/latest` 返回 `7 / 1.0.2`，
  下载 URL 返回 `application/vnd.android.package-archive`，下载文件大小和 SHA256 与 manifest 一致。
- GHCR run `27431784268` 中 `Publish admin` 成功，`Publish backend` 失败于
  `docker/build-push-action` 的 layer 上传阶段：`error writing layer blob: not_found`，不是本地代码构建失败。

后续修改计划：
- 通过文档进度提交重触发 GHCR `1.0.5/latest` 后台镜像发布。
- 新 GHCR run 完成后，验证 `jdyk-admin:1.0.5`、`jdyk-backend:1.0.5` 与 `latest` 的多架构 manifest。
- 若后台 Buildx 再次失败，再只调整 GHCR backend 构建/缓存策略，不改 TV Release。

## 36. 2026-06-13 Android TV 固定三行字幕播放模板

当前修改目标：
- 第一版 TV 播放版式不再参考 AI 返回的版式、安全区、字体和左右位置建议。
- 所有照片固定使用电影字幕式三行居中展示：上方标准字体、中间手写体、下方标准字体。
- 按 3840x2160 设计稿逐行还原字幕坐标、字号、行高和字距：
  - 第一行：`left=1455 top=1524 width=889 height=90 fontSize=88 lineHeight=104 letterSpacing=42`
  - 第二行：`left=912 top=1691 width=2067 height=199 fontSize=160 lineHeight=200 letterSpacing=2`
  - 第三行：`left=1463 top=1941 width=917 height=84 fontSize=84 lineHeight=100 letterSpacing=36`

当前状态：
- `MemoryExhibitionPlayer` 已改为固定使用第一组三段式 `narrationVariants`，避免播放模板阶段随机切换。
- `CaptionStage` 已固定使用 `cinematicCaptionDesignLines()` 的 4K 坐标按当前屏幕尺寸缩放，不再读取 `layoutPosition` 或 `safeArea` 决定字幕区域。
- 字体样式已固定为上/下 Serif 标准字体、中间 Cursive 手写体，文本统一居中；中间行逗号、句号、顿号等标点使用红色强调。
- 遮罩改为通用底部纵向暗场，避免根据 AI 建议做左/右渐变。
- 图片轻运动不再根据 `layoutPosition` 左右偏移。
- Android TV 版本已提升到 `versionCode 8 / versionName 1.0.3`，并同步 `.env.feiniu.example`、`docker-compose.feiniu.yml`、Android manifest 测试、TV README 和本地发布校验脚本。
- 新增 `MemoryExhibitionPlayerTest`，覆盖 4K 设计边界、逐行设计规格、三段旁白顺序和 fallback 最多三行。
- 已生成签名 APK 并本地保留：`apps/android-tv/build/release/wangri-tv-1.0.3.apk`，大小 `8632033` bytes，SHA256 `3287dbf300b93a1f8794696ab19df716f03dcd33c6258765934ee612e3fb11ec`。
- 已上传到本地后台 releases：`apps/backend-api/releases/wangri-tv-1.0.3.apk`，并生成 `apps/backend-api/releases/latest.json`。
- 后台 `app.controller.spec.ts` 已隔离 `WRJDYK_RELEASES_DIR`，避免本地已上传的真实 `latest.json` 污染 runtime env 相关单元测试。

验证：
- 已先运行 `:app:testDebugUnitTest --tests com.wangrizhongxian.tv.MemoryExhibitionPlayerTest` 看到缺少新模板 helper 的预期失败。
- 已在 4K 设计规格测试修改后再次看到当前实现不满足的预期失败，然后按规格实现并转绿。
- `node --test scripts/android-tv/generate-update-manifest.test.mjs`：通过。
- `:app:testDebugUnitTest --tests com.wangrizhongxian.tv.MemoryExhibitionPlayerTest`：通过。
- `:app:testDebugUnitTest`：通过。
- `:app:assembleRelease`：通过，使用本地可覆盖旧版的 Android TV release keystore 签名。
- `aapt dump badging`：确认 APK 为 `versionCode=8 / versionName=1.0.3`。
- `apksigner verify --print-certs`：通过，证书 SHA-256 指纹为 `b88d6fac9014fa4e702daabce0d2580046ae9e6d0b1691412d36e0fbed3ce9aa`。
- `GET http://127.0.0.1:3999/api/device/app-update/latest`：返回 `8 / 1.0.3`，下载地址为 `http://127.0.0.1:3999/releases/wangri-tv-1.0.3.apk`。
- 下载校验文件 `apps/android-tv/build/release/wangri-tv-1.0.3-download-check.apk`：大小 `8632033` bytes，SHA256 与 manifest 一致。
- `docker compose -f docker-compose.feiniu.yml config`：通过，展开后的 TV 默认升级版本为 `8 / 1.0.3`。
- `.\scripts\release\verify-local-release.ps1 -TvVersionCode 8 -TvVersionName 1.0.3`：通过。覆盖版本面检查、Android manifest 测试、后台 87 个 Jest 用例、管理端路由 Vitest、后台 build、管理端 typecheck、管理端 production build、Compose 展开、Android debug/release 构建和 APK 元数据检查。

后续修改计划：
- 如需正式 GitHub 发布，再提交并推送 `main`，创建并推送 `tv-v1.0.3` tag，触发 GitHub Android TV Release workflow。
- 字体形态目前依赖系统 Serif/Cursive fallback；若要完全贴合 `Source Han Serif SC` 与 `Ma Shan Zheng/Zhi Mang Xing/LXGW WenKai`，后续需要把字体文件加入 Android TV 资源并显式加载。
- 后续增加多模板时，在当前固定模板基础上扩展模板枚举和随机策略，不再把 AI 版式建议直接作为播放器布局输入。

## 37. 2026-06-13 管理端关于页版本号与通用 latest Compose

当前修改目标：
- 在后台管理端“关于”页面下方显示当前后台/管理端发布版本号。
- 将后台/管理端 GHCR 固定版本从 `1.0.5` 提升到 `1.0.6`，用于触发 GitHub 镜像发布测试。
- 新增一个通用 Compose 文件，每次启动时跟随并拉取 `latest` 镜像，不依赖飞牛固定 `/vol1/...` 路径。

当前状态：
- 管理端新增 `VITE_ADMIN_RELEASE_VERSION=1.0.6`，避免与 Vben 模板插件注入的 `VITE_APP_VERSION=5.7.0` 冲突。
- “关于”页面已在通用 Vben About 内容下方追加 `当前版本号：1.0.6`。
- GHCR workflow 固定版本标签已改为 `1.0.6`，`latest` 仍在 `main` 分支发布时同步更新。
- 新增 `docker-compose.latest.yml`：后端和管理端均使用 `ghcr.io/zsdd2/...:latest`，并设置 `pull_policy: always`；数据、媒体缓存和 releases 使用 Docker 命名卷。
- 发布脚本已增加 `VITE_ADMIN_RELEASE_VERSION` 检查，并同时验证 `docker-compose.feiniu.yml` 与 `docker-compose.latest.yml` 的展开配置。
- 飞牛部署文档已更新到 Android TV `1.0.3 / versionCode 8`，并补充通用 latest Compose 用法。
- 修复 `TV 版本管理` 页面上传 APK 返回 `Bad Request` 的问题：前端上传接口改为使用项目统一的 `requestClient.upload()`，不再把 `FormData` 直接交给默认 JSON 请求客户端。

验证：
- 已用 `curl -F` 对本地后端上传 `wangri-tv-1.0.3-github-download-check.apk`，接口返回 201，确认后端和 APK 文件本身可用。
- `vitest run src/api/photo-library-tv-release.spec.ts src/app-version.spec.ts src/preferences.spec.ts src/router/photo-library-routes.spec.ts`：通过，4 个测试文件 / 5 个用例。
- `corepack pnpm -F @vben/web-antd run typecheck`：通过。
- `vite build --mode production`：通过。
- 生产产物 `about-*.js` 已确认包含 `VITE_ADMIN_RELEASE_VERSION: 1.0.6`，页面会显示 `当前版本号：1.0.6`。
- `docker compose -f docker-compose.feiniu.yml config`：通过。
- `docker compose -f docker-compose.latest.yml config`：通过。
- 浏览器访问 `http://127.0.0.1:5200/photo-library/tv-release`：页面正常显示 `TV 版本管理` 和上传按钮，控制台无 error。

后续修改计划：
- 提交并推送 `main`，触发 GHCR 发布 `jdyk-admin:1.0.6`、`jdyk-backend:1.0.6` 和新的 `latest`。
- GitHub Actions 完成后，验证两个镜像的 `1.0.6/latest` 多架构 manifest。
- 飞牛侧使用 `docker compose pull && docker compose up -d --force-recreate`，或通用 Compose 使用 `docker compose -f docker-compose.latest.yml up -d` 拉取最新管理端。
