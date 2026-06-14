package com.wangrizhongxian.tv

import android.app.Activity
import android.content.Context
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.view.KeyEvent as AndroidKeyEvent
import android.view.View
import androidx.activity.compose.BackHandler
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.clickable
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusProperties
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shadow
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.TextRange
import androidx.compose.ui.text.input.TextFieldValue
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.geometry.Offset
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import androidx.tv.material3.Button
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.Text
import coil3.ImageLoader
import coil3.compose.AsyncImage
import coil3.request.ImageRequest
import coil3.svg.SvgDecoder
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

private suspend fun FocusRequester.requestFocusWhenReady() {
  delay(350)
  withFrameNanos { }
  runCatching { requestFocus() }
}

private val Context.settingsDataStore by preferencesDataStore("wangri_zhongxian_tv")
private val serverUrlKey = stringPreferencesKey("server_url")
private val usernameKey = stringPreferencesKey("username")
private val passwordKey = stringPreferencesKey("password")
private val deviceTokenKey = stringPreferencesKey("device_token")

private const val fallbackServerUrl = "http://192.168.10.188:3999"

private val accent = Color(0xFFD69A45)
private val warmText = Color(0xFFFFF3DF)
private val mutedText = Color(0xA6FFF3DF)
private val softText = Color(0x73FFF3DF)
private val panel = Color(0xCC0B1014)
private val panelSoft = Color(0x9910181E)
private val stroke = Color(0x2EFFF3DF)
private val deepBg = Color(0xFF05090D)

class MainActivity : ComponentActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)

    enterImmersiveMode()
    setContent {
      MaterialTheme {
        TvMemoryApp()
      }
    }
  }

  override fun onWindowFocusChanged(hasFocus: Boolean) {
    super.onWindowFocusChanged(hasFocus)
    if (hasFocus) {
      enterImmersiveMode()
    }
  }

  private fun enterImmersiveMode() {
    @Suppress("DEPRECATION")
    window.decorView.systemUiVisibility = (
      View.SYSTEM_UI_FLAG_FULLSCREEN or
        View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or
        View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY or
        View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or
        View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION or
        View.SYSTEM_UI_FLAG_LAYOUT_STABLE
      )
  }
}

@Composable
private fun TvMemoryApp() {
  val context = LocalContext.current
  val scope = rememberCoroutineScope()
  val httpClient = remember { OkHttpClient() }
  val imageLoader = remember {
    ImageLoader.Builder(context)
      .components { add(SvgDecoder.Factory()) }
      .build()
  }

  var screen by remember { mutableStateOf(TvAppScreen.Login) }
  var serverUrl by remember { mutableStateOf(defaultServerUrl()) }
  var username by remember { mutableStateOf("admin") }
  var password by remember { mutableStateOf("admin123") }
  var deviceToken by remember { mutableStateOf("") }
  var statusText by remember { mutableStateOf("系统已就绪，等待登录") }
  var albums by remember { mutableStateOf<List<TvAlbum>>(emptyList()) }
  var playlistItems by remember { mutableStateOf<List<TvPlaylistItem>>(emptyList()) }
  var selectedAlbumIndex by remember { mutableIntStateOf(0) }
  var selectedQueueIndex by remember { mutableIntStateOf(0) }
  var currentItemIndex by remember { mutableIntStateOf(0) }
  var playbackSessionSeed by remember { mutableIntStateOf(0) }
  var settingsIndex by remember { mutableIntStateOf(0) }
  var scanProgress by remember { mutableIntStateOf(0) }
  var playbackStatusText by remember { mutableStateOf("") }
  var showLogoutDialog by remember { mutableStateOf(false) }
  var updateUiState by remember { mutableStateOf<TvUpdateUiState>(TvUpdateUiState.Idle) }
  var updateCheckedThisSession by remember { mutableStateOf(false) }

  val activeAlbum = albums.getOrNull(selectedAlbumIndex)
  val activePlaylist = activeAlbum?.items ?: playlistItems
  val activeItem = activePlaylist.getOrNull(currentItemIndex)

  fun checkForAppUpdate(manual: Boolean) {
    if (serverUrl.isBlank()) {
      if (manual) updateUiState = TvUpdateUiState.Error("请先配置后台地址")
      return
    }
    scope.launch {
      updateUiState = TvUpdateUiState.Checking(manual)
      val result = AppUpdateManager.fetchLatest(serverUrl, httpClient)
      result.fold(
        onSuccess = { info ->
          if (info != null) {
            updateUiState = TvUpdateUiState.Available(info)
          } else {
            updateUiState = if (manual) {
              TvUpdateUiState.Error("当前已是最新版本")
            } else {
              TvUpdateUiState.Idle
            }
          }
        },
        onFailure = { error ->
          updateUiState = if (manual) {
            TvUpdateUiState.Error(error.message ?: "更新检测失败")
          } else {
            TvUpdateUiState.Idle
          }
        },
      )
    }
  }

  fun startAppUpdateDownload(info: TvAppUpdateInfo) {
    val activity = context as? Activity
    if (activity == null) {
      updateUiState = TvUpdateUiState.Error("无法获取当前窗口")
      return
    }
    if (
      AppUpdateManager.shouldBlockDownloadForInstallPermission(Build.VERSION.SDK_INT) &&
      !AppUpdateManager.canRequestPackageInstalls(activity)
    ) {
      AppUpdateManager.openInstallPermission(activity)
      updateUiState = TvUpdateUiState.Error("请允许本应用安装未知来源应用后重试")
      return
    }

    scope.launch {
      updateUiState = TvUpdateUiState.Downloading(info, 0)
      val result = AppUpdateManager.downloadApk(context, info, httpClient) { progress ->
        scope.launch {
          if (updateUiState is TvUpdateUiState.Downloading) {
            updateUiState = TvUpdateUiState.Downloading(info, progress)
          }
        }
      }
      updateUiState = result.fold(
        onSuccess = { file -> TvUpdateUiState.ReadyToInstall(info, file) },
        onFailure = { error -> TvUpdateUiState.Error(error.message ?: "更新包下载失败") },
      )
    }
  }

  fun installDownloadedUpdate(file: File) {
    val activity = context as? Activity
    if (activity == null) {
      updateUiState = TvUpdateUiState.Error("无法获取当前窗口")
      return
    }
    if (!AppUpdateManager.canRequestPackageInstalls(activity)) {
      AppUpdateManager.openInstallPermission(activity)
      return
    }
    AppUpdateManager.launchInstall(activity, file).onFailure { error ->
      updateUiState = TvUpdateUiState.Error(error.message ?: "无法打开系统安装程序")
    }
  }

  LaunchedEffect(screen) {
    if (screen == TvAppScreen.ScanProgress) {
      scanProgress = 0
      for (value in 0..100 step 5) {
        scanProgress = value
        delay(140)
      }
      screen = TvAppScreen.ScanDone
    }
  }

  fun reportCurrentPlayback(item: TvPlaylistItem, skipped: Boolean = false) {
    scope.launch {
      val result = reportPlayRecord(serverUrl, deviceToken, item, skipped, httpClient)
      playbackStatusText = result.message
    }
  }

  fun connectAndLoad(autoLogin: Boolean = false) {
    val trimmedUrl = serverUrl.trim()
    val trimmedUsername = username.trim()
    val trimmedPassword = password.trim()
    if (trimmedUrl.isBlank() || trimmedUsername.isBlank() || trimmedPassword.isBlank()) {
      statusText = "后端地址、账号和密码不能为空"
      return
    }

    scope.launch {
      screen = TvAppScreen.Connecting
      statusText = "正在连接往日重现后台..."
      context.settingsDataStore.edit { preferences ->
        preferences[serverUrlKey] = trimmedUrl
        preferences[usernameKey] = trimmedUsername
        preferences[passwordKey] = trimmedPassword
      }

      val deviceUniqueId = Settings.Secure.getString(
        context.contentResolver,
        Settings.Secure.ANDROID_ID,
      ).orEmpty().ifBlank { "android_tv_unknown" }
      val loginResult = loginDevice(
        trimmedUrl,
        trimmedUsername,
        trimmedPassword,
        deviceUniqueId,
        httpClient,
      )
      if (!loginResult.ok || loginResult.deviceToken.isBlank()) {
        statusText = loginResult.message
        screen = TvAppScreen.Login
        return@launch
      }

      context.settingsDataStore.edit { preferences ->
        preferences[deviceTokenKey] = loginResult.deviceToken
      }
      deviceToken = loginResult.deviceToken

      val albumsResult = fetchAlbums(trimmedUrl, loginResult.deviceToken, httpClient)
      if (!albumsResult.ok) {
        statusText = albumsResult.message
        playlistItems = emptyList()
        albums = emptyList()
        screen = TvAppScreen.Login
        return@launch
      }

      albums = albumsResult.albums
      playlistItems = albumsResult.albums.flatMap { it.items }
      selectedAlbumIndex = 0
      selectedQueueIndex = 0
      currentItemIndex = 0
      statusText = "Backend connected: ${albumsResult.albums.size} albums"
      screen = if (albumsResult.albums.isEmpty()) TvAppScreen.EmptyAlbums else TvAppScreen.AlbumSelection
      if (!updateCheckedThisSession) {
        updateCheckedThisSession = true
        checkForAppUpdate(manual = false)
      }
    }
  }

  fun logoutToLogin() {
    scope.launch {
      context.settingsDataStore.edit { preferences ->
        preferences.remove(deviceTokenKey)
        preferences.remove(passwordKey)
      }
      deviceToken = ""
      password = ""
      albums = emptyList()
      playlistItems = emptyList()
      selectedAlbumIndex = 0
      selectedQueueIndex = 0
      currentItemIndex = 0
      showLogoutDialog = false
      statusText = "已退出登录，请重新输入密码"
      screen = TvAppScreen.Login
    }
  }

  LaunchedEffect(Unit) {
    val storedSettings = context.settingsDataStore.data.first()
    serverUrl = preferredServerUrl(
      storedServerUrl = storedSettings[serverUrlKey],
      buildDefaultServerUrl = defaultServerUrl(),
    )
    username = storedSettings[usernameKey] ?: username
    password = storedSettings[passwordKey] ?: ""
    deviceToken = storedSettings[deviceTokenKey] ?: ""
    if (serverUrl.isNotBlank() && username.isNotBlank() && password.isNotBlank()) {
      connectAndLoad(autoLogin = true)
    } else if (deviceToken.isNotBlank()) {
      statusText = "已读取登录状态，可选择图包"
    }
  }

  LaunchedEffect(screen, deviceToken, serverUrl) {
    if (screen != TvAppScreen.AlbumSelection || deviceToken.isBlank()) return@LaunchedEffect
    while (true) {
      delay(30_000L)
      val selectedAlbumId = albums.getOrNull(selectedAlbumIndex)?.albumId
      val albumsResult = fetchAlbums(serverUrl, deviceToken, httpClient)
      if (!albumsResult.ok) {
        statusText = albumsResult.message
        continue
      }

      albums = albumsResult.albums
      playlistItems = albumsResult.albums.flatMap { it.items }
      selectedAlbumIndex = albumsResult.albums.indexOfFirst { it.albumId == selectedAlbumId }
        .takeIf { it >= 0 }
        ?: selectedAlbumIndex.coerceAtMost((albumsResult.albums.size - 1).coerceAtLeast(0))
      statusText = "Album list refreshed: ${albumsResult.albums.size} albums"
    }
  }

  fun loadSavedTokenPlaylist() {
    if (deviceToken.isBlank()) {
      statusText = "Connect to backend first"
      return
    }

    scope.launch {
      screen = TvAppScreen.Connecting
      val albumsResult = fetchAlbums(serverUrl, deviceToken, httpClient)
      if (!albumsResult.ok) {
        statusText = albumsResult.message
        screen = TvAppScreen.Disconnected
        return@launch
      }

      albums = albumsResult.albums
      playlistItems = albumsResult.albums.flatMap { it.items }
      selectedAlbumIndex = 0
      selectedQueueIndex = 0
      currentItemIndex = 0
      statusText = "Backend connected: ${albumsResult.albums.size} albums"
      screen = if (albumsResult.albums.isEmpty()) TvAppScreen.EmptyAlbums else TvAppScreen.AlbumSelection
      if (!updateCheckedThisSession) {
        updateCheckedThisSession = true
        checkForAppUpdate(manual = false)
      }
    }
  }

  fun openAlbumDetail(index: Int) {
    val album = albums.getOrNull(index) ?: return
    selectedAlbumIndex = index
    selectedQueueIndex = 0
    currentItemIndex = 0

    if (album.items.isNotEmpty()) {
      playbackStatusText = "Playing: ${album.title}"
      playbackSessionSeed = playbackSessionSeed.nextPlaybackSessionSeed()
      screen = TvAppScreen.Player
      reportCurrentPlayback(album.items.first())
      return
    }

    scope.launch {
      screen = TvAppScreen.Connecting
      val detailResult = fetchAlbumDetail(serverUrl, deviceToken, album.albumId, httpClient)
      if (!detailResult.ok || detailResult.album == null) {
        statusText = detailResult.message
        screen = TvAppScreen.Disconnected
        return@launch
      }

      albums = albums.map { currentAlbum ->
        if (currentAlbum.albumId == detailResult.album.albumId) detailResult.album else currentAlbum
      }
      playlistItems = albums.flatMap { it.items }
      statusText = "Album loaded: ${detailResult.album.title}, ${detailResult.album.items.size} photos"
      if (detailResult.album.items.isEmpty()) {
        screen = TvAppScreen.EmptyPlaylist
      } else {
        playbackStatusText = "Playing: ${detailResult.album.title}"
        playbackSessionSeed = playbackSessionSeed.nextPlaybackSessionSeed()
        screen = TvAppScreen.Player
        reportCurrentPlayback(detailResult.album.items.first())
      }
    }
  }

  fun startActiveAlbum() {
    val album = activeAlbum ?: return
    if (album.items.isEmpty()) {
      screen = TvAppScreen.EmptyPlaylist
      return
    }

    currentItemIndex = 0
    selectedQueueIndex = 0
    playbackStatusText = "Playing: ${album.title}"
    playbackSessionSeed = playbackSessionSeed.nextPlaybackSessionSeed()
    screen = TvAppScreen.Player
    reportCurrentPlayback(album.items.first())
  }

  fun showNextItem(skipped: Boolean) {
    if (activePlaylist.isEmpty()) return
    currentItemIndex = (currentItemIndex + 1) % activePlaylist.size
    selectedQueueIndex = currentItemIndex
    reportCurrentPlayback(activePlaylist[currentItemIndex], skipped)
  }

  fun showPreviousItem() {
    if (activePlaylist.isEmpty()) return
    currentItemIndex = if (currentItemIndex == 0) activePlaylist.lastIndex else currentItemIndex - 1
    selectedQueueIndex = currentItemIndex
    reportCurrentPlayback(activePlaylist[currentItemIndex], skipped = true)
  }

  fun openQueueAtCurrent() {
    selectedQueueIndex = currentItemIndex
    screen = TvAppScreen.Queue
  }

  BackHandler(enabled = screen != TvAppScreen.Login) {
    screen = when (screen) {
      TvAppScreen.AlbumDetail -> TvAppScreen.AlbumSelection
      TvAppScreen.AlbumSelection -> {
        (context as? Activity)?.finish()
        TvAppScreen.AlbumSelection
      }
      TvAppScreen.Connecting -> TvAppScreen.Login
      TvAppScreen.Disconnected -> TvAppScreen.Login
      TvAppScreen.EmptyAlbums -> TvAppScreen.Login
      TvAppScreen.EmptyPlaylist -> TvAppScreen.AlbumSelection
      TvAppScreen.Help -> if (albums.isEmpty()) TvAppScreen.Login else TvAppScreen.AlbumSelection
      TvAppScreen.Player -> TvAppScreen.AlbumSelection
      TvAppScreen.Queue -> TvAppScreen.Player
      TvAppScreen.ScanDone -> TvAppScreen.AlbumSelection
      TvAppScreen.ScanProgress -> TvAppScreen.AlbumSelection
      TvAppScreen.Settings -> TvAppScreen.Player
      TvAppScreen.SystemInfo -> if (albums.isEmpty()) TvAppScreen.Login else TvAppScreen.AlbumSelection
      TvAppScreen.Login -> TvAppScreen.Login
    }
  }

  when (screen) {
    TvAppScreen.Login -> TvBackendLoginScreen(
      deviceToken = deviceToken,
      onConnect = { connectAndLoad() },
      onPasswordChange = { password = it },
      onServerUrlChange = { serverUrl = it },
      onSystemInfo = { screen = TvAppScreen.SystemInfo },
      onUseSavedToken = ::loadSavedTokenPlaylist,
      onUsernameChange = { username = it },
      password = password,
      serverUrl = serverUrl,
      statusText = statusText,
      username = username,
    )

    TvAppScreen.Connecting -> TvConnectingScreen(serverUrl = serverUrl)

    TvAppScreen.AlbumSelection -> TvAlbumSelectionScreen(
      albums = albums,
      imageLoader = imageLoader,
      onBack = { (context as? Activity)?.finish() },
      onHelp = { screen = TvAppScreen.Help },
      onLogout = { showLogoutDialog = true },
      onOpenSystem = { screen = TvAppScreen.SystemInfo },
      onSelectAlbum = ::openAlbumDetail,
      selectedIndex = selectedAlbumIndex,
      setSelectedIndex = { selectedAlbumIndex = it },
    )

    TvAppScreen.AlbumDetail -> activeAlbum?.let { album ->
      TvAlbumDetailScreen(
        album = album,
        imageLoader = imageLoader,
        onBack = { screen = TvAppScreen.AlbumSelection },
        onOpenSettings = {
          settingsIndex = 0
          screen = TvAppScreen.Settings
        },
        onStart = ::startActiveAlbum,
      )
    } ?: TvEmptyAlbumScreen(
      copy = emptyStateCopy(TvEmptyStateKind.Playlist),
      onBack = { screen = TvAppScreen.AlbumSelection },
      onRetry = ::loadSavedTokenPlaylist,
    )

    TvAppScreen.Player -> activeItem?.let { item ->
      TvPhotoPlayerScreen(
        currentIndex = currentItemIndex,
        imageLoader = imageLoader,
        item = item,
        itemCount = activePlaylist.size,
        items = activePlaylist,
        onAutoNext = { showNextItem(skipped = false) },
        onBack = { screen = TvAppScreen.AlbumSelection },
        onNext = { showNextItem(skipped = true) },
        onOpenQueue = ::openQueueAtCurrent,
        onOpenSettings = {
          settingsIndex = 0
          screen = TvAppScreen.Settings
        },
        onPrevious = ::showPreviousItem,
        playbackSessionSeed = playbackSessionSeed,
        playbackStatusText = playbackStatusText,
      )
    } ?: TvEmptyAlbumScreen(
      copy = emptyStateCopy(TvEmptyStateKind.Playlist),
      onBack = { screen = TvAppScreen.AlbumSelection },
      onRetry = ::loadSavedTokenPlaylist,
    )

    TvAppScreen.Settings -> TvPlaybackSettingsScreen(
      album = activeAlbum,
      imageLoader = imageLoader,
      onBack = { screen = TvAppScreen.Player },
      onCheckUpdate = { checkForAppUpdate(manual = true) },
      onOpenScan = { screen = TvAppScreen.ScanProgress },
      selectedIndex = settingsIndex,
      setSelectedIndex = { settingsIndex = it },
    )

    TvAppScreen.Queue -> TvQueueScreen(
      imageLoader = imageLoader,
      items = activePlaylist,
      onBack = { screen = TvAppScreen.Player },
      onConfirm = {
        currentItemIndex = selectedQueueIndex
        reportCurrentPlayback(activePlaylist[currentItemIndex], skipped = true)
        screen = TvAppScreen.Player
      },
      selectedIndex = selectedQueueIndex,
      setSelectedIndex = { selectedQueueIndex = it },
    )

    TvAppScreen.SystemInfo -> TvSystemInfoScreen(
      deviceToken = deviceToken,
      onBack = { screen = if (albums.isEmpty()) TvAppScreen.Login else TvAppScreen.AlbumSelection },
      onHelp = { screen = TvAppScreen.Help },
      serverUrl = serverUrl,
    )

    TvAppScreen.ScanProgress -> TvScanProgressScreen(progress = scanProgress)

    TvAppScreen.ScanDone -> TvScanDoneScreen(
      count = playlistItems.size,
      onConfirm = { screen = TvAppScreen.AlbumSelection },
    )

    TvAppScreen.Disconnected -> TvDisconnectedScreen(
      detail = statusText,
      onBack = { screen = TvAppScreen.Login },
      onRetry = { connectAndLoad() },
    )

    TvAppScreen.Help -> TvHelpScreen(
      onBack = { screen = if (albums.isEmpty()) TvAppScreen.Login else TvAppScreen.AlbumSelection },
    )

    TvAppScreen.EmptyAlbums -> TvEmptyAlbumScreen(
      copy = emptyStateCopy(TvEmptyStateKind.Albums),
      onBack = { screen = TvAppScreen.Login },
      onRetry = ::loadSavedTokenPlaylist,
    )

    TvAppScreen.EmptyPlaylist -> TvEmptyAlbumScreen(
      copy = emptyStateCopy(TvEmptyStateKind.Playlist),
      onBack = { screen = TvAppScreen.AlbumSelection },
      onRetry = { openAlbumDetail(selectedAlbumIndex) },
    )
  }

  if (showLogoutDialog) {
    TvLogoutDialog(
      onCancel = { showLogoutDialog = false },
      onConfirm = ::logoutToLogin,
    )
  }

  if (updateUiState != TvUpdateUiState.Idle) {
    TvUpdateDialog(
      onCancel = {
        val current = updateUiState
        if ((current as? TvUpdateUiState.Available)?.info?.forceUpdate == true) {
          (context as? Activity)?.finish()
        } else {
          updateUiState = TvUpdateUiState.Idle
        }
      },
      onDismissError = { updateUiState = TvUpdateUiState.Idle },
      onDownload = ::startAppUpdateDownload,
      onInstall = ::installDownloadedUpdate,
      state = updateUiState,
    )
  }
}

