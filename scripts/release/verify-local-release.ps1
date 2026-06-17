param(
  [string] $ImageVersion = '2.0.4',
  [int] $TvVersionCode = 16,
  [string] $TvVersionName = '2.0.4',
  [string] $JavaHome = 'F:\Java\OpenJDK17U-jdk_x64_windows_hotspot_17.0.19_10\jdk-17.0.19+10',
  [string] $AndroidSdk = 'F:\Android\Sdk'
)

$ErrorActionPreference = 'Stop'
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
Set-Location $repoRoot

function Invoke-Step {
  param(
    [string] $Name,
    [scriptblock] $Script
  )

  Write-Host ""
  Write-Host "==> $Name"
  $global:LASTEXITCODE = 0
  & $Script
  if ($global:LASTEXITCODE -ne 0) {
    throw "Step failed: $Name exited with code $global:LASTEXITCODE"
  }
}

function Assert-FileContains {
  param(
    [string] $Path,
    [string] $Pattern,
    [string] $Message
  )

  if (-not (Select-String -LiteralPath $Path -Pattern $Pattern -Quiet)) {
    throw $Message
  }
}

function Resolve-AndroidReleaseApkPath {
  $releaseApkCandidates = @(
    'apps/android-tv/app/build/outputs/apk/release/app-release.apk',
    'apps/android-tv/app/build/outputs/apk/release/app-release-unsigned.apk'
  )

  foreach ($candidate in $releaseApkCandidates) {
    if (Test-Path -LiteralPath $candidate) {
      return $candidate
    }
  }

  throw 'Android release APK output is missing'
}

function Write-ApkMetadata {
  param(
    [string] $Path
  )

  $item = Get-Item -LiteralPath $Path
  $hash = Get-FileHash -Algorithm SHA256 -LiteralPath $item.FullName
  Write-Host "$($item.FullName)"
  Write-Host "  size=$($item.Length)"
  Write-Host "  sha256=$($hash.Hash)"
}

function Copy-LocalApk {
  param(
    [string] $SourcePath,
    [string] $DestinationName
  )

  $releaseDir = Join-Path $repoRoot 'releases'
  New-Item -ItemType Directory -Force -Path $releaseDir | Out-Null
  $destinationPath = Join-Path $releaseDir $DestinationName
  Copy-Item -LiteralPath $SourcePath -Destination $destinationPath -Force
  Write-ApkMetadata $destinationPath
}

Invoke-Step 'check version surfaces' {
  Assert-FileContains '.github/workflows/ghcr-images.yml' "type=raw,value=$ImageVersion" "GHCR image version is not $ImageVersion"
  Assert-FileContains 'apps/web-antd/.env.production' "VITE_ADMIN_RELEASE_VERSION=$ImageVersion" "Admin app release version is not $ImageVersion"
  Assert-FileContains 'apps/android-tv/app/build.gradle' "versionCode $TvVersionCode" "TV versionCode is not $TvVersionCode"
  Assert-FileContains 'apps/android-tv/app/build.gradle' "versionName '$TvVersionName'" "TV versionName is not $TvVersionName"
  Assert-FileContains 'docker-compose.feiniu.yml' "WRJDYK_TV_UPDATE_VERSION_CODE:-$TvVersionCode" "Compose default TV versionCode is not $TvVersionCode"
  Assert-FileContains 'docker-compose.feiniu.yml' "WRJDYK_TV_UPDATE_VERSION_NAME:-$TvVersionName" "Compose default TV versionName is not $TvVersionName"
  Assert-FileContains 'deploy/nginx.conf' 'client_max_body_size 350m' 'Admin nginx upload body limit must allow Android TV APK uploads'
  Assert-FileContains 'deploy/backend.Dockerfile' '/workspace/apps/backend-api/prompts ./apps/backend-api/prompts' 'Backend image must include editable AI prompt files'
  $promptFiles = @(Get-ChildItem -LiteralPath 'apps/backend-api/prompts' -Filter '*.md' -File)
  $businessPrompt = $promptFiles | Where-Object { $_.Name -like '*Vision*.md' } | Select-Object -First 1
  $contractPrompt = $promptFiles | Where-Object {
    Select-String -LiteralPath $_.FullName -Pattern 'photo_tv_payload_v1' -Quiet
  } | Select-Object -First 1
  if (-not $businessPrompt) {
    throw 'Business vision prompt file is missing'
  }
  if (-not $contractPrompt) {
    throw 'Output contract prompt file is missing'
  }
}

