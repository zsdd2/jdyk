# 往日重现开发进度同步

## 2026-06-18 Android TV 2.0.6 本地版本打包

- 当前目标：把当前本地修复打包成新版，统一本地版本号并保留 APK 构建产物。
- 当前状态：项目/后端/管理端版本已更新为 `2.0.6`；Android TV 已更新为 `versionCode 18 / versionName 2.0.6`；GHCR workflow raw 版本、生产 env、Compose、Feiniu env 示例、TV README、manifest 测试和本地发布脚本默认参数已同步到 `2.0.6`。本轮已提交并推送 `main`，已创建并推送 `v2.0.6` 与 `tv-v2.0.6` 标签触发远端发布。
- 已验证步骤：`node --test .\scripts\android-tv\generate-update-manifest.test.mjs` 通过 3 项；完整 `.\scripts\release\verify-local-release.ps1` 通过，覆盖版本面检查、Android update manifest 测试、后端 3 个 Jest 套件 118 项、Web 5 个聚焦测试 6 项、后端 build、Web typecheck/production build、Compose 展开、Android debug/release 构建、APK 元数据检查和本地 APK 留档；复核产物为 `releases\wangri-tv-2.0.6-debug.apk` SHA256 `52D8DF78DAAF422EDA3475AFB2B287969ACD35D627C79F392310C55DB405D4B1`、`releases\wangri-tv-2.0.6-unsigned.apk` SHA256 `EBD67B6E93C7A386899D7DFC340153ACA50431B28857C92ECDA777ED7E8E03BC`。
- 本地构建证据：`releases/wangri-tv-2.0.6-debug.apk` 大小 `17483631` 字节，SHA256 `52D8DF78DAAF422EDA3475AFB2B287969ACD35D627C79F392310C55DB405D4B1`；`releases/wangri-tv-2.0.6-unsigned.apk` 大小 `14228232` 字节，SHA256 `EBD67B6E93C7A386899D7DFC340153ACA50431B28857C92ECDA777ED7E8E03BC`。本机 release 包未签名，只能作本机构建验证；正式远程升级仍应使用 GitHub Android TV workflow 生成的签名 APK。
- 远端发布证据：提交 `0b029b9 Release Android TV 2.0.6` 已推送到 `origin/main`；远端标签 `v2.0.6` 与 `tv-v2.0.6` 已推送。GitHub Actions 已触发：`Publish GHCR Images` main run `27924809347`、`Publish GHCR Images` tag run `27924818206`、`Android TV Release` run `27924818196`。查询时三个关键工作流仍在 `in_progress`；本机 `gh auth status` 显示 token 失效，随后公开 GitHub API 触发未认证限流，结论需恢复 gh 认证后复查。
- 下一步计划：恢复 GitHub CLI 认证后复查三个 Actions 结论，并确认 `tv-v2.0.6` GitHub Release 是否产出签名 `wangri-tv-2.0.6.apk`、`latest.json` 和 `feiniu-update.env`；随后再记录签名 APK 大小/hash。
- 当前风险：尚未在真实 Android 9 设备上安装 `2.0.6` Debug APK 做遥控器焦点实机复测；正式远程升级以 GitHub Android TV workflow 生成的签名 APK 为准，目前还未复查到远端工作流最终结论。

## 2026-06-18 Android TV 登录按钮焦点滑开修复

- 当前目标：修复 Android 9 设备登录界面从密码框移动到“立即登录”按钮时焦点无法稳定停留、会继续滑到下方选项的问题。
- 当前状态：已定位根因是登录页方向键移动和确认激活都在 `KeyUp` 阶段处理；从密码框按下方向键后，焦点到达登录按钮，同一次按键抬起事件可能被新焦点按钮接收并继续执行 `DirectionDown`，导致焦点自动跳到“记住密码”。已将登录页焦点移动改为只在 `KeyDown` 消费，确认/回车激活仍保持 `KeyUp`。
- 已验证步骤：先新增 `AlbumParsingTest.loginFocusMovementUsesKeyDownAndActivationUsesKeyUp` 并确认缺少事件相位约束时失败；实现后该定向测试通过；`AlbumParsingTest` 全量通过；Android TV `:app:testDebugUnitTest` 全量通过；`:app:assembleDebug` 通过。
- 下一步计划：如有真实 Android 9 设备连接，安装 Debug APK 后用遥控器复测“密码框向下 -> 立即登录 -> 确认登录”和“立即登录向下 -> 记住密码”的焦点路径。
- 当前风险：本轮已完成单测和构建验证，但尚未在真实 Android 9 电视设备上做遥控器实机复测。

## 2026-06-17 2.0.5 播放编辑与 Android TV 登录/竖图修复

- 当前目标：把播放相册里的时间、地点、天气快速修改入口合并到“快速修改 AI 旁白”模态；Android TV 竖构图不再随机使用左右侧栏模板，避免真机 Android 9 上照片与文案重叠；电视端登录不再凭旧 token 免登录进入相册，输入后台地址、账号、密码后直接进入首个可播放相册，底部改为“记住密码/自动登录”。
- 当前状态：Web 播放相册已新增旁白编辑 metadata 表单 helper；独立“编辑照片信息”不再显示或提交时间/地点/天气；Android TV 已新增凭保存账号密码自动登录策略、首个可播相册选择 helper，并把竖图播放模板固定为居中。项目/后端/管理端版本已更新为 `2.0.5`；Android TV 已更新为 `versionCode 17 / versionName 2.0.5`；GHCR workflow、生产 env、Compose、TV README、manifest 测试和本地发布脚本已同步。
- 最新已验证步骤：已先让 `..\..\node_modules\.bin\vitest.CMD run src/views/photo-library/playback-albums/playback-album-view.spec.ts` 因缺少 `buildPlaybackMemberNarrationEditForm` 失败；已先让 Android TV 新增登录/竖图回归测试因缺少 helper 或仍随机左右模板失败。实现后，Web 播放相册测试 11 项通过；`.\gradlew.bat :app:testDebugUnitTest --tests com.wangrizhongxian.tv.MemoryExhibitionPlayerTest --tests com.wangrizhongxian.tv.AlbumParsingTest --no-daemon` 通过；`corepack pnpm -F @vben/web-antd run typecheck`、`node --test scripts/android-tv/generate-update-manifest.test.mjs`、后端 `node_modules\.bin\jest.CMD app-access.guard.spec.ts app.controller.spec.ts sqlite-photo.repository.spec.ts --runInBand` 均通过。完整 `.\scripts\release\verify-local-release.ps1` 已通过，覆盖 manifest、后端聚焦测试、Web 聚焦测试、后端 build、Web typecheck/build、Compose 展开、Android debug/release 构建、APK 元数据和本地 APK 留档。
- 本地构建证据：`releases/wangri-tv-2.0.5-debug.apk` 大小 `17483623` 字节，SHA256 `5B538523391544EBC439C285D70238F8F66E0BFD30996CBCCF99AB6A89AE32CF`；`releases/wangri-tv-2.0.5-unsigned.apk` 大小 `14228228` 字节，SHA256 `9D827028E66DADB50276B31D9D5DEB2E41DA74AE095142AEABAF9D864FFE77C4`，未签名包只作本机构建验证。
- 远端发布证据：功能提交 `d30ae71` 已推送到 `origin/main`，并推送 tags `v2.0.5` 与 `tv-v2.0.5`；GitHub Actions `Publish GHCR Images` main run `27699679668` 成功，tag run `27699721298` 成功；`Android TV Release` run `27699717194` 首次远端 Gradle 构建在 30 分钟超时取消，直接重跑后 job `81939762708` 成功并发布 GitHub Release `tv-v2.0.5`。远端签名 APK `wangri-tv-2.0.5.apk` 大小 `14248609` 字节，资产 digest `sha256:8a49b71cdecbe389acf97e8c61d8b4f34a2e7c294525060da1c7da22c030626b`；`latest.json` digest `sha256:dd33767ba25b4011b03b81c4a6f096ddf62234a93401c005e1cbb5251004ac2f`；`feiniu-update.env` digest `sha256:1f26274d212896cf323e7dd47f8597621cfd222e9c751d67417dbf25c8345e24`。
- 下一步计划：上线前先备份飞牛数据目录，再拉取 `2.0.5` 镜像并按只读健康检查、管理端登录、播放相册快捷编辑、TV 登录直达播放、自动登录和 TV 更新顺序验收。
- 当前风险：真实 Android 9 设备尚未现场复测；生产飞牛上线前仍需备份 `/vol1/1000/docker/jdyk/data` 并确认登录直达播放、自动登录和 TV 更新。

## 2026-06-17 2.0.4 登录 500、TV 第三行与播放列表编辑修复

