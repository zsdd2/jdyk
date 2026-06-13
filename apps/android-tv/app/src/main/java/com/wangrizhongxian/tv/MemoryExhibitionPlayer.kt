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
  val narrationVariant = item.narrationVariants.firstOrNull()

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
      onLoading = { imageLoadState = ExhibitionImageLoadState.Loading },
      onReady = { imageLoadState = ExhibitionImageLoadState.Ready },
      onError = { imageLoadState = ExhibitionImageLoadState.Error },
    )
    OverlayStage()
    CaptionStage(
      item = item,
      narrationVariant = narrationVariant,
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
  onLoading: () -> Unit,
  onReady: () -> Unit,
  onError: () -> Unit,
) {
  val request = ImageRequest.Builder(LocalContext.current).data(item.displayImageUrl).build()
  val scale = 1f + 0.045f * motionProgress
  val translateX = 0f
  val translateY = -12f * motionProgress

  AsyncImage(
    model = request,
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
  AsyncImage(
    model = request,
    imageLoader = imageLoader,
    contentDescription = item.captionTitle,
    contentScale = ContentScale.Fit,
    onError = { onError() },
    onLoading = { onLoading() },
    onSuccess = { onReady() },
    modifier = Modifier
      .fillMaxSize()
      .graphicsLayer {
        scaleX = scale
        scaleY = scale
        translationX = translateX
        translationY = translateY
      },
  )
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
  textAlpha: Float,
  textOffset: Float,
) {
  BoxWithConstraints(modifier = Modifier.fillMaxSize()) {
    val lines = item.cinematicCaptionLines(narrationVariant)
    val density = LocalDensity.current
    val designLines = cinematicCaptionDesignLines(item)
    val safeArea = cinematicSubtitleArea(designLines)
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
      designLines.forEachIndexed { index, spec ->
        val line = lines.getOrNull(index) ?: return@forEachIndexed
        val role = when {
          lines.size >= 3 && index == 1 -> CaptionRole.Emphasis
          index == lines.lastIndex -> CaptionRole.Soft
          else -> CaptionRole.Normal
        }
        val fittedFontSize = cinematicCaptionFittedFontSize(line, spec, role)
        val fittedLineHeight = (fittedFontSize.toFloat() * spec.lineHeight / spec.fontSize).toInt()
        val fontSize = with(density) {
          (stageHeight.toPx() * fittedFontSize / CinematicCaptionCanvasHeight).toSp()
        }
        val lineHeight = with(density) {
          (stageHeight.toPx() * fittedLineHeight / CinematicCaptionCanvasHeight).toSp()
        }
        val letterSpacing = with(density) {
          (stageHeight.toPx() * spec.letterSpacing / CinematicCaptionCanvasHeight).toSp()
        }
        BasicText(
          modifier = Modifier
            .padding(
              start = stageWidth * ((spec.left - safeArea.x * CinematicCaptionCanvasWidth) / CinematicCaptionCanvasWidth),
              top = stageHeight * ((spec.top - safeArea.y * CinematicCaptionCanvasHeight) / CinematicCaptionCanvasHeight),
            )
            .width(stageWidth * (spec.width / CinematicCaptionCanvasWidth))
            .height(stageHeight * (spec.height / CinematicCaptionCanvasHeight)),
          maxLines = 1,
          overflow = TextOverflow.Clip,
          softWrap = false,
          text = cinematicCaptionText(line, role),
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

private const val CinematicCaptionCanvasWidth = 3840f
private const val CinematicCaptionCanvasHeight = 2160f
private val cinematicHandwrittenFontFamily = FontFamily(Font(R.font.shangshou_zhuiguang))
private val cinematicSupportingFontFamily = FontFamily(Font(R.font.lxgw_heart_serif_chs))

private fun cinematicCaptionDesignLines(item: TvPlaylistItem): List<CinematicCaptionLineSpec> {
  if (!item.isPortrait) return cinematicCaptionDesignLines()
  return if (item.layoutTemplateId.equals("portrait_side", ignoreCase = true)) {
    portraitSideCaptionDesignLines()
  } else {
    portraitOverlayCaptionDesignLines()
  }
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

internal fun portraitSidePhotoFrame(): CinematicPhotoFrame {
  return CinematicPhotoFrame(
    left = 860,
    top = 0,
    width = 1215,
    height = 2160,
  )
}

internal fun portraitOverlayCaptionDesignLines(): List<CinematicCaptionLineSpec> {
  return listOf(
    CinematicCaptionLineSpec(
      left = 1440,
      top = 1420,
      width = 960,
      height = 66,
      fontSize = 56,
      lineHeight = 68,
      letterSpacing = 18,
    ),
    CinematicCaptionLineSpec(
      left = 1415,
      top = 1538,
      width = 1010,
      height = 138,
      fontSize = 128,
      lineHeight = 138,
      letterSpacing = 2,
    ),
    CinematicCaptionLineSpec(
      left = 1480,
      top = 1712,
      width = 880,
      height = 58,
      fontSize = 48,
      lineHeight = 60,
      letterSpacing = 12,
    ),
  )
}

internal fun portraitSideCaptionDesignLines(): List<CinematicCaptionLineSpec> {
  return listOf(
    CinematicCaptionLineSpec(
      left = 2240,
      top = 760,
      width = 760,
      height = 78,
      fontSize = 64,
      lineHeight = 78,
      letterSpacing = 22,
    ),
    CinematicCaptionLineSpec(
      left = 2180,
      top = 910,
      width = 960,
      height = 170,
      fontSize = 150,
      lineHeight = 170,
      letterSpacing = 2,
    ),
    CinematicCaptionLineSpec(
      left = 2260,
      top = 1135,
      width = 720,
      height = 68,
      fontSize = 56,
      lineHeight = 68,
      letterSpacing = 16,
    ),
  )
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
  return kotlin.math.floor(drawableWidth / (characters * glyphRatio)).toInt().coerceAtLeast(28)
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
    CaptionRole.Emphasis -> 0.72f
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
    val variantLines = listOf(
      narrationVariant.sceneDescription,
      narrationVariant.handwrittenThought,
      narrationVariant.lyricalClosure,
    ).map(::withoutEnglishText)
    return if (topMetaLine.isNotBlank()) {
      listOf(topMetaLine, variantLines.getOrElse(1) { "" }, variantLines.getOrElse(2) { "" })
    } else {
      variantLines
    }
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
