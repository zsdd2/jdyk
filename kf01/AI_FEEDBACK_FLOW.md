# 往日重现 AI 反馈流程

更新时间：2026-06-09

本文是 AI 评分、评语、分类和 TV 文字设计的权威流程文档。代码实现仍在 NestJS + SQLite 桥接层中验证，后续迁移 FastAPI/PostgreSQL 时保持字段语义不变。

## 1. 当前目标

当前优先路线是“单次 Vision 调用 + 严格 photo_tv_payload_v1 输出”：

```text
播放相册开启 AI
-> 飞牛挂载照片按需导入照片中心
-> 生成三规格派生图契约
-> 使用 720p AI 分析图调用 Vision API
-> 一次返回评分、点评、分类和 TV 文字设计（photo_tv_payload_v1）
-> 持久化到本地 SQLite
-> 后台照片列表/播放相册/TV 播放流读取同一份结果
```

如果真实照片测试证明单次调用效果不稳定，再拆成“评分初筛”和“点评排版”两次调用。

## 2. AI 必须返回的 JSON

Vision API 必须只返回 JSON，不返回 Markdown、解释文本或代码块。新提示词默认要求 `schema_version` 为 `photo_tv_payload_v1`；缺少关键字段时后端会判定失败并进入重试/失败链路，不再用默认分数或兜底旁白标记完成。

```json
{
  "schema_version": "photo_tv_payload_v1",
  "photo_analysis": {
    "caption": "一家人围坐在明亮客厅里，脸上带着自然笑意。"
  },
  "evaluation": {
    "memory_score": 88.5,
    "beauty_score": 82,
    "is_trash": false,
    "reason": "人物自然，家庭记忆价值高。"
  },
  "classification": {
    "category": "人物,家庭",
    "scene_tags": ["人物", "家庭"],
    "tv_suitability": "high"
  },
  "narration": {
    "variants": [
      {
        "scene_description": "一家人并肩站在客厅",
        "handwritten_thought": "那天没有说太多，笑声却留了很久",
        "lyrical_closure": "灯光还记得这一晚"
      }
    ]
  },
  "tv_layout": {
    "layout": {
      "position_anchor": "bottom_right",
      "safe_area": {
        "x": 0.58,
        "y": 0.68,
        "w": 0.36,
        "h": 0.2
      },
      "text_color": "#FFFFFF"
    },
    "typography": {
      "primary_text": {
        "content": "岁月有光",
        "font_family": "handwriting",
        "weight": "regular"
      },
      "secondary_text": {
        "content": "笑声很长",
        "font_family": "serif",
        "weight": "light"
      }
    }
  },
  "push_decision": {
    "should_push": true,
    "push_reason": "达到回忆和美学双阈值。"
  }
}
```

字段约束：

- `evaluation.memory_score`：0-100，情感记忆价值。家人、生活瞬间、特殊事件得分高；单据、截图、无意义测试图低分。
- `evaluation.beauty_score`：0-100，构图、光线、清晰度和电视展示美感。
- `evaluation.is_trash`：废片判断。严重模糊、纯黑纯白、账单截图等为 `true`。
- `classification.category` / `classification.scene_tags`：中文类型标签，用于后续分拣和推送偏好。
- `narration.variants`：必须恰好 5 组，每组包含画面描述、手写心声和抒情收束。
- `scene_description`：8-16 个中文字符，只写真实可见内容。
- `handwritten_thought`：12-25 个中文字符，温暖、克制、生活化，作为手写强调行。
- `lyrical_closure`：8-18 个中文字符，轻轻收住情绪。
- `tv_layout.layout.position_anchor`：只能是 `top_left`、`top_right`、`bottom_left`、`bottom_right`、`center_safe`。
- `tv_layout.layout.safe_area`：0-1 归一化坐标，按 16:9 电视画布计算，代表文字可落位区域。
- `tv_layout.layout.text_color`：只能是 `#FFFFFF` 或 `#000000`。
- `tv_layout.typography.*.font_family`：字体建议，当前后端会归一为 `serif`、`sans-serif`、`handwriting` 供 TV 端过渡使用。
- `push_decision.should_push`：必须同时满足回忆相关度和美学水平两个阈值。

后端归一化规则：