@Composable
private fun TvUpdateDialog(
  onCancel: () -> Unit,
  onDismissError: () -> Unit,
  onDownload: (TvAppUpdateInfo) -> Unit,
  onInstall: (File) -> Unit,
  state: TvUpdateUiState,
) {
  val focusRequester = remember { FocusRequester() }
  var selectedIndex by remember(state) { mutableIntStateOf(0) }

  LaunchedEffect(state) {
    focusRequester.requestFocusWhenReady()
  }

  Box(
    modifier = Modifier
      .fillMaxSize()
      .background(Color.Black.copy(alpha = 0.64f))
      .focusRequester(focusRequester)
      .onPreviewKeyEvent { event ->
        if (event.type != KeyEventType.KeyUp) return@onPreviewKeyEvent false
        when (state) {
          is TvUpdateUiState.Checking, is TvUpdateUiState.Downloading -> {
            event.key == Key.Back
          }
          is TvUpdateUiState.Error -> {
            if (event.key == Key.DirectionCenter || event.key == Key.Enter || event.key == Key.Back) {
              onDismissError()
              true
            } else {
              false
            }
          }
          is TvUpdateUiState.Available -> when (event.key) {
            Key.DirectionLeft, Key.DirectionRight -> {
              selectedIndex = 1 - selectedIndex
              true
            }
            Key.DirectionCenter, Key.Enter -> {
              if (selectedIndex == 0) onDownload(state.info) else onCancel()
              true
            }
            Key.Back -> {
              onCancel()
              true
            }
            else -> false
          }
          TvUpdateUiState.Idle -> false
          is TvUpdateUiState.ReadyToInstall -> when (event.key) {
            Key.DirectionLeft, Key.DirectionRight -> {
              selectedIndex = 1 - selectedIndex
              true
            }
            Key.DirectionCenter, Key.Enter -> {
              if (selectedIndex == 0) onInstall(state.file) else onCancel()
              true
            }
            Key.Back -> {
              onCancel()
              true
            }
            else -> false
          }
        }
      }
      .focusable(),
    contentAlignment = Alignment.Center,
  ) {
    TvPanel(modifier = Modifier.width(520.dp)) {
      when (state) {
        is TvUpdateUiState.Checking -> {
          BasicText(text = "正在检查更新", style = TextStyle(color = accent, fontSize = 24.sp, fontWeight = FontWeight.SemiBold))
          Spacer(modifier = Modifier.height(12.dp))
          BasicText(text = "正在连接后台更新源...", style = TextStyle(color = mutedText, fontSize = 16.sp))
        }
        is TvUpdateUiState.Available -> {
          UpdateHeader("发现新版本", state.info)
          Spacer(modifier = Modifier.height(22.dp))
          Row(horizontalArrangement = Arrangement.spacedBy(18.dp)) {
            DialogActionButton(focused = selectedIndex == 0, onClick = { onDownload(state.info) }, text = "立即更新")
            DialogActionButton(
              focused = selectedIndex == 1,
              onClick = onCancel,
              text = if (state.info.forceUpdate) "退出应用" else "稍后再说",
              danger = state.info.forceUpdate,
            )
          }
        }
        is TvUpdateUiState.Downloading -> {
          UpdateHeader("正在下载更新", state.info)
          Spacer(modifier = Modifier.height(20.dp))
          ProgressBar(state.progress)
          Spacer(modifier = Modifier.height(10.dp))
          BasicText(text = "${state.progress.coerceIn(0, 100)}%", style = TextStyle(color = accent, fontSize = 18.sp, fontWeight = FontWeight.SemiBold))
        }
        is TvUpdateUiState.ReadyToInstall -> {
          UpdateHeader("更新包已下载", state.info)
          Spacer(modifier = Modifier.height(22.dp))
          Row(horizontalArrangement = Arrangement.spacedBy(18.dp)) {
            DialogActionButton(focused = selectedIndex == 0, onClick = { onInstall(state.file) }, text = "立即安装")
            DialogActionButton(focused = selectedIndex == 1, onClick = onCancel, text = "稍后安装")
          }
        }
        is TvUpdateUiState.Error -> {
          BasicText(text = "更新提示", style = TextStyle(color = accent, fontSize = 24.sp, fontWeight = FontWeight.SemiBold))
          Spacer(modifier = Modifier.height(12.dp))
          BasicText(text = state.message, style = TextStyle(color = mutedText, fontSize = 16.sp))
          Spacer(modifier = Modifier.height(22.dp))
          DialogActionButton(focused = true, onClick = onDismissError, text = "知道了")
        }
        TvUpdateUiState.Idle -> Unit
      }
    }
  }
}

@Composable
private fun UpdateHeader(title: String, info: TvAppUpdateInfo) {
  BasicText(text = title, style = TextStyle(color = accent, fontSize = 24.sp, fontWeight = FontWeight.SemiBold))
  Spacer(modifier = Modifier.height(12.dp))
  InfoRow("新版本", "v${info.versionName.ifBlank { info.versionCode.toString() }}")
  InfoRow("当前版本", "v${BuildConfig.VERSION_NAME}")
  if (info.publishedAt.isNotBlank()) InfoRow("发布时间", info.publishedAt.take(10))
  if (info.releaseNotes.isNotBlank()) {
    Spacer(modifier = Modifier.height(12.dp))
    BasicText(text = info.releaseNotes, style = TextStyle(color = mutedText, fontSize = 15.sp))
  }
}

