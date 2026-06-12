# 往日重现 Android TV

`apps/android-tv` 是项目的正式 Android TV APK。它使用 Kotlin + Compose for TV 实现原生照片播放器，不以 WebView 作为主播放层。

当前阶段目标：

1. 建立 Android TV 工程骨架。
2. 实现后台地址配置和健康检查。
3. 接入设备账号登录、图包选择和原生照片播放器。
4. 接入远程升级检查、APK 下载、校验和系统安装唤起。

本地构建建议使用 JDK 17、Android SDK 和仓库内 Gradle Wrapper：

```powershell
$env:JAVA_HOME='F:\Java\OpenJDK17U-jdk_x64_windows_hotspot_17.0.19_10\jdk-17.0.19+10'
$env:ANDROID_HOME='F:\Android\Sdk'
$env:ANDROID_SDK_ROOT='F:\Android\Sdk'
$env:GRADLE_USER_HOME='F:\xinxiangmu\jdyk\.gradle-android-home-update'
.\gradlew.bat :app:assembleDebug
```

## 远程升级

TV 端会请求当前登录后台的更新接口：

```text
GET /api/device/app-update/latest
```

后台通过环境变量返回最新 APK manifest：

- `WRJDYK_TV_UPDATE_VERSION_CODE`
- `WRJDYK_TV_UPDATE_VERSION_NAME`
- `WRJDYK_TV_UPDATE_APK_URL`
- `WRJDYK_TV_UPDATE_SHA256`
- `WRJDYK_TV_UPDATE_SIZE_BYTES`
- `WRJDYK_TV_UPDATE_FORCE`
- `WRJDYK_TV_UPDATE_NOTES`
- `WRJDYK_TV_UPDATE_PUBLISHED_AT`

TV 端规则：

- `versionCode` 大于当前 APK 才提示升级。
- 下载到 App 私有 `updates/` 目录。
- 如果配置了 `sizeBytes` 或 `sha256`，下载后必须校验通过。
- 通过 `FileProvider` 授权给系统安装器安装。
- 播放设置菜单中的“检查更新”可手动触发。

## Version 1.0.1

- `versionCode`: `6`
- `versionName`: `1.0.1`
- Update manifest:
  `http://<Feiniu-IP>:3999/api/device/app-update/latest`
- Primary APK:
  `http://<Feiniu-IP>:3999/releases/wangri-tv-1.0.1.apk`
- Backup release:
  `https://github.com/zsdd2/jdyk/releases/tag/tv-v1.0.1`

The production APK must be built by the Android TV release workflow with the
four `ANDROID_TV_*` signing secrets. Do not publish
`app-release-unsigned.apk`.
