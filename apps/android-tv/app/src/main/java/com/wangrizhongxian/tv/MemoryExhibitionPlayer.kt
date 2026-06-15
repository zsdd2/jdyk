package com.wangrizhongxian.tv

import android.view.KeyEvent as AndroidKeyEvent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shadow
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.ImageLoader
import coil3.compose.AsyncImage
import coil3.request.ImageRequest
import kotlinx.coroutines.delay

@Composable
fun MemoryExhibitionPlayer(
  currentIndex: Int,
  imageLoader: ImageLoader,
  item: TvPlaylistItem,
  itemCount: Int,
  nextItem: TvPlaylistItem?,
  playbackSessionSeed: Int,
  onAutoNext: () -> Unit,
  onBack: () -> Unit,
  onNext: () -> Unit,
  onOpenQueue: () -> Unit,
  onOpenSettings: () -> Unit,
  onPrevious: () -> Unit,
  playbackStatusText: String,
  touchEnabled: Boolean,
  thumbnailStrip: @Composable () -> Unit,
) {
  val context = LocalContext.current
  val focusRequester = remember { FocusRequester() }
  var imageLoadState by remember(item.displayImageUrl) {
    mutableStateOf(ExhibitionImageLoadState.Loading)
  }
  var loadedImageWidth by remember(item.displayImageUrl) { mutableIntStateOf(0) }
  var loadedImageHeight by remember(item.displayImageUrl) { mutableIntStateOf(0) }
  var showPlaybackChrome by remember { mutableStateOf(true) }
  var showPlaybackMenu by remember { mutableStateOf(false) }
  var playbackMenuIndex by remember { mutableIntStateOf(0) }
  var chromeVisibilityTick by remember { mutableIntStateOf(0) }
  val menuItems = listOf("播放设置", "幻灯片播放", "循环播放", "照片信息", "返回相册")
  val motionProgress = remember(item.photoId) { Animatable(0f) }
  val textProgress = remember(item.photoId) { Animatable(0f) }
  val textBreath by rememberInfiniteTransition(label = "caption-breath")
    .animateFloat(
      initialValue = 0.92f,
      targetValue = 1f,
      animationSpec = infiniteRepeatable(
        animation = tween(durationMillis = 2_800),
        repeatMode = RepeatMode.Reverse,
      ),
      label = "caption-alpha",
    )
  val narrationVariant = item.selectedNarrationVariant()
  val isPortrait = item.resolveIsPortrait(loadedImageWidth, loadedImageHeight)
  val portraitVariant = if (isPortrait) {
    portraitLayoutVariantFor(item.photoId, playbackSessionSeed)
  } else {
    null
  }

  LaunchedEffect(item.photoId, item.durationMs) {
    motionProgress.snapTo(0f)
    textProgress.snapTo(0f)
    textProgress.animateTo(1f, animationSpec = tween(durationMillis = 1_350))
  }
  LaunchedEffect(item.photoId, item.durationMs) {
    motionProgress.animateTo(
      targetValue = 1f,
      animationSpec = tween(durationMillis = item.durationMs.coerceAtLeast(8_000L).toInt()),
    )
  }
  LaunchedEffect(nextItem?.displayImageUrl) {
    val nextUrl = nextItem?.displayImageUrl.orEmpty()
    if (nextUrl.isNotBlank()) {
      imageLoader.enqueue(ImageRequest.Builder(context).data(nextUrl).build())
    }
  }
  LaunchedEffect(currentIndex, item.photoId, item.durationMs, itemCount) {
    if (itemCount > 1) {
      delay(item.durationMs.coerceAtLeast(4_000L))
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
      .clickable(enabled = touchEnabled, onClick = { revealPlaybackChrome() })
      .onPreviewKeyEvent { event ->
        if (event.type != KeyEventType.KeyUp) return@onPreviewKeyEvent false
        if (showPlaybackMenu) {
          when (event.key) {
            Key.DirectionUp -> {
              playbackMenuIndex = (playbackMenuIndex - 1).coerceAtLeast(0)
              true
            }
            Key.DirectionDown -> {
              playbackMenuIndex = (playbackMenuIndex + 1).coerceAtMost(menuItems.lastIndex)
              true
            }
            Key.DirectionCenter, Key.Enter -> {
              when (playbackMenuIndex) {
                0 -> onOpenSettings()
                1 -> showPlaybackMenu = false
                2 -> showPlaybackMenu = false
                3 -> {
                  showPlaybackMenu = false
                  onOpenQueue()
                }
                4 -> onBack()
              }
              true
            }
            Key.Back -> {
              showPlaybackMenu = false
              true
            }
            else -> false
          }
        } else if (event.key == Key(AndroidKeyEvent.KEYCODE_MENU)) {
          showPlaybackMenu = true
          revealPlaybackChrome()
          true
        } else {
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
      }
      .focusable(),
  ) {
    ImageStage(
      imageLoader = imageLoader,
      item = item,
      motionProgress = motionProgress.value,
      portraitVariant = portraitVariant,
      onLoading = { imageLoadState = ExhibitionImageLoadState.Loading },
      onReady = { width, height ->
        loadedImageWidth = width
        loadedImageHeight = height
        imageLoadState = ExhibitionImageLoadState.Ready
      },
      onError = { imageLoadState = ExhibitionImageLoadState.Error },
    )
    OverlayStage()
    CaptionStage(
      item = item,
      narrationVariant = narrationVariant,
      portraitVariant = portraitVariant,
      textAlpha = textProgress.value * textBreath,
      textOffset = 18f * (1f - textProgress.value),
    )

    AnimatedVisibility(
      visible = showPlaybackMenu,
      enter = fadeIn(animationSpec = tween(durationMillis = 180)),
      exit = fadeOut(animationSpec = tween(durationMillis = 220)),
      modifier = Modifier.align(Alignment.CenterStart),
    ) {
      PlaybackMenuOverlay(
        albumTitle = item.albumName,
        currentIndex = currentIndex,
        itemCount = itemCount,
        menuItems = menuItems,
        selectedIndex = playbackMenuIndex,
      )
    }

    BasicText(
      modifier = Modifier
        .align(Alignment.TopEnd)
        .padding(horizontal = 42.dp, vertical = 30.dp),
      text = "${currentIndex + 1} / $itemCount",
      style = TextStyle(color = Color(0x99FFF3DF), fontSize = 17.sp),
    )

    AnimatedVisibility(
      visible = showPlaybackChrome || showPlaybackMenu,
      enter = fadeIn(animationSpec = tween(durationMillis = 300)),
      exit = fadeOut(animationSpec = tween(durationMillis = 1_800)),
      modifier = Modifier.align(Alignment.BottomStart),
    ) {
      Column(
        modifier = Modifier
          .fillMaxWidth()
          .padding(horizontal = 64.dp, vertical = 34.dp),
      ) {
        BasicText(
          text = item.metaLine,
          style = TextStyle(color = Color(0xA6FFF3DF), fontSize = 17.sp),
        )
        if (playbackStatusText.isNotBlank()) {
          Spacer(modifier = Modifier.height(10.dp))
          BasicText(
            text = playbackStatusText,
            style = TextStyle(color = Color(0x73FFF3DF), fontSize = 14.sp),
          )
        }
        Spacer(modifier = Modifier.height(16.dp))
        thumbnailStrip()
      }
    }

    when (imageLoadState) {
      ExhibitionImageLoadState.Loading -> ExhibitionStatus(
        modifier = Modifier.align(Alignment.Center),
        title = "正在布展",
        detail = item.captionTitle,
      )
      ExhibitionImageLoadState.Error -> ExhibitionStatus(
        modifier = Modifier.align(Alignment.Center),
        title = "图片加载失败",
        detail = item.displayImageUrl,
      )
      ExhibitionImageLoadState.Ready -> Unit
    }
  }
}

@Composable
private fun PlaybackMenuOverlay(
  albumTitle: String,
  currentIndex: Int,
  itemCount: Int,
  menuItems: List<String>,
  selectedIndex: Int,
) {
  Column(
    modifier = Modifier
      .padding(start = 42.dp, top = 92.dp)
      .width(500.dp)
      .background(Color(0x7A050607), RoundedCornerShape(10.dp))
      .border(1.dp, Color.White.copy(alpha = 0.18f), RoundedCornerShape(10.dp))
      .padding(horizontal = 18.dp, vertical = 18.dp),
  ) {
    BasicText(
      text = albumTitle.ifBlank { "播放相册" },
      style = TextStyle(color = Color(0xFFD69A45), fontSize = 26.sp, fontWeight = FontWeight.SemiBold),
    )
    Spacer(modifier = Modifier.height(8.dp))
    BasicText(
      text = "${currentIndex + 1} / $itemCount",
      style = TextStyle(color = Color(0xCCFFF3DF), fontSize = 19.sp),
    )
    Spacer(modifier = Modifier.height(32.dp))
    menuItems.forEachIndexed { index, label ->
      PlaybackMenuRow(
        icon = when (index) {
          0 -> "⌘"
          1 -> "▣"
          2 -> "↻"
          3 -> "ⓘ"
          else -> "↩"
        },
        label = label,
        subLabel = if (index == 2) "关闭" else "",
        selected = index == selectedIndex,
      )
      if (index == 3) {
        Spacer(modifier = Modifier.height(18.dp))
        Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(Color.White.copy(alpha = 0.16f)))
        Spacer(modifier = Modifier.height(18.dp))
      }
    }
  }
}

@Composable
private fun PlaybackMenuRow(icon: String, label: String, subLabel: String, selected: Boolean) {
  Row(
    modifier = Modifier
      .fillMaxWidth()
      .height(76.dp)
      .background(if (selected) Color(0x1FD69A45) else Color.Transparent, RoundedCornerShape(7.dp))
      .border(if (selected) 2.dp else 0.dp, if (selected) Color(0xFFD69A45) else Color.Transparent, RoundedCornerShape(7.dp))
      .padding(horizontal = 18.dp),
    verticalAlignment = Alignment.CenterVertically,
  ) {
    BasicText(text = icon, style = TextStyle(color = Color(0xDDEDE3D3), fontSize = 25.sp))
    Spacer(modifier = Modifier.width(28.dp))
    Column(modifier = Modifier.weight(1f)) {
      BasicText(text = label, style = TextStyle(color = Color.White, fontSize = 24.sp, fontWeight = FontWeight.Medium))
      if (subLabel.isNotBlank()) {
        Spacer(modifier = Modifier.height(3.dp))
        BasicText(text = subLabel, style = TextStyle(color = Color(0x99FFF3DF), fontSize = 17.sp))
      }
    }
    BasicText(text = "›", style = TextStyle(color = Color(0xDDEDE3D3), fontSize = 32.sp))
  }
}

@Composable
private fun ImageStage(
  imageLoader: ImageLoader,
  item: TvPlaylistItem,
  motionProgress: Float,
  portraitVariant: PortraitLayoutVariant?,
  onLoading: () -> Unit,
  onReady: (Int, Int) -> Unit,
  onError: () -> Unit,
) {
  val context = LocalContext.current
  val foregroundRequest = ImageRequest.Builder(context).data(item.displayImageUrl).build()
  val backgroundRequest = ImageRequest.Builder(context).data(item.backgroundImageUrl).build()
  val scale = foregroundMotionScale(portraitVariant, motionProgress)
  val translateX = 0f
  val translateY = foregroundMotionTranslationY(portraitVariant, motionProgress)

  BoxWithConstraints(modifier = Modifier.fillMaxSize()) {
    if (shouldRenderBlurredBackground(portraitVariant)) {
      AsyncImage(
        model = backgroundRequest,
        imageLoader = imageLoader,
        contentDescription = item.captionTitle,
        contentScale = ContentScale.Crop,
        modifier = Modifier
          .fillMaxSize()
          .graphicsLayer {
            scaleX = 1.08f + 0.025f * motionProgress
            scaleY = 1.08f + 0.025f * motionProgress
          }
          .blur(22.dp),
      )
      Box(modifier = Modifier.fillMaxSize().background(Color(0x22000000)))
    } else {
      Box(modifier = Modifier.fillMaxSize().background(Color(0xFF050505)))
    }

    val photoFrame = when (portraitVariant) {
      PortraitLayoutVariant.PhotoRight -> portraitPhotoRightFrame()
      PortraitLayoutVariant.PhotoLeft -> portraitPhotoLeftFrame()
      else -> null
    }
    val foregroundModifier = Modifier.graphicsLayer {
      scaleX = scale
      scaleY = scale
      translationX = translateX
      translationY = translateY
    }
    if (photoFrame == null) {
      AsyncImage(
        model = foregroundRequest,
        imageLoader = imageLoader,
        contentDescription = item.captionTitle,
        contentScale = foregroundContentScale(portraitVariant),
        onError = { onError() },
        onLoading = { onLoading() },
        onSuccess = { state -> onReady(state.result.image.width, state.result.image.height) },
        modifier = Modifier.fillMaxSize().then(foregroundModifier),
      )
    } else {
      Box(
        modifier = Modifier
          .padding(
            start = maxWidth * (photoFrame.left / CinematicCaptionCanvasWidth),
            top = maxHeight * (photoFrame.top / CinematicCaptionCanvasHeight),
          )
          .width(maxWidth * (photoFrame.width / CinematicCaptionCanvasWidth))
          .height(maxHeight * (photoFrame.height / CinematicCaptionCanvasHeight))
          .clipToBounds(),
      ) {
        AsyncImage(
          model = foregroundRequest,
          imageLoader = imageLoader,
          contentDescription = item.captionTitle,
          contentScale = ContentScale.Crop,
          onError = { onError() },
          onLoading = { onLoading() },
          onSuccess = { state -> onReady(state.result.image.width, state.result.image.height) },
          modifier = Modifier.fillMaxSize().then(foregroundModifier),
        )
      }
    }
  }
}

@Composable
private fun OverlayStage() {
  Box(
    modifier = Modifier
      .fillMaxSize()
      .background(
        Brush.radialGradient(
          colors = listOf(Color.Transparent, Color(0x26000000), Color(0x62000000)),
          radius = 1_150f,
        ),
      ),
  )
  Box(
    modifier = Modifier
      .fillMaxSize()
      .background(
        Brush.verticalGradient(
          listOf(Color.Transparent, Color(0x12000000), Color(0x68000000)),
        ),
      ),
  )
}

@Composable
private fun CaptionStage(
  item: TvPlaylistItem,
  narrationVariant: TvNarrationVariant?,
  portraitVariant: PortraitLayoutVariant?,
  textAlpha: Float,
  textOffset: Float,
) {
  BoxWithConstraints(modifier = Modifier.fillMaxSize()) {
    val lines = item.cinematicNarrationLines(narrationVariant)
    val density = LocalDensity.current
    val designLines = cinematicCaptionDesignLines(portraitVariant)
    val metaSpec = when (portraitVariant) {
      PortraitLayoutVariant.PhotoRight -> portraitPhotoRightMetaSpec()
      PortraitLayoutVariant.PhotoLeft -> portraitPhotoLeftMetaSpec()
      PortraitLayoutVariant.Center -> portraitCenterMetaSpec()
      null -> landscapeMetaSpec()
    }
    val allSpecs = if (item.topMetaLine.isNotBlank()) {
      listOf(metaSpec) + designLines
    } else {
      designLines
    }
    val safeArea = cinematicSubtitleArea(allSpecs)
    val stageWidth = maxWidth
    val stageHeight = maxHeight
    Box(
      modifier = Modifier
        .fillMaxSize()
        .background(
          Brush.verticalGradient(
            colorStops = arrayOf(
              0.00f to Color.Transparent,
              0.54f to Color.Transparent,
              0.76f to Color(0x52000000),
              1.00f to Color(0xB8000000),
            ),
          ),
        ),
    )
    Box(
      modifier = Modifier
        .padding(
          start = stageWidth * safeArea.x,
          top = stageHeight * safeArea.y,
        )
        .width(stageWidth * safeArea.w)
        .height(stageHeight * safeArea.h)
        .graphicsLayer {
          alpha = textAlpha.coerceIn(0f, 1f)
          translationY = textOffset
        },
    ) {
      val renderedLines = buildList {
        if (item.topMetaLine.isNotBlank()) {
          add(Triple(item.topMetaLine, metaSpec, CaptionRole.Normal))
        }
        designLines.forEachIndexed { index, spec ->
          val line = lines.getOrNull(index) ?: return@forEachIndexed
          val role = when {
            lines.size >= 3 && index == 1 -> CaptionRole.Emphasis
            index == lines.lastIndex -> CaptionRole.Soft
            else -> CaptionRole.Normal
          }
          add(Triple(line, spec, role))
        }
      }
      renderedLines.forEach { (line, spec, role) ->
        val displayLines = cinematicDisplayLines(
          text = line,
          role = role,
          wrapEmphasis = portraitEmphasisWrapEnabled(portraitVariant),
        )
        val displayText = displayLines.joinToString("\n")
        val fit = cinematicCaptionFit(displayLines, spec, role)
        val fittedLineHeight = (fit.fontSize.toFloat() * spec.lineHeight / spec.fontSize).toInt()
        val fontSize = with(density) {
          (stageHeight.toPx() * fit.fontSize / CinematicCaptionCanvasHeight).toSp()
        }
        val lineHeight = with(density) {
          (stageHeight.toPx() * fittedLineHeight / CinematicCaptionCanvasHeight).toSp()
        }
        val letterSpacing = with(density) {
          (stageHeight.toPx() * fit.letterSpacing / CinematicCaptionCanvasHeight).toSp()
        }
        BasicText(
          modifier = Modifier
            .padding(
              start = stageWidth * ((spec.left - safeArea.x * CinematicCaptionCanvasWidth) / CinematicCaptionCanvasWidth),
              top = stageHeight * ((spec.top - safeArea.y * CinematicCaptionCanvasHeight) / CinematicCaptionCanvasHeight),
            )
            .width(stageWidth * (spec.width / CinematicCaptionCanvasWidth))
            .height(stageHeight * (spec.height / CinematicCaptionCanvasHeight)),
          maxLines = if (role == CaptionRole.Emphasis) 2 else 1,
          overflow = TextOverflow.Visible,
          softWrap = false,
          text = cinematicCaptionText(displayText, role),
          style = cinematicSubtitleTextStyle(
            role = role,
            fontSize = fontSize,
            letterSpacing = letterSpacing,
            lineHeight = lineHeight,
          ),
        )
      }
    }
  }
}

@Composable
private fun ExhibitionStatus(modifier: Modifier, title: String, detail: String) {
  Column(modifier = modifier, horizontalAlignment = Alignment.CenterHorizontally) {
    BasicText(
      text = title,
      style = TextStyle(
        color = Color(0xFFD69A45),
        fontSize = 24.sp,
        fontWeight = FontWeight.SemiBold,
      ),
    )
    if (detail.isNotBlank()) {
      Spacer(modifier = Modifier.height(10.dp))
      BasicText(
        text = detail.take(80),
        style = TextStyle(color = Color(0xA6FFF3DF), fontSize = 14.sp),
      )
    }
  }
}

private enum class ExhibitionImageLoadState {
  Loading,
  Ready,
  Error,
}

internal enum class CaptionRole {
  Normal,
  Emphasis,
  Soft,
}

internal enum class PortraitLayoutVariant {
  Center,
  PhotoRight,
  PhotoLeft,
}

internal data class CinematicCaptionLineSpec(
  val fontSize: Int,
  val height: Int,
  val left: Int,
  val letterSpacing: Int,
  val lineHeight: Int,
  val top: Int,
  val width: Int,
)

internal data class CinematicPhotoFrame(
  val height: Int,
  val left: Int,
  val top: Int,
  val width: Int,
)

internal data class CinematicCaptionFit(
  val fontSize: Int,
  val letterSpacing: Int,
)

private const val CinematicCaptionCanvasWidth = 3840f
private const val CinematicCaptionCanvasHeight = 2160f
private val cinematicHandwrittenFontFamily = FontFamily(Font(R.font.shangshou_zhuiguang))
private val cinematicSupportingFontFamily = FontFamily(Font(R.font.lxgw_heart_serif_chs))

private fun cinematicCaptionDesignLines(
  portraitVariant: PortraitLayoutVariant?,
): List<CinematicCaptionLineSpec> {
  return when (portraitVariant) {
    null -> cinematicCaptionDesignLines()
    PortraitLayoutVariant.Center -> portraitOverlayCaptionDesignLines()
    PortraitLayoutVariant.PhotoRight -> portraitPhotoRightCaptionDesignLines()
    PortraitLayoutVariant.PhotoLeft -> portraitPhotoLeftCaptionDesignLines()
  }
}

internal fun portraitLayoutVariantFor(photoId: String, sessionSeed: Int = 0): PortraitLayoutVariant {
  val variants = PortraitLayoutVariant.entries
  val mixedHash = photoId.hashCode() xor (sessionSeed * -0x61c88647)
  return variants[Math.floorMod(mixedHash, variants.size)]
}

internal fun cinematicCaptionDesignLines(): List<CinematicCaptionLineSpec> {
  return listOf(
    CinematicCaptionLineSpec(
      left = 730,
      top = 1524,
      width = 2380,
      height = 90,
      fontSize = 88,
      lineHeight = 104,
      letterSpacing = 42,
    ),
    CinematicCaptionLineSpec(
      left = 730,
      top = 1691,
      width = 2380,
      height = 240,
      fontSize = 240,
      lineHeight = 240,
      letterSpacing = 2,
    ),
    CinematicCaptionLineSpec(
      left = 930,
      top = 1960,
      width = 1980,
      height = 84,
      fontSize = 84,
      lineHeight = 100,
      letterSpacing = 36,
    ),
  )
}

internal fun portraitPhotoFrame(): CinematicPhotoFrame {
  return CinematicPhotoFrame(
    left = 1313,
    top = 0,
    width = 1215,
    height = 2160,
  )
}

internal fun portraitPhotoRightFrame(): CinematicPhotoFrame {
  return CinematicPhotoFrame(
    left = 2341,
    top = 0,
    width = 1215,
    height = 2160,
  )
}

internal fun portraitPhotoLeftFrame(): CinematicPhotoFrame {
  return CinematicPhotoFrame(
    left = 284,
    top = 0,
    width = 1215,
    height = 2160,
  )
}

internal fun landscapeMetaSpec(): CinematicCaptionLineSpec {
  return CinematicCaptionLineSpec(
    left = 300,
    top = 130,
    width = 3240,
    height = 76,
    fontSize = 63,
    lineHeight = 76,
    letterSpacing = 22,
  )
}

internal fun portraitCenterMetaSpec(): CinematicCaptionLineSpec {
  return CinematicCaptionLineSpec(
    left = 1360,
    top = 130,
    width = 1120,
    height = 76,
    fontSize = 63,
    lineHeight = 76,
    letterSpacing = 22,
  )
}

internal fun portraitOverlayCaptionDesignLines(): List<CinematicCaptionLineSpec> {
  return listOf(
    CinematicCaptionLineSpec(
      left = 1070,
      top = 1390,
      width = 1700,
      height = 82,
      fontSize = 68,
      lineHeight = 82,
      letterSpacing = 22,
    ),
    CinematicCaptionLineSpec(
      left = 970,
      top = 1510,
      width = 1900,
      height = 320,
      fontSize = 180,
      lineHeight = 180,
      letterSpacing = 2,
    ),
    CinematicCaptionLineSpec(
      left = 1170,
      top = 1850,
      width = 1500,
      height = 90,
      fontSize = 76,
      lineHeight = 90,
      letterSpacing = 28,
    ),
  )
}

internal fun portraitPhotoRightMetaSpec(): CinematicCaptionLineSpec {
  return CinematicCaptionLineSpec(
    left = 269,
    top = 130,
    width = 1920,
    height = 76,
    fontSize = 63,
    lineHeight = 76,
    letterSpacing = 22,
  )
}

internal fun portraitPhotoLeftMetaSpec(): CinematicCaptionLineSpec {
  return CinematicCaptionLineSpec(
    left = 1594,
    top = 130,
    width = 1977,
    height = 76,
    fontSize = 63,
    lineHeight = 76,
    letterSpacing = 22,
  )
}

internal fun portraitPhotoRightCaptionDesignLines(): List<CinematicCaptionLineSpec> {
  return listOf(
    CinematicCaptionLineSpec(
      left = 221,
      top = 1030,
      width = 1900,
      height = 82,
      fontSize = 68,
      lineHeight = 82,
      letterSpacing = 22,
    ),
    CinematicCaptionLineSpec(
      left = 221,
      top = 1200,
      width = 1900,
      height = 590,
      fontSize = 276,
      lineHeight = 276,
      letterSpacing = 2,
    ),
    CinematicCaptionLineSpec(
      left = 221,
      top = 1850,
      width = 1900,
      height = 108,
      fontSize = 95,
      lineHeight = 108,
      letterSpacing = 36,
    ),
  )
}

internal fun portraitPhotoLeftCaptionDesignLines(): List<CinematicCaptionLineSpec> {
  return listOf(
    CinematicCaptionLineSpec(
      left = 1719,
      top = 1030,
      width = 1900,
      height = 82,
      fontSize = 68,
      lineHeight = 82,
      letterSpacing = 22,
    ),
    CinematicCaptionLineSpec(
      left = 1719,
      top = 1200,
      width = 1900,
      height = 490,
      fontSize = 226,
      lineHeight = 226,
      letterSpacing = 2,
    ),
    CinematicCaptionLineSpec(
      left = 1719,
      top = 1750,
      width = 1900,
      height = 108,
      fontSize = 95,
      lineHeight = 108,
      letterSpacing = 36,
    ),
  )
}

internal fun cinematicEmphasisLines(text: String): List<String> {
  val characters = text.toList()
  if (characters.size <= 8) return listOf(text)
  if (characters.size <= 16) {
    return listOf(
      characters.take(8).joinToString(""),
      characters.drop(8).joinToString(""),
    )
  }
  val splitAt = kotlin.math.ceil(characters.size / 2.0).toInt()
  return listOf(
    characters.take(splitAt).joinToString(""),
    characters.drop(splitAt).joinToString(""),
  )
}

internal fun foregroundContentScale(
  portraitVariant: PortraitLayoutVariant?,
): ContentScale =
  when (portraitVariant) {
    PortraitLayoutVariant.Center -> ContentScale.Fit
    PortraitLayoutVariant.PhotoRight,
    PortraitLayoutVariant.PhotoLeft -> ContentScale.Crop
    null -> ContentScale.Fit
  }

internal fun shouldRenderBlurredBackground(
  portraitVariant: PortraitLayoutVariant?,
): Boolean = portraitVariant == null || portraitVariant == PortraitLayoutVariant.Center

internal fun foregroundMotionScale(
  portraitVariant: PortraitLayoutVariant?,
  motionProgress: Float,
): Float = if (portraitVariant == null) 1f else 1f + 0.045f * motionProgress

internal fun foregroundMotionTranslationY(
  portraitVariant: PortraitLayoutVariant?,
  motionProgress: Float,
): Float = if (portraitVariant == null) 0f else -12f * motionProgress

internal fun cinematicDisplayLines(
  text: String,
  role: CaptionRole,
  wrapEmphasis: Boolean,
): List<String> =
  if (role == CaptionRole.Emphasis && wrapEmphasis) cinematicEmphasisLines(text) else listOf(text)

internal fun portraitEmphasisWrapEnabled(portraitVariant: PortraitLayoutVariant?): Boolean =
  portraitVariant != null

internal fun cinematicCaptionFit(
  lines: List<String>,
  spec: CinematicCaptionLineSpec,
  role: CaptionRole,
): CinematicCaptionFit {
  val longestWidth = lines.maxOfOrNull {
    cinematicCaptionEstimatedTextWidth(it, spec.fontSize, spec.letterSpacing, role)
  } ?: 0f
  val safeWidth = spec.width * 0.9f
  if (longestWidth <= safeWidth) {
    return CinematicCaptionFit(spec.fontSize, spec.letterSpacing)
  }
  val scale = (safeWidth / longestWidth).coerceIn(0f, 1f)
  var fontSize = kotlin.math.floor(spec.fontSize * scale).toInt().coerceAtLeast(1)
  var letterSpacing = kotlin.math.floor(spec.letterSpacing * scale).toInt().coerceAtLeast(0)
  while (
    fontSize > 1 &&
    lines.any { cinematicCaptionEstimatedTextWidth(it, fontSize, letterSpacing, role) > safeWidth }
  ) {
    fontSize -= 1
  }
  while (
    letterSpacing > 0 &&
    lines.any { cinematicCaptionEstimatedTextWidth(it, fontSize, letterSpacing, role) > safeWidth }
  ) {
    letterSpacing -= 1
  }
  return CinematicCaptionFit(fontSize, letterSpacing)
}

internal fun cinematicCaptionFittedFontSize(
  line: String,
  spec: CinematicCaptionLineSpec,
  role: CaptionRole,
): Int {
  val characters = line.count { !it.isWhitespace() }
  if (characters <= 0) return spec.fontSize
  val widthAtDesignSize = cinematicCaptionEstimatedTextWidth(line, spec.fontSize, spec.letterSpacing, role)
  if (widthAtDesignSize <= spec.width) return spec.fontSize
  val letterSpacingWidth = (characters - 1).coerceAtLeast(0) * spec.letterSpacing
  val drawableWidth = (spec.width - letterSpacingWidth).coerceAtLeast(1)
  val glyphRatio = cinematicCaptionAverageGlyphWidthRatio(role)
  return kotlin.math.floor(drawableWidth / (characters * glyphRatio)).toInt().coerceAtLeast(1)
}

internal fun cinematicCaptionEstimatedTextWidth(
  line: String,
  fontSize: Int,
  letterSpacing: Int,
  role: CaptionRole = CaptionRole.Normal,
): Float {
  val characters = line.count { !it.isWhitespace() }
  if (characters <= 0) return 0f
  val letterSpacingWidth = (characters - 1).coerceAtLeast(0) * letterSpacing
  return characters * fontSize * cinematicCaptionAverageGlyphWidthRatio(role) + letterSpacingWidth
}

private fun cinematicCaptionAverageGlyphWidthRatio(role: CaptionRole): Float =
  when (role) {
    CaptionRole.Emphasis -> 1.0f
    CaptionRole.Normal -> 0.78f
    CaptionRole.Soft -> 0.78f
  }

internal fun cinematicSubtitleArea(): TvSafeArea {
  return cinematicSubtitleArea(cinematicCaptionDesignLines())
}

private fun cinematicSubtitleArea(lines: List<CinematicCaptionLineSpec>): TvSafeArea {
  val left = lines.minOf { it.left }
  val top = lines.minOf { it.top }
  val right = lines.maxOf { it.left + it.width }
  val bottom = lines.maxOf { it.top + it.height }
  return TvSafeArea(
    x = left / CinematicCaptionCanvasWidth,
    y = top / CinematicCaptionCanvasHeight,
    w = (right - left) / CinematicCaptionCanvasWidth,
    h = (bottom - top) / CinematicCaptionCanvasHeight,
  )
}

internal fun TvPlaylistItem.cinematicCaptionLines(
  narrationVariant: TvNarrationVariant?,
): List<String> {
  if (narrationVariant != null) {
    return cinematicNarrationLines(narrationVariant)
  }
  val text = withoutEnglishText(aiComment)
    .ifBlank { withoutEnglishText(captionText) }
    .replace(Regex("\\s+"), " ")
    .trim('，', '。', ',', '.', ' ')
  if (text.isBlank()) return emptyList()
  val segments = text
    .split('，', '。', '、', ',', '.', '；', ';')
    .map { it.trim() }
    .filter { it.isNotBlank() }
  if (segments.size >= 2) return segments.take(3)
  if (text.length <= 11) return listOf(text)
  val lineCount = if (text.length <= 24) 2 else 3
  val lineLength = kotlin.math.ceil(text.length.toDouble() / lineCount).toInt()
  return text.chunked(lineLength).take(3)
}

internal fun TvPlaylistItem.cinematicNarrationLines(
  narrationVariant: TvNarrationVariant?,
): List<String> {
  if (narrationVariant != null) {
    return listOf(
      narrationVariant.sceneDescription,
      narrationVariant.handwrittenThought,
      narrationVariant.lyricalClosure,
    ).map(::withoutEnglishText)
  }
  return cinematicCaptionLines(narrationVariant = null)
}

internal fun TvPlaylistItem.selectedNarrationVariant(): TvNarrationVariant? {
  val selectedText = aiComment.trim()
  if (selectedText.isBlank()) return narrationVariants.firstOrNull()
  narrationVariants.firstOrNull { variant ->
    normalizeNarrationSelection(variant.asAiComment()) == normalizeNarrationSelection(selectedText)
  }?.let { return it }
  val customLines = selectedText
    .lineSequence()
    .map { it.trim() }
    .filter { it.isNotBlank() }
    .toList()
  if (customLines.size == 3) {
    return TvNarrationVariant(
      sceneDescription = customLines[0],
      handwrittenThought = customLines[1],
      lyricalClosure = customLines[2],
    )
  }
  return null
}

private fun TvNarrationVariant.asAiComment(): String =
  listOf(sceneDescription, handwrittenThought, lyricalClosure).joinToString("\n")

private fun normalizeNarrationSelection(text: String): String =
  text.replace("\r\n", "\n")
    .lineSequence()
    .map { it.trim() }
    .filter { it.isNotBlank() }
    .joinToString("\n")

private fun withoutEnglishText(text: String): String {
  return text
    .replace(Regex("[A-Za-z]+(?:['’-][A-Za-z]+)*"), " ")
    .replace(Regex("\\s+([，。；、,.!?！？])"), "$1")
    .replace(Regex("\\s+"), " ")
    .trim('，', '。', '；', '、', ',', '.', '!', '?', '！', '？', ' ')
}

private fun cinematicCaptionText(line: String, role: CaptionRole): AnnotatedString {
  if (role != CaptionRole.Emphasis) return AnnotatedString(line)
  return buildAnnotatedString {
    line.forEach { character ->
      if (character in setOf('，', ',', '。', '.', '；', ';', '、')) {
        withStyle(SpanStyle(color = Color(0xFFC43A32))) {
          append(character)
        }
      } else {
        append(character)
      }
    }
  }
}

internal fun cinematicSubtitleTextStyle(
  role: CaptionRole,
  fontSize: androidx.compose.ui.unit.TextUnit,
  letterSpacing: androidx.compose.ui.unit.TextUnit,
  lineHeight: androidx.compose.ui.unit.TextUnit,
): TextStyle {
  val baseColor = Color(0xFFF5E9D2)
  val roleColor = when (role) {
    CaptionRole.Emphasis -> Color(0xFFFFE7B8)
    CaptionRole.Soft -> baseColor.copy(alpha = 0.86f)
    CaptionRole.Normal -> baseColor.copy(alpha = 0.94f)
  }
  return TextStyle(
    color = roleColor,
    fontFamily = when (role) {
      CaptionRole.Emphasis -> cinematicHandwrittenFontFamily
      CaptionRole.Soft -> cinematicSupportingFontFamily
      CaptionRole.Normal -> cinematicSupportingFontFamily
    },
    fontSize = fontSize,
    fontWeight = when (role) {
      CaptionRole.Emphasis -> FontWeight.Normal
      CaptionRole.Soft -> FontWeight.Normal
      CaptionRole.Normal -> FontWeight.Normal
    },
    lineHeight = lineHeight,
    letterSpacing = letterSpacing,
    textAlign = TextAlign.Center,
    shadow = Shadow(
      color = Color.Black.copy(alpha = 0.70f),
      offset = Offset(0f, 4f),
      blurRadius = 16f,
    ),
  )
}
