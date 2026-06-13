package com.wangrizhongxian.tv

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import androidx.compose.ui.unit.sp

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
  fun portraitSideCaptionSpecsKeepTextOutsidePortraitPhotoFrame() {
    val frame = portraitSidePhotoFrame()
    val lines = portraitSideCaptionDesignLines()

    lines.forEach { line ->
      assertTrue(line.left > frame.left + frame.width)
      assertTrue(line.left + line.width <= 3400)
    }
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
      mediaHeight = 0,
      mediaOrientation = "unknown",
      mediaWidth = 0,
      narrationVariants = emptyList(),
      photoId = "photo",
      safeArea = TvSafeArea(x = 0.58f, y = 0.70f, w = 0.34f, h = 0.18f),
      takenAt = "",
      textColor = "#000000",
      topMetaLocation = "",
      topMetaTime = "",
      topMetaWeather = "",
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
