package com.wangrizhongxian.tv

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlinx.coroutines.runBlocking
import okhttp3.OkHttpClient

class AlbumParsingTest {
  @Test
  fun parseAlbumListKeepsBackendAlbumIdentity() {
    val json = JSONObject(
      """
      {
        "albums": [
          {
            "albumId": "family-travel",
            "title": "家庭旅行",
            "description": "旅途中的光、风和笑声",
            "coverImageUrl": "/api/photos/p_001/display",
            "thumbnailUrl": "/api/photos/p_001/thumb",
            "photoCount": 8,
            "updatedAt": "2024-05-20"
          }
        ],
        "total": 1
      }
      """.trimIndent(),
    )

    val albums = parseAlbumListJson(json)

    assertEquals(1, albums.size)
    assertEquals("family-travel", albums[0].albumId)
    assertEquals("家庭旅行", albums[0].title)
    assertEquals("/api/photos/p_001/display", albums[0].coverUrl)
    assertEquals(8, albums[0].photoCount)
    assertEquals(emptyList<TvPlaylistItem>(), albums[0].items)
  }

  @Test
  fun parseAlbumDetailKeepsItemsForPlayback() {
    val json = JSONObject(
      """
      {
        "albumId": "weekend-daily",
        "title": "周末日常",
        "description": "厨房、阳台和午后的光",
        "coverImageUrl": "/api/photos/p_002/display",
        "thumbnailUrl": "/api/photos/p_002/thumb",
        "photoCount": 1,
        "updatedAt": "2024-01-13",
        "items": [
          {
            "albumId": "weekend-daily",
            "albumName": "周末日常",
            "photoId": "p_002",
            "displayImageUrl": "/api/photos/p_002/display",
            "durationMs": 12000,
            "takenAt": "2024-01-13",
            "location": "家",
            "caption": {
              "title": "午后的光",
              "text": "那天的风很轻。"
            }
          }
        ]
      }
      """.trimIndent(),
    )

    val album = parseAlbumDetailJson(json)

    assertEquals("weekend-daily", album.albumId)
    assertEquals("周末日常", album.title)
    assertEquals(1, album.items.size)
    assertEquals("p_002", album.items[0].photoId)
    assertEquals("weekend-daily", album.items[0].albumId)
  }

  @Test
  fun parsePlaylistItemKeepsAiDisplayContract() {
    val json = JSONObject(
      """
      {
        "albumId": "daily-ten",
        "albumName": "每日十图",
        "photoId": "p_ai_001",
        "displayImageUrl": "/api/photos/p_ai_001/display",
        "durationMs": 14000,
        "takenAt": "2025-05-02",
        "location": "客厅",
        "caption": {
          "title": "窗边的笑",
          "text": "那一刻的光和笑容都刚刚好。"
        },
        "ai": {
          "score": 93,
          "scoreStatus": "completed",
          "comment": "那一刻的光和笑容都刚刚好。",
          "commentStatus": "completed",
          "tags": ["人物", "开心"],
          "locked": true
        },
        "display": {
          "templateId": "classic-memory-v1",
          "layoutTemplateId": "bottom_gradient",
          "animationTemplateId": "cinematic_soft",
          "captionStyle": "warm_memory",
          "tvImageUrl": "/api/derivatives/p_ai_001/tv_4k.webp",
          "aiImageUrl": "/api/derivatives/p_ai_001/ai_720.webp",
          "textColor": "#000000",
          "fontStyle": "serif",
          "fontWeight": "light"
        },
        "layout": {
          "position": "right_bottom",
          "safeArea": { "x": 0.58, "y": 0.70, "w": 0.34, "h": 0.18 }
        }
      }
      """.trimIndent(),
    )

    val item = parsePlaylistItem("http://127.0.0.1:3999/api", json)

    assertEquals("p_ai_001", item.photoId)
    assertEquals(93, item.aiScore)
    assertEquals("completed", item.aiScoreStatus)
    assertEquals("completed", item.aiCommentStatus)
    assertEquals(listOf("人物", "开心"), item.aiTags)
    assertEquals(true, item.aiLocked)
    assertEquals("classic-memory-v1", item.displayTemplateId)
    assertEquals("bottom_gradient", item.layoutTemplateId)
    assertEquals("cinematic_soft", item.animationTemplateId)
    assertEquals("warm_memory", item.captionStyle)
    assertEquals("http://127.0.0.1:3999/api/photos/p_ai_001/display", item.displayImageUrl)
    assertEquals("http://127.0.0.1:3999/api/derivatives/p_ai_001/tv_4k.webp", item.backgroundImageUrl)
    assertEquals("http://127.0.0.1:3999/api/derivatives/p_ai_001/ai_720.webp", item.aiImageUrl)
    assertEquals("#000000", item.textColor)
    assertEquals("serif", item.fontStyle)
    assertEquals("light", item.fontWeight)
    assertEquals("right_bottom", item.layoutPosition)
    assertEquals(0.58f, item.safeArea.x)
    assertEquals(0.70f, item.safeArea.y)
    assertEquals(0.34f, item.safeArea.w)
    assertEquals(0.18f, item.safeArea.h)
  }