@Composable
private fun TvLogoutDialog(onCancel: () -> Unit, onConfirm: () -> Unit) {
  val focusRequester = remember { FocusRequester() }
  var selectedIndex by remember { mutableIntStateOf(0) }

  LaunchedEffect(Unit) {
    focusRequester.requestFocusWhenReady()
  }

  Box(
    modifier = Modifier
      .fillMaxSize()
      .background(Color.Black.copy(alpha = 0.58f))
      .focusRequester(focusRequester)
      .onPreviewKeyEvent { event ->
        if (event.type != KeyEventType.KeyUp) return@onPreviewKeyEvent false
        when (event.key) {
          Key.DirectionLeft, Key.DirectionRight -> {
            selectedIndex = 1 - selectedIndex
            true
          }
          Key.DirectionCenter, Key.Enter -> {
            if (selectedIndex == 0) onCancel() else onConfirm()
            true
          }
          Key.Back -> {
            onCancel()
            true
          }
          else -> false
        }
      }
      .focusable(),
    contentAlignment = Alignment.Center,
  ) {
    Column(
      modifier = Modifier
        .width(420.dp)
        .background(Color(0xF20B1014), RoundedCornerShape(18.dp))
        .border(1.dp, Color.White.copy(alpha = 0.18f), RoundedCornerShape(18.dp))
        .padding(horizontal = 34.dp, vertical = 30.dp),
      horizontalAlignment = Alignment.CenterHorizontally,
    ) {
      BasicText(
        text = "退出登录",
        style = TextStyle(color = warmText, fontSize = 27.sp, fontWeight = FontWeight.SemiBold),
      )
      Spacer(modifier = Modifier.height(14.dp))
      BasicText(
        text = "将清除当前设备登录状态和保存的密码，下次需要重新登录。",
        style = TextStyle(color = mutedText, fontSize = 16.sp),
      )
      Spacer(modifier = Modifier.height(28.dp))
      Row(horizontalArrangement = Arrangement.spacedBy(18.dp)) {
        DialogActionButton(
          focused = selectedIndex == 0,
          onClick = onCancel,
          text = "取消",
        )
        DialogActionButton(
          focused = selectedIndex == 1,
          onClick = onConfirm,
          text = "退出登录",
          danger = true,
        )
      }
    }
  }
}

@Composable
private fun DialogActionButton(
  focused: Boolean,
  onClick: () -> Unit,
  text: String,
  danger: Boolean = false,
) {
  Box(
    modifier = Modifier
      .width(132.dp)
      .height(42.dp)
      .clickable { onClick() }
      .background(
        when {
          danger && focused -> Color(0xFFE25555)
          focused -> accent
          else -> Color.White.copy(alpha = 0.08f)
        },
        RoundedCornerShape(10.dp),
      )
      .border(1.dp, if (focused) Color.White.copy(alpha = 0.65f) else Color.White.copy(alpha = 0.12f), RoundedCornerShape(10.dp)),
    contentAlignment = Alignment.Center,
  ) {
    BasicText(
      text = text,
      style = TextStyle(
        color = if (focused) Color(0xFF160F08) else warmText,
        fontSize = 16.sp,
        fontWeight = FontWeight.SemiBold,
      ),
    )
  }
}

@Composable
private fun TvBackendLoginScreen(
  deviceToken: String,
  onConnect: () -> Unit,
  onPasswordChange: (String) -> Unit,
  onServerUrlChange: (String) -> Unit,
  onSystemInfo: () -> Unit,
  onUseSavedToken: () -> Unit,
  onUsernameChange: (String) -> Unit,
  password: String,
  serverUrl: String,
  statusText: String,
  username: String,
) {
  val protocolFocus = remember { FocusRequester() }
  val serverFocus = remember { FocusRequester() }
  val usernameFocus = remember { FocusRequester() }
  val passwordFocus = remember { FocusRequester() }
  val connectFocus = remember { FocusRequester() }
  val savedFocus = remember { FocusRequester() }
  var useHttps by remember(serverUrl) { mutableStateOf(serverUrl.trim().startsWith("https://")) }
  var passwordVisible by remember { mutableStateOf(false) }
  var hostPort by remember(serverUrl) {
    mutableStateOf(serverUrl.removePrefix("https://").removePrefix("http://").trimEnd('/'))
  }

  fun updateServerUrl(nextHttps: Boolean = useHttps, nextHostPort: String = hostPort) {
    useHttps = nextHttps
    hostPort = nextHostPort
    onServerUrlChange("${if (nextHttps) "https" else "http"}://${nextHostPort.trim()}")
  }

  LaunchedEffect(Unit) {
    serverFocus.requestFocusWhenReady()
  }

  TvShell {
    LoginMemoryBackdrop()
    BoxWithConstraints(modifier = Modifier.fillMaxSize()) {
      val wide = maxWidth.value / maxHeight.value >= 1.58f
      val screenHeight = maxHeight
      val horizontalPadding = if (wide) maxWidth * 0.07f else maxWidth * 0.08f
      val cardWidth = if (wide) maxWidth * 0.405f else maxWidth * 0.50f
      val brandWidth = if (wide) maxWidth * 0.35f else maxWidth * 0.34f
      Row(
        modifier = Modifier
          .fillMaxSize()
          .padding(horizontal = horizontalPadding, vertical = if (wide) maxHeight * 0.048f else maxHeight * 0.085f),
        horizontalArrangement = Arrangement.spacedBy(if (wide) maxWidth * 0.065f else maxWidth * 0.045f),
        verticalAlignment = Alignment.CenterVertically,
      ) {
        Column(
          modifier = Modifier
            .width(brandWidth)
            .padding(top = if (wide) 0.dp else screenHeight * 0.06f),
        horizontalAlignment = Alignment.CenterHorizontally,
      ) {
        Column(
          modifier = Modifier.offset(y = if (wide) (-52).dp else 0.dp),
          horizontalAlignment = Alignment.CenterHorizontally,
        ) {
          AppLogoMark(size = if (wide) 142.dp else 110.dp)
          Spacer(modifier = Modifier.height(if (wide) 10.dp else 20.dp))
          BasicText(
            text = "往日重现",
            style = TextStyle(
              color = Color.White,
              fontSize = if (wide) 42.sp else 34.sp,
              fontWeight = FontWeight.Bold,
              letterSpacing = if (wide) 7.sp else 5.sp,
              shadow = Shadow(Color.Black.copy(alpha = 0.45f), Offset(0f, 4f), 16f),
            ),
          )
          Spacer(modifier = Modifier.height(if (wide) 12.dp else 18.dp))
          BasicText(
            text = "那些瞬间，值得反复回味",
            style = TextStyle(
              color = Color.White.copy(alpha = 0.86f),
              fontSize = if (wide) 18.sp else 15.sp,
              letterSpacing = 3.sp,
            )
          )
        }
      }

        Column(
          modifier = Modifier
            .width(cardWidth)
            .height(if (wide) screenHeight * 0.80f else screenHeight * 0.92f)
            .offset(y = if (wide) (-10).dp else 0.dp)
            .background(
              Brush.verticalGradient(
                listOf(
                  Color(0x8E5A4A3A),
                  Color(0x74332722),
                  Color(0x9A1B1712),
                ),
              ),
              RoundedCornerShape(24.dp),
            )
            .border(1.dp, Color.White.copy(alpha = 0.22f), RoundedCornerShape(24.dp))
            .padding(horizontal = if (wide) 38.dp else 28.dp, vertical = if (wide) 26.dp else 28.dp),
        ) {
          BasicText(
            modifier = Modifier.align(Alignment.CenterHorizontally),
            text = "欢迎回家",
            style = TextStyle(
              color = Color(0xFF6B7CFF),
              fontSize = if (wide) 30.sp else 25.sp,
              fontWeight = FontWeight.Bold,
              shadow = Shadow(Color(0x995C2DFF), Offset(2f, 2f), 11f),
            ),
          )
          Spacer(modifier = Modifier.height(if (wide) 16.dp else 18.dp))
          BasicText(text = "登录地址", style = TextStyle(color = Color(0xFFE9E8F7), fontSize = 14.sp, fontWeight = FontWeight.SemiBold))
          Spacer(modifier = Modifier.height(8.dp))
          Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            ProtocolChip(
              focusedRequester = protocolFocus,
              protocol = if (useHttps) "https://" else "http://",
              onToggle = { updateServerUrl(!useHttps) },
            )
            GlassLoginField(
              modifier = Modifier.weight(1f),
              downFocusRequester = passwordFocus,
              focusRequester = serverFocus,
              onMoveDown = { usernameFocus.requestFocus() },
              onValueChange = { updateServerUrl(nextHostPort = it) },
              value = hostPort,
            )
          }
          Spacer(modifier = Modifier.height(if (wide) 12.dp else 16.dp))
          Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Column {
              BasicText(text = "使用 HTTPS", style = TextStyle(color = Color(0xFFE9E8F7), fontSize = 14.sp, fontWeight = FontWeight.SemiBold))
              Spacer(modifier = Modifier.height(4.dp))
              BasicText(text = "开启后地址前缀切换为 https://", style = TextStyle(color = Color(0xBFE9E8F7), fontSize = 10.sp))
            }
            LoginSwitch(checked = useHttps, onToggle = { updateServerUrl(!useHttps) })
          }
          Spacer(modifier = Modifier.height(if (wide) 12.dp else 16.dp))
          BasicText(text = "账号", style = TextStyle(color = Color(0xFFE9E8F7), fontSize = 14.sp, fontWeight = FontWeight.SemiBold))
          Spacer(modifier = Modifier.height(8.dp))
          GlassLoginField(
            downFocusRequester = connectFocus,
            focusRequester = usernameFocus,
            icon = "♙",
            onMoveDown = { passwordFocus.requestFocus() },
            onMoveUp = { serverFocus.requestFocus() },
            onValueChange = onUsernameChange,
            upFocusRequester = serverFocus,
            value = username,
          )
          Spacer(modifier = Modifier.height(if (wide) 12.dp else 16.dp))
          BasicText(text = "密码", style = TextStyle(color = Color(0xFFE9E8F7), fontSize = 14.sp, fontWeight = FontWeight.SemiBold))
          Spacer(modifier = Modifier.height(8.dp))
          Box {
            GlassLoginField(
              downFocusRequester = connectFocus,
              focusRequester = passwordFocus,
              icon = "▣",
              onMoveDown = { connectFocus.requestFocus() },
              onMoveUp = { usernameFocus.requestFocus() },
              onValueChange = onPasswordChange,
              password = !passwordVisible,
              upFocusRequester = usernameFocus,
              value = password,
            )
            BasicText(
              modifier = Modifier
                .align(Alignment.CenterEnd)
                .padding(end = 20.dp)
                .clickable { passwordVisible = !passwordVisible },
              text = if (passwordVisible) "隐藏" else "查看",
              style = TextStyle(color = Color(0xFFDAD7E9), fontSize = 11.sp, fontWeight = FontWeight.SemiBold),
            )
          }
          Spacer(modifier = Modifier.height(if (wide) 12.dp else 20.dp))
          GlassPrimaryButton(
            focusRequester = connectFocus,
            onClick = onConnect,
            onMoveDown = { if (deviceToken.isNotBlank()) savedFocus.requestFocus() },
            onMoveUp = { passwordFocus.requestFocus() },
            text = "立即登录",
            upFocusRequester = passwordFocus,
          )
          Spacer(modifier = Modifier.height(10.dp))
          Row(modifier = Modifier.align(Alignment.CenterHorizontally), verticalAlignment = Alignment.CenterVertically) {
            Box(modifier = Modifier.size(8.dp).background(Color(0xFF76E363), RoundedCornerShape(4.dp)))
            Spacer(modifier = Modifier.height(4.dp))
            Spacer(modifier = Modifier.width(8.dp))
            BasicText(text = statusText.ifBlank { "系统已就绪，等待登录" }, style = TextStyle(color = Color(0xDDE9E8F7), fontSize = 12.sp))
          }
          if (deviceToken.isNotBlank()) {
            Spacer(modifier = Modifier.height(10.dp))
            Row(modifier = Modifier.align(Alignment.CenterHorizontally), horizontalArrangement = Arrangement.spacedBy(18.dp)) {
              SmallGlassLink(
                focusRequester = savedFocus,
                onClick = onUseSavedToken,
                text = "进入相册",
              )
              SmallGlassLink(onClick = onSystemInfo, text = "系统信息")
            }
          }
        }
      }
    }
  }
}

@Composable
private fun TvConnectingScreen(serverUrl: String) {
  TvShell {
    Box(modifier = Modifier.fillMaxSize()) {
      Column(modifier = Modifier.align(Alignment.Center), horizontalAlignment = Alignment.CenterHorizontally) {
        BasicText(
          text = "Connecting to backend",
          style = TextStyle(color = warmText, fontSize = 24.sp, fontWeight = FontWeight.SemiBold),
        )
        Spacer(modifier = Modifier.height(10.dp))
        BasicText(text = serverUrl, style = TextStyle(color = mutedText, fontSize = 16.sp))
        Spacer(modifier = Modifier.height(28.dp))
        BasicText(text = ".....", style = TextStyle(color = accent, fontSize = 36.sp))
      }
    }
  }
}

@Composable
private fun TvAlbumSelectionScreen(
  albums: List<TvAlbum>,
  imageLoader: ImageLoader,
  onBack: () -> Unit,
  onHelp: () -> Unit,
  onLogout: () -> Unit,
  onOpenSystem: () -> Unit,
  onSelectAlbum: (Int) -> Unit,
  selectedIndex: Int,
  setSelectedIndex: (Int) -> Unit,
) {
  val focusRequester = remember { FocusRequester() }
  val backgroundCover = remember(albums.map { it.coverUrl }) {
    albums.map { it.coverUrl }.filter { it.isNotBlank() }.shuffled().firstOrNull()
  }

  LaunchedEffect(Unit) {
    focusRequester.requestFocusWhenReady()
  }

  TvShell(backgroundImage = backgroundCover, imageLoader = imageLoader) {
    Column(
      modifier = Modifier
        .fillMaxSize()
        .focusRequester(focusRequester)
        .onPreviewKeyEvent { event ->
          if (event.type != KeyEventType.KeyUp) return@onPreviewKeyEvent false
          if (event.nativeKeyEvent.keyCode == AndroidKeyEvent.KEYCODE_MENU) {
            onLogout()
            return@onPreviewKeyEvent true
          }
          when (event.key) {
            Key.DirectionLeft, Key.DirectionUp -> {
              setSelectedIndex((selectedIndex - 1).coerceAtLeast(0))
              true
            }
            Key.DirectionRight, Key.DirectionDown -> {
              setSelectedIndex((selectedIndex + 1).coerceAtMost((albums.size - 1).coerceAtLeast(0)))
              true
            }
            Key.DirectionCenter, Key.Enter -> {
              if (albums.isNotEmpty()) onSelectAlbum(selectedIndex)
              true
            }
            Key.Back -> {
              onBack()
              true
            }
            Key.Menu -> {
              onLogout()
              true
            }
            else -> false
          }
        }
        .focusable()
        .padding(horizontal = 66.dp, vertical = 46.dp),
    ) {
      TopHint("按 ↑↓ 选择相册，按 OK 确认播放")
      BasicText(
        text = "选择要播放的图包",
        style = TextStyle(color = accent, fontSize = 34.sp, fontWeight = FontWeight.SemiBold),
      )
      Spacer(modifier = Modifier.height(16.dp))
      BasicText(text = "${albums.size} 个相册", style = TextStyle(color = mutedText, fontSize = 20.sp))
      Spacer(modifier = Modifier.height(44.dp))
      Row(horizontalArrangement = Arrangement.spacedBy(48.dp)) {
        albums.take(6).forEachIndexed { index, album ->
          AlbumCard(
            album = album,
            onClick = {
              setSelectedIndex(index)
              onSelectAlbum(index)
            },
            selected = index == selectedIndex,
          )
        }
      }
      Spacer(modifier = Modifier.weight(1f))
      FooterNav("↑↓  选择相册        OK  确认播放        ←  返回上一级")
    }
  }
}