- `ai_score = round(evaluation.memory_score * 0.65 + evaluation.beauty_score * 0.35)`。
- `classification` 持久化为 `ai_tags`；为空时使用 `["回忆"]`。
- 第 1 组旁白按三行合并为兼容字段 `ai_comment`。
- 完整 5 组旁白保存在 `ai_detail.raw.narration.variants`，播放 API 输出为 `narrationVariants`。
- TV 每次进入一张照片时随机选择一组旁白；没有有效旁白时保持为空，不生成兜底文案。
- 已保存但未提取的 AI 原始返回可通过 `POST /api/admin/photo-library/photos/{photoId}/ai-sync` 重新同步，不再次调用模型。
- 非法布局位置回退到 `bottom_left`。
- 非法字体回退到 `sans-serif`。
- 非法文字颜色回退到 `#FFFFFF`。

## 3. 当前本地数据库存储

当前有专门的 AI 设置表和 AI 任务表，但还没有单独的多版本 AI 反馈表。

已存在的专门配置表：

- `ai_settings`
  - `provider`
  - `model`
  - `base_url`
  - `api_key`
  - `scoring_prompt`
  - `comment_prompt`
  - `classification_prompt`
  - `updated_at`

已存在的 AI 任务表：

- `ai_recognition_tasks`
  - `job_id`
  - `target_type`
  - `target_id`
  - `target_title`
  - `album_id`
  - `album_title`
  - `status`
  - `requested_photo_count`
  - `completed_photo_count`
  - `skipped_photo_count`
  - `failed_photo_count`
  - `active_photo_id`
  - `active_photo_name`
  - `error`
  - `created_at`
  - `last_updated_at`
  - `finished_at`

每张照片的 AI 反馈当前直接存储在 `photos` 表：

- 基础反馈：`ai_score`、`ai_score_status`、`ai_comment`、`ai_comment_status`、`ai_tags`、`ai_locked`
- 统一 Vision 扩展：`ai_memory_score`、`ai_beauty_score`、`ai_is_trash`、`ai_reason`
- TV 设计反馈：`ai_layout_position`、`ai_text_color`、`ai_font_style`、`ai_safe_area`
- 派生图契约：`thumbnail_300_url`、`ai_720_url`、`tv_4k_webp_url`、`derivative_status`

播放相册 AI 策略当前存储在 `playback_albums` 表：

- `ai_enabled`
- `ai_score_threshold`
- `ai_priority_tags`
- `push_enabled`
- `push_score_threshold`
- `push_priority_tags`

当前结论：

- 已经能持久化 AI 最新反馈和 AI 任务进度，不是纯内存态。
- AI 反馈没有独立 `photo_ai_feedback` 表，当前落在 `photos` 表中。
- `ai_settings` 是专门的 AI 配置表。
- 后续当需要多模型历史、人工审核记录、失败重试和版本对比时，再拆出 `photo_ai_feedback_runs` 或 `photo_ai_insights` 表。

## 4. 后台生成流程

1. 后台在 AI 设置中心保存平台、模型、接口地址、API Key 和提示词。
   - API：`GET /api/admin/photo-library/ai-settings`
   - API：`PUT /api/admin/photo-library/ai-settings`
   - 存储：`ai_settings`

2. 播放相册开启 AI 开关。
   - API：`PATCH /api/admin/photo-library/playback-albums/{playbackAlbumId}/ai-policy`
   - 开启 `aiEnabled=true` 时，后端立即触发一次 AI job。
   - 手动重跑 API：`POST /api/admin/photo-library/playback-albums/{playbackAlbumId}/ai-jobs`

3. 如果播放相册直接挂载飞牛相册，先按需导入该飞牛相册照片。
   - 飞牛扫描仍只同步相册清单。
   - AI 生成时才把挂载相册里的照片写入照片中心，保证 AI 结果能绑定稳定 `photoId`。

4. 后端为每张目标照片调用 `ensurePhotoDerivatives(photoId)`。
   - 当前只生成三规格 URL 和 `ready` 状态。
   - 下一步接入 `sharp/libvips` 后，改为真实生成 300px、720p 和 4K WebP 文件。

5. 后端调用统一 Vision Adapter。
   - 输入图：`ai_720_url`
   - `detail`: `low`
   - 输出：第 2 节定义的 `photo_tv_payload_v1` JSON。
   - 未配置 `baseUrl + apiKey`、调用失败或 v1 校验失败时，不写兜底旁白；任务进入 retrying/failed，照片保持 pending 或 failed。

6. 后端归一化并写入 SQLite。
   - 写入函数：`applyPhotoAiInsights`
   - 当前写入 `photos` 表 AI 字段。

## 5. 后台图片展示流程

