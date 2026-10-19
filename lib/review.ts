import { UNCATEGORIZED } from './constants';
import type { BookmarkMeta } from './types';

/**
 * Small models tend to report high confidence for everything, so confidence
 * alone is not a reliable review signal. Structural gaps are.
 */
export function needsReview(meta?: BookmarkMeta | null): boolean {
  if (!meta) return false;
  if (meta.confidence < 0.6) return true;
  if (meta.category === UNCATEGORIZED) return true;
  if (!meta.subcategory || meta.subcategory === UNCATEGORIZED) return true;
  const description = meta.description.trim();
  if (description.length < 8) return true;
  if (/未知|未明确|无法判断|暂无具体信息|具体功能不明/.test(description)) return true;
  return false;
}