@Composable
private fun TvAlbumDetailScreen(
  album: TvAlbum,
  imageLoader: ImageLoader,
  onBack: () -> Unit,
  onOpenSettings: () -> Unit,
  onStart: () -> Unit,
) {
  val focusRequester = remember { FocusRequester() }

  TvShell {
    Row(
      modifier = Modifier
        .fillMaxSize()
        .focusRequester(focusRequester)
        .clickable(
          enabled = isTouchActivationEnabled(TvTouchTarget.AlbumDetail),
          onClick = onStart,
        )
        .onPreviewKeyEvent { event ->
          if (event.type != KeyEventType.KeyUp) return@onPreviewKeyEvent false
          when (event.key) {
            Key.DirectionCenter, Key.Enter -> {
              onStart()
              true
            }
            Key.DirectionDown -> {
              onOpenSettings()
              true
            }
            Key.Back -> {
              onBack()
              true
            }
            else -> false
          }
        }
        .focusable()
        .padding(horizontal = 44.dp, vertical = 36.dp),
      horizontalArrangement = Arrangement.spacedBy(30.dp),
      verticalAlignment = Alignment.CenterVertically,
    ) {
      Column(modifier = Modifier.width(360.dp)) {
        BasicText(text = album.title, style = TextStyle(color = accent, fontSize = 22.sp, fontWeight = FontWeight.SemiBold))
        Spacer(modifier = Modifier.height(18.dp))
        InfoRow("Photos", "${album.photoCount}")
        InfoRow("Updated", album.updatedAt)
        InfoRow("Scenes", "${album.sceneCount}")
        Spacer(modifier = Modifier.height(20.dp))
        BasicText(text = album.description, style = TextStyle(color = mutedText, fontSize = 15.sp))
        Spacer(modifier = Modifier.height(20.dp))
        AmberButtonLabel("Start")
        Spacer(modifier = Modifier.height(8.dp))
        DarkButtonLabel("播放设置")
      }

      HeroImage(imageLoader = imageLoader, imageUrl = album.coverUrl, modifier = Modifier.weight(1f))
    }
  }
}

@Composable
private fun TvPhotoPlayerScreen(
  currentIndex: Int,
  imageLoader: ImageLoader,
  item: TvPlaylistItem,
  itemCount: Int,
  items: List<TvPlaylistItem>,
  onAutoNext: () -> Unit,
  onBack: () -> Unit,
  onNext: () -> Unit,
  onOpenQueue: () -> Unit,
  onOpenSettings: () -> Unit,
  onPrevious: () -> Unit,
  playbackSessionSeed: Int,
  playbackStatusText: String,
) {
  return MemoryExhibitionPlayer(
    currentIndex = currentIndex,
    imageLoader = imageLoader,
    item = item,
    itemCount = itemCount,
    nextItem = if (items.isNotEmpty()) items[(currentIndex + 1) % items.size] else null,
    playbackSessionSeed = playbackSessionSeed,
    onAutoNext = onAutoNext,
    onBack = onBack,
    onNext = onNext,
    onOpenQueue = onOpenQueue,
    onPrevious = onPrevious,
    playbackStatusText = playbackStatusText,
    touchEnabled = isTouchActivationEnabled(TvTouchTarget.Player),
    onOpenSettings = onOpenSettings,
    thumbnailStrip = {
      ThumbnailStrip(imageLoader = imageLoader, items = items, currentIndex = currentIndex)
    },
  )
  val focusRequester = remember { FocusRequester() }
  var imageLoadState by remember(item.displayImageUrl) { mutableStateOf(TvImageLoadState.Loading) }
  var showPlaybackChrome by remember { mutableStateOf(true) }
  var chromeVisibilityTick by remember { mutableIntStateOf(0) }
  LaunchedEffect(currentIndex, item.photoId, item.durationMs, itemCount) {
    if (itemCount > 1) {
      delay(item.durationMs.coerceAtLeast(3_000L))
      onAutoNext()
    }
  }
  LaunchedEffect(chromeVisibilityTick) {
    delay(3_000L)
    showPlaybackChrome = false
  }
  fun revealPlaybackChrome() {
    showPlaybackChrome = true
    chromeVisibilityTick += 1
  }

  Box(
    modifier = Modifier
      .fillMaxSize()
      .background(Color.Black)
      .focusRequester(focusRequester)
      .clickable(
        enabled = isTouchActivationEnabled(TvTouchTarget.Player),
        onClick = { revealPlaybackChrome() },
      )
      .onPreviewKeyEvent { event ->
        if (event.type != KeyEventType.KeyUp) return@onPreviewKeyEvent false
        when (event.key) {
          Key.DirectionRight -> {
            onNext()
            true
          }
          Key.DirectionLeft -> {
            onPrevious()
            true
          }
          Key.DirectionCenter, Key.Enter, Key.DirectionDown -> {
            revealPlaybackChrome()
            true
          }
          Key.DirectionUp -> {
            onOpenQueue()
            true
          }
          Key.Back -> {
            onBack()
            true
          }
          else -> false
        }
      }
      .focusable(),
  ) {
    AsyncImage(
      model = ImageRequest.Builder(LocalContext.current).data(item.displayImageUrl).build(),
      imageLoader = imageLoader,
      contentDescription = item.captionTitle,
      contentScale = ContentScale.Crop,
      onError = { imageLoadState = TvImageLoadState.Error },
      onLoading = { imageLoadState = TvImageLoadState.Loading },
      onSuccess = { imageLoadState = TvImageLoadState.Ready },
      modifier = Modifier.fillMaxSize(),
    )
    Box(
      modifier = Modifier
        .fillMaxSize()
        .background(
          Brush.verticalGradient(
            listOf(Color.Transparent, Color(0x33000000), Color(0xE6000000)),
          ),
        ),
    )
    Box(
      modifier = Modifier
        .fillMaxSize()
        .background(
          Brush.horizontalGradient(
            listOf(Color(0x8F000000), Color(0x33000000), Color.Transparent),
          ),
        ),
    )

    BasicText(
      modifier = Modifier.align(Alignment.TopEnd).padding(horizontal = 42.dp, vertical = 30.dp),
      text = "22:30   ${currentIndex + 1} / $itemCount",
      style = TextStyle(color = Color(0xCCFFF3DF), fontSize = 17.sp),
    )

    BoxWithConstraints(modifier = Modifier.fillMaxSize()) {
      val safeArea = item.safeArea.normalized()
      val captionLines = item.captionLines()
      Column(
        modifier = Modifier
          .align(Alignment.TopStart)
          .padding(
            start = maxWidth * safeArea.x,
            top = maxHeight * safeArea.y,
          )
          .width(maxWidth * safeArea.w),
        horizontalAlignment = item.captionHorizontalAlignment(),
      ) {
        captionLines.forEachIndexed { index, line ->
          val isEmphasis = index == 1 && captionLines.size > 1
          BasicText(
            text = line,
            style = TextStyle(
              color = if (isEmphasis) Color(0xFFFFE7B8) else item.captionColor().copy(alpha = 0.92f),
              fontFamily = if (isEmphasis) FontFamily.Cursive else item.captionFontFamily(),
              fontSize = if (isEmphasis) 58.sp else 42.sp,
              fontWeight = item.captionFontWeight(isEmphasis),
              lineHeight = if (isEmphasis) 64.sp else 52.sp,
              letterSpacing = if (isEmphasis) 2.sp else 3.sp,
              shadow = Shadow(
                color = Color.Black.copy(alpha = 0.36f),
                offset = Offset(0f, 3f),
                blurRadius = 8f,
              ),
            ),
          )
          if (index != captionLines.lastIndex) Spacer(modifier = Modifier.height(8.dp))
        }
      }
    }

    AnimatedVisibility(
      visible = showPlaybackChrome,
      exit = fadeOut(animationSpec = tween(durationMillis = 1_800)),
      modifier = Modifier.align(Alignment.BottomStart),
    ) {
      Column(
        modifier = Modifier
          .fillMaxWidth()
          .padding(horizontal = 64.dp, vertical = 34.dp),
      ) {
        BasicText(text = item.metaLine, style = TextStyle(color = mutedText, fontSize = 17.sp))
        if (playbackStatusText.isNotBlank()) {
          Spacer(modifier = Modifier.height(10.dp))
          BasicText(text = playbackStatusText, style = TextStyle(color = softText, fontSize = 14.sp))
        }
        Spacer(modifier = Modifier.height(16.dp))
        ThumbnailStrip(imageLoader = imageLoader, items = items, currentIndex = currentIndex)
      }
    }

    when (imageLoadState) {
      TvImageLoadState.Loading -> TvOverlayStatus(Modifier.align(Alignment.Center), "正在加载图片", item.captionTitle)
      TvImageLoadState.Error -> TvOverlayStatus(Modifier.align(Alignment.Center), "图片加载失败", item.displayImageUrl)
      TvImageLoadState.Ready -> Unit
    }
  }
}

@Composable
private fun TvPlaybackSettingsScreen(
  album: TvAlbum?,
  imageLoader: ImageLoader,
  onBack: () -> Unit,
  onCheckUpdate: () -> Unit,
  onOpenScan: () -> Unit,
  selectedIndex: Int,
  setSelectedIndex: (Int) -> Unit,
) {
  val focusRequester = remember { FocusRequester() }
  val options = listOf("播放设置", "返回相册", "重新扫描", "检查更新", "照片队列", "系统信息", "使用帮助")

  TvShell(backgroundImage = album?.coverUrl, imageLoader = imageLoader) {
    Row(
      modifier = Modifier
        .fillMaxSize()
        .focusRequester(focusRequester)
        .onPreviewKeyEvent { event ->
          if (event.type != KeyEventType.KeyUp) return@onPreviewKeyEvent false
          when (event.key) {
            Key.DirectionUp -> {
              setSelectedIndex((selectedIndex - 1).coerceAtLeast(0))
              true
            }
            Key.DirectionDown -> {
              setSelectedIndex((selectedIndex + 1).coerceAtMost(options.lastIndex))
              true
            }
            Key.DirectionCenter, Key.Enter -> {
              when (selectedIndex) {
                1 -> onBack()
                2 -> onOpenScan()
                3 -> onCheckUpdate()
              }
              true
            }
            Key.Back -> {
              onBack()
              true
            }
            else -> false
          }
        }
        .focusable()
        .padding(horizontal = 34.dp, vertical = 32.dp),
      horizontalArrangement = Arrangement.spacedBy(24.dp),
    ) {
      TvPanel(modifier = Modifier.width(260.dp)) {
        options.forEachIndexed { index, option ->
          MenuRow(label = option, selected = index == selectedIndex)
        }
      }
      TvPanel(modifier = Modifier.weight(1f)) {
        BasicText(text = "播放设置", style = TextStyle(color = accent, fontSize = 18.sp, fontWeight = FontWeight.SemiBold))
        Spacer(modifier = Modifier.height(16.dp))
        SettingRow("Mode", "Sequence")
        SettingRow("Duration", "8 sec")
        SettingRow("Transition", "Fade")
        SettingRow("Title", "On")
        SettingRow("Caption", "On")
        SettingRow("Date", "On")
        SettingRow("Shuffle", "Off")
        SettingRow("Update", "菜单中选择“检查更新”")
      }
      HeroImage(imageLoader = imageLoader, imageUrl = album?.coverUrl ?: "", modifier = Modifier.width(360.dp))
    }
  }
}

@Composable
private fun TvQueueScreen(
  imageLoader: ImageLoader,
  items: List<TvPlaylistItem>,
  onBack: () -> Unit,
  onConfirm: () -> Unit,
  selectedIndex: Int,
  setSelectedIndex: (Int) -> Unit,
) {
  val focusRequester = remember { FocusRequester() }
  TvShell {
    Column(
      modifier = Modifier
        .fillMaxSize()
        .focusRequester(focusRequester)
        .onPreviewKeyEvent { event ->
          if (event.type != KeyEventType.KeyUp) return@onPreviewKeyEvent false
          when (event.key) {
            Key.DirectionLeft -> {
              setSelectedIndex((selectedIndex - 1).coerceAtLeast(0))
              true
            }
            Key.DirectionRight -> {
              setSelectedIndex((selectedIndex + 1).coerceAtMost((items.size - 1).coerceAtLeast(0)))
              true
            }
            Key.DirectionCenter, Key.Enter -> {
              onConfirm()
              true
            }
            Key.Back -> {
              onBack()
              true
            }
            else -> false
          }
        }
        .focusable()
        .padding(horizontal = 34.dp, vertical = 30.dp),
    ) {
      BasicText(text = "Queue: ${items.size}", style = TextStyle(color = warmText, fontSize = 18.sp, fontWeight = FontWeight.SemiBold))
      Spacer(modifier = Modifier.height(18.dp))
      Row(horizontalArrangement = Arrangement.spacedBy(14.dp)) {
        items.take(8).forEachIndexed { index, item ->
          QueueCard(
            imageLoader = imageLoader,
            item = item,
            index = index,
            onClick = {
              setSelectedIndex(index)
              onConfirm()
            },
            selected = index == selectedIndex,
          )
        }
      }
      Spacer(modifier = Modifier.height(16.dp))
      FooterNav("Arrows select    OK play    Back previous")
    }
  }
}