  @Test
  fun parsePlaylistItemKeepsThreePartNarrationVariants() {
    val item = parsePlaylistItem(
      "http://127.0.0.1:3999/api",
      JSONObject(
        """
        {
          "photoId": "p_narration",
          "albumId": "album_1",
          "albumName": "家庭回忆",
          "displayImageUrl": "/api/photos/p_narration/display",
          "durationMs": 12000,
          "caption": {"text": "兼容旁白", "title": "测试照片", "style": "warm"},
          "narrationVariants": [
            {
              "sceneDescription": "小手翻开彩色绘本",
              "handwrittenThought": "那天读过的故事，还在慢慢长大",
              "lyricalClosure": "午后的光没有走远"
            },
            {
              "sceneDescription": "粉色床单映着日光",
              "handwrittenThought": "我们把寻常一天，认真收进心里",
              "lyricalClosure": "后来想起仍很安静"
            }
          ]
        }
        """.trimIndent(),
      ),
    )

    assertEquals(2, item.narrationVariants.size)
    assertEquals("小手翻开彩色绘本", item.narrationVariants.first().sceneDescription)
    assertEquals("那天读过的故事，还在慢慢长大", item.narrationVariants.first().handwrittenThought)
    assertEquals("午后的光没有走远", item.narrationVariants.first().lyricalClosure)
  }

  @Test
  fun parsePlaylistItemKeepsMediaOrientationAndTopMeta() {
    val item = parsePlaylistItem(
      "http://127.0.0.1:3999/api",
      JSONObject(
        """
        {
          "photoId": "p_portrait",
          "albumId": "album_1",
          "albumName": "竖图测试",
          "displayImageUrl": "/api/photos/p_portrait/display",
          "durationMs": 12000,
          "caption": {"text": "竖图旁白", "title": "竖版照片", "style": "warm"},
          "media": {"width": 1080, "height": 1920, "orientation": "portrait"},
          "topMeta": {"time": "14:36", "location": "草原腹地", "weather": "Sunny / Clear"}
        }
        """.trimIndent(),
      ),
    )

    assertEquals(1080, item.mediaWidth)
    assertEquals(1920, item.mediaHeight)
    assertEquals("portrait", item.mediaOrientation)
    assertEquals("14:36 / 草原腹地 / Sunny / Clear", item.topMetaLine)
    assertEquals(true, item.isPortrait)
  }

  @Test
  fun loginDeviceReturnsFailureForMalformedServerUrlInsteadOfThrowing() = runBlocking {
    val result = loginDevice(
      serverUrl = "http://127.0.0.1:3999http://127.0.0.1:3999",
      username = "admin",
      password = "admin123",
      httpClient = OkHttpClient(),
    )

    assertFalse(result.ok)
  }

  @Test
  fun normalizeApiBaseKeepsLoopbackHostForAdbReverse() {
    assertEquals("http://localhost:3999/api", normalizeApiBase("http://localhost:3999"))
    assertEquals("http://127.0.0.1:3999/api", normalizeApiBase("http://127.0.0.1:3999/api"))
  }

  @Test
  fun defaultServerUrlUsesBuildConfigFallback() {
    assertEquals(BuildConfig.WRJDYK_TV_DEFAULT_SERVER_URL, defaultServerUrl())
  }

  @Test
  fun savedLoopbackServerUrlUsesLanBuildDefault() {
    assertEquals(
      "http://192.168.10.188:3999",
      preferredServerUrl(
        storedServerUrl = "http://localhost:3999",
        buildDefaultServerUrl = "http://192.168.10.188:3999",
      ),
    )
    assertEquals(
      "http://192.168.10.188:3999",
      preferredServerUrl(
        storedServerUrl = "http://127.0.0.1:3999",
        buildDefaultServerUrl = "http://192.168.10.188:3999",
      ),
    )
    assertEquals(
      "http://192.168.10.188:3999",
      preferredServerUrl(
        storedServerUrl = "http://192.168.10.188:3100",
        buildDefaultServerUrl = "http://192.168.10.188:3999",
      ),
    )
    assertEquals(
      "http://192.168.10.188:3999",
      preferredServerUrl(
        storedServerUrl = "http://192.168.10.188:3101",
        buildDefaultServerUrl = "http://192.168.10.188:3999",
      ),
    )
    assertEquals(
      "http://192.168.10.55:3999",
      preferredServerUrl(
        storedServerUrl = "http://192.168.10.55:3999",
        buildDefaultServerUrl = "http://192.168.10.188:3999",
      ),
    )
  }

  @Test
  fun savedTokenAloneDoesNotBypassCredentialLogin() {
    assertFalse(
      shouldAttemptStoredCredentialAutoLogin(
        serverUrl = "http://192.168.10.166:3999",
        username = "admin",
        password = "",
        autoLoginEnabled = true,
      ),
    )
  }

