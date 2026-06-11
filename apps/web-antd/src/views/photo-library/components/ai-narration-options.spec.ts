import { describe, expect, it } from 'vitest';

import {
  buildAiNarrationOptions,
  formatAiNarrationVariant,
  resolveAiNarrationVariants,
} from './ai-narration-options';

describe('ai narration options', () => {
  it('builds selectable three-line narration options for all variants', () => {
    const variants = Array.from({ length: 5 }, (_, index) => ({
      handwrittenThought: `手写 ${index + 1}`,
      lyricalClosure: `收束 ${index + 1}`,
      sceneDescription: `场景 ${index + 1}`,
    }));

    expect(buildAiNarrationOptions(variants)).toEqual([
      {
        label: '旁白 1：场景 1',
        value: '场景 1\n手写 1\n收束 1',
      },
      {
        label: '旁白 2：场景 2',
        value: '场景 2\n手写 2\n收束 2',
      },
      {
        label: '旁白 3：场景 3',
        value: '场景 3\n手写 3\n收束 3',
      },
      {
        label: '旁白 4：场景 4',
        value: '场景 4\n手写 4\n收束 4',
      },
      {
        label: '旁白 5：场景 5',
        value: '场景 5\n手写 5\n收束 5',
      },
    ]);
  });

  it('formats a narration variant as three lines', () => {
    expect(formatAiNarrationVariant({
      handwrittenThought: '把这一刻留住',
      lyricalClosure: '日子就这样亮起来',
      sceneDescription: '客厅里站满了家人',
    })).toBe('客厅里站满了家人\n把这一刻留住\n日子就这样亮起来');
  });

  it('resolves narration_options from raw AI detail when projected variants are empty', () => {
    expect(resolveAiNarrationVariants({
      aiDetail: JSON.stringify({
        narration_options: [
          {
            closing_line: '风轻轻拂过花间',
            handwritten_line: '阳光下的花丛里，他安静地站着，看着远方',
            scene_line: '紫色花海中静静站立',
          },
          {
            closing_line: '这一刻静好如诗',
            handwritten_line: '春日里，花影斑驳，他微笑着凝望远方的山峦',
            scene_line: '花影下的温暖时光',
          },
        ],
      }),
      aiNarrationVariants: [],
    })).toEqual([
      {
        handwrittenThought: '阳光下的花丛里，他安静地站着，看着远方',
        lyricalClosure: '风轻轻拂过花间',
        sceneDescription: '紫色花海中静静站立',
      },
      {
        handwrittenThought: '春日里，花影斑驳，他微笑着凝望远方的山峦',
        lyricalClosure: '这一刻静好如诗',
        sceneDescription: '花影下的温暖时光',
      },
    ]);
  });
});