@Composable
private fun TvSystemInfoScreen(
  deviceToken: String,
  onBack: () -> Unit,
  onHelp: () -> Unit,
  serverUrl: String,
) {
  val focusRequester = remember { FocusRequester() }
  TvShell {
    Row(
      modifier = Modifier
        .fillMaxSize()
        .focusRequester(focusRequester)
        .onPreviewKeyEvent { event ->
          if (event.type != KeyEventType.KeyUp) return@onPreviewKeyEvent false
          when (event.key) {
            Key.DirectionRight, Key.DirectionCenter, Key.Enter -> {
              onHelp()
              true
            }
            Key.Back -> {
              onBack()
              true
            }
            else -> false
          }
        }
        .focusable()
        .padding(horizontal = 44.dp, vertical = 42.dp),
      horizontalArrangement = Arrangement.spacedBy(36.dp),
      verticalAlignment = Alignment.CenterVertically,
    ) {
      TvPanel(modifier = Modifier.weight(1f)) {
        BasicText(text = "系统信息", style = TextStyle(color = accent, fontSize = 20.sp, fontWeight = FontWeight.SemiBold))
        Spacer(modifier = Modifier.height(18.dp))
        InfoRow("设备名称", "客厅电视")
        InfoRow("App 版本", "v1.0.0")
        InfoRow("Device ID", if (deviceToken.isBlank()) "Not connected" else "TV-20240520-001")
        InfoRow("后端地址", serverUrl)
        InfoRow("存储空间", "120 GB 可用 / 500 GB")
        InfoRow("Network", if (deviceToken.isBlank()) "Not connected" else "Connected")
      }
      TvPanel(modifier = Modifier.width(260.dp)) {
        BasicText(text = "手机扫码管理", style = TextStyle(color = warmText, fontSize = 16.sp, fontWeight = FontWeight.SemiBold))
        Spacer(modifier = Modifier.height(16.dp))
        FakeQr()
        Spacer(modifier = Modifier.height(12.dp))
        BasicText(text = "扫描二维码进入图包和设备设置", style = TextStyle(color = mutedText, fontSize = 12.sp))
      }
    }
  }
}

@Composable
private fun TvScanProgressScreen(progress: Int) {
  TvShell {
    Row(
      modifier = Modifier
        .fillMaxSize()
        .padding(horizontal = 72.dp, vertical = 64.dp),
      horizontalArrangement = Arrangement.spacedBy(48.dp),
      verticalAlignment = Alignment.CenterVertically,
    ) {
      BasicText(text = "*", style = TextStyle(color = accent, fontSize = 96.sp))
      TvPanel(modifier = Modifier.width(460.dp)) {
        BasicText(text = "Scanning photos", style = TextStyle(color = warmText, fontSize = 20.sp, fontWeight = FontWeight.SemiBold))
        Spacer(modifier = Modifier.height(10.dp))
        BasicText(text = "正在读取图片文件...", style = TextStyle(color = mutedText, fontSize = 14.sp))
        Spacer(modifier = Modifier.height(20.dp))
        ProgressBar(progress)
        Spacer(modifier = Modifier.height(8.dp))
        BasicText(text = "$progress%", style = TextStyle(color = accent, fontSize = 13.sp))
      }
    }
  }
}

@Composable
private fun TvScanDoneScreen(count: Int, onConfirm: () -> Unit) {
  val focusRequester = remember { FocusRequester() }
  TvShell {
    Column(
      modifier = Modifier
        .fillMaxSize()
        .focusRequester(focusRequester)
        .clickable(
          enabled = isTouchActivationEnabled(TvTouchTarget.ScanDone),
          onClick = onConfirm,
        )
        .onPreviewKeyEvent { event ->
          if (event.type == KeyEventType.KeyUp && (event.key == Key.Enter || event.key == Key.DirectionCenter)) {
            onConfirm()
            true
          } else {
            false
          }
        }
        .focusable(),
      horizontalAlignment = Alignment.CenterHorizontally,
      verticalArrangement = Arrangement.Center,
    ) {
      BasicText(text = "OK", style = TextStyle(color = Color(0xFF75C982), fontSize = 86.sp))
      Spacer(modifier = Modifier.height(18.dp))
      BasicText(text = "扫描完成", style = TextStyle(color = accent, fontSize = 24.sp, fontWeight = FontWeight.SemiBold))
      Spacer(modifier = Modifier.height(10.dp))
      BasicText(text = "Found $count photos", style = TextStyle(color = mutedText, fontSize = 16.sp))
      Spacer(modifier = Modifier.height(24.dp))
      AmberButtonLabel("确定")
    }
  }
}

@Composable
private fun TvDisconnectedScreen(detail: String, onBack: () -> Unit, onRetry: () -> Unit) {
  val focusRequester = remember { FocusRequester() }
  TvShell {
    Column(
      modifier = Modifier
        .fillMaxSize()
        .focusRequester(focusRequester)
        .onPreviewKeyEvent { event ->
          if (event.type != KeyEventType.KeyUp) return@onPreviewKeyEvent false
          when (event.key) {
            Key.DirectionCenter, Key.Enter -> {
              onRetry()
              true
            }
            Key.Back -> {
              onBack()
              true
            }
            else -> false
          }
        }
        .focusable(),
      horizontalAlignment = Alignment.CenterHorizontally,
      verticalArrangement = Arrangement.Center,
    ) {
      BasicText(text = "Not connected to backend", style = TextStyle(color = accent, fontSize = 28.sp, fontWeight = FontWeight.SemiBold))
      Spacer(modifier = Modifier.height(12.dp))
      BasicText(text = detail, style = TextStyle(color = mutedText, fontSize = 16.sp))
      Spacer(modifier = Modifier.height(24.dp))
      AmberButtonLabel("重试")
      Spacer(modifier = Modifier.height(8.dp))
      DarkButtonLabel("网络设置")
    }
  }
}

@Composable
private fun TvHelpScreen(onBack: () -> Unit) {
  val focusRequester = remember { FocusRequester() }
  TvShell {
    Row(
      modifier = Modifier
        .fillMaxSize()
        .focusRequester(focusRequester)
        .onPreviewKeyEvent { event ->
          if (event.type == KeyEventType.KeyUp && event.key == Key.Back) {
            onBack()
            true
          } else {
            false
          }
        }
        .focusable()
        .padding(horizontal = 52.dp, vertical = 46.dp),
      horizontalArrangement = Arrangement.spacedBy(50.dp),
      verticalAlignment = Alignment.CenterVertically,
    ) {
      TvPanel(modifier = Modifier.width(420.dp)) {
        BasicText(text = "使用帮助", style = TextStyle(color = accent, fontSize = 20.sp, fontWeight = FontWeight.SemiBold))
        Spacer(modifier = Modifier.height(14.dp))
        HelpRow("如何配置后端地址")
        HelpRow("如何选择图包播放")
        HelpRow("如何查看播放队列")
        HelpRow("播放设置说明")
        HelpRow("常见问题")
      }
      TvPanel(modifier = Modifier.weight(1f)) {
        BasicText(text = "Remote control", style = TextStyle(color = warmText, fontSize = 18.sp, fontWeight = FontWeight.SemiBold))
        Spacer(modifier = Modifier.height(18.dp))
        BasicText(text = "Arrows select, OK play, Back previous", style = TextStyle(color = mutedText, fontSize = 16.sp))
      }
    }
  }
}

@Composable
private fun TvEmptyAlbumScreen(copy: TvEmptyStateCopy, onBack: () -> Unit, onRetry: () -> Unit) {
  val focusRequester = remember { FocusRequester() }
  TvShell {
    Column(
      modifier = Modifier
        .fillMaxSize()
        .focusRequester(focusRequester)
        .clickable(
          enabled = isTouchActivationEnabled(TvTouchTarget.EmptyState),
          onClick = onRetry,
        )
        .onPreviewKeyEvent { event ->
          if (event.type != KeyEventType.KeyUp) return@onPreviewKeyEvent false
          when (event.key) {
            Key.DirectionCenter, Key.Enter -> {
              onRetry()
              true
            }
            Key.Back -> {
              onBack()
              true
            }
            else -> false
          }
        }
        .focusable(),
      horizontalAlignment = Alignment.CenterHorizontally,
      verticalArrangement = Arrangement.Center,
    ) {
      BasicText(text = copy.title, style = TextStyle(color = accent, fontSize = 28.sp, fontWeight = FontWeight.SemiBold))
      Spacer(modifier = Modifier.height(12.dp))
      BasicText(text = copy.description, style = TextStyle(color = mutedText, fontSize = 16.sp))
      Spacer(modifier = Modifier.height(24.dp))
      AmberButtonLabel("重试")
    }
  }
}

@Composable
private fun TvShell(
  backgroundImage: String? = null,
  imageLoader: ImageLoader? = null,
  content: @Composable BoxScope.() -> Unit,
) {
  Box(modifier = Modifier.fillMaxSize().background(deepBg)) {
    if (!backgroundImage.isNullOrBlank() && imageLoader != null) {
      AsyncImage(
        model = ImageRequest.Builder(LocalContext.current).data(backgroundImage).build(),
        imageLoader = imageLoader,
        contentDescription = null,
        contentScale = ContentScale.Crop,
        modifier = Modifier.fillMaxSize().graphicsLayer { scaleX = 1.08f; scaleY = 1.08f }.blur(22.dp),
      )
      Box(modifier = Modifier.fillMaxSize().background(Color(0xA605090D)))
    } else {
      Box(
        modifier = Modifier
          .fillMaxSize()
          .background(
            Brush.radialGradient(
              listOf(Color(0xFF1A1F20), deepBg, Color(0xFF020407)),
            ),
          ),
      )
    }
    Box(modifier = Modifier.fillMaxSize(), content = content)
  }
}

@Composable
private fun LoginMemoryBackdrop() {
  Image(
    painter = painterResource(id = R.drawable.login_memory_bg),
    contentDescription = null,
    contentScale = ContentScale.Crop,
    modifier = Modifier.fillMaxSize(),
  )
  Box(
    modifier = Modifier
      .fillMaxSize()
      .background(
        Brush.radialGradient(
          colors = listOf(Color.Transparent, Color(0xAA050403)),
          center = Offset(760f, 520f),
          radius = 1_180f,
        ),
      ),
  )
  Box(
    modifier = Modifier
      .fillMaxSize()
      .background(
        Brush.horizontalGradient(
          listOf(Color(0x53000000), Color.Transparent, Color(0x60000000)),
        ),
      ),
  )
  Box(
    modifier = Modifier
      .fillMaxSize()
      .background(
        Brush.verticalGradient(
          listOf(Color(0x10000000), Color.Transparent, Color(0x6E000000)),
        ),
      ),
  )
}

private fun Int.nextPlaybackSessionSeed(): Int = if (this == Int.MAX_VALUE) 1 else this + 1

@Composable
private fun AppLogoMark(size: androidx.compose.ui.unit.Dp = 170.dp) {
  Canvas(modifier = Modifier.size(size)) {
    val center = Offset(this.size.width / 2f, this.size.height / 2f)
    val petalW = this.size.width * 0.23f
    val petalH = this.size.height * 0.42f
    val colors = listOf(
      Color(0xFF3B7DFF), Color(0xFF4C6DFF), Color(0xFF7656FF), Color(0xFFA950F5),
      Color(0xFFE35CD0), Color(0xFFC85BFF), Color(0xFF7D54F7), Color(0xFF4D88FF),
    )
    colors.forEachIndexed { index, color ->
      rotate(index * 45f, pivot = center) {
        drawRoundRect(
          brush = Brush.linearGradient(
            listOf(color.copy(alpha = 0.98f), color.copy(alpha = 0.58f)),
            start = Offset(center.x, center.y - petalH * 0.68f),
            end = Offset(center.x, center.y),
          ),
          topLeft = Offset(center.x - petalW / 2f, center.y - petalH * 0.88f),
          size = androidx.compose.ui.geometry.Size(petalW, petalH),
          cornerRadius = androidx.compose.ui.geometry.CornerRadius(petalW * 0.48f, petalW * 0.48f),
        )
      }
    }
    drawCircle(Color(0xFF251D35), radius = this.size.width * 0.14f, center = center)
  }
}

@Composable
private fun ProtocolChip(
  focusedRequester: FocusRequester,
  protocol: String,
  onToggle: () -> Unit,
) {
  var focused by remember { mutableStateOf(false) }
  Row(
    modifier = Modifier
      .width(98.dp)
      .height(38.dp)
      .focusRequester(focusedRequester)
      .onFocusChanged { focused = it.isFocused }
      .onPreviewKeyEvent { event ->
        if (event.type == KeyEventType.KeyUp && (event.key == Key.DirectionCenter || event.key == Key.Enter)) {
          onToggle()
          true
        } else {
          false
        }
      }
      .focusable()
      .clickable { onToggle() }
      .background(Color.White.copy(alpha = if (focused) 0.28f else 0.18f), RoundedCornerShape(10.dp))
      .border(1.dp, if (focused) Color(0xFF8FA2FF) else Color.White.copy(alpha = 0.10f), RoundedCornerShape(10.dp))
      .padding(horizontal = 14.dp),
    verticalAlignment = Alignment.CenterVertically,
    horizontalArrangement = Arrangement.SpaceBetween,
  ) {
    BasicText(text = protocol, style = TextStyle(color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.SemiBold))
    BasicText(text = "⌄", style = TextStyle(color = Color(0xCCFFFFFF), fontSize = 18.sp))
  }
}

@Composable
private fun GlassLoginField(
  modifier: Modifier = Modifier,
  downFocusRequester: FocusRequester? = null,
  focusRequester: FocusRequester,
  icon: String? = null,
  onMoveDown: (() -> Unit)? = null,
  onMoveUp: (() -> Unit)? = null,
  onValueChange: (String) -> Unit,
  password: Boolean = false,
  upFocusRequester: FocusRequester? = null,
  value: String,
) {
  var focused by remember { mutableStateOf(false) }
  var fieldValue by remember {
    mutableStateOf(TextFieldValue(value, selection = TextRange(value.length)))
  }
  LaunchedEffect(value) {
    if (value != fieldValue.text) {
      fieldValue = TextFieldValue(value, selection = TextRange(value.length))
    }
  }
  Row(
    modifier = modifier
      .fillMaxWidth()
      .height(38.dp)
      .focusProperties {
        if (downFocusRequester != null) down = downFocusRequester
        if (upFocusRequester != null) up = upFocusRequester
      }
      .focusRequester(focusRequester)
      .onFocusChanged { focused = it.isFocused }
      .onPreviewKeyEvent { event ->
        if (event.type != KeyEventType.KeyUp) return@onPreviewKeyEvent false
        when (event.key) {
          Key.DirectionDown -> {
            onMoveDown?.invoke()
            onMoveDown != null
          }
          Key.DirectionUp -> {
            onMoveUp?.invoke()
            onMoveUp != null
          }
          else -> false
        }
      }
      .background(Color.White.copy(alpha = if (focused) 0.26f else 0.16f), RoundedCornerShape(10.dp))
      .border(1.dp, if (focused) Color(0xFF8FA2FF) else Color.White.copy(alpha = 0.08f), RoundedCornerShape(10.dp))
      .padding(horizontal = 14.dp),
    verticalAlignment = Alignment.CenterVertically,
  ) {
    if (icon != null) {
      BasicText(text = icon, style = TextStyle(color = Color(0xFFDAD7E9), fontSize = 15.sp))
      Spacer(modifier = Modifier.width(12.dp))
    }
    BasicTextField(
      value = fieldValue,
      onValueChange = {
        fieldValue = it
        if (it.text != value) onValueChange(it.text)
      },
      singleLine = true,
      textStyle = TextStyle(color = Color.White, fontSize = 15.sp, fontWeight = FontWeight.Medium),
      visualTransformation = if (password) PasswordVisualTransformation() else VisualTransformation.None,
      modifier = Modifier.weight(1f),
    )
  }
}

