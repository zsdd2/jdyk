package com.wangrizhongxian.tv

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import androidx.compose.ui.unit.sp
import androidx.compose.ui.layout.ContentScale

class MemoryExhibitionPlayerTest {
  @Test
  fun cinematicSubtitleAreaMatches4kDesignBounds() {
    val area = cinematicSubtitleArea()

    assertEquals(730f / 3840f, area.x, 0.001f)
    assertEquals(1524f / 2160f, area.y, 0.001f)
    assertEquals(2380f / 3840f, area.w, 0.001f)
    assertEquals(520f / 2160f, area.h, 0.001f)
  }

  @Test
  fun cinematicCaptionLineSpecsMatch4kDesign() {
    val lines = cinematicCaptionDesignLines()

    assertEquals(3, lines.size)
    assertLineSpec(lines[0], left = 730, top = 1524, width = 2380, height = 90, fontSize = 88, lineHeight = 104, letterSpacing = 42)
    assertLineSpec(lines[1], left = 730, top = 1691, width = 2380, height = 240, fontSize = 240, lineHeight = 240, letterSpacing = 2)
    assertLineSpec(lines[2], left = 930, top = 1960, width = 1980, height = 84, fontSize = 84, lineHeight = 100, letterSpacing = 36)
  }

  @Test
  fun cinematicCaptionLineSpecsAreCenteredLikeApprovedAStyle() {
    val lines = cinematicCaptionDesignLines()

    lines.forEach { line ->
      assertEquals(1920f, line.left + line.width / 2f, 1f)
    }
  }

  @Test
  fun portraitOverlayCaptionSpecsStayInsidePortraitPhotoFrame() {
    val frame = portraitPhotoFrame()
    val lines = portraitOverlayCaptionDesignLines()

    assertEquals(3, lines.size)
    lines.forEach { line ->
      assertTrue(line.left >= frame.left)
      assertTrue(line.left + line.width <= frame.left + frame.width)
      assertTrue(line.top >= frame.top)
      assertTrue(line.top + line.height <= frame.top + frame.height)
    }
    assertTrue(lines[1].fontSize < cinematicCaptionDesignLines()[1].fontSize)
  }

  @Test
  fun portraitPhotoRightLayoutMatchesApproved4kDesign() {
    val frame = portraitPhotoRightFrame()
    val lines = portraitPhotoRightCaptionDesignLines()
    val meta = portraitPhotoRightMetaSpec()

    assertEquals(2341, frame.left)
    assertEquals(1215, frame.width)
    assertEquals(1171f, lines.first().left + lines.first().width / 2f, 1f)
    assertEquals(1030, lines.first().top)
    assertEquals(130, meta.top)
    assertEquals(3, lines.size)
  }

  @Test
  fun portraitPhotoLeftLayoutMatchesApproved4kDesign() {
    val frame = portraitPhotoLeftFrame()
    val lines = portraitPhotoLeftCaptionDesignLines()
    val meta = portraitPhotoLeftMetaSpec()

    assertEquals(284, frame.left)
    assertEquals(1215, frame.width)
    assertEquals(2669f, lines.first().left + lines.first().width / 2f, 1f)
    assertEquals(1030, lines.first().top)
    assertEquals(130, meta.top)
    assertEquals(3, lines.size)
  }

  @Test
  fun portraitPhotosUseEveryExistingLayoutWithoutChangingDuringPlayback() {
    val variants = (1..100)
      .map { portraitLayoutVariantFor("portrait-photo-$it") }
      .toSet()

    assertEquals(
      setOf(
        PortraitLayoutVariant.Center,
        PortraitLayoutVariant.PhotoRight,
        PortraitLayoutVariant.PhotoLeft,
      ),
      variants,
    )
    assertEquals(
      portraitLayoutVariantFor("stable-photo"),
      portraitLayoutVariantFor("stable-photo"),
    )
  }

