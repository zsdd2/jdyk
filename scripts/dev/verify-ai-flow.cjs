const { readFileSync } = require('node:fs');
const {
  SqlitePhotoRepository,
} = require('../../apps/backend-api/dist/sqlite-photo.repository.js');
const {
  buildUnifiedVisionSystemPrompt,
  buildUnifiedVisionUserPrompt,
  normalizeUnifiedVisionResult,
  parseAiJsonContent,
} = require('../../apps/backend-api/dist/app.service.js');

const timeoutMs = Number(process.env.AI_VERIFY_TIMEOUT_MS || 90_000);
const targetPhotoId = process.argv[2] || '';

function buildChatCompletionsUrl(baseUrl) {
  const normalizedBaseUrl = String(baseUrl || '').trim().replace(/\/+$/, '');
  return normalizedBaseUrl.endsWith('/chat/completions')
    ? normalizedBaseUrl
    : `${normalizedBaseUrl}/chat/completions`;
}

function maskUrl(url) {
  return String(url || '').replace(/(https?:\/\/[^/]+).*/, '$1/...');
}

async function callChat(settings, messages, label) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();
  try {
    const response = await fetch(buildChatCompletionsUrl(settings.baseUrl), {
      body: JSON.stringify({
        max_tokens: 900,
        messages,
        model: settings.model,
        response_format: { type: 'json_object' },
        temperature: 0.2,
      }),
      headers: {
        Authorization: `Bearer ${settings.apiKey}`,
        'Content-Type': 'application/json',
      },
      method: 'POST',
      signal: controller.signal,
    });
    const durationMs = Date.now() - startedAt;
    const body = await response.text();
    let content = '';
    let parsedContent = null;
    try {
      const payload = JSON.parse(body);
      content = payload.choices?.[0]?.message?.content || '';
      parsedContent = content ? parseAiJsonContent(content) : null;
    } catch (error) {
      parsedContent = null;
    }
    return {
      bodyPrefix: body.slice(0, 240),
      contentPrefix: content.slice(0, 240),
      durationMs,
      label,
      ok: response.ok,
      parsedContent,
      status: response.status,
    };
  } catch (error) {
    return {
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
      label,
      ok: false,
      status: 0,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function selectPhoto(repository) {
  const pages = [1, 2, 3, 4, 5];
  for (const page of pages) {
    const items = repository.listPhotoCenterItems({ page, pageSize: 100 }).items;
    for (const item of items) {
      if (targetPhotoId && item.photoId !== targetPhotoId) continue;
      const asset = repository.getDerivativeAsset(item.photoId, 'ai_720.webp');
      if (asset) return { asset, item };
    }
  }
  throw new Error(
    targetPhotoId
      ? `No local ai_720.webp derivative found for ${targetPhotoId}`
      : 'No photo with local ai_720.webp derivative found',
  );
}

function summarizeRound(result) {
  return {
    contentKeys: result.parsedContent && typeof result.parsedContent === 'object'
      ? Object.keys(result.parsedContent)
      : [],
    contentPrefix: result.contentPrefix,
    durationMs: result.durationMs,
    error: result.error || '',
    label: result.label,
    ok: result.ok,
    status: result.status,
  };
}

async function main() {
  const repository = new SqlitePhotoRepository();
  const settings = repository.getAiRuntimeSettings();
  if (!settings.apiKey || !settings.baseUrl || !settings.model) {
    throw new Error('AI settings are incomplete');
  }

  const { asset, item } = selectPhoto(repository);
  const imageBuffer = readFileSync(asset.path);
  const imageDataUrl = `data:${asset.contentType};base64,${imageBuffer.toString('base64')}`;
  const album = repository.listPlaybackAlbums()[0] || {
    aiBeautyThreshold: 70,
    aiDailyLimit: 100,
    aiEnabled: true,
    aiMemoryThreshold: 80,
    aiPriorityTags: [],
    allowPush: true,
    authorizedDeviceIds: [],
    coverImageUrl: item.thumbnailUrl,
    createdAt: '',
    description: '',
    playbackAlbumId: 'verify',
    photoCount: 1,
    pushPriorityTags: [],
    sourceAlbumId: item.albumId,
    sourceAlbumTitle: item.albumName,
    sourceKind: 'manual',
    title: item.albumName || 'AI verify',
    updatedAt: '',
  };
  const derivative = {
    aiImageUrl: imageDataUrl,
    derivativeStatus: 'ready',
    thumbImageUrl: item.thumbnailUrl,
    tvImageUrl: item.thumbnailUrl,
  };

  const textRound = await callChat(settings, [
    { content: '只输出 JSON。', role: 'system' },
    { content: '请返回 {"ok": true, "message": "pong"}', role: 'user' },
  ], 'round1_text_connectivity');

  const visionRound = await callChat(settings, [
    { content: '只输出 JSON。', role: 'system' },
    {
      content: [
        {
          text: '请根据图片返回 JSON：{"seen_image": true, "summary": "不超过30字", "category": "类型"}',
          type: 'text',
        },
        {
          image_url: {
            detail: 'low',
            url: imageDataUrl,
          },
          type: 'image_url',
        },
      ],
      role: 'user',
    },
  ], 'round2_image_delivery');

  const fullRound = await callChat(settings, [
    {
      content: buildUnifiedVisionSystemPrompt(settings),
      role: 'system',
    },
    {
      content: [
        {
          text: buildUnifiedVisionUserPrompt({
            album,
            derivative,
            item,
            settings,
          }),
          type: 'text',
        },
        {
          image_url: {
            detail: 'low',
            url: imageDataUrl,
          },
          type: 'image_url',
        },
      ],
      role: 'user',
    },
  ], 'round3_full_prompt_parse');

  let normalized = null;
  let normalizeError = '';
  try {
    normalized = fullRound.parsedContent
      ? normalizeUnifiedVisionResult(fullRound.parsedContent)
      : null;
  } catch (error) {
    normalizeError = error instanceof Error ? error.message : String(error);
  }

  console.log(JSON.stringify({
    config: {
      apiKeyConfigured: Boolean(settings.apiKey),
      baseUrl: maskUrl(settings.baseUrl),
      model: settings.model,
      timeoutMs,
    },
    photo: {
      aiDerivativeBytes: imageBuffer.length,
      filename: item.filename,
      photoId: item.photoId,
      sourceType: item.sourceType,
    },
    rounds: [
      summarizeRound(textRound),
      summarizeRound(visionRound),
      summarizeRound(fullRound),
    ],
    round2Parsed: visionRound.parsedContent,
    round3Normalized: normalized && {
      aiBeautyScore: normalized.aiBeautyScore,
      aiComment: normalized.aiComment,
      aiCommentStatus: normalized.aiComment.trim() ? 'completed' : 'pending',
      aiMemoryScore: normalized.aiMemoryScore,
      aiTags: normalized.aiTags,
      hasDetailCandidate: Boolean(fullRound.parsedContent),
    },
    round3NormalizeError: normalizeError,
  }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({
    error: error instanceof Error ? error.message : String(error),
  }, null, 2));
  process.exitCode = 1;
});
