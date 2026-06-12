# 发布办法

本文记录管理端、后端 Docker 镜像和 Android TV APK 的标准发布流程。命令均在仓库根目录执行，除非特别说明。

## 1. 发布前准备

- 工作分支已合并到 `main`，且 `git status --short` 为空。
- Node.js、Corepack、Docker、GitHub CLI 可用。
- Android TV 本地构建使用 JDK 17 和 Android SDK。
- `apps/android-tv/gradlew`、`gradlew.bat` 和 `gradle/wrapper/*` 必须被 Git 跟踪；GitHub Runner 使用 Linux 版 `gradlew`。
- 正式 TV APK 必须使用历史发布使用的同一套签名证书。已有设备安装过正式版时，不得临时生成新证书替代。

GitHub 仓库需要一次性配置以下 Actions Secrets：

- `ANDROID_TV_KEYSTORE_BASE64`
- `ANDROID_TV_KEYSTORE_PASSWORD`
- `ANDROID_TV_KEY_ALIAS`
- `ANDROID_TV_KEY_PASSWORD`

可用 PowerShell 生成 keystore 的 Base64 文件，再把文件内容保存为 Secret：

```powershell
[Convert]::ToBase64String(
  [IO.File]::ReadAllBytes('D:\secure\android-tv-release.keystore')
) | Set-Content -NoNewline -Encoding ascii android-tv-keystore.base64.txt
```

不要提交 keystore、Base64 文件或密码。

## 2. 修改版本号

### 管理端和后端镜像

修改 `.github/workflows/ghcr-images.yml` 中的固定镜像标签：

```yaml
type=raw,value=1.0.5
```

`main` 分支发布时会同时更新 `latest`。版本标签用于回滚，`latest` 用于飞牛日常更新。

### Android TV

在 `apps/android-tv/app/build.gradle` 中同时递增：

```groovy
versionCode 7
versionName '1.0.2'
```

然后同步以下文件中的远程更新默认值和说明：

- `docker-compose.feiniu.yml`
- `docker-compose.latest.yml`
- `.env.feiniu.example`
- `apps/android-tv/README.md`
- `docs/FEINIU_DEPLOYMENT.md`

TV 标签格式固定为 `tv-v<versionName>`，例如 `tv-v1.0.2`。

## 3. 本地验证

### 后端和管理端

根据改动范围运行定向测试，然后至少执行：

```powershell
corepack pnpm -F @wrjdyk/backend-api run build
corepack pnpm -F @vben/web-antd run typecheck
apps\web-antd\node_modules\.bin\vite.CMD build --mode production
node --test scripts/android-tv/generate-update-manifest.test.mjs
docker compose -f docker-compose.feiniu.yml config
docker compose -f docker-compose.latest.yml config
```

### Android TV

```powershell
$env:JAVA_HOME='F:\Java\OpenJDK17U-jdk_x64_windows_hotspot_17.0.19_10\jdk-17.0.19+10'
$env:ANDROID_HOME='F:\Android\Sdk'
$env:ANDROID_SDK_ROOT='F:\Android\Sdk'
$env:ANDROID_USER_HOME="$PWD\.android-home"
$env:GRADLE_USER_HOME="$PWD\.gradle-android-home-update"
Set-Location apps\android-tv
.\gradlew.bat :app:assembleDebug --no-daemon
.\gradlew.bat :app:assembleRelease --no-daemon
Set-Location ..\..
```

没有提供 `ANDROID_TV_*` 签名变量时，Release 构建只会生成：

```text
apps/android-tv/app/build/outputs/apk/release/app-release-unsigned.apk
```

该文件只能证明 Release 构建通过，不得发布或用于远程升级。

## 4. 发布 GHCR 镜像

提交并推送 `main`：

```powershell
git add <本次修改文件>
git commit -m "Release <version>"
git push origin main
```

`.github/workflows/ghcr-images.yml` 会并行构建并推送：

- `ghcr.io/zsdd2/jdyk-admin:<version>`
- `ghcr.io/zsdd2/jdyk-admin:latest`
- `ghcr.io/zsdd2/jdyk-backend:<version>`
- `ghcr.io/zsdd2/jdyk-backend:latest`

每个镜像都必须包含 `linux/amd64` 和 `linux/arm64`。Actions 成功后执行匿名拉取验证：

```powershell
docker manifest inspect ghcr.io/zsdd2/jdyk-admin:latest
docker manifest inspect ghcr.io/zsdd2/jdyk-backend:latest
docker manifest inspect ghcr.io/zsdd2/jdyk-admin:<version>
docker manifest inspect ghcr.io/zsdd2/jdyk-backend:<version>
```