- 当前目标：修复升级到 `2.0.3` 后生产库首次用 `admin / admin123` 登录返回 500；同时修复 Android TV 侧栏竖图第三行字幕显示不全，并让播放相册成员列表也能直接编辑照片展示时间、地点、天气等信息。
- 当前状态：已定位登录 500 的根因为迁移记录已到 schema 19 但 `admin_credentials` 表缺失时，登录读取管理员凭据表会抛出 `no such table: admin_credentials`；已在 SQLite 初始化阶段增加可自愈建表。Android TV 左右侧栏第三行已缩小字号和字距，给 10 个中文字符留出更大安全余量。播放相册成员操作菜单已新增“编辑信息”，复用照片中心 `/metadata` 接口，保存后同步当前成员行和 AI 详情记录。
- 版本收口：项目/后端/管理端版本已更新为 `2.0.4`；Android TV 已更新为 `versionCode 16 / versionName 2.0.4`；GHCR workflow、生产 env、Compose、TV README、manifest 测试和本地发布脚本已同步。
- 最新已验证步骤：已先让 `node_modules\.bin\jest.CMD sqlite-photo.repository.spec.ts --runInBand --testNamePattern="repairs a missing admin credential table"` 失败并确认错误为 `no such table: admin_credentials`，实现后该测试通过；已先让 `.\gradlew.bat :app:testDebugUnitTest --tests com.wangrizhongxian.tv.MemoryExhibitionPlayerTest.portraitSideClosureLineLeavesRoomForTenChineseCharacters --no-daemon` 失败，实现后通过。随后 `node_modules\.bin\jest.CMD app-access.guard.spec.ts app.controller.spec.ts sqlite-photo.repository.spec.ts --runInBand` 通过 3 个套件 118 项；`..\..\node_modules\.bin\vitest.CMD run src/views/photo-library/playback-albums/playback-album-view.spec.ts` 通过 10 项；`corepack pnpm -F @vben/web-antd run typecheck`、`node --test scripts/android-tv/generate-update-manifest.test.mjs`、`.\gradlew.bat :app:testDebugUnitTest --tests com.wangrizhongxian.tv.MemoryExhibitionPlayerTest --no-daemon` 均通过。完整 `.\scripts\release\verify-local-release.ps1` 已通过，覆盖后端聚焦测试、后端 build、Web typecheck/build、Compose 展开、Android 构建、APK 元数据和本地 APK 留档。
- 本地构建证据：`releases/wangri-tv-2.0.4-debug.apk` 大小 `17483630` 字节，SHA256 `F0E6866B5AB6C889A71144EBCE44ABC1D505E7031EEE4A9F11583FF52386A6AE`；`releases/wangri-tv-2.0.4-unsigned.apk` 大小 `14228232` 字节，SHA256 `9B3B0AB6A8EF8A9DE7AA9BC0E114FDDC236C5FCC7C26E979930E81C43A9ED83E`，未签名包只作本机构建验证。
- 远端发布证据：功能提交 `ae64540` 已推送到 `origin/main`，并推送 tags `v2.0.4` 与 `tv-v2.0.4`；GitHub Actions `Publish GHCR Images` main run `27675942092` 成功，tag run `27676358986` 成功，`Android TV Release` run `27676358581` 成功。GitHub Release `tv-v2.0.4` 已发布 `wangri-tv-2.0.4.apk`、`latest.json`、`feiniu-update.env`；签名 APK 大小 `14248613` 字节，资产 digest `sha256:3b96bdd1bc9b7eb74dd75c66343197341f12eec924afc5c0e1cfaab0de0523bd`。
- 下一步计划：上线前先备份 `/vol1/1000/docker/jdyk/data`，再在飞牛环境拉取 `2.0.4` 镜像并按只读健康检查、管理端首次登录改密、播放列表编辑和 TV 更新顺序验收。
- 当前风险：尚未在真实飞牛容器上重新覆盖验证，生产上线仍需先备份 `/vol1/1000/docker/jdyk/data` 并确认新版健康接口、首次登录改密、播放列表编辑和 TV 更新；正式 TV 安装包以 GitHub Actions 签名 APK 为准。

## 2026-06-17 2.0.3 初始密码强制修改与本地 APK 留档

- 当前目标：把正式版首次运行策略改为可用 `admin / admin123` 登录，但登录后必须立即修改初始密码；同时把每次本地 APK 打包后的版本化副本保留到 `releases/`，并统一发布面到 `2.0.3`。
- 当前状态：后端已新增 SQLite `admin_credentials` 表，生产首次未配置 `WRJDYK_ADMIN_PASSWORD` 且未设置 SQLite 密码时，管理端登录返回 `mustChangePassword=true`；该 token 只能访问 `POST /api/auth/password`，普通后台 API 和 TV 设备登录在改密前不可用。改密成功后新密码写入 SQLite，`admin123` 失效。管理端已新增 `/auth/change-password` 强制改密页，登录 store 遇到 `mustChangePassword` 不再拉菜单，直接跳转改密。
- 版本收口：项目/后端/管理端版本已更新为 `2.0.3`；Android TV 已更新为 `versionCode 15 / versionName 2.0.3`；GHCR workflow、生产 env、Compose、TV README、manifest 测试和本地发布脚本已同步。
- 本地 APK 留档：`scripts/release/verify-local-release.ps1` 已新增 `local APK copies` 步骤；每次本地发布门禁构建后都会复制 `releases/wangri-tv-<version>-debug.apk`，并根据本机是否有签名环境复制 `releases/wangri-tv-<version>.apk` 或 `releases/wangri-tv-<version>-unsigned.apk`，同时打印大小和 SHA256。
- 最新已验证步骤：后端新增红灯测试已先失败，再实现后通过；`node_modules\.bin\jest.CMD app-access.guard.spec.ts app.controller.spec.ts sqlite-photo.repository.spec.ts --runInBand` 通过 3 个套件 117 项；`..\..\node_modules\.bin\vitest.CMD run src/app-version.spec.ts src/api/core/auth.spec.ts src/api/photo-library-tv-release.spec.ts src/preferences.spec.ts src/router/photo-library-routes.spec.ts` 通过 5 个文件 6 项；`corepack pnpm -F @wrjdyk/backend-api run build`、`corepack pnpm -F @vben/web-antd run typecheck`、`node --test scripts/android-tv/generate-update-manifest.test.mjs` 均通过。完整 `.\scripts\release\verify-local-release.ps1` 已通过，覆盖 Android manifest 测试、后端聚焦测试、Web 聚焦测试、后端 build、Web typecheck、Web production build、两套 Compose 展开、Android 构建、APK 元数据和本地 APK 留档。
- 本地构建证据：Debug APK 为 `apps/android-tv/app/build/outputs/apk/debug/app-debug.apk`，大小 `17483624` 字节，SHA256 `1B661539CEC5A9F4CB5085F06A924E772DDB71C255FE120198FB8E20BCD4B184`；本地 Release 产物为未签名 `apps/android-tv/app/build/outputs/apk/release/app-release-unsigned.apk`，大小 `14228228` 字节，SHA256 `A7FB8D0F5DD78611456B83423D2767CA2C43DCFCA85FDCD98AAC8303E85251F7`。发布脚本已同步复制到 `releases/wangri-tv-2.0.3-debug.apk` 和 `releases/wangri-tv-2.0.3-unsigned.apk`。
- 远端发布证据：功能提交 `913ad86` 已推送到 `origin/main`，并推送 tags `v2.0.3` 与 `tv-v2.0.3`；GitHub Actions `Android TV Release` run `27672967237` 成功，`Publish GHCR Images` tag run `27672966744` 成功，main run `27672944127` 成功。GitHub Release `tv-v2.0.3` 已发布 `wangri-tv-2.0.3.apk`、`latest.json`、`feiniu-update.env`；签名 APK 大小 `14248603` 字节，资产 digest `sha256:3e1c2bfebf7c00475714016aeb151201c48ad41aa5f7e1e0301d6d5daef37182`。
- 下一步计划：上线前先备份 `/vol1/1000/docker/jdyk/data`，再在飞牛环境拉取 `2.0.3` 镜像并按只读健康检查、管理端首次登录改密、TV 更新页和设备登录顺序验收。
- 当前风险：真实飞牛容器覆盖尚未执行；生产上线仍需以生产备份存在、卷挂载正确、健康接口、数据计数和首次改密流程通过为准。本机 Release APK 未签名，只能作为构建验证，正式发布以 GitHub Actions 签名 APK 为准。

## 2026-06-16 上线覆盖前数据保护与收口清单

