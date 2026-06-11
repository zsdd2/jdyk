# TV UI Development Progress

## 2026-06-10

### Current Modification Goal

- Rebuild Android TV login screen to match the provided 16:9 reference, with adaptive fallback for narrower screens.
- Rebuild album selection screen with large TV cards and a blurred album-photo background.
- Consolidate AI settings into one unified prompt contract and make backend normalize the new `photo_tv_payload_v1` output into the existing TV playback fields.
- Remove the intermediate album detail step: selecting an album now loads its photos and enters playback directly.
- Add an in-player menu overlay modeled after the provided playback menu reference.

### Current Status

- `MainActivity.kt` login screen now uses a 16:9-aware split layout, glass login card, protocol selector, HTTPS switch, username/password fields, visibility toggle, and primary login button.
- `MainActivity.kt` login screen now uses a bundled 16:9 photoreal memory-room background asset (`login_memory_bg.png`) instead of the earlier procedural Canvas backdrop, bringing the first screen much closer to the provided reference.
- The login card, left brand logo/title/subtitle spacing, glass opacity, input sizing, and status row were retuned against a 1920x1080 emulator screenshot.
- `MainActivity.kt` album selection now accepts the shared `ImageLoader`, picks one album cover as a session background, and uses larger album cards with selected-state check mark.
- `MainActivity.kt` album cards were retuned after screenshot verification: card size is reduced, image area is smaller, and title/date/photo count stay visible at 1600x900 and 16:9 layouts while keeping the blurred album-cover background.
- Album selection key handling now lets up/down/left/right move between albums; OK enters playback.
- `apps/web-antd/src/views/photo-library/ai-settings/index.vue` now exposes one unified prompt editor instead of separate scoring/comment/classification/layout prompt boxes.
- `apps/backend-api/src/app.service.ts` now recognizes `photo_tv_payload_v1` prompts, asks the model for one complete JSON payload, and normalizes memory score, beauty score, category tags, narration, text color, safe area, anchor, and font hints back into the current stored AI fields.
- `openAlbumDetail` now loads album detail only as a data step and then immediately opens `Player`.
- `MemoryExhibitionPlayer.kt` now has a menu overlay opened from the TV menu key, with playback settings, slideshow, loop, photo info, and return-album options.
- Android debug build passed with `:app:assembleDebug`.
- APK was installed to `emulator-5554` and launched. Logcat showed no fatal crash after startup.
- Current login verification screenshot: `apps/android-tv/build/screenshots/login_1to1_check_v6.png`.
- Current album selection verification screenshot: `apps/android-tv/build/screenshots/album_selection_prompt_ui_v4.png`.
- TV login lifecycle was corrected: after a successful login the app now stores server URL, username, password, and device token; the next launch automatically logs in and enters album selection.
- Login or album-fetch failure now returns to the login screen with the error status instead of leaving the user on a disconnected screen.
- Album selection Back now exits the app directly. Verification showed the foreground activity returns to `com.android.launcher3/.Launcher`.
- Album selection Menu key now opens a logout confirmation dialog. Confirming logout clears device token and saved password while keeping server URL and username for faster re-login.
- Current logout menu verification screenshot: `apps/android-tv/build/screenshots/album_logout_menu_dialog_v2.png`.
- AI fallback narration no longer writes the photo filename into `ai_comment`; fallback text was changed to pure narration text.
- Missing/failed Vision AI calls are no longer marked as completed. Failed AI attempts keep the photo pending, enqueue an in-memory async retry, retry up to 3 times, and then mark AI status failed.
- Manually edited AI narration is now protected by `ai_locked`: later AI refreshes can update scores/tags/layout but cannot overwrite the locked human narration.
- TV album selection now refreshes the album list every 30 seconds while the user stays on the selection screen, so album photo counts and covers can update without restarting the app.
- Backend API build passed with `pnpm -F @wrjdyk/backend-api run build`; web admin Vite build passed through direct `vite build --mode production`.

### Future Plan

- Extend the database/API contract to persist the complete `photo_tv_payload_v1.tv_layout` playback template instead of only normalizing it into the older flat fields.
- Rebuild the player rendering layer so it can consume the full playback template: display mode, safe area, text hierarchy, font family/weight, overlay intensity, and motion hints.
- Connect menu items beyond return/settings to real playback toggles when the playback settings model is finalized.

## 2026-06-11

### Current Modification Goal

- Change single-photo AI recognition so manual refresh reruns Vision AI and overwrites existing AI narration, scores, tags, and layout.
- Persist AI recognition details for debugging, including model return payload, image-send status, errors, and recognition time.
- Fix admin AI narration inline editing so typed text is not reset by table re-rendering.
- Keep the AI pipeline strict: no fallback narration or filename-based text should be persisted when no real Vision AI result is received.
- Tune real Vision AI execution for current model latency: 90-second request timeout and at most 3 concurrent photo recognitions.

