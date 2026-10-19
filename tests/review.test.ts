import { describe, expect, it } from 'vitest';
import { needsReview } from '../lib/review';
import type { BookmarkMeta } from '../lib/types';

function meta(patch: Partial<BookmarkMeta> = {}): BookmarkMeta {
  return {
    url: 'https://example.com',
    title: 'Example',
    category: '阅读与资讯',
    subcategory: '个人博客',
    description: '独立博客，前端和生活随笔都有。',
    tags: ['博客'],
    confidence: 0.9,
    model: 'test',
    analyzedAt: 1,
    sourceFolder: '',
    ...patch,
  };
}

describe('needsReview', () => {
  it('accepts a normal entry', () => {
    expect(needsReview(meta())).toBe(false);
  });

  it('flags uncategorized entries', () => {
    expect(needsReview(meta({ category: '未分类' }))).toBe(true);
  });

  it('flags missing subcategory', () => {
    expect(needsReview(meta({ subcategory: '' }))).toBe(true);
  });

  it('flags low confidence', () => {
    expect(needsReview(meta({ confidence: 0.4 }))).toBe(true);
  });

  it('flags very short descriptions', () => {
    expect(needsReview(meta({ description: '博客。' }))).toBe(true);
  });

  it('flags descriptions that admit uncertainty', () => {
    expect(needsReview(meta({ description: '一个网站，具体内容未知。' }))).toBe(true);
  });

  it('ignores missing metadata', () => {
    expect(needsReview(undefined)).toBe(false);
  });
});