  @Test
  fun storedCredentialsAutoLoginOnlyWhenUserEnabledIt() {
    assertTrue(
      shouldAttemptStoredCredentialAutoLogin(
        serverUrl = "http://192.168.10.166:3999",
        username = "admin",
        password = "admin123",
        autoLoginEnabled = true,
      ),
    )
    assertFalse(
      shouldAttemptStoredCredentialAutoLogin(
        serverUrl = "http://192.168.10.166:3999",
        username = "admin",
        password = "admin123",
        autoLoginEnabled = false,
      ),
    )
  }

  @Test
  fun loginFlowStartsTheFirstPlayableAlbum() {
    val albums = listOf(
      TvAlbum(
        albumId = "empty",
        coverUrl = "",
        description = "",
        items = emptyList(),
        photoCount = 0,
        sceneCount = 0,
        title = "空相册",
        updatedAt = "",
      ),
      TvAlbum(
        albumId = "ready",
        coverUrl = "",
        description = "",
        items = listOf(
          testPlaylistItem(
            albumId = "ready",
            albumName = "可播放",
            photoId = "p1",
          ),
        ),
        photoCount = 1,
        sceneCount = 1,
        title = "可播放",
        updatedAt = "",
      ),
    )

    assertEquals(1, firstPlayableAlbumIndex(albums))
  }

  @Test
  fun parseFeiniuAlbumKeepsAbsoluteMediaUrlsForTvPlayback() {
    val json = JSONObject(
      """
      {
        "albumId": "feiniu-100",
        "title": "飞牛相册",
        "description": "来自飞牛相册源",
        "coverImageUrl": "http://192.168.10.166:60000/media/cover.jpg",
        "photoCount": 1,
        "updatedAt": "2026-06-06",
        "items": [
          {
            "albumId": "feiniu-100",
            "albumName": "飞牛相册",
            "photoId": "feiniu-photo-1",
            "displayImageUrl": "http://192.168.10.166:60000/media/photo.jpg",
            "durationMs": 12000,
            "takenAt": "2026-06-06",
            "location": "NAS",
            "caption": {
              "title": "飞牛照片",
              "text": "直链媒体 URL"
            }
          }
        ]
      }
      """.trimIndent(),
    )

    val album = parseAlbumDetailJson(json, "http://127.0.0.1:3999/api")

    assertEquals("http://192.168.10.166:60000/media/cover.jpg", album.coverUrl)
    assertEquals("http://192.168.10.166:60000/media/photo.jpg", album.items[0].displayImageUrl)
  }

  @Test
  fun emptyStateCopySeparatesAlbumListAndPlaylistCases() {
    val emptyAlbumsCopy = emptyStateCopy(TvEmptyStateKind.Albums)
    val emptyPlaylistCopy = emptyStateCopy(TvEmptyStateKind.Playlist)

    assertEquals("暂无图包", emptyAlbumsCopy.title)
    assertEquals("还没有创建任何可播放的图包", emptyAlbumsCopy.description)
    assertEquals("播放列表为空", emptyPlaylistCopy.title)
    assertEquals("当前图包还没有可播放的照片", emptyPlaylistCopy.description)
  }

  @Test
  fun primaryTvSurfacesExposeTouchActivation() {
    assertEquals(true, isTouchActivationEnabled(TvTouchTarget.AlbumCard))
    assertEquals(true, isTouchActivationEnabled(TvTouchTarget.AlbumDetail))
    assertEquals(true, isTouchActivationEnabled(TvTouchTarget.Player))
    assertEquals(true, isTouchActivationEnabled(TvTouchTarget.QueueCard))
    assertEquals(true, isTouchActivationEnabled(TvTouchTarget.EmptyState))
    assertEquals(true, isTouchActivationEnabled(TvTouchTarget.ScanDone))
    assertEquals(true, isTouchActivationEnabled(TvTouchTarget.LoginInput))
    assertEquals(true, isTouchActivationEnabled(TvTouchTarget.LoginButton))
  }
}

private fun testPlaylistItem(albumId: String, albumName: String, photoId: String): TvPlaylistItem =
  TvPlaylistItem(
    aiComment = "",
    aiCommentStatus = "",
    aiLocked = false,
    aiScore = null,
    aiScoreStatus = "",
    aiTags = emptyList(),
    albumId = albumId,
    albumName = albumName,
    animationTemplateId = "",
    captionStyle = "",
    captionText = "",
    captionTitle = "照片",
    displayTemplateId = "",
    displayImageUrl = "/api/photos/$photoId/display",
    durationMs = 12000,
    aiImageUrl = "",
    fontStyle = "",
    fontWeight = "",
    layoutTemplateId = "",
    layoutPosition = "",
    location = "",
    mediaHeight = 1920,
    mediaOrientation = "portrait",
    mediaWidth = 1080,
    narrationVariants = emptyList(),
    photoId = photoId,
    safeArea = TvSafeArea(0f, 0f, 1f, 1f),
    takenAt = "",
    textColor = "",
    topMetaLocation = "",
    topMetaTime = "",
    topMetaWeather = "",
  )
