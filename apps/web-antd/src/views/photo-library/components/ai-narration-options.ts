import type { PhotoCenterItem } from '#/api/photo-library';

type AiNarrationVariant = PhotoCenterItem['aiNarrationVariants'][number];

export function formatAiNarrationVariant(
  variant: AiNarrationVariant,
) {
  return [
    variant.sceneDescription,
    variant.handwrittenThought,
    variant.lyricalClosure,
  ].filter(Boolean).join('\n');
}

export function buildAiNarrationOptions(
  variants: AiNarrationVariant[],
) {
  return variants.map((variant, index) => ({
    label: `旁白 ${index + 1}：${variant.sceneDescription}`,
    value: formatAiNarrationVariant(variant),
  }));
}

export function resolveAiNarrationVariants(
  record: Pick<PhotoCenterItem, 'aiDetail' | 'aiNarrationVariants'>,
): AiNarrationVariant[] {
  if (record.aiNarrationVariants.length > 0) return record.aiNarrationVariants;
  const raw = parseAiDetail(record.aiDetail);
  if (!raw) return [];
  return extractAiNarrationVariants(raw);
}

function parseAiDetail(value: string): Record<string, unknown> | null {
  const text = value.trim();
  if (!text) return null;
  try {
    return asRecord(JSON.parse(stripJsonFence(text)));
  } catch {
    return null;
  }
}

function stripJsonFence(value: string) {
  return value
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

function extractAiNarrationVariants(raw: Record<string, unknown>): AiNarrationVariant[] {
  const narration = asRecord(raw.narration);
  const candidates = Array.isArray(narration?.variants)
    ? narration.variants
    : Array.isArray(raw.narration_options)
      ? raw.narration_options
      : Array.isArray(raw.narration_variants)
        ? raw.narration_variants
        : [];
  return candidates
    .map((candidate) => asRecord(candidate))
    .filter((candidate): candidate is Record<string, unknown> => candidate !== null)
    .map((candidate) => ({
      handwrittenThought: normalizeNarrationPart(
        candidate.handwritten_thought ??
          candidate.handwrittenThought ??
          candidate.handwritten_line,
      ),
      lyricalClosure: normalizeNarrationPart(
        candidate.lyrical_closure ??
          candidate.lyricalClosure ??
          candidate.closing_line,
      ),
      sceneDescription: normalizeNarrationPart(
        candidate.scene_description ??
          candidate.sceneDescription ??
          candidate.scene_line,
      ),
    }))
    .filter(
      (candidate) =>
        candidate.sceneDescription &&
        candidate.handwrittenThought &&
        candidate.lyricalClosure,
    )
    .slice(0, 5);
}

function normalizeNarrationPart(value: unknown): string {
  return typeof value === 'string' ? value.trim().slice(0, 48) : '';
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}
