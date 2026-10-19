import { describe, expect, it } from 'vitest';
import { buildAnalysisQueue, chunk, dedupeByUrl } from '../lib/batch';
import { buildPlan, flattenPlan, planTotals } from '../lib/plan';
import type { BookmarkItem, BookmarkMeta, MetaMap } from '../lib/types';
import { urlKey } from '../lib/url';

function bookmark(id: string, url: string): BookmarkItem {
  return {
    id,
    title: `title-${id}`,
    url,
    parentId: '2',
    folderPath: '其他收藏夹 / ui',
  };
}

function meta(url: string, category: string, subcategory = ''): BookmarkMeta {
  return {
    url,
    title: url,
    category,
    subcategory,
    description: 'desc',
    tags: ['a'],
    confidence: 0.9,
    model: 'm',
    analyzedAt: 1,
    sourceFolder: '其他收藏夹',
  };
}

describe('chunk', () => {
  it('splits into fixed size batches', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('never produces empty batches', () => {
    expect(chunk([], 20)).toEqual([]);
    expect(chunk([1], 0)).toEqual([[1]]);
  });
});

describe('buildAnalysisQueue', () => {
  const items = [
    bookmark('1', 'https://a.com'),
    bookmark('2', 'https://a.com/?utm_source=x'),
    bookmark('3', 'edge://favorites'),
    bookmark('4', 'https://b.com'),
  ];

  it('dedupes by normalized URL and skips non-web protocols', () => {
    expect(dedupeByUrl(items).map((item) => item.id)).toEqual(['1', '3', '4']);
  });

  it('only returns unanalyzed items in pending scope', () => {
    const metaMap: MetaMap = { [urlKey('https://a.com')]: meta('https://a.com', '设计') };
    expect(buildAnalysisQueue(items, metaMap, 'pending').map((item) => item.id)).toEqual(['4']);
  });

  it('returns everything analyzable in all scope', () => {
    const metaMap: MetaMap = { [urlKey('https://a.com')]: meta('https://a.com', '设计') };
    expect(buildAnalysisQueue(items, metaMap, 'all').map((item) => item.id)).toEqual(['1', '4']);
  });

  it('review scope includes uncategorized and unknown categories', () => {
    const metaMap: MetaMap = {
      [urlKey('https://a.com')]: meta('https://a.com', '未分类'),
      [urlKey('https://b.com')]: meta('https://b.com', '旧分类'),
    };
    const queue = buildAnalysisQueue(
      items,
      metaMap,
      'review',
      [{ name: '设计资源' }, { name: '未分类' }],
    );
    expect(queue.map((item) => item.id)).toEqual(['1', '4']);
  });

  it('review scope skips manually edited entries', () => {
    const metaMap: MetaMap = {
      [urlKey('https://a.com')]: {
        ...meta('https://a.com', '未分类'),
        editedByUser: true,
      },
    };
    expect(
      buildAnalysisQueue(items, metaMap, 'review', [
        { name: '未分类' },
      ]).map((item) => item.id),
    ).toEqual([]);
  });
});

describe('buildPlan', () => {
  const items = [
    bookmark('1', 'https://a.com'),
    bookmark('2', 'https://b.com'),
    bookmark('3', 'https://c.com'),
    bookmark('4', 'https://d.com'),
  ];

  const metaMap: MetaMap = {
    [urlKey('https://a.com')]: meta('https://a.com', '设计灵感', '作品集'),
    [urlKey('https://b.com')]: meta('https://b.com', '设计灵感', '作品集'),
    [urlKey('https://c.com')]: meta('https://c.com', 'AI 工具'),
    // d.com intentionally unanalyzed
  };

  it('groups by category and subcategory, skipping unanalyzed', () => {
    const plan = buildPlan(items, metaMap, [
      { name: '设计灵感' },
      { name: 'AI 工具' },
    ]);
    expect(plan.map((category) => category.name)).toEqual(['设计灵感', 'AI 工具']);
    expect(plan[0]?.count).toBe(2);
    expect(plan[0]?.subcategories[0]?.name).toBe('作品集');
    expect(flattenPlan(plan).map((item) => item.bookmark.id)).toEqual(['1', '2', '3']);
  });

  it('puts missing subcategories under 其他', () => {
    const plan = buildPlan(items, metaMap, [{ name: '设计灵感' }, { name: 'AI 工具' }]);
    expect(plan[1]?.subcategories[0]?.name).toBe('其他');
  });

  it('respects configured category order and appends unknown categories', () => {
    const withUnknown: MetaMap = {
      ...metaMap,
      [urlKey('https://d.com')]: meta('https://d.com', '冷门分类'),
    };
    const plan = buildPlan(items, withUnknown, [{ name: 'AI 工具' }, { name: '设计灵感' }]);
    expect(plan.map((category) => category.name)).toEqual(['AI 工具', '设计灵感', '冷门分类']);
  });

  it('counts folders and bookmarks for preview', () => {
    const plan = buildPlan(items, metaMap, [{ name: '设计灵感' }, { name: 'AI 工具' }]);
    expect(planTotals(plan)).toEqual({ folders: 3, bookmarks: 3 });
  });

  it('sanitizes folder names', () => {
    const weird: MetaMap = {
      [urlKey('https://a.com')]: meta('https://a.com', 'a/b', 'c:d'),
    };
    const plan = buildPlan([items[0]!], weird, []);
    expect(plan[0]?.name).toBe('a b');
    expect(plan[0]?.subcategories[0]?.name).toBe('c d');
  });
});