  @Test
  fun portraitLayoutsRefreshWhenAPlaybackSessionRestarts() {
    val photoIds = (1..30).map { "portrait-photo-$it" }
    val firstSession = photoIds.map { portraitLayoutVariantFor(it, sessionSeed = 101) }
    val repeatedFirstSession = photoIds.map { portraitLayoutVariantFor(it, sessionSeed = 101) }
    val secondSession = photoIds.map { portraitLayoutVariantFor(it, sessionSeed = 102) }

    assertEquals(firstSession, repeatedFirstSession)
    assertNotEquals(firstSession, secondSession)
    assertEquals(PortraitLayoutVariant.entries.toSet(), firstSession.toSet())
    assertEquals(PortraitLayoutVariant.entries.toSet(), secondSession.toSet())
  }

  @Test
  fun cinematicCaptionFittedFontSizeKeepsLongHandwrittenTitleOnOneLine() {
    val titleSpec = cinematicCaptionDesignLines()[1]
    val longTitle = "你在湖边举灯看向远方的微光与山海"

    val fittedSize = cinematicCaptionFittedFontSize(longTitle, titleSpec, CaptionRole.Emphasis)
    val fittedWidth = cinematicCaptionEstimatedTextWidth(longTitle, fittedSize, titleSpec.letterSpacing, CaptionRole.Emphasis)

    assertTrue(fittedSize < titleSpec.fontSize)
    assertTrue(fittedWidth <= titleSpec.width)
  }

  @Test
  fun cinematicEmphasisLinesNeverCreateAThirdLine() {
    val title = "一二三四五六七八九十甲乙丙丁戊己庚辛壬癸"

    val lines = cinematicEmphasisLines(title)

    assertEquals(2, lines.size)
    assertEquals(title, lines.joinToString(""))
    assertTrue(kotlin.math.abs(lines[0].length - lines[1].length) <= 1)
  }

  @Test
  fun cinematicEmphasisLinesWrapAtEightCharactersUntilSixteen() {
    val lines = cinematicEmphasisLines("一二三四五六七八九十甲乙")

    assertEquals(listOf("一二三四五六七八", "九十甲乙"), lines)
  }

  @Test
  fun cinematicCaptionFitKeepsBothLongTitleLinesInsideAvailableWidth() {
    val spec = portraitPhotoRightCaptionDesignLines()[1]
    val lines = cinematicEmphasisLines("你在湖边举灯看向远方的微光与山海也看见归途灯火")

    val fit = cinematicCaptionFit(lines, spec, CaptionRole.Emphasis)

    assertTrue(fit.fontSize < spec.fontSize)
    lines.forEach { line ->
      assertTrue(
        cinematicCaptionEstimatedTextWidth(
          line,
          fit.fontSize,
          fit.letterSpacing,
          CaptionRole.Emphasis,
        ) <= spec.width,
      )
    }
  }

  @Test
  fun selectedNarrationVariantMatchesTheAiCommentInsteadOfTheFirstOption() {
    val first = TvNarrationVariant("第一条中段", "第一条结尾", "第一条开头")
    val selected = TvNarrationVariant("第二条中段", "第二条结尾", "第二条开头")
    val item = playlistItem(
      aiComment = "第二条开头\n第二条中段\n第二条结尾",
      narrationVariants = listOf(first, selected),
    )

    assertEquals(selected, item.selectedNarrationVariant())
  }

  @Test
  fun selectedNarrationVariantUsesCustomThreeLineAiComment() {
    val item = playlistItem(aiComment = "自定义开头\n自定义中段\n自定义结尾")

    assertEquals(
      TvNarrationVariant("自定义中段", "自定义结尾", "自定义开头"),
      item.selectedNarrationVariant(),
    )
  }

  @Test
  fun topMetaUsesSlashSeparators() {
    val item = playlistItem(
      topMetaLocation = "草原腹地",
      topMetaTime = "14:36",
      topMetaWeather = "晴朗",
    )

    assertEquals("14:36 / 草原腹地 / 晴朗", item.topMetaLine)
  }

  @Test
  fun topMetaDoesNotReplaceTheFirstNarrationLine() {
    val item = playlistItem(topMetaTime = "2025-08-31")
    val variant = TvNarrationVariant("中段旁白", "结尾旁白", "第一段旁白")

    assertEquals(
      listOf("第一段旁白", "中段旁白", "结尾旁白"),
      item.cinematicNarrationLines(variant),
    )
  }

