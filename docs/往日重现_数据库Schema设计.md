# 《往日重现》数据库 Schema 设计

更新时间：2026-06-06

## 设计目标

本设计用于把当前 `apps/backend-api` 的内存样例数据迁移为可持久化的数据模型，优先支撑 Android TV 主链路：

- 后台扫描 NAS 照片目录，生成稳定 Photo ID。
- 图包聚合照片，并向 TV 返回 `AlbumSummary` / `AlbumDetailResponse`。
- TV 使用设备 Token 拉取图包、播放列表、播放策略。
- AI 文案、展示图、缩略图和播放记录都绑定到稳定照片 ID。
- 先满足单用户/家庭 NAS MVP，保留后续多用户和生产鉴权扩展空间。

## 推荐技术基线

- 第一阶段建议使用 SQLite，便于 Docker 单机部署和备份。
- 后续需要多用户或并发任务扩展时，再迁移到 PostgreSQL。
- 主键统一使用字符串 ID，避免数据库迁移影响 TV/API 协议。
- 时间字段统一 ISO 字符串或数据库 `datetime`，API 出口保持 ISO 8601。
- JSON 配置字段先用 `text` 存储序列化 JSON，等 PostgreSQL 阶段再迁移为 `jsonb`。

## 核心表

### photo_sources

记录 NAS 或本地挂载目录。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | text pk | 目录 ID，例如 `src_family_nas` |
| name | text | 展示名称 |
| root_path | text unique | Docker 容器内可访问路径 |
| original_path_hint | text nullable | 用户看到的 NAS 原路径提示 |
| enabled | integer | 0/1 |
| last_scan_job_id | text nullable | 最近一次扫描任务 |
| created_at | datetime | 创建时间 |
| updated_at | datetime | 更新时间 |

### photos

照片索引表，是播放链路的核心事实表。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | text pk | 稳定 Photo ID |
| source_id | text fk | 所属照片目录 |
| relative_path | text | 相对目录路径 |
| file_name | text | 文件名 |
| file_hash | text | 内容 hash，用于去重和变更检测 |
| file_size | integer | 文件大小 |
| mime_type | text | MIME 类型 |
| width | integer nullable | 原图宽度 |
| height | integer nullable | 原图高度 |
| orientation | text | `landscape` / `portrait` / `square` / `unknown` |
| taken_at | datetime nullable | EXIF 拍摄时间 |
| location_name | text nullable | 展示用地点 |
| gps_lat | real nullable | GPS 纬度 |
| gps_lng | real nullable | GPS 经度 |
| exif_json | text nullable | 原始 EXIF JSON |
| enabled | integer | 是否可参与播放 |
| favorite | integer | 是否收藏 |
| deleted_at | datetime nullable | 软删除时间，只影响索引不删原图 |
| created_at | datetime | 创建时间 |
| updated_at | datetime | 更新时间 |

索引：

- `unique(source_id, relative_path)`
- `index(source_id, taken_at)`
- `index(file_hash)`
- `index(enabled, taken_at)`

### albums

图包表。图包可以来自手工创建、目录自动聚合或规则生成。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | text pk | 对应 API `albumId` |
| title | text | 图包标题 |
| description | text | 图包说明 |
| cover_photo_id | text nullable fk | 封面照片 |
| album_type | text | `manual` / `source` / `smart` |
| source_id | text nullable fk | 目录型图包来源 |
| smart_rule_json | text nullable | 智能图包规则 |
| sort_order | integer | 后台排序 |
| enabled | integer | 是否对 TV 可见 |
| created_at | datetime | 创建时间 |
| updated_at | datetime | 更新时间 |

### album_photos

图包和照片的关系表。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| album_id | text fk | 图包 ID |
| photo_id | text fk | 照片 ID |
| sort_order | integer | 图包内排序 |
| added_at | datetime | 加入时间 |

主键：`(album_id, photo_id)`

索引：

- `index(album_id, sort_order)`
- `index(photo_id)`

### ai_captions

AI 文案和识图结果表。AI 结果必须绑定 Photo ID。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | text pk | 文案 ID |
| photo_id | text fk | 照片 ID |
| provider | text | `openai` / `azure` / `gemini` 等 |
| model | text | 模型名称 |
| style | text | `warm_memory` / `poetic` / `family_diary` / `travel` / `minimal` |
| title | text | 标题 |
| text | text | 正文 |
| scene_tags_json | text | 场景标签 JSON |
| mood_tags_json | text | 情绪标签 JSON |
| suggested_layout | text | 推荐版式 |
| suggested_animation | text | 推荐动画 |
| status | text | `pending` / `generated` / `failed` / `locked` |
| locked | integer | 用户锁定后不自动覆盖 |
| error | text nullable | 失败信息 |
| generated_at | datetime nullable | 生成时间 |
| created_at | datetime | 创建时间 |
| updated_at | datetime | 更新时间 |