不能只看 Actions 绿色状态；匿名 `docker manifest inspect` 成功才能确认 GHCR 包已公开且飞牛可拉取。

## 5. 发布 Android TV

先确认四个签名 Secret 已配置，再创建并推送标签：

```powershell
git tag tv-v1.0.2
git push origin tv-v1.0.2
```

`.github/workflows/android-tv-release.yml` 将执行：

1. 恢复正式 keystore。
2. 使用 JDK 17 构建签名 Release APK。
3. 用 `apksigner` 验证签名。
4. 生成 `latest.json` 和 `feiniu-update.env`。
5. 创建或更新 GitHub Release。

Release 必须包含：

- `wangri-tv-<versionName>.apk`
- `latest.json`
- `feiniu-update.env`

如果工作流停在 `Validate signing secrets`，说明缺少 Secret，不是代码编译失败。补齐 Secret 后重新运行该工作流即可。

## 6. 部署到飞牛并启用远程更新

在 `/vol1/1000/docker/jdyk` 中执行：

```sh
docker compose --env-file .env.feiniu -f docker-compose.feiniu.yml pull
docker compose --env-file .env.feiniu -f docker-compose.feiniu.yml up -d --force-recreate
```

下载正式签名 APK：

```sh
curl -fL \
  -o data/releases/wangri-tv-1.0.2.apk \
  https://github.com/zsdd2/jdyk/releases/download/tv-v1.0.2/wangri-tv-1.0.2.apk
```

将 Release 中 `latest.json` 对应的值写入 `.env.feiniu`：

- `WRJDYK_TV_UPDATE_VERSION_CODE`
- `WRJDYK_TV_UPDATE_VERSION_NAME`
- `WRJDYK_TV_UPDATE_SHA256`
- `WRJDYK_TV_UPDATE_SIZE_BYTES`
- `WRJDYK_TV_UPDATE_FORCE`
- `WRJDYK_TV_UPDATE_NOTES`
- `WRJDYK_TV_UPDATE_PUBLISHED_AT`

`WRJDYK_TV_UPDATE_APK_URL` 保持为空，后端会根据电视实际访问的飞牛地址动态生成本地 APK URL，不需要配置固定飞牛 IP。

修改环境变量后再次执行 `up -d --force-recreate`，否则旧容器不会读取新值。

## 7. 发布后验证

```sh
docker compose --env-file .env.feiniu -f docker-compose.feiniu.yml ps
curl -f http://127.0.0.1:3999/api/health
curl -f http://127.0.0.1:5200/healthz
curl -f http://127.0.0.1:5200/api/health
curl -f http://127.0.0.1:3999/api/device/app-update/latest
curl -I http://127.0.0.1:3999/releases/wangri-tv-1.0.2.apk
sha256sum data/releases/wangri-tv-1.0.2.apk
```

确认更新接口中的 `versionCode`、`versionName`、`sha256` 和 `sizeBytes` 与 GitHub Release 一致。最后由电视端“检查更新”验证下载、校验和系统安装唤起。

## 8. 常见问题

### 飞牛拉不到新的 `latest`

`latest` 是可移动标签，必须重新拉取并重建容器：

```sh
docker compose --env-file .env.feiniu -f docker-compose.feiniu.yml pull
docker compose --env-file .env.feiniu -f docker-compose.feiniu.yml up -d --force-recreate
```

### ARM64 构建较慢

GHCR 使用 QEMU 构建 `linux/arm64`，通常明显慢于 `amd64`。只要 Actions 任务仍在运行且没有错误，就继续等待，不要重复触发发布。

### TV APK 能编译但 Release 发布失败

先看失败步骤。`Validate signing secrets` 失败表示签名配置缺失；`assembleRelease` 失败才是编译或资源问题。未签名 APK 不能替代正式产物。

如果日志显示 `chmod: cannot access 'gradlew'`，说明 Unix Gradle Wrapper 没有被提交。执行 `gradlew.bat wrapper` 生成标准脚本，将 `gradlew`、`gradlew.bat` 和 `gradle/wrapper/*` 一并提交，并确认 `gradlew` 具有可执行位。

### 回滚镜像

临时把 Compose 中的 `latest` 改为已验证的历史版本标签，重新执行 `pull` 和 `up -d --force-recreate`。数据库、缓存和 APK 位于挂载目录，不会因容器重建而删除。
