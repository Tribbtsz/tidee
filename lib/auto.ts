import { classifyBatch } from './ai';
import { buildAnalysisQueue } from './batch';
import { flattenTree, getTree } from './bookmarks';
import { readMeta, readSettings, STORAGE_KEYS, writeMeta } from './store';
import type { MetaMap } from './types';
import { urlKey } from './url';

export const AUTO_ALARM = 'tidee-auto';
export const AUTO_SOON_ALARM = 'tidee-auto-soon';

export async function syncAutoAlarm(): Promise<void> {
  const settings = await readSettings();
  await chrome.alarms.clear(AUTO_ALARM);
  await chrome.alarms.clear(AUTO_SOON_ALARM);

  if (!settings.autoAnalyze || !settings.baseUrl || !settings.model) return;
  await chrome.alarms.create(AUTO_ALARM, {
    periodInMinutes: Math.max(30, settings.autoIntervalMinutes),
  });
}

export async function scheduleAutoSoon(delayMs = 60_000): Promise<void> {
  await chrome.alarms.create(AUTO_SOON_ALARM, { when: Date.now() + delayMs });
}

export async function canUseAutoApi(baseUrl: string): Promise<boolean> {
  try {
    const url = new URL(baseUrl);
    const pattern = `${url.origin}/*`;
    return await chrome.permissions.contains({ origins: [pattern] });
  } catch {
    return false;
  }
}

export async function runAutoAnalysis(): Promise<{
  analyzed: number;
  remaining: number;
} | null> {
  const settings = await readSettings();
  if (!settings.autoAnalyze || !settings.baseUrl || !settings.model) return null;
  if (!(await canUseAutoApi(settings.baseUrl))) return null;

  const storedLock = await chrome.storage.local.get(STORAGE_KEYS.runLock);
  const lockTime = Number(storedLock[STORAGE_KEYS.runLock] ?? 0);
  if (lockTime && Date.now() - lockTime < 10 * 60_000) return null;

  await chrome.storage.local.set({ [STORAGE_KEYS.runLock]: Date.now() });

  try {
    const [tree, storedMeta] = await Promise.all([getTree(), readMeta()]);
    const bookmarks = flattenTree(tree);
    const currentKeys = new Set(bookmarks.map((bookmark) => urlKey(bookmark.url)));

    const meta: MetaMap = { ...storedMeta };
    let pruned = false;
    for (const key of Object.keys(meta)) {
      if (currentKeys.has(key)) continue;
      delete meta[key];
      pruned = true;
    }
    if (pruned) await writeMeta(meta);

    const queue = buildAnalysisQueue(bookmarks, meta, 'pending', settings.categories);
    if (queue.length === 0) return { analyzed: 0, remaining: 0 };

    const batch = queue.slice(0, Math.min(settings.batchSize, 20));
    const refs = batch.map((bookmark, index) => ({
      ref: `a:${index}`,
      title: bookmark.title,
      url: bookmark.url,
      folder: bookmark.folderPath,
    }));

    const result = await classifyBatch(settings, settings.categories, refs);
    const entries = new Map(result.entries.map((entry) => [entry.ref, entry]));
    const nextMeta: MetaMap = { ...meta };

    for (let index = 0; index < batch.length; index += 1) {
      const bookmark = batch[index]!;
      const entry = entries.get(`a:${index}`);
      if (!entry) continue;
      nextMeta[urlKey(bookmark.url)] = {
        url: bookmark.url,
        title: bookmark.title,
        category: entry.category,
        subcategory: entry.subcategory,
        description: entry.description,
        tags: entry.tags,
        confidence: entry.confidence,
        model: result.model,
        analyzedAt: Date.now(),
        sourceFolder: bookmark.folderPath,
        editedByUser: false,
      };
    }

    await writeMeta(nextMeta);
    return {
      analyzed: result.entries.length,
      remaining: Math.max(0, queue.length - batch.length),
    };
  } finally {
    await chrome.storage.local.remove(STORAGE_KEYS.runLock);
  }
}
