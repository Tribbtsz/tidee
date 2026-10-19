import type { BookmarkItem, CategoryDef, MetaMap } from './types';
import { needsReview } from './review';
import { isAnalyzable, urlKey } from './url';

export function chunk<T>(items: T[], size: number): T[][] {
  const safeSize = Math.max(1, Math.floor(size) || 1);
  const output: T[][] = [];
  for (let i = 0; i < items.length; i += safeSize) {
    output.push(items.slice(i, i + safeSize));
  }
  return output;
}

export function dedupeByUrl(bookmarks: BookmarkItem[]): BookmarkItem[] {
  const seen = new Set<string>();
  const output: BookmarkItem[] = [];
  for (const bookmark of bookmarks) {
    const key = urlKey(bookmark.url);
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(bookmark);
  }
  return output;
}

export type AnalysisScope = 'pending' | 'review' | 'all';

export function buildAnalysisQueue(
  bookmarks: BookmarkItem[],
  meta: MetaMap,
  scope: AnalysisScope,
  categories: CategoryDef[] = [],
): BookmarkItem[] {
  const knownCategories = new Set(categories.map((category) => category.name));

  return dedupeByUrl(bookmarks).filter((bookmark) => {
    if (!isAnalyzable(bookmark.url)) return false;
    const entry = meta[urlKey(bookmark.url)];
    if (scope === 'all') return true;
    if (scope === 'review') {
      if (!entry || entry.editedByUser) return false;
      return needsReview(entry) || !knownCategories.has(entry.category);
    }
    return !entry;
  });
}

export function estimateBatches(total: number, batchSize: number): number {
  if (total <= 0) return 0;
  return Math.ceil(total / Math.max(1, batchSize));
}