- 当前目标：把最近多轮升级整理成上线前必须完成的门禁，确保用新镜像覆盖部署时不覆盖或丢失旧版本 SQLite、派生图、媒体缓存、APK 发布文件和设备授权数据。
- 当前状态：已完成只读复核和本地发布门禁，当前工作区仍有跨后端、管理端、Android TV、发布脚本和 CI 的未提交改动；已完成的本地验证包括认证/资源签名、扫描 upsert 保留状态、AI 任务重启恢复、34 张待处理照片补齐、播放相册/设备授权展示优化、AI 第三段 10 字规则与展示信息编辑。生产 Compose 的持久化保护依赖 `/workspace/apps/backend-api/data`、`/workspace/media-cache`、`/workspace/releases` 挂载到宿主目录或 Docker 命名卷；镜像构建本身不会携带运行库覆盖线上数据。
- 已确认的数据风险：`SqlitePhotoRepository.rebuildFromPhotoRoot()` 已从全表清空改为 `local-scan` upsert，能保留同一 `scan_###` 的 AI/派生状态；但如果生产照片目录与旧版本不一致，扫描仍会删除当前目录中不存在的 `source_type='local' AND source_album_id='local-scan'` 照片记录。SQLite schema 升级到 18 主要是补列、建表和刷新内置 AI 提示词；刷新提示词会覆盖 `ai_settings.scoring_prompt` 与 `output_contract_prompt`，上线前需确认这是预期。
- 版本收口：已按推送发布要求把本轮版本面统一为项目/后端/管理端 `2.0.2`，Android TV `versionCode 14 / versionName 2.0.2`；已同步 `docker-compose.feiniu.yml`、`docker-compose.latest.yml`、`.env.feiniu.example`、Android TV README、manifest 测试和 `verify-local-release.ps1`。
- 最新已验证步骤：首次执行 `.\scripts\release\verify-local-release.ps1` 时停在后端聚焦测试，根因是 4 个 AI 旁白归一化测试仍按旧的第三段 8 字预期断言；已把测试预期同步到当前确认的 10 字规则。随后 `node_modules\.bin\jest.CMD app.controller.spec.ts sqlite-photo.repository.spec.ts --runInBand` 通过 2 个套件 107 项；再次执行 `.\scripts\release\verify-local-release.ps1` 完整通过，覆盖 Android manifest 测试 3 项、后端聚焦测试、Web 聚焦测试 4 个文件 5 项、后端 build、Web typecheck、Web production build、两套 Compose 展开、Android Debug/Release 构建与 APK 元数据。补跑 `node_modules\.bin\jest.CMD app-access.guard.spec.ts app.controller.spec.ts app.module.spec.ts sqlite-photo.repository.spec.ts --runInBand` 通过 4 个套件 116 项；补跑 `vitest` 管理端 4 个测试文件通过 21 项。版本收口后再次执行 `.\scripts\release\verify-local-release.ps1` 通过，构建产物元数据确认 Debug/Release 均为 `versionCode 14 / versionName 2.0.2`。
- 远端发布证据：提交 `b398bb6` 已推送到 `origin/main`，并推送 tags `v2.0.2` 与 `tv-v2.0.2`；GitHub Actions `Android TV Release` run `27627337357` 成功，`Publish GHCR Images` tag run `27627336894` 成功，main run `27627221969` 成功。GitHub Release `tv-v2.0.2` 已发布 `wangri-tv-2.0.2.apk`、`latest.json`、`feiniu-update.env`；签名 APK 大小 `14248603` 字节，资产 digest `sha256:40f2def56df9bb80221f0e066d522f10d9a6c01938bf47670f93bfd2f747662c`。
- 构建证据：本地 Debug APK 为 `apps/android-tv/app/build/outputs/apk/debug/app-debug.apk`，大小 `17483628` 字节，SHA256 `1828B7EE757E3DD52F6B871CC3370C800256836AC393C76F848B464DCF1ACC77`；本地 Release 产物为未签名 `apps/android-tv/app/build/outputs/apk/release/app-release-unsigned.apk`，大小 `14228232` 字节，SHA256 `9516E263F3818FCA0AD4086ED6AA3482BF10A33FC340BD533A9712FBB8EB34DE`，只能作为构建验证，不能发布。
- 上线前必须完成：
  1. 给生产宿主目录做离线备份：`/vol1/1000/docker/jdyk/data/backend`、`/vol1/1000/docker/jdyk/data/media-cache`、`/vol1/1000/docker/jdyk/data/releases`，至少包含 `wrjdyk.sqlite`、`derivatives/`、`releases/`。
  2. 在生产 `.env.feiniu` 或部署环境中补齐 `WRJDYK_ADMIN_PASSWORD` 与 `WRJDYK_AUTH_SECRET`，避免生产默认口令不可用导致无法登录，且避免 token secret 跟随口令变化导致旧 token 全失效。
  3. 本地发布门禁已通过；提交/推送后还需确认远端 CI、GHCR 镜像和正式签名 APK。
  4. 合并和推送后确认 GHCR `2.0.2` 与 `latest` 镜像构建成功，再在生产拉取前核对镜像 digest。
  5. 生产覆盖启动后先只做健康检查和只读核对：`/api/health.version=2.0.2`、照片总数、播放相册数、设备数、AI 任务状态、TV 更新 manifest，不立即触发扫描/补齐/清理。
  6. 确认线上数据无误后再按需触发补齐任务；生产扫描只能在确认照片源目录与旧版本一致后执行。
- 当前不能自动执行的动作：不能直接 `docker compose up -d --force-recreate` 覆盖生产，不能清空/迁移生产卷，不能在未备份前执行扫描，不能发布未签名 Android TV APK，不能把本地 `app-release-unsigned.apk` 当正式更新包。
- 下一步计划：先完成上线前代码收口与测试门禁；随后提交/推送本轮改动，等待 GHCR 和 Android TV 发布工作流；最后按“备份 -> 拉镜像 -> 重建容器 -> 只读核对 -> 设备/页面验证 -> 必要时补齐”的顺序上线。
- 当前风险：本轮只做了本机静态与文档复核，没有直接读取生产 NAS 上的真实数据目录，也没有执行生产容器覆盖；上线安全最终必须以生产备份文件存在、生产容器卷挂载正确、健康接口和数据计数核对通过为准。

## 2026-06-16 AI 第三段旁白 10 字规则与展示信息编辑

- 当前目标：修复 AI 识别详情中第三段旁白比原始 JSON 少字的问题，并允许在旁白详情处修改展示时间、地点、天气，支持对已选照片批量修改展示信息。
- 当前状态：根因确认是后台归一化把 `lyrical_closure / closing_line` 硬截为 8 个中文字符，已统一改为 10 个中文字符以内；系统提示词同步改成“lyrical_closure 不超过 10 个中文字符”。照片 metadata 更新接口扩展 `takenAt`、`location`、`weather`，其中时间/地点写入 photos 表，天气写回 `ai_detail.raw.photo_analysis.observed_meta.weather`，并允许传空字符串清空。管理端照片列表和 AI 详情新增展示时间/地点/天气编辑，已选照片支持“批量改展示信息”。
- 最新已验证步骤：先让 `app.controller.spec.ts` 中“第三段 10 字”和“metadata 编辑时间/地点/天气”聚焦测试失败；实现后 `.\node_modules\.bin\jest.CMD app.controller.spec.ts --runInBand --testNamePattern="ten Chinese characters|edits photo metadata"` 通过 2 项；`corepack pnpm -F @wrjdyk/backend-api build` 通过；`corepack pnpm -F @vben/web-antd run typecheck` 通过；`..\..\node_modules\.bin\vitest.CMD run src/views/photo-library/components/ai-narration-options.spec.ts src/views/photo-library/photos/photo-list-status.spec.ts src/views/photo-library/photos/playback-album-assignment.spec.ts` 通过 3 个文件 10 项。
- 运行态验证：已重启本地 3999 到新构建，当前监听 PID 37628，`/api/health` 返回 ok。用真实 admin token 调用 `/api/admin/photo-library/photos/scan_001/metadata` 验证时间/地点/天气可写入，并确认地点/天气可恢复为空；Playwright 登录 5200 后确认照片列表出现“识别待处理/旁白待处理/识别失败/旁白失败”“批量改展示信息”，AI 详情弹窗出现“展示信息/保存展示信息”，且“可选识别旁白”仍正常显示。
- 下一步计划：继续第二优先级，把照片列表批量操作的“选择后反馈”和筛选空状态做得更明确；随后进入 TV 真机复核竖屏背景和 0.2 秒前后景显示顺序。
- 当前风险：天气目前作为 AI 原始详情中的 observed_meta 字段保存，没有新增独立数据库列；这保持了现有 TV 顶栏投影链路，但未来如果需要按天气筛选，应再补独立列和索引。

## 2026-06-16 第二优先级：播放相册与设备授权体验优化

- 当前目标：把第一优先级补齐后的后台状态转成管理端可理解的播放相册可播状态、设备授权状态和异常提示，减少“0 个授权相册”等误导。
- 当前状态：播放相册页新增“可播放 / 需关注 / 启用设备”概览和“可播状态”列，按照片数、设备授权、AI 策略判断 `可播放`、`无照片`、`未授权`、`AI 停用`；同列展示授权设备数量和设备名称摘要。设备中心新增设备概览，授权相册列改为显示“全部相册”策略或具体相册名称摘要，并清理编辑弹窗中重复的设备名称/启用字段；不选择授权相册时的占位文案已说明默认可观看全部播放相册。
- 最新已验证步骤：新增 `playback-album-view.spec.ts` 覆盖空授权列表等于全部相册、未授权、无照片优先级和设备授权摘要；`.\\node_modules\\.bin\\vitest.CMD run apps/web-antd/src/views/photo-library/playback-albums/playback-album-view.spec.ts` 通过 1 个测试文件 9 项；`corepack pnpm -F @vben/web-antd run typecheck` 通过。
- 运行态验证：本地后端 `http://127.0.0.1:3999/api/health` 返回 `ok`、版本 `2.0.2`，前端 `http://127.0.0.1:5200` 返回 200。Playwright 使用真实登录接口 `admin/admin123` 注入会话后访问播放相册页，确认显示播放相册 3、已分拣照片 91、可播放 1、需关注 2、启用设备 7，并在行内看到“可播放 / AI 停用”和授权设备摘要；访问设备中心确认显示设备 7、启用设备 7、授权相册列展示具体相册名称摘要。页面无运行错误，仅有既有 StorageManager 空 prefix warning。
- 下一步计划：进入第二优先级的下一项，优化照片列表批量操作反馈与筛选入口，让“待处理/已完成/失败”和批量补齐后的结果更容易定位；随后再回到 TV 真机复核竖屏背景与 0.2 秒前后景显示顺序。
- 当前风险：本轮只改管理端展示和纯前端 helper，未改后台授权语义；当前设备数据里没有启用设备处于“全部相册权限”策略，相关语义由单测覆盖但运行态未出现真实样例。

## 2026-06-16 第一优先级：照片中心待处理补齐任务入口