  @Test
  fun unknownPlaylistOrientationFallsBackToLoadedImageDimensions() {
    val item = playlistItem(
      mediaHeight = 0,
      mediaOrientation = "unknown",
      mediaWidth = 0,
    )

    assertEquals(null, item.declaredIsPortrait)
    assertTrue(item.resolveIsPortrait(loadedWidth = 1080, loadedHeight = 1920))
    assertEquals(false, item.resolveIsPortrait(loadedWidth = 1920, loadedHeight = 1080))
  }

  @Test
  fun landscapeEmphasisStaysOnOneLineAndShrinksToFit() {
    val spec = cinematicCaptionDesignLines()[1]
    val text = "横版中间文案不受八个字换行限制并且始终完整显示"
    val lines = cinematicDisplayLines(text, CaptionRole.Emphasis, wrapEmphasis = false)
    val fit = cinematicCaptionFit(lines, spec, CaptionRole.Emphasis)

    assertEquals(listOf(text), lines)
    assertTrue(
      cinematicCaptionEstimatedTextWidth(
        text,
        fit.fontSize,
        fit.letterSpacing,
        CaptionRole.Emphasis,
      ) <= spec.width,
    )
  }

  @Test
  fun landscapePhotosStayFullyVisibleWhilePortraitLayoutsKeepTheirFraming() {
    assertEquals(ContentScale.Fit, foregroundContentScale(portraitVariant = null))
    assertEquals(ContentScale.Fit, foregroundContentScale(PortraitLayoutVariant.Center))
    assertEquals(ContentScale.Crop, foregroundContentScale(PortraitLayoutVariant.PhotoRight))
    assertEquals(ContentScale.Crop, foregroundContentScale(PortraitLayoutVariant.PhotoLeft))
  }

  @Test
  fun landscapeForegroundDoesNotZoomOrTranslate() {
    assertEquals(1f, foregroundMotionScale(null, motionProgress = 1f), 0.001f)
    assertEquals(0f, foregroundMotionTranslationY(null, motionProgress = 1f), 0.001f)
    assertTrue(foregroundMotionScale(PortraitLayoutVariant.Center, motionProgress = 1f) > 1f)
  }

  @Test
  fun handwrittenWidthEstimateLeavesRoomForRealFontGlyphs() {
    val spec = portraitOverlayCaptionDesignLines()[1]
    val text = "适合在电视上慢慢重温"

    val fit = cinematicCaptionFit(listOf(text), spec, CaptionRole.Emphasis)

    assertTrue(fit.fontSize <= 100)
    assertTrue(
      cinematicCaptionEstimatedTextWidth(
        text,
        fit.fontSize,
        fit.letterSpacing,
        CaptionRole.Emphasis,
      ) <= spec.width * 0.9f,
    )
  }

  @Test
  fun cinematicCaptionLinesPreferThreePartNarrationInOrder() {
    val item = playlistItem(
      aiComment = "备用内容",
      captionText = "备用文案",
      captionTitle = "备用标题",
    )
    val variant = TvNarrationVariant(
      sceneDescription = "顶部标准文字",
      handwrittenThought = "中间手写标题",
      lyricalClosure = "底部标准文字",
    )

    val lines = item.cinematicCaptionLines(variant)

    assertEquals(
      listOf("顶部标准文字", "中间手写标题", "底部标准文字"),
      lines,
    )
  }

  @Test
  fun cinematicCaptionLinesFallsBackToAtMostThreeLines() {
    val item = playlistItem(
      aiComment = "第一行，第二行，第三行，第四行",
      captionText = "",
      captionTitle = "备用标题",
    )

    val lines = item.cinematicCaptionLines(narrationVariant = null)

    assertEquals(listOf("第一行", "第二行", "第三行"), lines)
  }

  @Test
  fun cinematicCaptionLinesDoNotRenderEnglishText() {
    val item = playlistItem()
    val variant = TvNarrationVariant(
      sceneDescription = "湖边清晨 Morning light",
      handwrittenThought = "风轻轻掠过 the hills",
      lyricalClosure = "THE QUIET HORIZON",
    )

    val lines = item.cinematicCaptionLines(variant)

    assertEquals(listOf("湖边清晨", "风轻轻掠过", ""), lines)
  }

