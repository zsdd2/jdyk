# 《往日重现》Android TV 技术选型

更新时间：2026-06-05

## 1. 结论

Android TV 端是本项目的核心 APK 和最终展示端，必须按长期主播放器设计，不再把 WebView 播放页作为最终主播放器。

最终选型：

- 主语言：Kotlin。
- UI 框架：Jetpack Compose for TV。
- TV 组件：AndroidX TV Material。
- 主播放器：Compose 原生图片播放引擎。
- 图片加载：Coil。
- 网络：Retrofit / OkHttp。
- 本地配置：DataStore。
- 离线缓存：Room + 本地文件缓存。
- 异步任务：Kotlin Coroutines。
- 动画：Compose Animation + graphicsLayer + Canvas。
- 视频能力：后续如需要再接 Media3，照片播放不以 Media3 / ExoPlayer 为核心。

`apps/tv-player-web` 不再是电视端主播放器，只保留为：

- 管理后台播放预览。
- 浏览器调试工具。
- Android TV APK 的备用 WebView 模式。

## 2. 为什么不直接二开现成播放器

目前没有一个开源 Android TV 照片播放器能直接匹配本项目的长期目标。

可参考项目：

- Immich Android TV：接近“自托管照片服务 + Android TV 播放”，适合参考相册接入、幻灯片、屏保、4K 缩略图和 EXIF 展示。
- Aerial Views：适合参考 Android TV / Google TV / Fire TV 兼容性、D-pad 操作、屏保模式、Overlay、防烧屏和多媒体源处理。
- Kodi：兼容性和成熟度强，但过重，C++ / 皮肤体系复杂，不适合作为本项目底座。
- Aves / Fossify Gallery：图库能力强，但主要不是 Android TV 沉浸播放端。

不直接 fork 的原因：

- 外部项目通常绑定自己的后端、媒体协议或 UI 架构。
- 本项目需要播放策略、AI 文案、版式动画和设备绑定，协议是自有的。
- GPL 项目直接二开并分发会带来开源范围约束，后续商业或闭源分发空间受限。
- 电视端是核心体验，直接自研主播放器更容易控制动画、性能、兼容性和长期演进。

## 3. Android TV APK 模块边界

建议在 `apps/android-tv` 内按包或模块拆分：

```text
apps/android-tv
├── app
│   ├── MainActivity
│   ├── AppNavHost
│   └── AppTheme
├── core-model
│   ├── PlaylistItem
│   ├── DevicePolicy
│   └── PlayRecord
├── core-network
│   ├── BackendApi
│   ├── ApiClient
│   └── NetworkStatus
├── core-storage
│   ├── SettingsStore
│   ├── DeviceTokenStore
│   └── OfflinePlaylistStore
├── feature-bind
│   ├── ServerSetupScreen
│   ├── BindCodeScreen
│   └── BindViewModel
├── feature-player
│   ├── NativePhotoPlayerScreen
│   ├── PhotoLayer
│   ├── CaptionLayer
│   ├── AnimationEngine
│   └── PlayerViewModel
└── feature-settings
    ├── QuickSettingsPanel
    └── DeviceInfoScreen
```

第一版可以先用单模块 Android 工程实现，代码包名按以上边界组织。等复杂度上来后再拆 Gradle 多模块。

## 4. 主播放器设计

### 4.1 图层结构

```text
NativePhotoPlayer
├── BackgroundFillLayer
├── PreviousImageLayer
├── CurrentImageLayer
├── NextImagePreloadLayer
├── GradientMaskLayer
├── CaptionLayer
├── MetadataLayer
├── StatusOverlayLayer
└── ErrorFallbackLayer
```

### 4.2 核心机制

- 双缓冲播放：当前图片和下一张图片分离。
- 下一张预加载：提前加载展示图，不等切换时才请求。
- 动画模板驱动：后台下发动画 ID 和参数，Android 端映射到本地动画实现。
- 文案图层独立：图片转场和文字动画分开，避免互相阻塞。
- 低性能降级：低端设备关闭 Ken Burns、模糊背景和复杂文字动画，只保留淡入淡出。
- 主动释放资源：切换后释放上一张 Bitmap / ImageRequest 资源，避免长时间播放内存增长。
- 离线兜底：后端不可达时优先播放本地缓存的最近播放列表。
- 错误跳过：图片加载失败时上报错误并切到下一张。

### 4.3 图片规格原则

Android TV 端不直接加载 NAS 原图。

后端必须提供适合电视展示的图片版本：

- `displayImageUrl`：1080p / 4K 展示图，用于电视全屏播放。
- `thumbnailUrl`：列表和预加载状态使用。
- `originalUrl`：只在后台管理或用户明确查看原图时使用。

原因：

- NAS 原图可能超过 10MB 到 30MB，长期轮播容易造成内存和网络抖动。
- 电视端主要需求是稳定全屏展示，不需要每次都取完整原图。
- 后端统一生成展示图，能更好控制方向、EXIF、色彩、尺寸和缓存。