- 当前目标：先补齐必须能力，为剩余待处理照片提供安全的批量重转码 + AI 补全入口，而不是继续做泛 UI 美化。
- 当前状态：后端新增 `POST /api/admin/photo-library/backfill-jobs`，会创建 `backfill` 类型 AI 进度任务；服务层新增 `createPhotoCenterBackfillJob()`，按照片中心分页筛选 `derivativeStatus != ready` 或 AI 未完成的照片，逐张复用现有派生图生成与统一视觉 AI 分析链路，单张失败计数但不中断批次；管理端照片列表新增“补齐待处理”按钮，触发后打开现有 AI 进度弹窗。真实补齐任务 `backfill_mqgbn7rn` 已执行完成，34 张待处理照片全部补齐。
- 最新已验证步骤：先写后端补齐任务测试并确认旧实现因缺少 `createPhotoCenterBackfillJob` 失败；实现后通过。`node_modules\.bin\jest.CMD app-access.guard.spec.ts app.controller.spec.ts sqlite-photo.repository.spec.ts --runInBand` 通过 3 个套件 115 项；`& ..\..\node_modules\.bin\vitest.CMD run src\views\photo-library\components\ai-task-progress.spec.ts` 通过 1 个文件 5 项；`corepack pnpm -F @wrjdyk/backend-api build` 通过；`corepack pnpm -F @vben/web-antd run typecheck` 通过。
- 运行态验证：已重启本地 3999 到新构建 PID 29152，`/api/health.version=2.0.2`；先使用 `limit=0` 调用 `/api/admin/photo-library/backfill-jobs` 验证路由/鉴权/任务记录链路；随后按用户确认执行真实补齐任务 `backfill_mqgbn7rn`，AI 进度轮询结果为 `requested=34, completed=34, failed=0, skipped=0`。执行后照片中心 69 张全部为 `derivativeStatus=ready`、`aiScoreStatus=completed`、`aiCommentStatus=completed`，pendingCount=0；Playwright 登录 5200 后确认照片列表首屏无“待转码/待补全/pending”，前 20 条均显示“已转码/已完成”。
- 下一步计划：进入第二优先级，优化播放相册/设备授权体验，把已补齐的数据状态转成更清晰的相册可播状态、设备授权状态、异常提示和批量操作反馈。
- 当前风险：真实 AI 已完成 34 张本地扫描照片补齐；后续若重新扫描或新增照片，仍需通过“补齐待处理”入口继续处理新增 pending 项。

## 2026-06-16 后续开发计划重排与架构复核

- 当前目标：按当前真实业务闭环重新排序后续开发，把必须补齐的基础能力放在第一位，直接影响体验的界面/交互放在第二位，一般优化放在第三位。
- 运行态基线：本地后台 `2.0.2`；照片中心 69 张，`local=38`、`feiniu=31`；`derivativeStatus` 为 `ready=35`、`pending=34`；AI 评分和旁白均为 `completed=35`、`pending=34`；34 个 pending 全部来自“本地扫描”。播放相册 3 个，累计照片数 91；设备 7 个；TV 更新清单仍发布 `2.0.0`。
- 架构理解：当前核心链路是照片源入池（本地扫描/飞牛）-> SQLite 照片中心 -> 派生图与 AI 识别 -> 播放相册策展 -> 设备授权 -> TV 端 `/device/albums` 和 `/device/playlist` 消费 -> TV 更新清单发布。`AppService` 目前承担调度/业务聚合，`SqlitePhotoRepository` 承担持久化和列表投影，管理端围绕 `photo-library.ts` 调用这些能力。
- 第一优先级必须补齐：建立“剩余待处理照片批量重转码 + AI 补全”的后台安全入口、任务状态和可重试机制；确认扫描/upsert 不再破坏状态；把 TV 更新清单与当前实际发布版本策略收口；补齐关键接口的资源签名回归测试。
- 第二优先级直接影响体验：播放相册/设备授权页面重做信息层级，清楚呈现设备授权、相册绑定、补全 AI、转码缺失、更新时间和异常原因；照片列表批量操作需要更明确的反馈和筛选入口；TV 端仍需真机复核竖屏背景和 0.2 秒前后景显示顺序。
- 第三优先级优化项：拆分 `AppService`/`SqlitePhotoRepository` 过大的职责，整理照片源缓存、Feiniu 分页/远程源性能、日志和运行文档；统一版本显示和发布文档。
- 下一步计划：先实现第一优先级中的批量补齐任务，不先做大规模 UI 美化；完成后用 HTTP、页面和数据库状态确认 34 张本地扫描照片从 pending 进入 ready/completed，再进入播放相册/设备授权体验优化。

## 2026-06-16 缩略图鉴权、播放相册封面与扫描状态保留修复

- 当前目标：修复资源鉴权加固后管理端图片无法通过普通 `<img>` 加载的问题，恢复照片列表与播放相册封面缩略图；定位本地扫描导致 AI 识别状态、转码状态被重置的问题；同步后台版本与下一步计划。
- 当前状态：照片资源接口仍保持鉴权，后台改为给照片列表、播放相册列表、播放相册成员、设备相册和播放列表中的 `/api/photos/*`、`/api/derivatives/*` 资源 URL 附加 6 小时 `assetToken`，`AppAccessGuard` 只允许有效签名资源匿名读取。`SqlitePhotoRepository.rebuildFromPhotoRoot()` 已从“清空重建 photos/albums”改为按 `scan_###` upsert，并保留已有 AI、转码、旁白和派生图字段，避免后续扫描再次抹掉状态。
- 数据恢复：当前运行库 `apps/backend-api/data/wrjdyk.sqlite` 已在修改前备份为 `apps/backend-api/data/wrjdyk.sqlite.before-asset-fix-20260616-110126.bak`。从可用备份 `.docker-test/backend2/data/wrjdyk.sqlite` 中按文件名安全匹配恢复了 4 张照片的 AI/转码状态和派生文件；当前照片列表为 38 张，其中 4 张 `ready/completed/completed`，34 张仍为真实待转码/待 AI 状态，剩余无法从现有备份可靠恢复，需要重新跑转码和 AI 补全。
- 播放相册封面修复：根因是播放相册页面用 `coverPhotoId` 在前端重新拼 `/api/photos/{id}/thumb`，绕过了后台签名；现已让后台 `PlaybackAlbum` 返回 `thumbnailUrl/coverImageUrl` 并统一签名，前端优先使用后台签名 URL，仅在旧响应缺失时回退拼接。
- CodeGraph：本轮开始时 MCP 多次返回 `Transport closed`，`.codegraph/daemon.pid` 指向的 pid 不存在，daemon 日志显示曾因 idle timeout 退出；最终复查已恢复，索引状态为 1526 files / 14259 nodes / 29169 edges。
- 最新已验证步骤：`node_modules\.bin\jest.CMD app-access.guard.spec.ts app.controller.spec.ts sqlite-photo.repository.spec.ts --runInBand` 通过 3 个套件 113 项；`corepack pnpm -F @vben/web-antd run typecheck` 通过；`corepack pnpm -F @wrjdyk/backend-api build` 通过；本地 3999 已重启到新构建 PID 42840，`/api/health.version=2.0.2`；播放相册接口第一张封面签名 URL 返回 `200 image/jpeg`，去掉 token 返回 `401`；Playwright 登录后访问 `http://127.0.0.1:5200/photo-library/playback-albums`，3 张 `img.album-cover` 均加载完成且无图片 4xx。
- 当前版本更新内容：后台/管理端镜像版本推进到 `2.0.2`，包含资源签名访问、扫描保留状态、播放相册封面签名、照片列表状态局部恢复；Android TV 版本未改，仍保持 `2.0.1` 变更边界。
- 下一步计划：先补一个后台“剩余 34 张照片批量重转码 + AI 重新识别/补全”的安全入口和进度反馈，把当前数据彻底补齐；完成后继续原计划进入“播放相册/设备授权界面优化”，减少设备授权、相册绑定和异常状态的操作歧义。
- 当前风险：`assetToken` 会过期，页面刷新或重新拉接口会自动生成新 token；旧进程占用 3999 会导致看不到新版本，已按 workflow 停掉旧 PID 并重启；剩余 34 张状态不是显示问题，而是当前库缺少可恢复的历史 AI/派生记录。

更新时间：2026-06-16

本文是项目计划、完成状态、风险和后续步骤的唯一权威入口。开发规范、API 目录和固定发布流程统一维护在 `DEVELOPMENT_STANDARDS_API.md`。

## 2026-06-16 AI 任务界面可观测性优化

- 当前目标：从“后台稳固”进入“界面优化”阶段，先把管理端 AI 识别进度弹窗补齐为可判断、可筛选、可定位异常原因的运行视图。
- 当前状态：AI 识别进度弹窗已新增任务总览卡片、进行中/失败/重启恢复筛选、后端重启中断告警、失败原因 tooltip、更新时间格式化和重启恢复行高亮；重启恢复任务会被单独识别为“后端重启中断”，避免和普通 AI 失败混在一起。
- 最新已验证步骤：已先让 `ai-task-progress.spec.ts` 在缺少 helper 与筛选函数时失败，随后补齐实现并通过；`& ..\..\node_modules\.bin\vitest.CMD run src/views/photo-library/components/ai-task-progress.spec.ts` 通过 1 个测试文件 4 项；`corepack pnpm -F @vben/web-antd run typecheck` 通过；Playwright 使用本地 3999 登录和 5200 页面验证，`AI 进度 -> 重启恢复 3` 后只显示 3 行，弹窗宽度 1240，表格宽度 1192，重启恢复行背景为 `rgba(250, 173, 20, 0.09)`，时间列 `white-space: nowrap`。
- 下一步计划：继续界面优化主线，优先处理“播放相册/设备授权”管理界面，把后台稳定能力转成更清晰的设备状态、授权状态、播放相册绑定和异常提示；完成后再回到照片列表的批量操作反馈与空状态优化。
- 当前风险：本轮只覆盖管理端 AI 任务弹窗，没有改后端接口和 Android TV；CodeGraph daemon 日志显示 watcher 已自动同步文件变化，但 `codegraph_status` MCP 查询复查时传输断开，后续如果进入跨模块结构调整，需要先恢复 CodeGraph 状态查询再动代码。