@Composable
private fun LoginSwitch(checked: Boolean, onToggle: () -> Unit) {
  Box(
    modifier = Modifier
      .width(78.dp)
      .height(34.dp)
      .clickable { onToggle() }
      .background(
        if (checked) Brush.horizontalGradient(listOf(Color(0xFF3A7BFF), Color(0xFFB755FF))) else Brush.horizontalGradient(listOf(Color(0x66555555), Color(0x66555555))),
        RoundedCornerShape(20.dp),
      )
      .padding(4.dp),
  ) {
    Box(
      modifier = Modifier
        .align(if (checked) Alignment.CenterEnd else Alignment.CenterStart)
        .size(26.dp)
        .background(Color.White, RoundedCornerShape(13.dp)),
    )
  }
}

@Composable
private fun GlassPrimaryButton(
  focusRequester: FocusRequester,
  onClick: () -> Unit,
  onMoveDown: (() -> Unit)? = null,
  onMoveUp: (() -> Unit)? = null,
  text: String,
  upFocusRequester: FocusRequester? = null,
) {
  var focused by remember { mutableStateOf(false) }
  Box(
    modifier = Modifier
      .fillMaxWidth()
      .height(42.dp)
      .focusProperties {
        if (upFocusRequester != null) up = upFocusRequester
      }
      .focusRequester(focusRequester)
      .onFocusChanged { focused = it.isFocused }
      .onPreviewKeyEvent { event ->
        if (event.type != KeyEventType.KeyUp) return@onPreviewKeyEvent false
        when (event.key) {
          Key.DirectionCenter, Key.Enter -> {
            onClick()
            true
          }
          Key.DirectionUp -> {
            onMoveUp?.invoke()
            onMoveUp != null
          }
          Key.DirectionDown -> {
            onMoveDown?.invoke()
            onMoveDown != null
          }
          else -> false
        }
      }
      .focusable()
      .clickable { onClick() }
      .background(
        Brush.horizontalGradient(listOf(Color(0xFF337DFF), Color(0xFFBD57FF))),
        RoundedCornerShape(10.dp),
      )
      .border(1.dp, if (focused) Color.White.copy(alpha = 0.8f) else Color.Transparent, RoundedCornerShape(10.dp)),
    contentAlignment = Alignment.Center,
  ) {
    BasicText(text = text, style = TextStyle(color = Color.White, fontSize = 18.sp, fontWeight = FontWeight.Medium))
  }
}

@Composable
private fun SmallGlassLink(
  focusRequester: FocusRequester? = null,
  onClick: () -> Unit,
  text: String,
) {
  val baseModifier = Modifier
    .height(34.dp)
    .clickable { onClick() }
    .background(Color.White.copy(alpha = 0.10f), RoundedCornerShape(17.dp))
    .padding(horizontal = 18.dp)
  Box(
    modifier = if (focusRequester != null) {
      baseModifier.focusRequester(focusRequester).focusable()
    } else {
      baseModifier
    },
    contentAlignment = Alignment.Center,
  ) {
    BasicText(text = text, style = TextStyle(color = Color(0xDDE9E8F7), fontSize = 13.sp))
  }
}

@Composable
private fun TvPanel(modifier: Modifier = Modifier, content: @Composable ColumnScope.() -> Unit) {
  Column(
    modifier = modifier
      .background(panel, RoundedCornerShape(7.dp))
      .border(1.dp, stroke, RoundedCornerShape(7.dp))
      .padding(16.dp),
    content = content,
  )
}

@Composable
private fun BrandBlock() {
  Column {
    BasicText(text = "Yesterday Once More", style = TextStyle(color = accent, fontSize = 24.sp, fontWeight = FontWeight.SemiBold))
    Spacer(modifier = Modifier.height(6.dp))
    BasicText(text = "Let memories return to the screen.", style = TextStyle(color = mutedText, fontSize = 13.sp))
  }
}

@Composable
private fun TopHint(text: String) {
  Box(modifier = Modifier.fillMaxWidth()) {
    BasicText(
      modifier = Modifier.align(Alignment.TopEnd),
      text = text,
      style = TextStyle(color = softText, fontSize = 11.sp),
    )
  }
}

@Composable
private fun AlbumCard(album: TvAlbum, onClick: () -> Unit, selected: Boolean) {
  Box(
    modifier = Modifier
      .width(188.dp)
      .height(270.dp)
      .clickable(
        enabled = isTouchActivationEnabled(TvTouchTarget.AlbumCard),
        onClick = onClick,
      )
      .background(Color(0xC70B1114), RoundedCornerShape(8.dp))
      .border(if (selected) 2.dp else 1.dp, if (selected) accent else Color.White.copy(alpha = 0.13f), RoundedCornerShape(8.dp))
      .padding(14.dp),
  ) {
    Column(modifier = Modifier.fillMaxSize()) {
      Box(
        modifier = Modifier
          .fillMaxWidth()
          .height(148.dp)
          .background(Color(0xFF1F2324), RoundedCornerShape(6.dp)),
      ) {
        AsyncImage(
          model = ImageRequest.Builder(LocalContext.current).data(album.coverUrl).build(),
          contentDescription = album.title,
          contentScale = ContentScale.Crop,
          modifier = Modifier.fillMaxSize(),
        )
      }
      Spacer(modifier = Modifier.height(12.dp))
      BasicText(
        text = album.title,
        style = TextStyle(color = warmText, fontSize = 19.sp, fontWeight = FontWeight.SemiBold),
        maxLines = 1,
        overflow = TextOverflow.Ellipsis,
      )
      Spacer(modifier = Modifier.height(6.dp))
      if (album.updatedAt.isNotBlank()) {
        BasicText(
          text = album.updatedAt,
          style = TextStyle(color = Color(0xCCFFF3DF), fontSize = 15.sp),
          maxLines = 1,
          overflow = TextOverflow.Ellipsis,
        )
        Spacer(modifier = Modifier.height(12.dp))
      }
      BasicText(text = "${album.photoCount} 张照片", style = TextStyle(color = mutedText, fontSize = 15.sp))
    }
    if (selected) {
      Box(
        modifier = Modifier
          .align(Alignment.TopEnd)
          .size(25.dp)
          .background(accent, RoundedCornerShape(13.dp)),
        contentAlignment = Alignment.Center,
      ) {
        BasicText(text = "✓", style = TextStyle(color = Color(0xFF1D1409), fontSize = 16.sp, fontWeight = FontWeight.Bold))
      }
    }
  }
}

@Composable
private fun HeroImage(imageLoader: ImageLoader, imageUrl: String, modifier: Modifier) {
  Box(
    modifier = modifier
      .fillMaxHeight(0.82f)
      .background(Color(0xFF1A1E20), RoundedCornerShape(7.dp))
      .border(1.dp, stroke, RoundedCornerShape(7.dp)),
  ) {
    AsyncImage(
      model = ImageRequest.Builder(LocalContext.current).data(imageUrl).build(),
      imageLoader = imageLoader,
      contentDescription = null,
      contentScale = ContentScale.Crop,
      modifier = Modifier.fillMaxSize().padding(1.dp),
    )
  }
}

@Composable
private fun ThumbnailStrip(imageLoader: ImageLoader, items: List<TvPlaylistItem>, currentIndex: Int) {
  Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
    items.take(7).forEachIndexed { index, item ->
      Box(
        modifier = Modifier
          .width(82.dp)
          .height(50.dp)
          .background(panelSoft, RoundedCornerShape(4.dp))
          .border(if (index == currentIndex) 2.dp else 1.dp, if (index == currentIndex) accent else stroke, RoundedCornerShape(4.dp)),
      ) {
        AsyncImage(
          model = ImageRequest.Builder(LocalContext.current).data(item.displayImageUrl).build(),
          imageLoader = imageLoader,
          contentDescription = item.captionTitle,
          contentScale = ContentScale.Crop,
          modifier = Modifier.fillMaxSize().padding(1.dp),
        )
      }
    }
  }
}

@Composable
private fun QueueCard(
  imageLoader: ImageLoader,
  item: TvPlaylistItem,
  index: Int,
  onClick: () -> Unit,
  selected: Boolean,
) {
  Column(
    modifier = Modifier
      .width(150.dp)
      .clickable(
        enabled = isTouchActivationEnabled(TvTouchTarget.QueueCard),
        onClick = onClick,
      ),
  ) {
    Box(
      modifier = Modifier
        .fillMaxWidth()
        .height(170.dp)
        .background(panelSoft, RoundedCornerShape(6.dp))
        .border(if (selected) 2.dp else 1.dp, if (selected) accent else stroke, RoundedCornerShape(6.dp)),
    ) {
      AsyncImage(
        model = ImageRequest.Builder(LocalContext.current).data(item.displayImageUrl).build(),
        imageLoader = imageLoader,
        contentDescription = item.captionTitle,
        contentScale = ContentScale.Crop,
        modifier = Modifier.fillMaxSize().padding(1.dp),
      )
    }
    Spacer(modifier = Modifier.height(8.dp))
    BasicText(text = "${index + 1}. ${item.captionTitle}", style = TextStyle(color = warmText, fontSize = 12.sp))
  }
}

@Composable
private fun TvInputField(
  downFocusRequester: FocusRequester? = null,
  focusRequester: FocusRequester,
  label: String,
  leftFocusRequester: FocusRequester? = null,
  onMoveLeft: (() -> Unit)? = null,
  onMoveDown: (() -> Unit)? = null,
  onMoveRight: (() -> Unit)? = null,
  onMoveUp: (() -> Unit)? = null,
  onValueChange: (String) -> Unit,
  password: Boolean = false,
  rightFocusRequester: FocusRequester? = null,
  upFocusRequester: FocusRequester? = null,
  value: String,
) {
  var focused by remember { mutableStateOf(false) }
  var fieldValue by remember {
    mutableStateOf(TextFieldValue(value, selection = TextRange(value.length)))
  }
  LaunchedEffect(value) {
    if (value != fieldValue.text) {
      fieldValue = TextFieldValue(value, selection = TextRange(value.length))
    }
  }
  Column {
    BasicText(text = label, style = TextStyle(color = mutedText, fontSize = 12.sp))
    Spacer(modifier = Modifier.height(5.dp))
    BasicTextField(
      value = fieldValue,
      onValueChange = {
        fieldValue = it
        if (it.text != value) onValueChange(it.text)
      },
      singleLine = true,
      textStyle = TextStyle(color = warmText, fontSize = 14.sp),
      visualTransformation = if (password) PasswordVisualTransformation() else VisualTransformation.None,
      modifier = Modifier
        .fillMaxWidth()
        .height(38.dp)
        .focusProperties {
          if (downFocusRequester != null) down = downFocusRequester
          if (leftFocusRequester != null) left = leftFocusRequester
          if (rightFocusRequester != null) right = rightFocusRequester
          if (upFocusRequester != null) up = upFocusRequester
        }
        .focusRequester(focusRequester)
        .border(1.dp, if (focused) accent else stroke, RoundedCornerShape(6.dp))
        .background(Color(0x6610181E), RoundedCornerShape(6.dp))
        .onFocusChanged { focused = it.isFocused }
        .onPreviewKeyEvent { event ->
          if (event.type != KeyEventType.KeyUp) return@onPreviewKeyEvent false
          when (event.key) {
            Key.DirectionDown -> {
              onMoveDown?.invoke()
              onMoveDown != null
            }
            Key.DirectionUp -> {
              onMoveUp?.invoke()
              onMoveUp != null
            }
            else -> false
          }
        }
        .padding(horizontal = 12.dp, vertical = 8.dp),
    )
  }
}

@Composable
private fun TvButton(
  enabled: Boolean,
  focusRequester: FocusRequester,
  label: String,
  leftFocusRequester: FocusRequester? = null,
  onClick: () -> Unit,
  onMoveLeft: (() -> Unit)? = null,
  onMoveRight: (() -> Unit)? = null,
  onMoveUp: (() -> Unit)? = null,
  rightFocusRequester: FocusRequester? = null,
  upFocusRequester: FocusRequester? = null,
) {
  var focused by remember { mutableStateOf(false) }

  Button(
    enabled = enabled,
    modifier = Modifier
      .width(112.dp)
      .height(38.dp)
      .clickable(
        enabled = enabled && isTouchActivationEnabled(TvTouchTarget.LoginButton),
        onClick = onClick,
      )
      .focusProperties {
        if (leftFocusRequester != null) left = leftFocusRequester
        if (rightFocusRequester != null) right = rightFocusRequester
        if (upFocusRequester != null) up = upFocusRequester
      }
      .focusRequester(focusRequester)
      .onFocusChanged { focused = it.isFocused }
      .onPreviewKeyEvent { event ->
        if (event.type != KeyEventType.KeyUp) return@onPreviewKeyEvent false
        when (event.key) {
          Key.DirectionLeft -> {
            onMoveLeft?.invoke()
            onMoveLeft != null
          }
          Key.DirectionRight -> {
            onMoveRight?.invoke()
            onMoveRight != null
          }
          Key.DirectionUp -> {
            onMoveUp?.invoke()
            onMoveUp != null
          }
          else -> false
        }
      },
    onClick = onClick,
  ) {
    Text(text = label, fontSize = 13.sp)
  }
}