索引：

- `index(photo_id, style, status)`
- `index(status, created_at)`

### display_assets

电视展示图、缩略图和压缩图缓存。TV 不直接加载 NAS 原图。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | text pk | 资源 ID |
| photo_id | text fk | 照片 ID |
| variant | text | `original_proxy` / `display_1080p` / `display_4k` / `thumb` |
| fit_mode | text | `contain` / `cover` / `cover_safe` / `portrait_blur_fill` |
| storage_path | text | 缓存文件路径 |
| mime_type | text | 输出 MIME 类型 |
| width | integer | 输出宽度 |
| height | integer | 输出高度 |
| file_size | integer nullable | 输出文件大小 |
| dominant_color | text nullable | 主色，例如 `#d8a465` |
| status | text | `pending` / `ready` / `failed` |
| error | text nullable | 失败信息 |
| created_at | datetime | 创建时间 |
| updated_at | datetime | 更新时间 |

索引：

- `unique(photo_id, variant, fit_mode)`
- `index(status, updated_at)`

### devices

电视设备表。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | text pk | API `deviceId` |
| name | text | 设备名称 |
| device_type | text | `android_tv` / `web_preview` |
| app_version | text nullable | TV App 版本 |
| screen_width | integer nullable | 屏幕宽 |
| screen_height | integer nullable | 屏幕高 |
| status | text | `active` / `disabled` |
| last_seen_at | datetime nullable | 最近访问 |
| created_at | datetime | 创建时间 |
| updated_at | datetime | 更新时间 |

### device_tokens

设备 Token 表，用于替换当前临时字符串 Token。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| token_hash | text pk | Token hash，不存明文 |
| device_id | text fk | 设备 ID |
| token_prefix | text | 排障显示前缀 |
| expires_at | datetime nullable | 过期时间 |
| revoked_at | datetime nullable | 撤销时间 |
| created_at | datetime | 创建时间 |
| last_used_at | datetime nullable | 最近使用 |

索引：

- `index(device_id, revoked_at)`
- `index(expires_at)`

### device_bind_sessions

设备绑定码会话表。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| bind_code | text pk | 6 位绑定码 |
| status | text | `pending` / `bound` / `expired` |
| device_id | text nullable fk | 绑定后的设备 |
| device_name | text nullable | 绑定时命名 |
| app_version | text nullable | App 版本 |
| screen_width | integer nullable | 屏幕宽 |
| screen_height | integer nullable | 屏幕高 |
| created_at | datetime | 创建时间 |
| expires_at | datetime | 过期时间 |
| confirmed_at | datetime nullable | 确认时间 |

### play_policies

播放策略表。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | text pk | 策略 ID |
| name | text | 策略名称 |
| play_mode | text | `date_desc` / `random` / `sequence` / `today_in_history` |
| interval_seconds | integer | 默认播放间隔 |
| layout_template | text | 默认版式 |
| animation_template | text | 默认动画 |
| image_fit_mode | text | 默认图片适配 |
| performance_hint | text | `low` / `standard` / `high` |
| filter_json | text nullable | 筛选条件 |
| enabled | integer | 是否启用 |
| version | integer | 策略版本 |
| created_at | datetime | 创建时间 |
| updated_at | datetime | 更新时间 |

### device_policy_assignments

设备和策略、图包的绑定关系。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| device_id | text fk | 设备 ID |
| policy_id | text fk | 策略 ID |
| album_id | text nullable fk | 限定图包；为空表示策略筛选 |
| assigned_at | datetime | 分配时间 |

主键：`(device_id, policy_id, album_id)`

### play_records

播放记录表。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | text pk | 记录 ID |
| device_id | text nullable fk | 设备 ID |
| photo_id | text fk | 照片 ID |
| album_id | text nullable fk | 播放时所属图包 |
| policy_id | text | 策略 ID |
| policy_version | integer nullable | 策略版本 |
| duration_seconds | integer | 播放时长 |
| skipped | integer | 是否跳过 |
| error | text nullable | 播放错误 |
| played_at | datetime | 播放时间 |
| created_at | datetime | 记录创建时间 |

索引：

- `index(device_id, played_at)`
- `index(photo_id, played_at)`
- `index(album_id, played_at)`

### scan_jobs

照片扫描任务。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | text pk | 任务 ID |
| source_id | text fk | 扫描目录 |
| status | text | `queued` / `running` / `completed` / `failed` / `cancelled` |
| total_files | integer | 总文件数 |
| scanned_files | integer | 已扫描 |
| new_photos | integer | 新增照片 |
| updated_photos | integer | 更新照片 |
| error | text nullable | 失败信息 |
| started_at | datetime nullable | 开始时间 |
| finished_at | datetime nullable | 结束时间 |
| created_at | datetime | 创建时间 |

### ai_jobs

