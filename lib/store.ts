import { DEFAULT_CATEGORIES, DEFAULT_SETTINGS, MAX_BATCH_SIZE, UNCATEGORIZED } from './constants';
import type { AppliedRecord, CategoryDef, MetaMap, Settings } from './types';

export const STORAGE_KEYS = {
  settings: 'tidee.settings.v1',
  meta: 'tidee.meta.v1',
  applied: 'tidee.applied.v1',
  runLock: 'tidee.runLock.v1',
} as const;

function clamp(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function normalizeCategories(input: unknown): CategoryDef[] {
  const items = Array.isArray(input) ? input : DEFAULT_CATEGORIES;
  const legacyNames = [
    '设计灵感',
    'UI 与素材',
    'AI 工具',
    '开发与代码',
    '效率与办公',
    '资讯与社区',
    '学习与文档',
    '生活与服务',
    '未分类',
  ];
  const incomingNames = items
    .map((item) =>
      item && typeof item === 'object'
        ? String((item as Record<string, unknown>).name ?? '').trim()
        : '',
    )
    .filter(Boolean);
  const isLegacyDefault =
    incomingNames.length <= legacyNames.length &&
    legacyNames.every((name) => incomingNames.includes(name));
  const raw = isLegacyDefault ? DEFAULT_CATEGORIES : items;
  const seen = new Set<string>();
  const output: CategoryDef[] = [];

  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const value = item as Record<string, unknown>;
    const name = String(value.name ?? '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 16);
    if (!name || seen.has(name)) continue;
    seen.add(name);
    output.push({
      name,
      description: String(value.description ?? '').trim().slice(0, 40) || undefined,
    });
    if (output.length === 20) break;
  }

  if (output.length === 0) output.push(...DEFAULT_CATEGORIES);
  if (!seen.has(UNCATEGORIZED)) output.push({ name: UNCATEGORIZED, description: '暂时无法确定归属的收藏' });
  return output;
}

export function normalizeSettings(input: unknown): Settings {
  const raw = (input && typeof input === 'object' ? input : {}) as Partial<Settings>;
  return {
    ...DEFAULT_SETTINGS,
    ...raw,
    version: 1,
    baseUrl: String(raw.baseUrl ?? DEFAULT_SETTINGS.baseUrl).trim(),
    apiKey: String(raw.apiKey ?? '').trim(),
    model: String(raw.model ?? DEFAULT_SETTINGS.model).trim(),
    temperature: clamp(Number(raw.temperature), 0, 1.5, DEFAULT_SETTINGS.temperature),
    batchSize: Math.round(clamp(Number(raw.batchSize), 1, MAX_BATCH_SIZE, DEFAULT_SETTINGS.batchSize)),
    concurrency: Math.round(clamp(Number(raw.concurrency), 1, 4, DEFAULT_SETTINGS.concurrency)),
    jsonMode: raw.jsonMode !== false,
    categories: normalizeCategories(raw.categories),
    rootFolderName: String(raw.rootFolderName || DEFAULT_SETTINGS.rootFolderName).trim().slice(0, 40),
    destination: raw.destination === 'bar' ? 'bar' : 'other',
    useSubcategories: raw.useSubcategories === true,
    autoAnalyze: raw.autoAnalyze !== false,
    autoIntervalMinutes: Math.round(
      clamp(Number(raw.autoIntervalMinutes), 30, 1440, DEFAULT_SETTINGS.autoIntervalMinutes),
    ),
    theme: raw.theme === 'light' || raw.theme === 'dark' ? raw.theme : 'system',
  };
}

export async function readSettings(): Promise<Settings> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.settings);
  return normalizeSettings(result[STORAGE_KEYS.settings]);
}

export async function writeSettings(settings: Settings): Promise<Settings> {
  const normalized = normalizeSettings(settings);
  await chrome.storage.local.set({ [STORAGE_KEYS.settings]: normalized });
  return normalized;
}

function normalizeMetaMap(input: unknown): MetaMap {
  if (!input || typeof input !== 'object') return {};
  const output: MetaMap = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (!value || typeof value !== 'object') continue;
    const entry = value as Record<string, unknown>;
    const url = String(entry.url ?? '').trim();
    if (!url) continue;
    output[key] = {
      url,
      title: String(entry.title ?? '').slice(0, 300),
      category: String(entry.category ?? UNCATEGORIZED).slice(0, 20),
      subcategory: String(entry.subcategory ?? '').slice(0, 20),
      description: String(entry.description ?? '').slice(0, 200),
      tags: Array.isArray(entry.tags)
        ? entry.tags.filter((tag): tag is string => typeof tag === 'string').slice(0, 4)
        : [],
      confidence: clamp(Number(entry.confidence), 0, 1, 0.5),
      model: String(entry.model ?? '').slice(0, 80),
      analyzedAt: Number(entry.analyzedAt) || Date.now(),
      sourceFolder: String(entry.sourceFolder ?? '').slice(0, 200),
      editedByUser: entry.editedByUser === true,
    };
  }
  return output;
}

export async function readMeta(): Promise<MetaMap> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.meta);
  return normalizeMetaMap(result[STORAGE_KEYS.meta]);
}

export async function writeMeta(meta: MetaMap): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.meta]: meta });
}

export async function readApplied(): Promise<AppliedRecord | null> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.applied);
  const value = result[STORAGE_KEYS.applied] as AppliedRecord | undefined;
  if (!value || typeof value !== 'object') return null;
  if (!Array.isArray(value.items) || !value.rootId) return null;
  return value;
}

export async function writeApplied(record: AppliedRecord): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.applied]: record });
}

export async function clearApplied(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEYS.applied);
}

export async function clearMeta(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEYS.meta);
}