@Composable
private fun TvOverlayStatus(modifier: Modifier, title: String, detail: String) {
  Column(
    modifier = modifier
      .background(Color(0xC9000000), RoundedCornerShape(8.dp))
      .padding(horizontal = 28.dp, vertical = 20.dp),
    horizontalAlignment = Alignment.CenterHorizontally,
  ) {
    BasicText(text = title, style = TextStyle(color = warmText, fontSize = 20.sp, fontWeight = FontWeight.SemiBold))
    if (detail.isNotBlank()) {
      Spacer(modifier = Modifier.height(8.dp))
      BasicText(text = detail, style = TextStyle(color = mutedText, fontSize = 14.sp))
    }
  }
}

@Composable
private fun RecentAddress(address: String) {
  BasicText(text = "• $address", style = TextStyle(color = mutedText, fontSize = 11.sp))
  Spacer(modifier = Modifier.height(5.dp))
}

@Composable
private fun SmallLink(text: String, onOpen: () -> Unit) {
  BasicText(text = "• $text", style = TextStyle(color = softText, fontSize = 11.sp))
}

@Composable
private fun InfoRow(label: String, value: String) {
  Row(modifier = Modifier.fillMaxWidth().padding(vertical = 5.dp), horizontalArrangement = Arrangement.SpaceBetween) {
    BasicText(text = label, style = TextStyle(color = mutedText, fontSize = 13.sp))
    BasicText(text = value, style = TextStyle(color = warmText, fontSize = 13.sp))
  }
}

@Composable
private fun SettingRow(label: String, value: String) {
  Row(
    modifier = Modifier
      .fillMaxWidth()
      .background(Color(0x5510181E), RoundedCornerShape(4.dp))
      .padding(horizontal = 12.dp, vertical = 8.dp),
    horizontalArrangement = Arrangement.SpaceBetween,
  ) {
    BasicText(text = label, style = TextStyle(color = mutedText, fontSize = 13.sp))
    BasicText(text = value, style = TextStyle(color = warmText, fontSize = 13.sp))
  }
  Spacer(modifier = Modifier.height(6.dp))
}

@Composable
private fun MenuRow(label: String, selected: Boolean) {
  Box(
    modifier = Modifier
      .fillMaxWidth()
      .background(if (selected) Color(0x33D69A45) else Color.Transparent, RoundedCornerShape(4.dp))
      .padding(horizontal = 12.dp, vertical = 9.dp),
  ) {
    BasicText(text = label, style = TextStyle(color = if (selected) warmText else mutedText, fontSize = 13.sp))
  }
}

@Composable
private fun AmberButtonLabel(text: String) {
  Box(
    modifier = Modifier
      .width(140.dp)
      .height(36.dp)
      .background(accent, RoundedCornerShape(5.dp)),
    contentAlignment = Alignment.Center,
  ) {
    BasicText(text = text, style = TextStyle(color = Color(0xFF241609), fontSize = 13.sp, fontWeight = FontWeight.SemiBold))
  }
}

@Composable
private fun DarkButtonLabel(text: String) {
  Box(
    modifier = Modifier
      .width(140.dp)
      .height(34.dp)
      .background(Color(0x9910181E), RoundedCornerShape(5.dp))
      .border(1.dp, stroke, RoundedCornerShape(5.dp)),
    contentAlignment = Alignment.Center,
  ) {
    BasicText(text = text, style = TextStyle(color = mutedText, fontSize = 12.sp))
  }
}

@Composable
private fun HelpRow(text: String) {
  Box(
    modifier = Modifier
      .fillMaxWidth()
      .background(Color(0x5510181E), RoundedCornerShape(4.dp))
      .padding(horizontal = 12.dp, vertical = 9.dp),
  ) {
    BasicText(text = text, style = TextStyle(color = mutedText, fontSize = 13.sp))
  }
  Spacer(modifier = Modifier.height(7.dp))
}

@Composable
private fun FooterNav(text: String) {
  BasicText(text = text, style = TextStyle(color = softText, fontSize = 12.sp))
}

@Composable
private fun FakeQr() {
  Column(
    modifier = Modifier
      .size(132.dp)
      .background(Color(0xFFF7F1E4), RoundedCornerShape(4.dp))
      .padding(8.dp),
    verticalArrangement = Arrangement.SpaceBetween,
  ) {
    for (row in 0 until 7) {
      Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
        for (col in 0 until 7) {
          val dark = (row + col) % 2 == 0 || row in listOf(0, 6) || col in listOf(0, 6)
          Box(modifier = Modifier.size(10.dp).background(if (dark) Color.Black else Color.White))
        }
      }
    }
  }
}

@Composable
private fun ProgressBar(progress: Int) {
  Box(
    modifier = Modifier
      .fillMaxWidth()
      .height(10.dp)
      .background(Color(0x6610181E), RoundedCornerShape(5.dp)),
  ) {
    Box(
      modifier = Modifier
        .fillMaxWidth((progress.coerceIn(0, 100) / 100f))
        .height(10.dp)
        .background(accent, RoundedCornerShape(5.dp)),
    )
  }
}

private fun buildAlbums(items: List<TvPlaylistItem>): List<TvAlbum> {
  return items
    .groupBy { it.albumName.ifBlank { "家庭时光" } }
    .entries
    .mapIndexed { index, entry ->
      val albumItems = entry.value
      val first = albumItems.first()
      TvAlbum(
        albumId = first.albumId.ifBlank { entry.key },
        coverUrl = first.displayImageUrl,
        description = when (index) {
          0 -> "Family memories"
          1 -> "Travel and smiles"
          else -> "Old photos"
        },
        items = albumItems,
        photoCount = albumItems.size,
        sceneCount = albumItems.map { it.location }.filter { it.isNotBlank() }.distinct().size.coerceAtLeast(1),
        title = entry.key,
        updatedAt = albumItems.maxOfOrNull { it.takenAt } ?: "2024-05-20",
      )
    }
}

private enum class TvAppScreen {
  Login,
  Connecting,
  AlbumSelection,
  AlbumDetail,
  Player,
  Settings,
  Queue,
  SystemInfo,
  ScanProgress,
  ScanDone,
  Disconnected,
  Help,
  EmptyAlbums,
  EmptyPlaylist,
}

private sealed interface TvUpdateUiState {
  data object Idle : TvUpdateUiState
  data class Checking(val manual: Boolean) : TvUpdateUiState
  data class Available(val info: TvAppUpdateInfo) : TvUpdateUiState
  data class Downloading(val info: TvAppUpdateInfo, val progress: Int) : TvUpdateUiState
  data class ReadyToInstall(val info: TvAppUpdateInfo, val file: File) : TvUpdateUiState
  data class Error(val message: String) : TvUpdateUiState
}

enum class TvEmptyStateKind {
  Albums,
  Playlist,
}

data class TvEmptyStateCopy(
  val title: String,
  val description: String,
)

fun emptyStateCopy(kind: TvEmptyStateKind): TvEmptyStateCopy =
  when (kind) {
    TvEmptyStateKind.Albums -> TvEmptyStateCopy(
      title = "暂无图包",
      description = "还没有创建任何可播放的图包",
    )
    TvEmptyStateKind.Playlist -> TvEmptyStateCopy(
      title = "播放列表为空",
      description = "当前图包还没有可播放的照片",
    )
  }

enum class TvTouchTarget {
  AlbumCard,
  AlbumDetail,
  EmptyState,
  LoginButton,
  LoginInput,
  Player,
  QueueCard,
  ScanDone,
}

fun isTouchActivationEnabled(target: TvTouchTarget): Boolean =
  when (target) {
    TvTouchTarget.AlbumCard,
    TvTouchTarget.AlbumDetail,
    TvTouchTarget.EmptyState,
    TvTouchTarget.LoginButton,
    TvTouchTarget.LoginInput,
    TvTouchTarget.Player,
    TvTouchTarget.QueueCard,
    TvTouchTarget.ScanDone -> true
  }

private enum class TvImageLoadState {
  Loading,
  Ready,
  Error,
}

data class TvAlbum(
  val albumId: String,
  val coverUrl: String,
  val description: String,
  val items: List<TvPlaylistItem>,
  val photoCount: Int,
  val sceneCount: Int,
  val title: String,
  val updatedAt: String,
)

data class DeviceLoginResult(
  val ok: Boolean,
  val deviceToken: String = "",
  val message: String,
)

private data class PlaylistLoadResult(
  val ok: Boolean,
  val items: List<TvPlaylistItem> = emptyList(),
  val message: String,
)

private data class AlbumListLoadResult(
  val ok: Boolean,
  val albums: List<TvAlbum> = emptyList(),
  val message: String,
)

private data class AlbumDetailLoadResult(
  val ok: Boolean,
  val album: TvAlbum? = null,
  val message: String,
)

private data class PlayRecordResult(
  val ok: Boolean,
  val message: String,
)

data class TvPlaylistItem(
  val aiComment: String,
  val aiCommentStatus: String,
  val aiLocked: Boolean,
  val aiScore: Int?,
  val aiScoreStatus: String,
  val aiTags: List<String>,
  val albumId: String,
  val albumName: String,
  val animationTemplateId: String,
  val captionStyle: String,
  val captionText: String,
  val captionTitle: String,
  val displayTemplateId: String,
  val displayImageUrl: String,
  val durationMs: Long,
  val aiImageUrl: String,
  val fontStyle: String,
  val fontWeight: String,
  val layoutTemplateId: String,
  val layoutPosition: String,
  val location: String,
  val mediaHeight: Int,
  val mediaOrientation: String,
  val mediaWidth: Int,
  val narrationVariants: List<TvNarrationVariant>,
  val photoId: String,
  val safeArea: TvSafeArea,
  val takenAt: String,
  val textColor: String,
  val topMetaLocation: String,
  val topMetaTime: String,
  val topMetaWeather: String,
) {
  val metaLine: String
    get() = listOf(albumName, takenAt, location)
      .filter { it.isNotBlank() }
      .joinToString(" 路 ")
  val topMetaLine: String
    get() = listOf(topMetaTime, topMetaLocation, topMetaWeather)
      .filter { it.isNotBlank() }
      .joinToString(" / ")
  val declaredIsPortrait: Boolean?
    get() = when {
      mediaOrientation.equals("portrait", ignoreCase = true) -> true
      mediaOrientation.equals("landscape", ignoreCase = true) -> false
      mediaWidth > 0 && mediaHeight > 0 -> mediaHeight > mediaWidth
      else -> null
    }
  val isPortrait: Boolean
    get() = declaredIsPortrait == true

  fun resolveIsPortrait(loadedWidth: Int, loadedHeight: Int): Boolean =
    declaredIsPortrait ?: (loadedWidth > 0 && loadedHeight > loadedWidth)
}

data class TvSafeArea(
  val x: Float,
  val y: Float,
  val w: Float,
  val h: Float,
) {
  fun normalized(): TvSafeArea {
    val normalizedX = x.coerceIn(0f, 0.9f)
    val normalizedY = y.coerceIn(0f, 0.86f)
    val normalizedW = w.coerceIn(0.18f, 0.8f)
    val normalizedH = h.coerceIn(0.08f, 0.5f)
    return copy(
      x = normalizedX,
      y = normalizedY,
      w = normalizedW.coerceAtMost(1f - normalizedX),
      h = normalizedH.coerceAtMost(1f - normalizedY),
    )
  }
}

data class TvNarrationVariant(
  val handwrittenThought: String,
  val lyricalClosure: String,
  val sceneDescription: String,
)

suspend fun loginDevice(
  serverUrl: String,
  username: String,
  password: String,
  deviceUniqueId: String = "android_tv_unknown",
  httpClient: OkHttpClient,
): DeviceLoginResult = withContext(Dispatchers.IO) {
  val apiBase = normalizeApiBase(serverUrl)
  val normalizedDeviceUniqueId = deviceUniqueId.ifBlank { "android_tv_unknown" }
  val body = JSONObject()
    .put("username", username)
    .put("password", password)
    .put("deviceUniqueId", normalizedDeviceUniqueId)
    .put("deviceName", "Android TV $normalizedDeviceUniqueId")
    .put("platform", "AndroidTV")
    .put("appVersion", BuildConfig.VERSION_NAME)
    .toString()

  try {
    val request = Request.Builder()
      .url("$apiBase/device/login")
      .post(body.toRequestBody(jsonMediaType))
      .build()

    httpClient.newCall(request).execute().use { response ->
      if (!response.isSuccessful) {
        return@withContext DeviceLoginResult(false, message = "Login failed: ${response.code}")
      }

      val json = JSONObject(response.body?.string().orEmpty())
      val token = json.optString("deviceToken")
      DeviceLoginResult(
        ok = token.isNotBlank(),
        deviceToken = token,
        message = if (token.isNotBlank()) "Login success" else "Backend did not return device token",
      )
    }
  } catch (error: Exception) {
    DeviceLoginResult(false, message = "Login error: ${error.message ?: "unknown error"}")
  }
}

private suspend fun fetchPlaylist(
  serverUrl: String,
  deviceToken: String,
  httpClient: OkHttpClient,
): PlaylistLoadResult = withContext(Dispatchers.IO) {
  val apiBase = normalizeApiBase(serverUrl)

  try {
    val request = Request.Builder()
      .url("$apiBase/device/playlist")
      .header("Authorization", "Bearer $deviceToken")
      .header("X-Device-Token", deviceToken)
      .get()
      .build()

    httpClient.newCall(request).execute().use { response ->
      if (!response.isSuccessful) {
        return@withContext PlaylistLoadResult(false, message = "Playlist fetch failed: ${response.code}")
      }

      val json = JSONObject(response.body?.string().orEmpty())
      val itemsJson = json.optJSONArray("items")
      val items = mutableListOf<TvPlaylistItem>()
      if (itemsJson != null) {
        for (index in 0 until itemsJson.length()) {
          val itemJson = itemsJson.optJSONObject(index) ?: continue
          items.add(parsePlaylistItem(apiBase, itemJson))
        }
      }

      PlaylistLoadResult(
        ok = true,
        items = items,
        message = if (items.isNotEmpty()) "Playlist loaded: ${items.size} photos" else "Playlist is empty",
      )
    }
  } catch (error: Exception) {
    PlaylistLoadResult(false, message = "Playlist fetch error: ${error.message ?: "unknown error"}")
  }
}

