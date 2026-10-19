import { describe, expect, it } from 'vitest';
import { normalizeCategory, parseJsonLoose } from '../lib/ai';
import type { CategoryDef } from '../lib/types';

const categories: CategoryDef[] = [
  { name: '设计灵感' },
  { name: 'AI 工具' },
  { name: '未分类' },
];

describe('parseJsonLoose', () => {
  it('parses plain JSON', () => {
    expect(parseJsonLoose('{"items":[]}')).toEqual({ items: [] });
  });

  it('strips markdown fences', () => {
    expect(parseJsonLoose('```json\n{"ok":true}\n```')).toEqual({ ok: true });
  });

  it('finds an object inside prose', () => {
    expect(parseJsonLoose('好的，结果如下：{"items":[{"id":"1"}]} 完毕')).toEqual({
      items: [{ id: '1' }],
    });
  });

  it('parses a bare array', () => {
    expect(parseJsonLoose('[{"id":"1"}]')).toEqual([{ id: '1' }]);
  });

  it('throws a friendly error for invalid output', () => {
    expect(() => parseJsonLoose('not json at all')).toThrow(/不是合法 JSON/);
  });
});

describe('normalizeCategory', () => {
  it('keeps exact names', () => {
    expect(normalizeCategory('设计灵感', categories)).toBe('设计灵感');
  });

  it('matches case-insensitively', () => {
    expect(normalizeCategory('ai 工具', categories)).toBe('AI 工具');
  });

  it('matches partial names', () => {
    expect(normalizeCategory('设计灵感/作品集', categories)).toBe('设计灵感');
  });

  it('falls back to 未分类', () => {
    expect(normalizeCategory('完全不存在的分类', categories)).toBe('未分类');
  });

  it('handles empty values', () => {
    expect(normalizeCategory('', categories)).toBe('未分类');
  });
});