## 2026-06-16 AI 任务重启恢复

- 当前目标：完成后台稳固阶段的 AI 任务重启恢复，避免后端进程重启后历史 `queued` / `running` / `retrying` 任务永久停留在进行中状态。
- 当前状态：SQLite 仓库新增 `recoverInterruptedAiRecognitionTasks()`，会在启动恢复时把未完成 AI 任务标记为 `failed`，清空活动照片字段，写入明确错误原因 `Backend restarted before the AI task finished. Please retry the task.`，并保留已完成/已失败任务不变。`AppService.onModuleInit()` 已接入该恢复逻辑；现有 AI 定时调度仍由 `main.ts` 中的 `startPlaybackAlbumAiScheduler()` 启动，不在恢复阶段自动重跑任务，避免重启后重复消耗 AI 调用。
- 最新已验证步骤：已先看到仓库恢复测试因缺少 `recoverInterruptedAiRecognitionTasks` 失败、服务启动恢复测试因缺少 `onModuleInit` 失败；实现后通过。验证命令：`node_modules\.bin\jest.CMD sqlite-photo.repository.spec.ts --runInBand --testNamePattern="marks unfinished AI recognition tasks"` 通过；`node_modules\.bin\jest.CMD app.controller.spec.ts --runInBand --testNamePattern="recovers unfinished AI recognition tasks"` 通过；`node_modules\.bin\jest.CMD app-access.guard.spec.ts app.controller.spec.ts app.module.spec.ts sqlite-photo.repository.spec.ts --runInBand` 通过 4 个套件 111 项；`corepack pnpm -F @wrjdyk/backend-api build` 通过。已重启本地 3999 后端并用 HTTP 验证 `/api/health` 返回 `ok`，受保护 `/api/admin/photo-library/ai-tasks` 可访问，当前运行库 AI 任务状态汇总为 `completed=61`、`failed=6`，无 `queued/running/retrying` 遗留。
- 下一步计划：进入“后台可观测性到界面优化”的过渡步骤，先检查管理端 AI 任务弹窗/列表是否清楚显示失败原因、时间和重试/清理入口；若现有 UI 足够，再进入照片中心、播放相册、设备授权页面的界面优化。
- 当前风险：恢复策略当前选择“失败并提示重试”，没有自动续跑旧任务；这能避免重复 AI 消耗，但用户需要在管理端手动重试仍有价值的任务。

## 2026-06-16 本地启动流程与默认口令策略收口

- 当前目标：先启动本地后端与管理端，再继续上一轮计划中的默认 `admin/admin123` 部署策略收口，并把反复验证后的本地启动流程沉淀为全局 workflow。
- 当前状态：本地后端 `http://127.0.0.1:3999` 与管理端 `http://127.0.0.1:5200` 已启动并通过 HTTP 检查；全局 workflow 已写入 `C:\Users\Administrator\.codex\workflows\debugging\jdyk-local-dev-startup.md`。后端管理端登录与 TV 设备登录现在共用 `WRJDYK_ADMIN_USERNAME` / `WRJDYK_ADMIN_PASSWORD`；未设置 `WRJDYK_ADMIN_PASSWORD` 时仅非生产运行态保留 `admin123`，`NODE_ENV=production` 下默认口令不可用。`DEVELOPMENT_STANDARDS_API.md` 已同步更新账号与口令约定。
- 最新已验证步骤：已先看到新增测试在旧实现下失败：生产环境仍接受默认口令、设备登录不跟随 `WRJDYK_ADMIN_PASSWORD`；实现后通过。验证命令：`node_modules\.bin\jest.CMD app.controller.spec.ts --runInBand --testNamePattern="built-in default admin password|configured admin password"` 通过；`node_modules\.bin\jest.CMD app-access.guard.spec.ts app.controller.spec.ts app.module.spec.ts --runInBand` 通过 3 个套件 84 项；`corepack pnpm -F @wrjdyk/backend-api build` 通过；HTTP 验证 `/api/health` 返回 `ok`，`http://127.0.0.1:5200/` 返回 200，非生产本地 `/api/auth/login` 与 `/api/device/login` 使用 `admin/admin123` 冒烟通过。
- 下一步计划：继续处理 AI 任务重启恢复；若要进入生产部署前安全收口，需要设置真实 `WRJDYK_ADMIN_PASSWORD` 并重启后端验证默认口令已拒绝。
- 当前风险：本轮没有在 `NODE_ENV=production` 的真实运行进程上做 HTTP 冒烟，生产默认口令拒绝由单元测试覆盖；本地当前 3999 仍按非生产运行态保留开发默认口令，便于继续调试。

## 2026-06-16 TV 竖屏左右版式背景与设备 token 加固

- 当前目标：修复 Android TV 竖屏照片左右版式未居中时背景黑屏的问题，并把显示顺序改成先出现模糊背景、0.2 秒后再出现前景照片；同时继续审计后的第二步安全加固，将设备登录 token 从可预测字符串改为随机持久 token。
- 当前状态：Android TV 播放器左右竖屏版式现在也渲染模糊背景；背景图优先使用 `backgroundImageUrl`，缺失时回退到当前展示图；前景照片通过 `foregroundRevealDelayMillis()` 延迟 200ms 后显示，加载/错误状态也等前景出现后再显示。后端设备登录现在生成 `dt_` + 48 位十六进制随机 token，同一设备重复登录复用 SQLite 中已持久化 token，并移除了 `dt_login_admin` legacy 通行路径。
- 最新已验证步骤：已先看到 `MemoryExhibitionPlayerTest` 因缺少 `foregroundRevealDelayMillis()` 失败、设备 token 新测试因旧的 `dt_login_admin_living-room-tv` 失败；实现后验证通过。验证命令：`.\gradlew.bat :app:testDebugUnitTest --tests com.wangrizhongxian.tv.MemoryExhibitionPlayerTest --no-daemon` 通过；`node_modules\.bin\jest.CMD app-access.guard.spec.ts app.controller.spec.ts app.module.spec.ts --runInBand` 通过 3 个套件 82 项；`corepack pnpm -F @wrjdyk/backend-api build` 通过；`corepack pnpm -F @vben/web-antd run typecheck` 通过；`.\gradlew.bat :app:assembleDebug --no-daemon` 通过。
- 下一步计划：继续处理 AI 任务重启恢复；生产部署前设置真实 `WRJDYK_ADMIN_PASSWORD` 并重启后端验证。
- 当前风险：本轮已完成单测和构建验证，但还没有在真实 Android TV 设备上截图复核 0.2 秒显示顺序和左右竖屏背景效果；设备 token 行为改变后，已登录旧设备可能需要重新登录获取随机持久 token。

## 2026-06-16 第一步认证与照片资源边界修复

- 当前目标：先修复审计中最高优先级的服务端访问边界，避免管理端 API、照片资源接口和 refresh 入口在无有效 token 时直接进入业务 handler。
- 当前状态：已新增全局 `AppAccessGuard` 并接入 `AppModule`；管理端 `/admin/*`、`/user/info`、`/menu/all`、`/auth/codes`、`/auth/logout`、`/auth/refresh` 需要 admin token；照片资源 `/photos/*` 与 `/derivatives/*` 需要 admin token 或 device token；设备播放列表、相册和播放记录需要 device token；健康检查、登录、TV 更新清单和 APK 下载保持公开。管理端登录不再返回静态 `wrjdyk_admin_admin`，改为 HMAC 签名的 `wrjdyk_admin.<payload>.<signature>`，refresh 会用当前 admin token 换新 token。管理端 refresh 请求已改为携带当前 access token。
- 最新已验证步骤：已先看到新增 `app-access.guard.spec.ts` 因缺少 `AppAccessGuard` 失败；随后实现通过。验证命令：`node_modules\.bin\jest.CMD app-access.guard.spec.ts app.controller.spec.ts app.module.spec.ts --runInBand` 通过 3 个套件 81 项；`corepack pnpm -F @wrjdyk/backend-api build` 通过；`corepack pnpm -F @vben/web-antd run typecheck` 通过；CodeGraph 复查索引为 1524 个文件、14219 个符号节点、29278 条关系边。
- 下一步计划：继续第二步安全加固，把默认 `admin/admin123` 改成初始化/环境变量强制配置策略；随后再处理 AI 任务重启恢复。
- 当前风险：本轮没有启动真实 `3999/5200` 服务做 HTTP 冒烟，也没有改 Android TV 登录交互；默认账号仍保留用于兼容现有部署，安全性尚未达到生产强口令级别。

## 2026-06-16 CodeGraph 当前业务流程审计

