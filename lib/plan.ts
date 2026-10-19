import { UNCATEGORIZED } from './constants';
import type {
  BookmarkItem,
  CategoryDef,
  MetaMap,
  PlanCategory,
  PlanItem,
  PlanSubcategory,
} from './types';
import { sanitizeFolderName, urlKey } from './url';

const OTHER_SUBFOLDER = '其他';

export function buildPlan(
  bookmarks: BookmarkItem[],
  meta: MetaMap,
  categories: CategoryDef[] = [],
): PlanCategory[] {
  const categoryOrder = new Map<string, number>();
  categories.forEach((category, index) => categoryOrder.set(category.name, index));

  const byCategory = new Map<string, Map<string, PlanItem[]>>();

  for (const bookmark of bookmarks) {
    const entry = meta[urlKey(bookmark.url)];
    if (!entry) continue;
    const category = sanitizeFolderName(entry.category || UNCATEGORIZED, UNCATEGORIZED);
    const subcategory = sanitizeFolderName(entry.subcategory || OTHER_SUBFOLDER, OTHER_SUBFOLDER);

    if (!byCategory.has(category)) byCategory.set(category, new Map());
    const subs = byCategory.get(category)!;
    if (!subs.has(subcategory)) subs.set(subcategory, []);
    subs.get(subcategory)!.push({ bookmark, meta: entry });
  }

  const plan: PlanCategory[] = [];
  for (const [name, subs] of byCategory) {
    const subcategories: PlanSubcategory[] = [];
    let count = 0;
    for (const [subName, items] of subs) {
      subcategories.push({ name: subName, items });
      count += items.length;
    }
    subcategories.sort((a, b) => b.items.length - a.items.length || a.name.localeCompare(b.name));
    plan.push({ name, subcategories, count });
  }

  plan.sort((a, b) => {
    const ai = categoryOrder.get(a.name);
    const bi = categoryOrder.get(b.name);
    if (ai !== undefined && bi !== undefined) return ai - bi;
    if (ai !== undefined) return -1;
    if (bi !== undefined) return 1;
    return b.count - a.count || a.name.localeCompare(b.name);
  });

  return plan;
}

export function planTotals(
  plan: PlanCategory[],
  includeSubcategories = true,
): { folders: number; bookmarks: number } {
  let folders = 0;
  let bookmarks = 0;
  for (const category of plan) {
    folders += 1;
    bookmarks += category.count;
    if (!includeSubcategories) continue;
    for (const sub of category.subcategories) {
      if (sub.name !== OTHER_SUBFOLDER) folders += 1;
    }
  }
  return { folders, bookmarks };
}

export function flattenPlan(plan: PlanCategory[]): PlanItem[] {
  return plan.flatMap((category) => category.subcategories.flatMap((sub) => sub.items));
}