### Current Status

- `apps/backend-api/src/sqlite-photo.repository.ts` now stores `ai_detail`, `ai_error`, and `ai_recognized_at` on photos through schema migration 12.
- Single-photo AI refresh now calls `applyPhotoAiInsights(..., { forceOverwriteLockedComment: true })`, clears the manual lock, and overwrites the old AI narration.
- Playback album batch/scheduled AI jobs still preserve manually locked narration by default.
- Vision AI detail now records `imageSent`, `imageSource`, `model`, `provider`, `photoId`, and the raw model JSON, so the admin can confirm whether the photo was sent through `image_url`.
- The AI prompt no longer embeds the base64 720p image into text; the image is sent only through the structured `image_url` payload.
- Photo list and playback-album photo detail both expose an `AI Detail` action and modal.
- Inline AI narration editing in both admin tables now updates the row while typing, then persists on blur.
- Single-photo forced AI refresh now clears the full previous AI result set immediately: narration, recognition status, memory score, beauty score, total score, tags, reason, detail, error, and recognition time. The admin shows empty/pending until a real model response is stored.
- Empty or missing model narration no longer becomes a completed AI narration. It remains empty and pending instead of writing a fallback sentence.
- Vision AI requests now use a 90-second abort timeout. Timeout or request failure enters the existing retry path and does not generate fallback content.
- Backend AI execution is globally limited to 3 concurrent Vision AI requests through the shared `analyzePhotoAiTarget` path, covering manual single-photo refresh, album jobs, scheduled jobs, and retry jobs.
- Feiniu photos with an existing local `ai_720.webp` derivative now reuse that local derivative for AI recognition instead of forcing a remote display-image fetch before analysis.
- Real AI flow verification found that the configured provider can return valid content wrapped in Markdown code fences even when `response_format: json_object` is requested. Backend parsing now extracts JSON from fenced blocks before normalization.
- The normalizer now accepts provider payloads shaped as `priority_tags` plus `caption.text` / `caption.position`, so current model output can still produce tags, narration, scores, and layout position.
- Added `scripts/dev/verify-ai-flow.cjs` for controlled AI verification. It reads local AI settings, masks endpoint/key details, sends a text check, sends one 720p image check, then tests the full prompt and backend normalization.
- Verification passed:
  - `corepack pnpm -F @wrjdyk/backend-api run build`
  - `corepack pnpm -F @wrjdyk/backend-api test -- sqlite-photo.repository.spec.ts`
  - `corepack pnpm -F @vben/web-antd run typecheck`
- Verification passed again after the no-fallback/concurrency changes:
  - `corepack pnpm -F @wrjdyk/backend-api run build`
  - `corepack pnpm -F @wrjdyk/backend-api test -- sqlite-photo.repository.spec.ts`
- Verification passed after fenced-JSON/provider-payload parsing:
  - `corepack pnpm -F @wrjdyk/backend-api run build`
  - `jest src/app.controller.spec.ts --testNamePattern="parses fenced JSON|normalizes provider payloads"`
  - `corepack pnpm -F @wrjdyk/backend-api test -- sqlite-photo.repository.spec.ts`
- Real provider verification before the privacy gate blocked further image sends:
  - Text connectivity returned HTTP 200 in about 59s, but wrapped JSON in a Markdown code fence.
  - Image delivery returned HTTP 200 in about 49s and correctly identified the photo content.
  - Full prompt returned HTTP 200 in about 33s, also as fenced JSON with fields including `memory_score`, `beauty_score`, `priority_tags`, and `caption`.
- Full `app.controller.spec.ts` still has stale failures from older expectations: migration version 11, placeholder AI generation without configured AI, and old prompt-threshold text. These should be updated in a separate test-alignment pass because product behavior now intentionally requires real AI/no fallback.
- Runtime business-flow check:
  - `POST /api/admin/photo-library/photos/feiniu-127678/ai-jobs` returns `queued`.
  - Immediately after refresh, `aiComment`, memory score, beauty score, total score, tags, detail, and error are empty while both AI statuses are `pending`.
  - After waiting past the previous timeout window, no fallback narration was written; the photo stayed empty/pending while waiting for real AI or retry/failure handling.
- Runtime started and verified:
  - `GET http://127.0.0.1:3999/api/health` returns `ok`
  - `GET http://127.0.0.1:5200/` returns `200`

### Future Plan

- Use the new AI detail modal to test real batch/single AI recognition against uploaded photos and verify that `imageSent: true` appears in stored detail after a real model response returns.
- If a model returns fallback or malformed JSON repeatedly, add per-photo failed-state detail review and a manual retry queue view.
- Continue migrating the full `photo_tv_payload_v1.tv_layout` into a richer TV playback template once AI output quality is stable.