AI 文案生成任务。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | text pk | 任务 ID |
| photo_id | text fk | 照片 ID |
| status | text | `queued` / `running` / `completed` / `failed` |
| provider | text | AI provider |
| model | text | 模型 |
| style | text | 文案风格 |
| error | text nullable | 失败信息 |
| created_at | datetime | 创建时间 |
| started_at | datetime nullable | 开始时间 |
| finished_at | datetime nullable | 完成时间 |

## API 映射

### `GET /api/device/albums`

来源：

- `albums`
- `album_photos`
- `photos`
- `display_assets`

返回字段：

- `albumId` = `albums.id`
- `title` = `albums.title`
- `description` = `albums.description`
- `coverImageUrl` = `/api/photos/:coverPhotoId/display`
- `thumbnailUrl` = `/api/photos/:coverPhotoId/thumb`
- `photoCount` = enabled 照片数量
- `updatedAt` = 图包更新时间或最新照片时间

### `GET /api/device/albums/:albumId`

来源：

- `albums`
- `album_photos`
- `photos`
- `ai_captions`
- `display_assets`
- `play_policies`

返回 `AlbumDetailResponse`，其中 `items` 由图包内 enabled 照片按策略排序生成。

### `GET /api/device/playlist?albumId=...`

第一阶段可复用图包详情的 `items` 生成逻辑。后续如果需要跨图包策略，再增加独立 playlist snapshot 表。

### `POST /api/device/play-record`

写入 `play_records`。当前 API 没有传 `deviceId`，正式 Token 校验后应从 Token 反查设备 ID，不要求 TV 端额外传设备 ID。

## 迁移顺序

1. 建立 SQLite 连接、迁移机制和上述核心表。
2. 先落 `photos`、`albums`、`album_photos`、`display_assets`，用 seed 数据替代当前 `sampleItems`。
3. 落 `devices`、`device_tokens`、`device_bind_sessions`，替换内存 Token 和绑定会话。
4. 落 `play_records`，替换当前 console 记录。
5. 落 `photo_sources`、`scan_jobs`，接入真实 NAS 目录扫描。
6. 落 `ai_captions`、`ai_jobs`，接入预生成 AI 文案。
7. 落 `play_policies`、`device_policy_assignments`，替换当前固定策略。

## 第一轮实现边界

第一轮只建议实现：

- SQLite 基础设施。
- `photos`、`albums`、`album_photos`、`display_assets`。
- 最小 seed 数据。
- `GET /api/device/albums`、`GET /api/device/albums/:albumId`、`GET /api/device/playlist` 从数据库读取。

暂缓：

- 正式用户体系。
- 复杂权限。
- AI Provider 实现。
- 真实 NAS 扫描任务。
- Web 管理后台 CRUD。

## 风险点

- Photo ID 必须稳定；不能用自增 ID 暴露给 TV。
- 不删除 NAS 原图；删除只影响索引和缓存。
- TV 不直接加载 NAS 原图，必须使用展示图或缩略图接口。
- AI 文案被用户编辑或锁定后不能被自动覆盖。
- 播放记录写入不能阻塞 TV 播放；失败时可以降级为客户端忽略。

## 2026-06-11 AI 任务持久化补充

### ai_recognition_tasks

AI 识别任务进度表，用于支撑后台“AI 识别进度”、单张重新识别、相册补全 AI、定时任务和 TV/每日推送前置状态判断。任务状态不再只保存在进程内存，后台重启后仍可追踪最近任务。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| job_id | text pk | 任务 ID |
| target_type | text | `photo` / `album` / `scheduler` |
| target_id | text | 目标照片或相册 ID |
| title | text | 任务标题 |
| status | text | `queued` / `running` / `retrying` / `completed` / `failed` |
| total | integer | 总照片数 |
| completed | integer | 完成数量 |
| failed | integer | 失败数量 |
| skipped | integer | 跳过数量 |
| current_photo_id | text nullable | 当前处理照片 |
| current_photo_title | text nullable | 当前处理照片标题 |
| error | text nullable | 最近错误 |
| created_at | datetime | 创建时间 |
| updated_at | datetime | 更新时间 |

### 统一 AI 输出协议

新 AI 识别任务默认要求模型返回 `photo_tv_payload_v1`，后端严格校验后才写入照片 AI 结果。必须包含：

- `photo_analysis.caption`
- `evaluation.memory_score`
- `evaluation.beauty_score`
- `classification.category`
- `classification.scene_tags`
- `narration.text`
- `tv_layout.layout.position_anchor`
- `tv_layout.layout.safe_area`
- `tv_layout.layout.text_color`
- `push_decision.eligible`

如果 AI 未配置、调用失败、返回 JSON 不合法或缺少必填字段，系统不再生成兜底旁白，也不把照片标记为识别完成；任务进入 `retrying` 或 `failed`，照片保持待处理或失败状态，便于后台重试和人工排查。
