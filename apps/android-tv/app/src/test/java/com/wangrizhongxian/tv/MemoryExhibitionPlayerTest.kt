package com.wangrizhongxian.tv

import org.junit.Assert.assertEquals
import org.junit.Test

class MemoryExhibitionPlayerTest {
  @Test
  fun cinematicSubtitleAreaMatches4kDesignBounds() {
    val area = cinematicSubtitleArea()

    assertEquals(912f / 3840f, area.x, 0.001f)
    assertEquals(1524f / 2160f, area.y, 0.001f)
    assertEquals(2067f / 3840f, area.w, 0.001f)
    assertEquals(501f / 2160f, area.h, 0.001f)
  }

  @Test
  fun cinematicCaptionLineSpecsMatch4kDesign() {
    val lines = cinematicCaptionDesignLines()

    assertEquals(3, lines.size)
    assertLineSpec(lines[0], left = 1455, top = 1524, width = 889, height = 90, fontSize = 88, lineHeight = 104, letterSpacing = 42)
    assertLineSpec(lines[1], left = 912, top = 1691, width = 2067, height = 199, fontSize = 160, lineHeight = 200, letterSpacing = 2)
    assertLineSpec(lines[2], left = 1463, top = 1941, width = 917, height = 84, fontSize = 84, lineHeight = 100, letterSpacing = 36)
  }

  @Test
  fun cinematicCaptionLinesPreferThreePartNarrationInOrder() {
    val item = playlistItem(
      aiComment = "fallback",
      captionText = "fallback text",
      captionTitle = "fallback title",
    )
    val variant = TvNarrationVariant(
      sceneDescription = "top standard line",
      handwrittenThought = "middle handwritten line",
      lyricalClosure = "bottom standard line",
    )

    val lines = item.cinematicCaptionLines(variant)

    assertEquals(
      listOf("top standard line", "middle handwritten line", "bottom standard line"),
      lines,
    )
  }

  @Test
  fun cinematicCaptionLinesFallsBackToAtMostThreeLines() {
    val item = playlistItem(
      aiComment = "first line, second line, third line, fourth line",
      captionText = "",
      captionTitle = "fallback title",
    )

    val lines = item.cinematicCaptionLines(narrationVariant = null)

    assertEquals(listOf("first line", "second line", "third line"), lines)
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
      narrationVariants = emptyList(),
      photoId = "photo",
      safeArea = TvSafeArea(x = 0.58f, y = 0.70f, w = 0.34f, h = 0.18f),
      takenAt = "",
      textColor = "#000000",
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