后台照片列表和播放相册成员弹窗只使用缩略图：

```text
photos.thumbnail_300_url
-> PhotoCenterItem.thumbnailUrl
-> Vben Image src
-> GET /api/photos/{photoId}/thumb?profile=thumb_300
```

当前限制：

- `thumb_300` 还不是实际 300px 文件，只是 URL/profile 契约。
- 真实转码落地后，后台列表必须只读 300px 缩略图，不能加载原图或 TV 4K 图。

## 6. TV 图片和文字展示流程

TV 播放流读取播放相册成员，并把 AI 反馈映射到 `PlaylistItem`：

```text
photos.tv_4k_webp_url
-> PlaylistItem.displayImageUrl
-> PlaylistItem.display.tvImageUrl
-> Android TV 图片展示

photos.ai_comment
-> PlaylistItem.caption.text
-> Android TV 旁白展示

photos.ai_layout_position / ai_safe_area / ai_text_color / ai_font_style
-> PlaylistItem.layout + PlaylistItem.display
-> Android TV 文案落位、颜色和字体风格
```

映射规则：

- `caption.text` 优先使用 `ai_comment`，为空时回退到原始 `caption_text`。
- `display.tvImageUrl` 使用 4K WebP TV 图。
- `display.aiImageUrl` 只供 AI 分析或后台排障，不给 TV 优先展示。
- `layout.safeArea` 是 16:9 归一化坐标，TV 端需要按屏幕尺寸等比例换算。
- `display.textColor` 和 `display.fontStyle` 是 TV 文案样式提示。

## 7. 下一步实现顺序

1. 接入 `sharp/libvips`，把三规格 URL 契约替换为真实文件生成。
2. 让 AI 输入使用真实 720p 分析图，必要时改为后端可访问 URL 或 base64/data URL。
3. 用 3-5 张本地/飞牛照片测试单次 Vision 返回质量。
4. 如果单次返回的布局不可靠，拆为评分和排版两阶段。
5. 增加 AI 失败状态持久化，避免调用失败被本地兜底误认为真实 AI 完成。
6. 等需要历史追踪时，拆出独立 `photo_ai_insights` 表，保留 `photos` 表当前字段作为最新快照。

## 2026-06-09 实现状态补充

- 本地照片已经接入 `sharp/libvips`，`ensurePhotoDerivatives(photoId)` 会生成真实 `thumb_300.webp`、`ai_720.webp`、`tv_4k.webp` 文件。
- 本地派生图默认保存到 `apps/backend-api/data/derivatives/{photoId}/`。
- 后端通过 `GET /api/derivatives/:photoId/:filename` 暴露派生图，AI 输入应优先使用 `ai_720.webp`。
- 历史状态：飞牛远程照片曾保留远程 URL/profile 兜底并标记为 `remote_pending`；当前实现已在下方补充为可按需拉取远程流并生成真实派生图。

## 2026-06-09 实现状态补充：飞牛远程媒体

- 飞牛远程照片已接入按需转码流程。
- 当播放相册 AI job 遇到 `remote_pending` 飞牛照片时，后端会通过当前 `PhotoSource.getPhotoAsset(photoId, 'display')` 获取远程媒体流。
- 远程媒体流转为 Buffer 后复用本地 `sharp/libvips` 三规格转码逻辑。
- 生成成功后，飞牛照片会写入 `/api/derivatives/{photoId}/thumb_300.webp`、`ai_720.webp`、`tv_4k.webp`，并将 `derivativeStatus` 更新为 `ready`。
- 如果飞牛媒体暂时无法拉取，仍保留 `remote_pending` 兜底，避免单张照片失败中断整批 AI job。
## 2026-06-09 实现补充：AI 输入图片使用 data URL

- 统一 Vision AI 的外部调用不再使用 `/api/derivatives/{photoId}/ai_720.webp` 相对 URL。
- 后端 AI job 会先确保 `ai_720.webp` 已生成，再读取该文件并转换为 `data:image/webp;base64,...` 传给模型。
- `photos.ai_720_url`、`photos.tv_4k_webp_url` 和 `photos.thumbnail_300_url` 继续保存 API URL，用于后台显示和 TV 播放。
- 真实飞牛共享相册验证显示，单次 Vision 调用可以返回评分、评语、分类、文字位置、安全区、颜色和字体风格。
- 当前仍需要增加失败状态：模型偶发失败时不应长期用 fallback 覆盖真实 AI 结果，后续应记录失败原因并允许重试。
