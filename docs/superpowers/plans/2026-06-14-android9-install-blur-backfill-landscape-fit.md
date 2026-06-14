# Android 9 Install, Blur Backfill, and Landscape Fit Plan

**Goal:** Make Android 9 updates reliably open the system installer, let manual playback-album scans migrate legacy TV derivatives to `tv_blur_fill.webp`, and keep landscape photos fully visible without foreground zoom.

**Approach:** Keep the existing download, derivative generation, and player architecture. Change only the compatibility decisions and completion checks that currently misclassify or transform the requested paths.

## Task 1: Android 9 installation flow

- Update the installer intent regression test to require `ACTION_VIEW` with APK MIME compatibility on Android 9.
- Add a testable permission-return decision so a downloaded APK remains pending until unknown-source permission is granted.
- On lifecycle resume, automatically launch the pending APK after permission is granted.
- Add URI clip data/read permission flags for vendor package installers.

## Task 2: Landscape playback

- Change landscape foreground rendering from `Crop` to `Fit`.
- Add a pure motion helper and tests proving landscape foreground scale/translation stay fixed while portrait layouts retain existing motion.

## Task 3: Blur derivative backfill

- Add a repository check that distinguishes the current `tv_blur_fill.webp` artifact from legacy `tv_4k.webp` rows even when both are marked `ready`.
- Make manual playback-album scan count and regenerate legacy/incomplete derivatives.
- Add a regression test for a legacy-ready row being migrated by an immediate scan.

## Task 4: Verification and release readiness

- Run focused failing tests before implementation, then focused and full backend/Android tests after implementation.
- Build Android Debug and Release APKs.
- Update `PROJECT_DEVELOPMENT.md` with goal, verified status, and remaining real-device checks.
- Review the final diff and repository status before commit/push.