- 当前目标：用 CodeGraph 和 `rg` 重新审计当前照片中心、AI 任务、播放相册、TV 播放与 TV 更新业务流程，整理最应该优先修复的问题。
- 当前状态：已完成只读审计。CodeGraph 索引当前为 1522 个文件、14178 个符号节点、29109 条关系边；入口集中在 `apps/backend-api/src/app.controller.ts`、`apps/backend-api/src/app.service.ts`、`apps/backend-api/src/sqlite-photo.repository.ts`、`apps/web-antd/src/api/photo-library.ts`、`apps/android-tv/app/src/main/java/com/wangrizhongxian/tv/MainActivity.kt`、`MemoryExhibitionPlayer.kt`、`AppUpdateManager.kt`。本轮未修改业务代码。
- 最新已验证步骤：CodeGraph 状态检查通过；`rg` 已核查管理端/设备端路由、照片资源接口、AI 任务状态、TV 更新清单、飞牛相册源和 Android TV 取数链路。确认最高优先级问题是管理端/设备端仍保留演示期认证模型：管理端 API 缺少后端鉴权守卫，设备登录使用硬编码 `admin/admin123`，设备 token 可预测且存在 legacy 通行路径，照片资源接口公开返回原图/展示图/缩略图。
- 下一步计划：先修复认证与资源访问边界，再处理 AI 任务重启恢复和飞牛远程源缓存/分页性能，最后再做 `AppController` / `AppService` / `SqlitePhotoRepository` 的服务拆分。
- 当前风险：本轮为静态审计，未启动后端、未调用真实接口、未运行测试；修复认证会跨后端、管理端和 Android TV 登录链路，需要先给出具体修改计划并获得确认。

## 2026-06-15 AI 地点精简、第三行字数限制与 TV 竖屏重叠修复

- 当前目标：修复 AI 识别地点在 TV 顶栏显示过细、旁白第三行过长，以及真实电视上竖屏侧栏版式出现两张照片重叠的问题；随后更新小版本号、完成本地验证和只推送本轮修改。
- 当前状态：已定位真实电视重叠的根因候选为侧栏竖图同时绘制全屏背景照片和画框前景照片，真机上运行时 blur 或背景派生回退会让全屏背景变成第二张清晰照片；已改为仅横图和居中竖图渲染磨砂背景，侧栏竖图使用暗底承托。后端已在 AI 归一化和旧 `ai_detail` 投影路径压缩地点展示，并将第三段旁白限制为最多 8 个中文字符；默认提示词文件已同步写入地点和第三行要求。版本已提升到项目/管理端 `2.0.1`、Android TV `versionCode 13 / versionName 2.0.1`。根目录缺失的 `kf01.md` 已按项目模板补齐。
- 最新已验证步骤：后端聚焦测试 `apps/backend-api/node_modules/.bin/jest.CMD app.controller.spec.ts --runInBand --testNamePattern="normalizes AI observed locations|limits the third narration line"` 通过；Android 聚焦测试 `.\gradlew.bat :app:testDebugUnitTest --tests com.wangrizhongxian.tv.MemoryExhibitionPlayerTest.sidePortraitLayoutsDoNotRenderASecondFullScreenPhotoBehindTheFrame --no-daemon` 通过；`node --test scripts/android-tv/generate-update-manifest.test.mjs` 通过 3/3；`apps/backend-api/node_modules/.bin/jest.CMD --runInBand app.controller.spec.ts sqlite-photo.repository.spec.ts` 通过 98/98；Android `:app:testDebugUnitTest` 通过；完整 `.\scripts\release\verify-local-release.ps1` 通过，覆盖版本面、manifest、后端聚焦测试、Web 测试/类型检查/生产构建、Compose 展开、Android clean 后单测与 Debug/Release 构建。
- 本地产物：已生成 `releases/wangri-tv-2.0.1-debug.apk`，大小 `17483617` 字节，SHA-256 `82ABF4B6846EF368E8CF31B42F3DB5160F56913A5307BEE90F20BD247C8DDE55`；Release 构建产物为未签名 `app-release-unsigned.apk`，不能发布，正式签名包仍需 GitHub Android TV workflow 生成。
- 下一步计划：按“只提交本轮修改”规则提交并推送；推送后等待 GitHub workflow 生成正式签名 APK，再在真实电视上复核竖屏侧栏视觉。
- 当前风险：真实电视截图需在用户设备侧最终复核；本地 Release 包未签名不可用于远程更新发布。

## 2026-06-14 Android TV 1.0.5 与 AI 错误诊断

- 当前目标：真正退出播放后刷新既有竖屏版式随机结果，精准识别旧模型输出，并发布 Android TV `1.0.5`。
- 当前状态：竖屏版式选择已加入播放会话种子。同一播放会话中同一照片保持稳定；退出播放并重新开始后，会在现有居中、照片靠左、照片靠右版式中重新分配。队列或设置页返回播放不会误刷新。代码已推送到 `main`，发布标签为 `tv-v1.0.5`。
- AI 诊断：可解析 JSON 但缺少当前 `scores`、`narration_options`、`selected_narration_index`、`layout_plan` 契约时，归类为旧版输出。后端会使用标准输出契约纠正重试一次；仍失败时明确返回模型名称，以及模型下线、别名回退或结构不兼容的可能原因。网络、超时、鉴权错误保持原错误类型。
- 验证状态：Android TV 播放会话测试及后端 AI 契约诊断测试已通过；当前 `gpt-5.2` 配置的真实请求返回了完整 `photo_tv_payload_v1`，说明当前提示词链路有效。
- 发布门禁：完整本地发布验证已通过，覆盖更新清单测试、后端聚焦测试、Web 测试/类型检查/生产构建、Compose 配置展开，以及 Android clean、单元测试、Debug/Release 构建。GitHub Actions 运行 `27485132624` 已成功发布正式签名 APK；本地副本为 `releases/wangri-tv-1.0.5.apk`，大小 `14248610` 字节，SHA-256 为 `2d3f871c447a71fc486f1d16808e84290154e08b43f813a7494682e6c274189c`，与 `latest.json` 完全一致。签名证书与 `1.0.4` 相同，可覆盖升级。
- 后续计划：当前本机 `3999` 更新接口仍发布 `1.0.3`；本轮未擅自修改运行中后端发布状态。若进入设备更新发布阶段，应使用上述已校验的同一签名 APK 更新后端清单，并在 TV 设备上验证下载、安装和播放退出后重新随机。

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
- 当前 Android TV 最新版本是 `versionName 1.0.4`、`versionCode 9`。

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
- 管理端关于页版本已提升到 `1.0.8`，用于发布 Android TV A 版摄影海报显示修复。
- GHCR 后端/管理端 `1.0.6` 和 `latest` 已发布并验证多架构 manifest；`1.0.7/latest` 待本轮推送后由 Actions 发布验证。
- Android TV `1.0.4 / versionCode 9` 已实现 A 版摄影海报显示并完成模拟器截图验证。
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

2026-06-13 TV 版本列表与 Android 9 更新链路修复：
- 当前修改目标：后台 TV 版本上传页改为列表式展示历史 APK，并明确显示每个版本的强制更新开关状态；Android TV 在 Android 9 盒子上点击更新后应先下载并校验 APK，再在安装阶段处理未知来源安装权限和系统安装器唤起。
- 当前状态：后端 `TvReleaseInfo` 已增加 `versions` 列表；上传 APK 时除 `latest.json` 外同步写入同名版本元数据 JSON；管理端 TV 版本页新增“已上传版本”表格，显示最新标识、versionName、versionCode、强制更新、文件状态、大小、发布时间、APK 文件和 SHA256；上传表单强制更新开关支持开启/关闭并显示当前状态。
- Android 更新链路：下载前不再因为 Android 8+ 未授予未知来源安装权限而中断；APK 下载、大小校验和 SHA256 校验完成后进入待安装状态；点击安装时如果缺少权限则打开权限页并保留待安装状态，授权后可再次点击安装；Android 7+ 优先使用 `ACTION_INSTALL_PACKAGE`，不支持时回退到 `ACTION_VIEW`。
- 验证结果：`corepack pnpm -F @wrjdyk/backend-api test -- --runInBand app.controller.spec.ts` 通过；`corepack pnpm -F @vben/web-antd run typecheck` 通过；`.\gradlew.bat :app:testDebugUnitTest --tests com.wangrizhongxian.tv.AppUpdateManagerTest` 通过。
- 后续注意：仍需要在真实 Android 9 电视盒子上做端到端验证，包括未授权未知来源时点击安装是否进入权限页、授权返回后是否能再次拉起安装器、安装完成后是否成功升级到目标 `versionCode`。
- 按计划下一步：继续阶段 A 的真实 TV/ADB 播放效果验收，优先采集暗图、亮图、人像图、横图、竖图截图；若字幕字体形态仍偏离设计稿，再进入可随 APK 发布的中文字体资源引入。

2026-06-13 TV 摄影海报字体预览调整：
- 当前修改目标：确认 A 版原始字体宽度，并将竖屏尚首追光手写标题在现有基础上放大 15%。
- 当前状态：视觉预览已将 A 版标记为当前选择；仅竖屏 A 版手写标题从 `11px` 调整为 `12.65px`，横屏排版、LXGW 正文字体和 B 版保持不变。
- 未来修改计划：浏览器确认竖屏标题比例后，再将最终版式规格整理为 Android TV 实现计划；未确认前不修改正式 TV 播放代码。

2026-06-13 TV 摄影海报手写标题 50% 放大预览：
- 当前修改目标：观察所有手写标题统一放大 50% 后的横屏与竖屏效果。
- 当前状态：A、B 两版横屏和竖屏标题均按上一版实际字号乘以 `1.5`；其他文字、位置、间距和字体不变，正式 Android TV 播放代码未修改。
- 未来修改计划：根据浏览器视觉结果确认最终标题字号，再整理 Android TV 端实现规格。