  @Test
  fun cinematicCaptionLinesFallBackAfterEnglishOnlyAiTextIsRemoved() {
    val item = playlistItem(
      aiComment = "THE QUIET HORIZON",
      captionText = "风吹过湖面，树影轻轻摇晃",
    )

    val lines = item.cinematicCaptionLines(narrationVariant = null)

    assertEquals(listOf("风吹过湖面", "树影轻轻摇晃"), lines)
  }

  @Test
  fun cinematicSubtitleTextStyleKeepsReadableShadow() {
    val style = cinematicSubtitleTextStyle(
      role = CaptionRole.Normal,
      fontSize = 88.sp,
      letterSpacing = 42.sp,
      lineHeight = 104.sp,
    )

    val shadow = style.shadow
    assertNotNull(shadow)
    assertTrue((shadow?.color?.alpha ?: 0f) >= 0.68f)
    assertTrue((shadow?.blurRadius ?: 0f) >= 14f)
  }

  @Test
  fun cinematicSubtitleTextStyleUsesBundledProjectFonts() {
    val titleStyle = cinematicSubtitleTextStyle(
      role = CaptionRole.Emphasis,
      fontSize = 240.sp,
      letterSpacing = 2.sp,
      lineHeight = 240.sp,
    )
    val supportingStyle = cinematicSubtitleTextStyle(
      role = CaptionRole.Normal,
      fontSize = 88.sp,
      letterSpacing = 42.sp,
      lineHeight = 104.sp,
    )

    assertNotEquals(androidx.compose.ui.text.font.FontFamily.Cursive, titleStyle.fontFamily)
    assertNotEquals(androidx.compose.ui.text.font.FontFamily.Serif, supportingStyle.fontFamily)
    assertEquals(androidx.compose.ui.text.font.FontWeight.Normal, titleStyle.fontWeight)
  }

  private fun playlistItem(
    aiComment: String = "",
    captionText: String = "",
    captionTitle: String = "",
    mediaHeight: Int = 0,
    mediaOrientation: String = "unknown",
    mediaWidth: Int = 0,
    narrationVariants: List<TvNarrationVariant> = emptyList(),
    topMetaLocation: String = "",
    topMetaTime: String = "",
    topMetaWeather: String = "",
  ): TvPlaylistItem {
    return TvPlaylistItem(
      aiComment = aiComment,
      aiCommentStatus = "completed",
      aiLocked = true,
      aiScore = 90,
      aiScoreStatus = "completed",
      aiTags = emptyList(),
      albumId = "album",
      albumName = "album name",
      animationTemplateId = "cinematic_soft",
      captionStyle = "warm_memory",
      captionText = captionText,
      captionTitle = captionTitle,
      displayTemplateId = "classic-memory-v1",
      displayImageUrl = "http://127.0.0.1/photo.jpg",
      durationMs = 12_000,
      aiImageUrl = "",
      fontStyle = "serif",
      fontWeight = "light",
      layoutTemplateId = "bottom_gradient",
      layoutPosition = "right_bottom",
      location = "",
      mediaHeight = mediaHeight,
      mediaOrientation = mediaOrientation,
      mediaWidth = mediaWidth,
      narrationVariants = narrationVariants,
      photoId = "photo",
      safeArea = TvSafeArea(x = 0.58f, y = 0.70f, w = 0.34f, h = 0.18f),
      takenAt = "",
      textColor = "#000000",
      topMetaLocation = topMetaLocation,
      topMetaTime = topMetaTime,
      topMetaWeather = topMetaWeather,
    )
  }

  private fun assertLineSpec(
    actual: CinematicCaptionLineSpec,
    left: Int,
    top: Int,
    width: Int,
    height: Int,
    fontSize: Int,
    lineHeight: Int,
    letterSpacing: Int,
  ) {
    assertEquals(left, actual.left)
    assertEquals(top, actual.top)
    assertEquals(width, actual.width)
    assertEquals(height, actual.height)
    assertEquals(fontSize, actual.fontSize)
    assertEquals(lineHeight, actual.lineHeight)
    assertEquals(letterSpacing, actual.letterSpacing)
  }
}