private suspend fun fetchAlbums(
  serverUrl: String,
  deviceToken: String,
  httpClient: OkHttpClient,
): AlbumListLoadResult = withContext(Dispatchers.IO) {
  val apiBase = normalizeApiBase(serverUrl)

  try {
    val request = Request.Builder()
      .url("$apiBase/device/albums")
      .header("Authorization", "Bearer $deviceToken")
      .header("X-Device-Token", deviceToken)
      .get()
      .build()

    httpClient.newCall(request).execute().use { response ->
      if (!response.isSuccessful) {
        return@withContext AlbumListLoadResult(false, message = "Album list fetch failed: ${response.code}")
      }

      val albums = parseAlbumListJson(JSONObject(response.body?.string().orEmpty()), apiBase)
      AlbumListLoadResult(
        ok = true,
        albums = albums,
        message = if (albums.isNotEmpty()) "Albums loaded: ${albums.size}" else "No albums",
      )
    }
  } catch (error: Exception) {
    AlbumListLoadResult(false, message = "Album list fetch error: ${error.message ?: "unknown error"}")
  }
}

private suspend fun fetchAlbumDetail(
  serverUrl: String,
  deviceToken: String,
  albumId: String,
  httpClient: OkHttpClient,
): AlbumDetailLoadResult = withContext(Dispatchers.IO) {
  val apiBase = normalizeApiBase(serverUrl)

  try {
    val request = Request.Builder()
      .url("$apiBase/device/albums/$albumId")
      .header("Authorization", "Bearer $deviceToken")
      .header("X-Device-Token", deviceToken)
      .get()
      .build()

    httpClient.newCall(request).execute().use { response ->
      if (!response.isSuccessful) {
        return@withContext AlbumDetailLoadResult(false, message = "Album detail fetch failed: ${response.code}")
      }

      val album = parseAlbumDetailJson(JSONObject(response.body?.string().orEmpty()), apiBase)
      AlbumDetailLoadResult(
        ok = true,
        album = album,
        message = if (album.items.isNotEmpty()) "Album loaded: ${album.items.size} photos" else "Album is empty",
      )
    }
  } catch (error: Exception) {
    AlbumDetailLoadResult(false, message = "Album detail fetch error: ${error.message ?: "unknown error"}")
  }
}

private suspend fun reportPlayRecord(
  serverUrl: String,
  deviceToken: String,
  item: TvPlaylistItem,
  skipped: Boolean,
  httpClient: OkHttpClient,
): PlayRecordResult = withContext(Dispatchers.IO) {
  val apiBase = normalizeApiBase(serverUrl)
  val durationSeconds = (item.durationMs / 1000).toInt().coerceAtLeast(1)
  val body = JSONObject()
    .put("durationSeconds", durationSeconds)
    .put("photoId", item.photoId)
    .put("policyId", "policy_demo_family")
    .put("skipped", skipped)
    .toString()

  try {
    val request = Request.Builder()
      .url("$apiBase/device/play-record")
      .header("Authorization", "Bearer $deviceToken")
      .header("X-Device-Token", deviceToken)
      .post(body.toRequestBody(jsonMediaType))
      .build()

    httpClient.newCall(request).execute().use { response ->
      if (response.isSuccessful) {
        PlayRecordResult(true, "播放记录已上报：${item.photoId}")
      } else {
        PlayRecordResult(false, "Play record failed: ${response.code}")
      }
    }
  } catch (error: Exception) {
    PlayRecordResult(false, "Play record error: ${error.message ?: "unknown error"}")
  }
}

fun parseAlbumListJson(json: JSONObject, apiBase: String = ""): List<TvAlbum> {
  return parseAlbumArray(json.optJSONArray("albums"), apiBase)
}

fun parseAlbumDetailJson(json: JSONObject, apiBase: String = ""): TvAlbum {
  return parseAlbumJson(json, apiBase, json.optJSONArray("items"))
}

private fun parseAlbumArray(albumsJson: JSONArray?, apiBase: String): List<TvAlbum> {
  val albums = mutableListOf<TvAlbum>()
  if (albumsJson == null) return albums

  for (index in 0 until albumsJson.length()) {
    val albumJson = albumsJson.optJSONObject(index) ?: continue
    albums.add(parseAlbumJson(albumJson, apiBase, albumJson.optJSONArray("items")))
  }

  return albums
}

private fun parseAlbumJson(json: JSONObject, apiBase: String, itemsJson: JSONArray?): TvAlbum {
  val items = parsePlaylistItems(apiBase, itemsJson)
  val title = json.optString("title").ifBlank { "Untitled album" }
  return TvAlbum(
    albumId = json.optString("albumId"),
    coverUrl = resolveApiUrl(apiBase, json.optString("coverImageUrl").ifBlank {
      json.optString("thumbnailUrl")
    }),
    description = json.optString("description").ifBlank { "No description" },
    items = items,
    photoCount = json.optInt("photoCount", items.size),
    sceneCount = items.map { it.location }.filter { it.isNotBlank() }.distinct().size.coerceAtLeast(1),
    title = title,
    updatedAt = json.optString("updatedAt").ifBlank {
      json.optString("latestTakenAt").ifBlank { items.maxOfOrNull { it.takenAt } ?: "2024-05-20" }
    },
  )
}

private fun parsePlaylistItems(apiBase: String, itemsJson: JSONArray?): List<TvPlaylistItem> {
  val items = mutableListOf<TvPlaylistItem>()
  if (itemsJson == null) return items

  for (index in 0 until itemsJson.length()) {
    val itemJson = itemsJson.optJSONObject(index) ?: continue
    items.add(parsePlaylistItem(apiBase, itemJson))
  }

  return items
}

fun parsePlaylistItem(apiBase: String, json: JSONObject): TvPlaylistItem {
  val ai = json.optJSONObject("ai")
  val caption = json.optJSONObject("caption")
  val display = json.optJSONObject("display")
  val layout = json.optJSONObject("layout")
  val media = json.optJSONObject("media")
  val topMeta = json.optJSONObject("topMeta")
  val animationTemplateId = display?.optString("animationTemplateId").orEmpty().ifBlank {
    json.optString("animationTemplateId")
  }
  val captionStyle = display?.optString("captionStyle").orEmpty().ifBlank {
    caption?.optString("style").orEmpty()
  }
  val layoutTemplateId = display?.optString("layoutTemplateId").orEmpty().ifBlank {
    json.optString("layoutTemplateId")
  }
  val displayImageUrl = display?.optString("tvImageUrl").orEmpty().ifBlank {
    json.optString("displayImageUrl")
  }
  return TvPlaylistItem(
    aiComment = ai?.optString("comment").orEmpty(),
    aiCommentStatus = ai?.optString("commentStatus", "pending") ?: "pending",
    aiLocked = ai?.optBoolean("locked", false) ?: false,
    aiScore = if (ai != null && !ai.isNull("score")) ai.optInt("score") else null,
    aiScoreStatus = ai?.optString("scoreStatus", "pending") ?: "pending",
    aiTags = parseStringList(ai?.optJSONArray("tags")),
    albumId = json.optString("albumId"),
    albumName = json.optString("albumName"),
    animationTemplateId = animationTemplateId,
    captionStyle = captionStyle,
    captionText = caption?.optString("text").orEmpty(),
    captionTitle = caption?.optString("title").orEmpty().ifBlank {
      json.optString("photoId", "Untitled photo")
    },
    displayTemplateId = display?.optString("templateId").orEmpty(),
    displayImageUrl = resolveApiUrl(apiBase, displayImageUrl),
    durationMs = json.optLong("durationMs", 12_000L),
    aiImageUrl = resolveApiUrl(apiBase, display?.optString("aiImageUrl").orEmpty()),
    fontStyle = display?.optString("fontStyle").orEmpty().ifBlank { "sans-serif" },
    fontWeight = display?.optString("fontWeight").orEmpty().ifBlank { "regular" },
    layoutTemplateId = layoutTemplateId,
    layoutPosition = layout?.optString("position").orEmpty().ifBlank { "left_bottom" },
    location = json.optString("location"),
    mediaHeight = media?.optInt("height", 0) ?: 0,
    mediaOrientation = media?.optString("orientation", "unknown") ?: "unknown",
    mediaWidth = media?.optInt("width", 0) ?: 0,
    narrationVariants = parseNarrationVariants(json.optJSONArray("narrationVariants")),
    photoId = json.optString("photoId"),
    safeArea = parseSafeArea(layout?.optJSONObject("safeArea")),
    takenAt = json.optString("takenAt"),
    textColor = display?.optString("textColor").orEmpty().ifBlank { "#FFFFFF" },
    topMetaLocation = topMeta?.optString("location").orEmpty(),
    topMetaTime = topMeta?.optString("time").orEmpty(),
    topMetaWeather = topMeta?.optString("weather").orEmpty(),
  )
}

private fun parseSafeArea(json: JSONObject?): TvSafeArea {
  if (json == null) return TvSafeArea(x = 0.08f, y = 0.32f, w = 0.42f, h = 0.28f)
  return TvSafeArea(
    x = json.optDouble("x", 0.08).toFloat(),
    y = json.optDouble("y", 0.32).toFloat(),
    w = json.optDouble("w", 0.42).toFloat(),
    h = json.optDouble("h", 0.28).toFloat(),
  )
}

private fun parseNarrationVariants(json: JSONArray?): List<TvNarrationVariant> {
  if (json == null) return emptyList()
  return buildList {
    for (index in 0 until json.length()) {
      val candidate = json.optJSONObject(index) ?: continue
      val variant = TvNarrationVariant(
        handwrittenThought = candidate.optString("handwrittenThought").trim(),
        lyricalClosure = candidate.optString("lyricalClosure").trim(),
        sceneDescription = candidate.optString("sceneDescription").trim(),
      )
      if (
        variant.sceneDescription.isNotBlank() &&
        variant.handwrittenThought.isNotBlank() &&
        variant.lyricalClosure.isNotBlank()
      ) {
        add(variant)
      }
    }
  }
}

private fun TvPlaylistItem.captionLines(): List<String> {
  val text = aiComment
    .ifBlank { captionText }
    .replace(Regex("\\s+"), "")
    .trim('，', '。', ',', '.', ' ')
    .ifBlank { "这一刻，轻轻留在记忆里" }
  if (text.length <= 12) return listOf(text)

  val segments = text
    .split('，', '。', '、', ',', '.', '；', ';', ' ')
    .map { it.trim() }
    .filter { it.isNotBlank() }
  if (segments.size in 2..3) return segments.take(3)

  val lineCount = if (text.length <= 24) 2 else 3
  val lineLength = kotlin.math.ceil(text.length.toDouble() / lineCount).toInt()
  return text.chunked(lineLength).take(3)
}

private fun TvPlaylistItem.captionColor(): Color {
  return when (textColor.uppercase()) {
    "#000000" -> Color.Black
    "#FFFFFF" -> Color.White
    else -> Color.White
  }
}

private fun TvPlaylistItem.captionFontFamily(): FontFamily {
  return when (fontStyle.lowercase()) {
    "handwriting" -> FontFamily.Cursive
    "serif" -> FontFamily.Serif
    else -> FontFamily.SansSerif
  }
}

private fun TvPlaylistItem.captionFontWeight(isEmphasis: Boolean): FontWeight {
  return when (fontWeight.lowercase()) {
    "bold", "heavy" -> FontWeight.Bold
    "light" -> FontWeight.Light
    "regular" -> if (isEmphasis) FontWeight.Medium else FontWeight.Normal
    else -> if (isEmphasis) FontWeight.SemiBold else FontWeight.Medium
  }
}

private fun TvPlaylistItem.captionHorizontalAlignment(): Alignment.Horizontal {
  return when (layoutPosition.lowercase()) {
    "right_bottom", "top_right", "bottom_right" -> Alignment.End
    "center_safe" -> Alignment.CenterHorizontally
    else -> Alignment.Start
  }
}

private fun parseStringList(json: JSONArray?): List<String> {
  if (json == null) return emptyList()
  val items = mutableListOf<String>()
  for (index in 0 until json.length()) {
    val item = json.optString(index)
    if (item.isNotBlank()) items.add(item)
  }
  return items
}

private val jsonMediaType = "application/json; charset=utf-8".toMediaType()

fun normalizeApiBase(serverUrl: String): String {
  val normalizedUrl = serverUrl.trim().trimEnd('/')
  return if (normalizedUrl.endsWith("/api")) normalizedUrl else "$normalizedUrl/api"
}

fun defaultServerUrl(): String {
  return BuildConfig.WRJDYK_TV_DEFAULT_SERVER_URL.trim().ifBlank { fallbackServerUrl }
}

fun preferredServerUrl(
  storedServerUrl: String?,
  buildDefaultServerUrl: String = defaultServerUrl(),
): String {
  val stored = storedServerUrl?.trim().orEmpty()
  val buildDefault = buildDefaultServerUrl.trim().ifBlank { fallbackServerUrl }
  if (stored.isBlank()) return buildDefault
  if (isLegacyLocalBackendUrl(stored) && !isLegacyLocalBackendUrl(buildDefault)) return buildDefault
  if (isLoopbackServerUrl(stored) && !isLoopbackServerUrl(buildDefault)) return buildDefault
  return stored
}

private fun isLegacyLocalBackendUrl(serverUrl: String): Boolean {
  val uri = try {
    java.net.URI(serverUrl.trim())
  } catch (_: IllegalArgumentException) {
    return false
  }
  val host = uri.host.orEmpty().lowercase()
  val port = if (uri.port == -1) 80 else uri.port
  return host in setOf("localhost", "127.0.0.1", "192.168.10.188") && port in setOf(3100, 3101)
}

fun isLoopbackServerUrl(serverUrl: String): Boolean {
  val host = try {
    java.net.URI(serverUrl.trim()).host.orEmpty().lowercase()
  } catch (_: IllegalArgumentException) {
    return false
  }
  return host == "localhost" || host == "127.0.0.1" || host == "::1"
}

private fun resolveApiUrl(apiBase: String, path: String): String {
  val normalizedPath = path.trim()
  if (normalizedPath.startsWith("http://") || normalizedPath.startsWith("https://")) {
    return normalizedPath
  }

  val apiRoot = if (apiBase.endsWith("/api")) apiBase.removeSuffix("/api") else apiBase
  return when {
    normalizedPath.startsWith("/api/") -> "$apiRoot$normalizedPath"
    normalizedPath.startsWith("/") -> "$apiBase$normalizedPath"
    else -> "$apiBase/$normalizedPath"
  }
}