2026-06-13 Android TV A 版摄影海报显示实现：
- 当前修改目标：将已确认的 A 版原始宽度字体效果应用到 Android TV 播放界面，当前阶段不显示英文，也不修改后端、AI 提示词或共享接口。
- 当前状态：Android TV 已内置尚首追光与 LXGW 两份项目字体；中间手写标题使用尚首追光常规字重，4K 设计字号从 `160` 放大 50% 到 `240`；上下中文信息使用 LXGW；TV 字幕整理阶段会移除英文字母，保留现有三段数据顺序。定向 `MemoryExhibitionPlayerTest` 已通过。
- 实现架构：后端 `GET /api/device/playlist` 只下发文案、`displayTemplateId`、`fontStyle`、`fontWeight` 等轻量字段；字体文件和排版模板由 TV APK 本地持有，避免每张照片重复下载字体。字体族定义为进程级稳定对象，不随文案重复创建。
- 包体积与性能：Release APK 从 `8.21 MB` 增加到 `13.55 MB`，两份完整中文字体实际增加 `5.34 MB`。模拟器播放器现代帧统计为 `13 / 3268` 卡顿帧（`0.40%`），50/90/95/99 分位为 `9/10/10/15ms`；总 PSS 约 `100 MB`。该数据仅作初步参考，真实电视盒子仍需验证；当前更重的渲染路径是双层图片、模糊和持续缩放动画，而不是字体文件。
- 英文处理：TV 端当前移除字幕中的英文字母；如果 AI 主文案过滤后为空，会继续回退到中文 `captionText`，避免有中文备用文案时出现空字幕。照片画面本身包含的英文不做图像处理。
- 验证结果：Android TV 全量 `testDebugUnitTest` 通过，Debug 与 Release 构建通过；最新 Debug APK 已覆盖安装到 `emulator-5554` 并进入播放页。截图确认中间尚首追光标题、顶部 LXGW 中文说明和英文字幕过滤生效。截图保存于 `build/android-tv-a-style-latest.png`。
- 未来修改计划：在真实电视盒子上采集播放截图与帧数据。后续英文或文案结构调整通过 AI 识别提示词单独处理。

2026-06-13 Android TV 1.0.4 与项目 1.0.8 发布准备：
- 当前修改目标：为 Android TV A 版摄影海报显示修复更新项目版本与电视端版本，并推送 GitHub。
- 当前状态：Android TV 版本已提升到 `versionCode 9 / versionName 1.0.4`；管理端发布版本已提升到 `1.0.8`；飞牛/latest compose 默认 TV 更新元数据、发布验证脚本、manifest 测试、Android TV README 和发布规范文档已同步。
- 验证结果：`.\scripts\release\verify-local-release.ps1` 通过；Android APK 元数据确认为 `versionCode=9`、`versionName=1.0.4`；模拟器播放截图确认字幕居中、长手写标题单行完整显示、底部暗底为全屏向上渐变。截图保存于 `build/android-tv-a-style-gradient-clean.png`。
- 发布状态：正式功能提交 `c19b6e8` 已推送 `main`；`tv-v1.0.4` 标签已创建并推送，等待 GitHub Actions 产出正式签名 APK。

2026-06-13 竖版布局、旁白刷新与照片顶部信息完善：
- 当前修改目标：竖版照片按照片画框缩小字幕并提供画内覆盖、画外侧栏两种模板；TV 每次收到新播放列表后立即使用最新三段旁白；顶部时间、地点、天气优先使用照片已保存信息，缺失时才采用 AI 有证据的推断；业务提示词与标准输出字段要求以本地文件维护并随后端镜像发布。
- 当前状态：共享播放协议已增加照片宽高、方向和顶部信息；SQLite schema 版本提升到 18，在生成派生图时持久化原图方向，并在升级时将已有数据库刷新到本次随包发布的两份提示词；后端播放列表优先组合照片字段，缺失项再使用 `observed_meta`；Android TV 已移除按 `photoId` 缓存旁白的逻辑，竖版默认使用画内覆盖模板，`portrait_side` 使用画外侧栏模板；生产 Docker 镜像会复制提示词目录。
- 当前验证：`.\scripts\release\verify-local-release.ps1` 完整通过；后端两个套件 `93/93`、管理端 4 个测试文件 `5/5`、后端 build、管理端 typecheck/production build、两份 Compose 展开、Android 全量 `testDebugUnitTest`、Debug/Release 构建及 APK 元数据检查均成功。Debug APK 为 `17,467,250` 字节，SHA256 `640C00CE747AF1D3DC7E8011FB23F62EBD2DB22108A2002DF90311F827594D6B`；本地 Release 为未签名包，只用于构建验证。发布预检会确认提示词目录、业务 Vision 文件、标准输出契约及 Docker 镜像复制规则；发布脚本从后端目录调用该包本地的 `jest.CMD --runInBand`，避免两个后端套件并行清理共享测试目录。内置浏览器拒绝访问本地预览地址，因此本轮无法重新做网页视觉验收，改用既有设计坐标、派生图尺寸关系、单元测试和 Android 构建验证。
- 发布状态：正式功能提交 `c19b6e8` 已推送 `main`，`tv-v1.0.4` 标签已成功推送。GitHub API 在线状态查询因本机 TLS 请求持续无响应而终止，流水线结果尚未在线确认。
- 未来修改计划：验证 GHCR `1.0.8/latest` 镜像和 GitHub Actions 正式签名 APK；随后在真实 Android 9 盒子验收安装授权流程，并在实体 TV 面板验收竖版两种模板的视觉效果。

2026-06-14 Android TV 竖屏现有版式随机播放：
- 当前修改目标：不调整任何现有展示版式，仅让竖屏照片随机使用正式代码中已有的全部竖屏版式。
- 当前状态：确认当前已有两种竖屏版式，即画内覆盖 `Overlay` 和画外侧栏 `Side`；TV 端按 `photoId` 稳定散列选择，保证不同竖屏照片能覆盖两种方式，同一照片播放和重组期间不会切换版式；横屏逻辑不变。
- 当前验证：定向 `MemoryExhibitionPlayerTest` 已完成预期失败到通过的红绿验证；Android 全量 `testDebugUnitTest` 与 `assembleDebug` 均成功。
- 未来修改计划：创建本地提交，重启本地后端和管理端，将 Debug APK 安装到已连接设备并使用实际播放截图确认升级和竖屏随机效果。

2026-06-14 Android TV 实机复查问题修复：
- 当前修改目标：修复后台切换旁白选项后 TV 仍只显示第一条；让竖屏照片图层实际使用现有居中、靠左、靠右展示能力；确保中间手写文字超出可用宽度时缩小字号并保持单行完整显示。
- 当前状态：本地提交 `3c620f2` 已创建；后端 `3999` 和管理端 `5200` 已重启并返回 HTTP 200；Debug APK 已覆盖安装到 `emulator-5554`，设备版本已从 `versionCode 8 / 1.0.3` 升级到 `versionCode 9 / 1.0.4`。实机截图确认当前竖屏照片图层仍由 `ContentScale.Fit` 居中，上一轮随机选择仅影响字幕规格，未实现照片靠左/靠右；旁白选择链路和长标题实际宽度仍在定位。
- 未来修改计划：先用 CodeGraph 追踪后台所选旁白索引到 TV 的完整数据流及照片图层渲染入口；分别增加失败测试后做最小修复，再运行全量测试、构建、覆盖安装和截图验证。

2026-06-14 Android TV 竖屏 B/C 视觉规格确认：
- 当前修改目标：正式代码修改前先确认 B 照片靠右、C 照片靠左的文字与顶部信息规格，居中 A 保持当前正式效果不变。
- 当前状态：B/C 顶部地点、时间、天气移到画面顶部，分别与左侧/右侧文案边缘对齐，字号缩小 1/3；三段文案与照片间距缩短一半；第一行字号缩小 1/3且保持单行，第二行按原基础字号显示并每 8 个字换行，第三行保持单行。示意稿已更新，正式 Android TV 视觉代码尚未修改。
- 未来修改计划：浏览器确认 B/C 示意效果后，再将确认规格写入 Android TV，并与旁白选择缺陷分别测试和验证。

2026-06-14 Android TV 竖屏示意稿第二轮：
- 当前修改目标：A 直接展示当前设备已有居中效果且不列入修改；B/C 顶部信息和三段文案改为居中对齐，顶部信息使用 `/` 分隔；调整两组信息的垂直距离及文案与照片的水平距离。
- 当前状态：A 已替换为当前 TV 实际居中截图；B 的文案与照片间距扩大到上一版的 2 倍，C 缩短到上一版的 1/2；B/C 顶部信息与文案均居中对齐，顶部信息到三段文案的距离缩短 1/3。正式 Android TV 代码尚未修改。
- 当前验证：浏览器已确认 A 实拍截图加载成功；B/C 顶部信息与三段文案中心线一致；B 水平间距实测为画面宽度 `4%`（旧版 `2%` 的 2 倍），C 为 `2.5%`（旧版 `5%` 的 1/2）；页面无资源加载错误。
- 本轮示意调整：B/C 顶部地点、时间、天气保持不动；三段文案整体相对画面下移 `35%`。B 文案区改为屏幕左边线到照片左边线之间严格居中，C 文案区改为照片右边线到屏幕右边线之间严格居中；正式 Android TV 代码仍未修改。
- 最新视觉微调：B/C 三段文案在上一版基础上统一向上移动画面高度的 `10%`，顶部信息和水平居中规则保持不变；正式 Android TV 代码仍未修改。
- 未来修改计划：浏览器确认本轮示意稿；确认后再进入正式 Android TV 视觉实现和旁白选择缺陷修复。

