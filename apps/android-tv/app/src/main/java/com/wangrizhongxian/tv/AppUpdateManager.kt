package com.wangrizhongxian.tv

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.FileProvider
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.security.MessageDigest
import java.util.Locale

data class TvAppUpdateInfo(
  val apkUrl: String,
  val forceUpdate: Boolean,
  val publishedAt: String,
  val releaseNotes: String,
  val sha256: String,
  val sizeBytes: Long,
  val versionCode: Int,
  val versionName: String,
) {
  fun hasNewVersion(): Boolean {
    if (apkUrl.isBlank()) return false
    return if (versionCode > 0) {
      versionCode > BuildConfig.VERSION_CODE
    } else {
      normalizedVersionCode(versionName) > normalizedVersionCode(BuildConfig.VERSION_NAME)
    }
  }
}

object AppUpdateManager {
  private const val updatePath = "api/device/app-update/latest"
  private const val bufferSize = 8192

  suspend fun fetchLatest(serverUrl: String, client: OkHttpClient): Result<TvAppUpdateInfo?> =
    withContext(Dispatchers.IO) {
      runCatching {
        val request = Request.Builder()
          .url(resolveUrl(serverUrl, updatePath))
          .get()
          .build()
        client.newCall(request).execute().use { response ->
          if (!response.isSuccessful) {
            throw IllegalStateException("更新检测失败: HTTP ${response.code}")
          }
          val body = response.body?.string().orEmpty()
          val root = JSONObject(body)
          val data = root.optJSONObject("data") ?: JSONObject()
          TvAppUpdateInfo(
            apkUrl = data.optString("apkUrl").trim(),
            forceUpdate = data.optBoolean("forceUpdate", false),
            publishedAt = data.optString("publishedAt").trim(),
            releaseNotes = data.optString("releaseNotes").trim(),
            sha256 = data.optString("sha256").trim(),
            sizeBytes = data.optLong("sizeBytes", 0L).coerceAtLeast(0L),
            versionCode = data.optInt("versionCode", 0).coerceAtLeast(0),
            versionName = data.optString("versionName").trim(),
          ).takeIf { it.hasNewVersion() }
        }
      }
    }

  suspend fun downloadApk(
    context: Context,
    info: TvAppUpdateInfo,
    client: OkHttpClient,
    onProgress: (Int) -> Unit,
  ): Result<File> = withContext(Dispatchers.IO) {
    runCatching {
      onProgress(0)
      val apkFile = updateApkFile(context, info.versionName)
      val tmpFile = File(apkFile.absolutePath + ".tmp")
      if (tmpFile.exists()) tmpFile.delete()

      val request = Request.Builder().url(info.apkUrl).get().build()
      client.newCall(request).execute().use { response ->
        if (!response.isSuccessful) {
          throw IllegalStateException("更新包下载失败: HTTP ${response.code}")
        }
        val body = response.body ?: throw IllegalStateException("更新包为空")
        val total = body.contentLength().takeIf { it > 0 } ?: info.sizeBytes
        body.byteStream().use { input ->
          FileOutputStream(tmpFile).use { output ->
            val buffer = ByteArray(bufferSize)
            var downloaded = 0L
            while (true) {
              val read = input.read(buffer)
              if (read == -1) break
              output.write(buffer, 0, read)
              downloaded += read
              if (total > 0) {
                onProgress(((downloaded * 100) / total).toInt().coerceIn(0, 99))
              }
            }
            output.flush()
          }
        }
      }

      if (info.sizeBytes > 0 && tmpFile.length() != info.sizeBytes) {
        tmpFile.delete()
        throw IllegalStateException("更新包大小校验失败")
      }
      if (info.sha256.isNotBlank() && sha256(tmpFile) != info.sha256.lowercase(Locale.ROOT)) {
        tmpFile.delete()
        throw IllegalStateException("更新包 SHA256 校验失败")
      }

      if (apkFile.exists()) apkFile.delete()
      if (!tmpFile.renameTo(apkFile)) {
        tmpFile.delete()
        throw IllegalStateException("更新包保存失败")
      }
      onProgress(100)
      apkFile
    }
  }

  fun canRequestPackageInstalls(activity: Activity): Boolean {
    return Build.VERSION.SDK_INT < Build.VERSION_CODES.O ||
      activity.packageManager.canRequestPackageInstalls()
  }

  internal fun shouldBlockDownloadForInstallPermission(sdkInt: Int): Boolean = false

  internal fun installIntentActionForSdk(sdkInt: Int): String {
    return if (sdkInt >= Build.VERSION_CODES.N) {
      Intent.ACTION_INSTALL_PACKAGE
    } else {
      Intent.ACTION_VIEW
    }
  }

  fun openInstallPermission(activity: Activity) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val intent = Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES).apply {
        data = Uri.parse("package:${activity.packageName}")
      }
      try {
        activity.startActivity(intent)
      } catch (_: ActivityNotFoundException) {
        activity.startActivity(Intent(Settings.ACTION_SECURITY_SETTINGS))
      }
    }
  }

  fun launchInstall(activity: Activity, apkFile: File): Result<Unit> = runCatching {
    if (!apkFile.exists()) throw IllegalStateException("更新包不存在")
    val apkUri = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
      FileProvider.getUriForFile(activity, "${activity.packageName}.fileprovider", apkFile)
    } else {
      Uri.fromFile(apkFile)
    }
    val intent = Intent(installIntentActionForSdk(Build.VERSION.SDK_INT)).apply {
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
      if (action == Intent.ACTION_INSTALL_PACKAGE) {
        data = apkUri
        putExtra(Intent.EXTRA_NOT_UNKNOWN_SOURCE, true)
        putExtra(Intent.EXTRA_RETURN_RESULT, true)
      } else {
        setDataAndType(apkUri, "application/vnd.android.package-archive")
      }
    }
    try {
      activity.startActivity(intent)
    } catch (_: ActivityNotFoundException) {
      val fallbackIntent = Intent(Intent.ACTION_VIEW).apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        setDataAndType(apkUri, "application/vnd.android.package-archive")
      }
      activity.startActivity(fallbackIntent)
    }
  }

  private fun updateApkFile(context: Context, versionName: String): File {
    val baseDir = context.getExternalFilesDir(null) ?: context.filesDir
    val dir = File(baseDir, "updates")
    if (!dir.exists()) dir.mkdirs()
    val safeVersionName = versionName.ifBlank { "latest" }.replace(Regex("[^A-Za-z0-9._-]"), "_")
    return File(dir, "wangri-tv-$safeVersionName.apk")
  }

  private fun resolveUrl(serverUrl: String, path: String): String {
    val base = serverUrl.trim().trimEnd('/')
    return "$base/$path"
  }

  private fun sha256(file: File): String {
    val digest = MessageDigest.getInstance("SHA-256")
    file.inputStream().use { input ->
      val buffer = ByteArray(bufferSize)
      while (true) {
        val read = input.read(buffer)
        if (read == -1) break
        digest.update(buffer, 0, read)
      }
    }
    return digest.digest().joinToString("") { "%02x".format(it) }
  }
}

private fun normalizedVersionCode(version: String): Int {
  val parts = version.split('.')
  val major = parts.getOrNull(0).toVersionPart()
  val minor = parts.getOrNull(1).toVersionPart()
  val patch = parts.getOrNull(2).toVersionPart()
  return major * 10_000 + minor * 100 + patch
}

private fun String?.toVersionPart(): Int {
  return this?.replace(Regex("[^0-9]"), "")?.toIntOrNull() ?: 0
}