## 5. 动画能力路线

第一版必须实现：

- 淡入淡出。
- Ken Burns 轻微缩放和平移。
- 底部渐变文案层。
- 标题和说明淡入上移。
- 下一张手动切换。

第二版扩展：

- 左右构图版式。
- 竖图安全展示。
- 背景模糊填充。
- 文字轻微浮动。
- 今日往日主题过场。

长期扩展：

- Canvas 粒子、胶片感、旧照片边框。
- Shader 渐变和局部光效。
- 多照片拼贴。
- 年度回忆主题模板。
- 屏保模式和防烧屏 Overlay 漂移。

## 6. 与后台播放协议的关系

Android TV 不直接理解后台业务规则，只消费播放协议。

后端负责：

- 选择照片。
- 生成展示图和缩略图。
- 绑定 AI 文案。
- 计算播放策略。
- 下发播放单元。

Android TV 负责：

- 拉取设备策略。
- 拉取播放列表。
- 缓存最近播放列表。
- 加载展示图。
- 执行动画和版式。
- 处理遥控器按键。
- 上报播放记录和错误。

播放协议后续需要补充：

- `displayImageUrl`。
- `imageFitMode`。
- `dominantColor`。
- `performanceHint`。
- `layoutTemplateId`。
- `animationTemplateId`。
- `durationMs`。

## 7. 开源项目借鉴方式

### 7.1 Immich Android TV

借鉴点：

- 自托管照片服务到 Android TV 的数据链路。
- 幻灯片和屏保体验。
- 4K 缩略图 / 展示图加载策略。
- EXIF 展示和相册筛选。

不直接复用点：

- 不绑定 Immich API。
- 不照搬其播放协议。
- 不以其项目结构作为本项目底座。

### 7.2 Aerial Views

借鉴点：

- Android TV / Google TV / Fire TV 兼容性处理。
- D-pad 操作和设置页体验。
- 屏保模式。
- Overlay、防烧屏、设备差异处理。
- 多媒体源接入经验。

不直接复用点：

- 不把视频屏保模型作为照片播放器核心。
- 不照搬其媒体源结构。

## 8. Android TV 阶段计划

### 阶段 A：工程和基础壳

- 创建 `apps/android-tv`。
- 配置 Kotlin、Compose for TV、AndroidX TV Material。
- 实现启动页和主导航。
- 实现后台地址配置和 DataStore 持久化。
- 实现网络健康检查。

验收：

- APK 可构建。
- Android TV 模拟器或真实设备可启动。
- 能保存后台地址。
- 后台不可达时有明确提示。

### 阶段 B：设备绑定

- 实现绑定码页面。
- 接入设备绑定 API。
- 保存设备 Token。
- 绑定成功后进入播放页。

验收：

- 未绑定设备显示绑定码。
- 后台完成绑定后电视端进入播放。
- 重启 APK 后仍保持绑定状态。

### 阶段 C：原生照片播放器 MVP

- 实现播放列表拉取。
- 实现展示图加载。
- 实现双缓冲。
- 实现淡入淡出和 Ken Burns。
- 实现标题、说明、日期、位置图层。
- 实现上一张、下一张、暂停 / 继续。
- 实现播放记录上报。

验收：

- 不依赖 WebView，可原生播放照片。
- 遥控器右键切换下一张。
- 播放失败可跳过并上报。

### 阶段 D：缓存和稳定性

- 缓存最近播放列表。
- 缓存最近展示图。
- 后台断开时继续播放缓存。
- 增加低性能模式。
- 增加长时间播放内存测试。

验收：

- 后台短暂不可达时不黑屏。
- 连续播放 4 小时无明显内存增长。
- 低端设备可关闭复杂动画。

### 阶段 E：高级展示和屏保能力

- 屏保模式。
- 防烧屏 Overlay 漂移。
- 更多版式模板。
- 更多动画模板。
- 当前照片详情面板。
- 快捷设置面板。

验收：

- 电视端可作为长期家庭照片展示入口。
- 展示效果优于普通 WebView 幻灯片。

## 9. 必须避免的方向

- 不以 WebView 作为正式主播放器。
- 不让 Android TV 直接读取 NAS 原图。
- 不让 Android TV 直接调用云端 AI。
- 不把 ExoPlayer / Media3 作为照片播放核心。
- 不直接 fork GPL 项目并混入核心代码，除非明确接受 GPL 分发约束。
- 不把复杂管理功能放进电视端。

## 10. 当前下一步

后续开发顺序应调整为：

1. 更新后端播放协议，预留 `displayImageUrl` 和动画 / 版式字段。
2. 创建 `apps/android-tv` Compose for TV 工程。
3. 先实现后台地址配置和健康检查。
4. 再实现设备绑定。
5. 再实现原生照片播放器 MVP。
6. `apps/tv-player-web` 仅继续作为后台预览和调试工具维护。