2026-06-14 Android TV 竖屏 A/B/C 正式实现启动：
- 当前修改目标：按已确认示意图保留 A 居中效果，正式实现 B 照片靠右、C 照片靠左；修复 TV 固定显示第一条 AI 旁白；保证所有三段文案完整显示。
- 当前状态：设计规格和实施计划已写入 `docs/superpowers`。A 保留现有效果；B/C 已按 `photoId` 稳定随机，照片分别靠右和靠左。第二段在 B/C 中最多两行，9 至 16 字按 8 字换行，超过 16 字平均拆成两行并缩小字号；横版第二段保持单行并按宽度缩小；第一、三段始终单行完整显示。顶部信息与三段旁白分离并使用 `/` 分隔。TV 会按 `aiComment` 匹配后台当前选中的旁白，自定义三行旁白也可直接显示。
- 根因确认：本地实际数据库 101 张照片的 `source_width/source_height` 全部为 `0`，后端下发方向为 `unknown`，旧代码因此始终把真实竖图当作横图。TV 现已在图片解码成功后用真实像素宽高回退判断方向，无需修改数据库或后台协议。
- 当前验证：Android TV 定向测试和全量 `testDebugUnitTest` 通过，Debug APK 构建成功并覆盖安装到 `emulator-5554`，应用重新启动成功；本地后端 `3999` 和管理端 `5200` 重启后均返回 HTTP 200。按最新要求未继续采集截图。
- 后续实机问题修复：部分手写文案裁切的根因是原估算字宽小于尚首追光字体实际字形宽度，现将手写字宽估算提高并保留 10% 安全宽度；横版 4:3 图片显示偏小的根因是 `ContentScale.Fit`，现改为横版 `Crop` 铺满，竖版 A 继续 `Fit` 居中，B/C 继续在左右画框内 `Crop`。
- 最终验证：新增方向回退、横版单行、手写字宽安全区和横图铺满测试；Android TV 全量 `testDebugUnitTest` 与 `assembleDebug` 再次通过；最终 Debug APK 已覆盖安装到 `emulator-5554` 并成功启动。按最新要求未继续采集截图。
- 未来修改计划：在真实电视设备上观察 A/B/C 的随机分布、横图裁切焦点和极端长文案；本轮不推送远端、不制作正式发布包。

2026-06-14 Android 9 安装、磨砂图补转与横图完整播放修复：
- 当前修改目标：修复 Android 9 下载 APK 后不能稳定拉起系统安装器；让播放相册“立即扫描图片”补转旧版或缺失的 TV 磨砂衍生图；横版照片完整显示且前景不缩放。
- 根因确认：授权未知来源后应用没有在返回前台时继续安装，且 Android 9 使用的 `ACTION_INSTALL_PACKAGE` 在部分电视固件上兼容性不足；扫描只看 `derivative_status=ready`，会把旧 `tv_4k.webp` 误判为当前 `tv_blur_fill.webp`；横图前景同时使用 `ContentScale.Crop` 和持续 4.5% 缩放。
- 当前状态：Android 9 安装改为优先使用带 APK MIME、`ClipData` 和读取授权的 `ACTION_VIEW`，授权返回后自动继续拉起安装器；扫描按数据库 URL 与磁盘 `tv_blur_fill.webp` 文件共同判断，旧衍生图会重新生成并计入补转数量；横图前景改为 `Fit`，缩放和垂直位移固定为零，竖图动画保持不变。
- 当前验证：新增回归测试先确认旧实现失败；修改后 Android 定向测试通过，后端 `app.controller.spec.ts` 71 项全部通过，其中覆盖旧 `tv_4k.webp` 经立即扫描迁移到 `tv_blur_fill.webp`。
- 发布准备：修复版提升为 Android TV `versionCode 11 / versionName 1.0.6`，GHCR/管理端镜像版本提升为 `1.0.9`；飞牛与 latest Compose 的更新元数据已同步，确保已安装 `1.0.5` 的盒子能检测到新版本。
- 当前验证：Android 全量单测与 Debug/Release 构建通过；后端 11 个测试套件共 116 项全部通过，后端编译通过。
- 发布预检：`scripts/release/verify-local-release.ps1` 完整通过；后端发布定向测试 96 项、管理端 5 项测试、typecheck、生产构建、两套 Compose 展开和 Android 清理后全量构建均成功。Debug APK 为 `17,483,629` 字节，SHA256 `DE8F69C22C6524740935EFF6BF73BE4BE233AFDEED455188B3B68C7C777F7C0A`；本地 Release APK 未签名，仅用于构建验证，正式包由 GitHub Actions 签名。
- 未来修改计划：运行发布预检后提交并推送 `main` 与 `tv-v1.0.6` 标签，等待 GitHub Actions 生成正式签名 APK 和 `1.0.9/latest` GHCR 镜像；随后在真实 Android 9 盒子验证授权返回、系统安装界面、磨砂背景和横图完整显示。如拉取仍出现 `EOF`，继续排查 NAS 到 `ghcr.io` 的网络链路。

2026-06-14 横图前景铺满与竖图长字幕修复：
- 当前修改目标：横版照片按原始比例显示，宽或高至少一边到达屏幕边缘且不拉伸；磨砂衍生图仅作背景；修复 `_DSC2430` 居中竖图长手写句字号过小。
- 根因确认：SQLite 播放相册把顶层 `displayImageUrl` 覆盖为 `tv_blur_fill.webp`，Android 又用同一地址绘制前景和背景；居中竖图主句仅有 1010 设计宽度且不换行，目标长句会缩到约 36 设计字号。
- 当前状态：回归测试已确认旧实现失败；后端普通播放列表、显式播放相册和来源相册合并三条播放查询均已恢复普通显示图作为顶层前景地址，TV 磨砂图继续单独下发；Android 播放器已分离前景和背景请求；居中竖图主句改为最多两行并扩大到 1900 设计宽度。Android 定向测试已通过，后端首轮定向测试定位并补齐了第二条播放相册查询。
- 当前验证：后端定向测试 96/96、全量测试 116/116 和编译通过；Android 定向测试、全量单测与 Debug 构建通过。新后端已在本地 `3999` 运行，真实相册接口已确认普通前景图与 TV 磨砂背景图分离；Debug APK 已覆盖安装到当前设备。用户已于 2026-06-14 确认功能正常并审核通过。
- 未来修改计划：停止继续截图和本地视觉操作；保持当前修改未推送，待后续明确指令再整理提交与发布。

2026-06-14 项目与 Android TV 2.0.0 全量发布：
- 当前修改目标：将项目 GHCR/管理端版本和 Android TV 版本统一提升到 `2.0.0`，完整发布近期已验收的后台、播放、磨砂背景、横竖图版式与 Android 9 更新链路改进。
- 当前状态：发布分支为 `codex/release-2.0.0`；项目镜像与管理端版本已设为 `2.0.0`；Android TV 已设为 `versionCode 12 / versionName 2.0.0`；两套 Compose 更新元数据、发布校验脚本、manifest 测试和 TV README 已同步。完整发布预检通过：manifest 测试 3/3、后端发布测试 96/96、管理端测试 5/5、后端编译、管理端 typecheck/生产构建、两套 Compose 展开及 Android 清理后全量单测和 Debug/Release 构建均成功；后端额外全量回归 116/116 通过；推送前审查未发现问题。
- 构建证据：Debug APK 为 `17,483,625` 字节，SHA256 `43E12329B6A8C10EFF9F0E2750147F9EBCC2B782E824A85E2EFC9E07955854B6`；本地 Release 为未签名验证包，不发布，正式签名 APK 由 GitHub Actions 生成。
- 未来修改计划：分逻辑提交并合并回 `main`，推送 `main`、`v2.0.0` 和 `tv-v2.0.0`；随后核对 GitHub Actions、GHCR `2.0.0/latest` 与正式签名 APK，并将同一正式 APK 同步到后台更新服务。

2026-06-15 Android TV 本地 Release 构建：
- 目标：按当前 `versionCode 13 / versionName 2.0.1` 在本机生成 TV 端 release 构建产物，并确认是否为正式签名包。
- 状态：`apps/android-tv` 下执行 `clean :app:assembleRelease` 已成功；真实产物为 `F:\xinxiangmu\jdyk\apps\android-tv\app\build\outputs\apk\release\app-release-unsigned.apk`，大小 `14228232` 字节，SHA256 `3546F25FCD6B629440D3073F07BB8C91607C105092BC9E6F4B617DF9355CAF5F`。
- 验证：`aapt dump badging` 确认为 `com.wangrizhongxian.tv`、`versionCode='13'`、`versionName='2.0.1'`；`apksigner verify --verbose` 返回 `DOES NOT VERIFY` / `Missing META-INF/MANIFEST.MF`，确认该包未签名。
- 阻塞：当前 Process/User/Machine 环境均没有 `ANDROID_TV_KEYSTORE_FILE`、`ANDROID_TV_KEYSTORE_PASSWORD`、`ANDROID_TV_KEY_ALIAS`、`ANDROID_TV_KEY_PASSWORD`，本机无法生成正式签名 APK；README 也要求正式包必须使用四个 `ANDROID_TV_*` 签名参数，不能发布 `app-release-unsigned.apk`。
- 下一步：补齐四个 `ANDROID_TV_*` 签名环境变量后重新执行 release 构建，再用 `apksigner verify` 确认签名通过，并复制为 `releases\wangri-tv-2.0.1.apk`。