Invoke-Step 'android update manifest tests' {
  node --test scripts/android-tv/generate-update-manifest.test.mjs
}

Invoke-Step 'backend focused tests' {
  Push-Location apps/backend-api
  try {
    .\node_modules\.bin\jest.CMD --runInBand app-access.guard.spec.ts app.controller.spec.ts sqlite-photo.repository.spec.ts
  } finally {
    Pop-Location
  }
}

Invoke-Step 'web focused tests' {
  Push-Location apps/web-antd
  try {
    ..\..\node_modules\.bin\vitest.CMD run src/app-version.spec.ts src/api/core/auth.spec.ts src/api/photo-library-tv-release.spec.ts src/preferences.spec.ts src/router/photo-library-routes.spec.ts
  } finally {
    Pop-Location
  }
}

Invoke-Step 'backend build' {
  corepack pnpm --filter '@wrjdyk/backend-api' run build
}

Invoke-Step 'web typecheck' {
  corepack pnpm --filter '@vben/web-antd' run typecheck
}

Invoke-Step 'web production build' {
  Push-Location apps/web-antd
  try {
    ..\..\node_modules\.bin\vite.CMD build --mode production
  } finally {
    Pop-Location
  }
}

Invoke-Step 'compose config expansion' {
  $dockerConfig = Join-Path $repoRoot '.docker-config'
  New-Item -ItemType Directory -Force -Path $dockerConfig | Out-Null
  $env:DOCKER_CONFIG = $dockerConfig
  docker compose -f docker-compose.feiniu.yml config
  docker compose -f docker-compose.latest.yml config
}

Invoke-Step 'android debug and release build' {
  $env:JAVA_HOME = $JavaHome
  $env:ANDROID_HOME = $AndroidSdk
  $env:ANDROID_SDK_ROOT = $AndroidSdk
  $env:ANDROID_USER_HOME = Join-Path $repoRoot '.android-home'
  $env:GRADLE_USER_HOME = Join-Path $repoRoot '.gradle-android-home-update'
  Remove-Item Env:ANDROID_PREFS_ROOT -ErrorAction SilentlyContinue
  Remove-Item Env:ANDROID_SDK_HOME -ErrorAction SilentlyContinue
  Remove-Item Env:GRADLE_OPTS -ErrorAction SilentlyContinue

  Push-Location apps/android-tv
  try {
    .\gradlew.bat clean testDebugUnitTest :app:assembleDebug :app:assembleRelease --no-daemon
  } finally {
    Pop-Location
  }
}

Invoke-Step 'android APK metadata' {
  $releaseApkPath = Resolve-AndroidReleaseApkPath
  $apkPaths = @(
    'apps/android-tv/app/build/outputs/apk/debug/app-debug.apk',
    $releaseApkPath
  )
  foreach ($apkPath in $apkPaths) {
    Write-ApkMetadata $apkPath
  }

  $buildTools = Get-ChildItem (Join-Path $AndroidSdk 'build-tools') -Directory |
    Sort-Object { [version] $_.Name } -Descending |
    Select-Object -First 1
  $aapt = Join-Path $buildTools.FullName 'aapt.exe'
  & $aapt dump badging $releaseApkPath |
    Select-String -Pattern "versionCode='$TvVersionCode' versionName='$TvVersionName'"
}

Invoke-Step 'local APK copies' {
  $debugApkPath = 'apps/android-tv/app/build/outputs/apk/debug/app-debug.apk'
  $releaseApkPath = Resolve-AndroidReleaseApkPath
  $releaseApkFileName = Split-Path -Leaf $releaseApkPath
  $releaseDestinationName = if ($releaseApkFileName -eq 'app-release.apk') {
    "wangri-tv-$TvVersionName.apk"
  } else {
    "wangri-tv-$TvVersionName-unsigned.apk"
  }

  Copy-LocalApk $debugApkPath "wangri-tv-$TvVersionName-debug.apk"
  Copy-LocalApk $releaseApkPath $releaseDestinationName
}

Write-Host ""
Write-Host "Local release verification finished. Use the GitHub Android TV workflow APK for remote update; do not publish app-release-unsigned.apk."