## 2026-06-11 AI Progress Queue Follow-up

### Current Modification Goal

- Make all single-photo `刷新 AI` actions and playback-album `补全 AI` actions visible through a shared AI recognition progress list.
- Avoid long blocking waits in the admin UI when a Vision AI request takes 20-90 seconds.
- Show queued/running/completed/failed task state from the backend so users can understand whether AI is actually working.

### Current Status

- Backend now exposes `GET /api/admin/photo-library/ai-tasks` for the latest in-memory AI recognition tasks.
- Single-photo AI refresh already enqueues a background task and records progress by photo.
- Playback-album `补全 AI` now returns `queued` immediately and continues in the background instead of waiting for the full batch to finish.
- Playback-album batch progress is registered as soon as the task starts, then updates requested/completed/skipped/failed counts as work proceeds.
- Admin photo list and playback-album pages both include an `AI 进度` button and shared progress modal.
- Clicking single-photo `刷新 AI` now opens `AI 进度` and shows a queued/running task instead of displaying a misleading completed message.
- Clicking playback-album `补全 AI` now opens `AI 进度` and reports that the task has entered the queue.
- Runtime status after restart:
  - `3999` backend is listening.
  - `5200` admin frontend is listening.
  - `GET /api/health` returns `ok`.
  - `GET /api/admin/photo-library/ai-tasks` returns a valid task list response.
- Verification passed:
  - `pnpm -F @wrjdyk/backend-api run build`
  - `pnpm -F @vben/web-antd run typecheck`

### Remaining Verification / Future Plan

- Full `app.controller.spec.ts` still contains stale synchronous-AI expectations. It should be updated in a focused test-alignment pass to expect queued jobs plus progress-list completion instead of synchronous album AI completion.
- Real button click testing with uploaded photos should be done after explicit approval to send selected 720p photo derivatives to the configured external Vision AI provider.
- Persist AI task progress to SQLite if task history must survive backend restarts; the current progress list is intentionally in-memory.

## 2026-06-11 AI Detail Normalization Follow-up

### Current Modification Goal

- Fix the case where a real single-photo AI task appears completed in the progress list but the admin AI detail/list fields show empty or stale fallback-like values.
- Preserve the no-fallback rule: if the model returns no usable AI content, keep fields empty; if raw AI content exists, parse it instead of inventing narration.

### Current Status

- Root cause confirmed through `IMG_0251`: the provider did send image content and returned `ai_detail.raw`, but the payload shape used nested `analysis` / `ai_analysis` objects while older flattening logic only read top-level fields.
- Backend normalization now accepts:
  - `analysis.memory_score`, `analysis.beauty_score`, `analysis.tags`, `analysis.caption_candidates`
  - `ai_analysis.memory_score`, `ai_analysis.beauty_score`, `ai_analysis.tags`, `ai_analysis.caption`
  - `push_decision.push_reason` when present
- Admin photo list and playback-album AI detail openers now re-fetch the latest photo row by `photoId` before opening the modal, avoiding stale table-row data.
- Repository row mapping now projects saved `ai_detail.raw` into list fields when flattened AI fields are incomplete, so historical valid raw AI responses can display scores/tags/narration without another external AI call.
- UI labels changed from `刷新 AI` to `重新识别`.
- Runtime check after backend restart:
  - `GET /api/health` returns `ok`.
  - `GET /api/admin/photo-library/photos?keyword=IMG_0251&page=1&pageSize=5` now returns `aiCompleted: true`, memory score `92`, beauty score `85`, total score `90`, tags `人物/儿童/家庭/微笑`, and a non-empty AI narration projected from stored raw AI output.

### Verification

- `node .corepack\v1\corepack-38860-caa8a703.44c13\bin\pnpm.cjs -F @wrjdyk/backend-api run build`
- `node ...\jest\bin\jest.js app.controller.spec.ts --runInBand -t "normalizes nested analysis"`
- `node ...\jest\bin\jest.js app.controller.spec.ts --runInBand -t "normalizes ai_analysis"`
- `node ...\jest\bin\jest.js sqlite-photo.repository.spec.ts --runInBand -t "projects legacy AI detail"`
- `node .corepack\v1\corepack-38860-caa8a703.44c13\bin\pnpm.cjs -F @vben/web-antd run typecheck`

### Remaining Verification / Future Plan

- Re-click one photo's `重新识别` in the admin after the restart to verify a fresh external Vision AI response stores flattened fields correctly, not only projected historical raw fields.
- Align stale full-controller tests with current queued/no-fallback AI behavior in a separate focused pass.
