import { computed, ref } from 'vue';
import { DEFAULT_SETTINGS, UNCATEGORIZED } from '../lib/constants';
import { buildAnalysisQueue, chunk, type AnalysisScope } from '../lib/batch';
import {
  AiError,
  classifyBatch,
  ensureHostPermission,
  generateTaxonomy,
} from '../lib/ai';
import {
  applyPlan,
  destinationParentId,
  findNode,
  flattenTree,
  getTree,
  undoApply,
  type BookmarkNode,
} from '../lib/bookmarks';
import {
  backupFilename,
  downloadText,
  metaToJson,
  treeToNetscapeHtml,
} from '../lib/export';
import { buildPlan } from '../lib/plan';
import { needsReview } from '../lib/review';
import {
  clearApplied,
  clearMeta,
  normalizeSettings,
  readApplied,
  readMeta,
  readSettings,
  STORAGE_KEYS,
  writeApplied,
  writeMeta,
  writeSettings,
} from '../lib/store';
import type {
  AnalysisProgress,
  AppliedRecord,
  BookmarkItem,
  BookmarkMeta,
  MetaMap,
  Settings,
} from '../lib/types';
import { hostOf, urlKey } from '../lib/url';

export interface Toast {
  id: number;
  message: string;
  tone: 'info' | 'success' | 'error';
}

const settings = ref<Settings>({ ...DEFAULT_SETTINGS });
const meta = ref<MetaMap>({});
const applied = ref<AppliedRecord | null>(null);
const bookmarks = ref<BookmarkItem[]>([]);
const bookmarkTree = ref<BookmarkNode[]>([]);
const ready = ref(false);
const analyzing = ref(false);
const progress = ref<AnalysisProgress | null>(null);
const toasts = ref<Toast[]>([]);
const initError = ref('');

let initPromise: Promise<void> | null = null;
let abortController: AbortController | null = null;
let refreshTimer: ReturnType<typeof setTimeout> | undefined;
let toastId = 0;
let listenersAttached = false;
let suppressMetaSync = false;

function errorMessage(error: unknown): string {
  if (error instanceof AiError) return error.message;
  if (error instanceof Error) return error.message;
  return String(error);
}

export function pushToast(message: string, tone: Toast['tone'] = 'info'): void {
  const id = ++toastId;
  toasts.value = [...toasts.value, { id, message, tone }];
  setTimeout(() => {
    toasts.value = toasts.value.filter((toast) => toast.id !== id);
  }, tone === 'error' ? 6000 : 3600);
}

function dismissToast(id: number): void {
  toasts.value = toasts.value.filter((toast) => toast.id !== id);
}

export function useTidee() {
  const configured = computed(
    () => Boolean(settings.value.baseUrl.trim() && settings.value.model.trim()),
  );

  const analyzedItems = computed(() =>
    bookmarks.value.filter((bookmark) => Boolean(meta.value[urlKey(bookmark.url)])),
  );

  const analyzedCount = computed(() => analyzedItems.value.length);
  const pendingCount = computed(() => bookmarks.value.length - analyzedCount.value);
  const reviewCount = computed(() => {
    const known = new Set(settings.value.categories.map((category) => category.name));
    return analyzedItems.value.filter((bookmark) => {
      const entry = meta.value[urlKey(bookmark.url)];
      if (entry?.editedByUser) return false;
      return needsReview(entry) || (entry ? !known.has(entry.category) : false);
    }).length;
  });

  const categoryStats = computed(() => {
    const counts = new Map<string, number>();
    for (const bookmark of analyzedItems.value) {
      const entry = meta.value[urlKey(bookmark.url)];
      if (!entry) continue;
      counts.set(entry.category, (counts.get(entry.category) ?? 0) + 1);
    }
    return counts;
  });

  const plan = computed(() => buildPlan(bookmarks.value, meta.value, settings.value.categories));

  async function refreshBookmarks(): Promise<void> {
    const tree = await getTree();
    bookmarkTree.value = tree;
    bookmarks.value = flattenTree(tree);

    const currentKeys = new Set(bookmarks.value.map((bookmark) => urlKey(bookmark.url)));
    const nextMeta = { ...meta.value };
    let changed = false;
    for (const key of Object.keys(nextMeta)) {
      if (currentKeys.has(key)) continue;
      delete nextMeta[key];
      changed = true;
    }
    if (changed) {
      meta.value = nextMeta;
      await writeMeta(nextMeta);
    }
  }

  function scheduleRefresh(): void {
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      void refreshBookmarks();
    }, 280);
  }

  function attachListeners(): void {
    if (listenersAttached) return;
    listenersAttached = true;

    chrome.bookmarks.onCreated.addListener(scheduleRefresh);
    chrome.bookmarks.onRemoved.addListener(scheduleRefresh);
    chrome.bookmarks.onChanged.addListener(scheduleRefresh);
    chrome.bookmarks.onMoved.addListener(scheduleRefresh);
    chrome.bookmarks.onChildrenReordered.addListener(scheduleRefresh);

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      if (changes[STORAGE_KEYS.settings]?.newValue) {
        settings.value = normalizeSettings(changes[STORAGE_KEYS.settings]!.newValue);
      }
      if (changes[STORAGE_KEYS.applied]) {
        const value = changes[STORAGE_KEYS.applied]!.newValue as AppliedRecord | undefined;
        applied.value = value ?? null;
      }
      if (changes[STORAGE_KEYS.meta] && !suppressMetaSync) {
        void readMeta().then((value) => {
          meta.value = value;
        });
      }
    });
  }

  async function init(): Promise<void> {
    if (initPromise) return initPromise;
    initPromise = (async () => {
      try {
        attachListeners();
        const [loadedSettings, loadedMeta, loadedApplied] = await Promise.all([
          readSettings(),
          readMeta(),
          readApplied(),
        ]);
        settings.value = loadedSettings;
        meta.value = loadedMeta;
        applied.value = loadedApplied;
        await refreshBookmarks();
        ready.value = true;
      } catch (error) {
        initError.value = errorMessage(error);
        pushToast(`初始化失败：${initError.value}`, 'error');
        ready.value = true;
      }
    })();
    return initPromise;
  }

  async function saveSettings(next: Settings): Promise<Settings> {
    const normalized = await writeSettings(next);
    settings.value = normalized;
    return normalized;
  }

  async function updateSettings(patch: Partial<Settings>): Promise<Settings> {
    return saveSettings({ ...settings.value, ...patch });
  }

  function entryFor(bookmark: BookmarkItem): BookmarkMeta | undefined {
    return meta.value[urlKey(bookmark.url)];
  }

  async function updateEntry(bookmark: BookmarkItem, patch: Partial<BookmarkMeta>): Promise<void> {
    const key = urlKey(bookmark.url);
    const current = meta.value[key];
    if (!current) return;
    const next: MetaMap = {
      ...meta.value,
      [key]: { ...current, ...patch, url: bookmark.url, editedByUser: true },
    };
    meta.value = next;
    await writeMeta(next);
  }

  async function deleteEntry(bookmark: BookmarkItem): Promise<void> {
    const key = urlKey(bookmark.url);
    if (!meta.value[key]) return;
    const next = { ...meta.value };
    delete next[key];
    meta.value = next;
    await writeMeta(next);
  }

  async function analyzeOne(bookmark: BookmarkItem): Promise<void> {
    await analyzeItems([bookmark]);
  }

  async function analyzeItems(targets: BookmarkItem[]): Promise<void> {
    if (analyzing.value) return;
    if (!configured.value) throw new Error('请先在设置里填写 API 地址和模型');
    if (targets.length === 0) return;

    const allowed = await ensureHostPermission(settings.value.baseUrl);
    if (!allowed) throw new Error('没有获得访问该 API 域名的权限');

    const storedLock = await chrome.storage.local.get(STORAGE_KEYS.runLock);
    const lockTime = Number(storedLock[STORAGE_KEYS.runLock] ?? 0);
    if (lockTime && Date.now() - lockTime < 10 * 60_000) {
      throw new Error('后台自动整理正在进行，请稍后再试');
    }
    await chrome.storage.local.set({ [STORAGE_KEYS.runLock]: Date.now() });
    analyzing.value = true;
    abortController = new AbortController();
    const batchSize = settings.value.batchSize;
    const batches = chunk(targets, batchSize);
    const workingMeta: MetaMap = { ...meta.value };
    const startedAt = Date.now();

    progress.value = {
      total: targets.length,
      done: 0,
      failed: 0,
      batches: batches.length,
      completedBatches: 0,
      currentBatch: 0,
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      errors: [],
      startedAt,
    };

    let nextBatch = 0;
    const controller = abortController;

    const worker = async (): Promise<void> => {
      while (!controller.signal.aborted) {
        const batchIndex = nextBatch;
        nextBatch += 1;
        if (batchIndex >= batches.length) return;

        const batch = batches[batchIndex]!;
        if (progress.value) progress.value.currentBatch = batchIndex + 1;
        const refs = batch.map((bookmark, index) => ({
          ref: `${batchIndex}:${index}`,
          title: bookmark.title,
          url: bookmark.url,
          folder: bookmark.folderPath,
        }));

        try {
          const result = await classifyBatch(
            settings.value,
            settings.value.categories,
            refs,
            { signal: controller.signal },
          );

          const returned = new Set<string>();
          for (const entry of result.entries) {
            const [batchRef, indexRef] = entry.ref.split(':');
            if (batchRef === String(batchIndex)) {
              const target = batch[Number(indexRef)];
              if (target) {
                returned.add(entry.ref);
                workingMeta[urlKey(target.url)] = {
                  url: target.url,
                  title: target.title,
                  category: entry.category,
                  subcategory: entry.subcategory,
                  description: entry.description,
                  tags: entry.tags,
                  confidence: entry.confidence,
                  model: result.model,
                  analyzedAt: Date.now(),
                  sourceFolder: target.folderPath,
                  editedByUser: false,
                };
              }
            }
          }

          if (progress.value) {
            progress.value.done += returned.size;
            progress.value.failed += batch.length - returned.size;
            progress.value.usage.promptTokens += result.usage.promptTokens;
            progress.value.usage.completionTokens += result.usage.completionTokens;
            progress.value.usage.totalTokens += result.usage.totalTokens;
          }

          suppressMetaSync = true;
          await writeMeta(workingMeta);
          suppressMetaSync = false;
          meta.value = { ...workingMeta };
        } catch (error) {
          if (error instanceof DOMException && error.name === 'AbortError') {
            return;
          }
          if (progress.value) {
            progress.value.failed += batch.length;
            progress.value.errors.push(errorMessage(error));
          }
        } finally {
          if (progress.value) progress.value.completedBatches += 1;
          suppressMetaSync = false;
        }
      }
    };

    try {
      const workerCount = Math.min(settings.value.concurrency, batches.length);
      await Promise.all(Array.from({ length: workerCount }, () => worker()));
    } finally {
      if (progress.value) {
        progress.value.finishedAt = Date.now();
        progress.value.cancelled = abortController?.signal.aborted ?? false;
      }
      analyzing.value = false;
      abortController = null;
      await chrome.storage.local.remove(STORAGE_KEYS.runLock);
    }
  }

  async function startAnalysis(scope: AnalysisScope): Promise<void> {
    if (!configured.value) throw new Error('请先在设置里填写 API 地址和模型');
    const queue = buildAnalysisQueue(
      bookmarks.value,
      meta.value,
      scope,
      settings.value.categories,
    );
    if (queue.length === 0) {
      pushToast('没有需要读的收藏', 'info');
      return;
    }
    await analyzeItems(queue);
    const value = progress.value;
    if (value) {
      if (value.failed > 0) {
        pushToast(
          `读完了：${value.done} 条成功，${value.failed} 条失败`,
          value.failed === value.total ? 'error' : 'info',
        );
      } else {
        pushToast(`读完了：${value.done} 条`, 'success');
      }
    }
  }

  function cancelAnalysis(): void {
    abortController?.abort();
    pushToast('已停止，已完成的结果已保存', 'info');
  }

  async function suggestCategories(): Promise<number> {
    if (!configured.value) throw new Error('请先在设置里填写 API 地址和模型');
    const allowed = await ensureHostPermission(settings.value.baseUrl);
    if (!allowed) throw new Error('没有获得访问该 API 域名的权限');
    if (bookmarks.value.length === 0) throw new Error('收藏夹是空的');

    const result = await generateTaxonomy(
      settings.value,
      bookmarks.value.map((bookmark) => ({
        title: bookmark.title,
        host: hostOf(bookmark.url),
        folder: bookmark.folderPath,
      })),
    );

    const categories = [...result.categories];
    if (!categories.some((category) => category.name === UNCATEGORIZED)) {
      categories.push({ name: UNCATEGORIZED, description: 'AI 也无法确定归属的收藏' });
    }
    await updateSettings({ categories });
    pushToast(`已生成 ${result.categories.length} 个分类`, 'success');
    return result.categories.length;
  }

  async function applyNow(): Promise<AppliedRecord> {
    if (plan.value.length === 0) throw new Error('还没有可整理的收藏');

    const tree = await getTree();
    let rootId: string | undefined;
    if (applied.value) {
      const previousRoot = findNode(tree, applied.value.rootId);
      const targetParent = destinationParentId(tree, settings.value.destination);
      if (previousRoot?.parentId === targetParent) rootId = applied.value.rootId;
    }

    downloadText(
      backupFilename('tidee-backup', 'html'),
      treeToNetscapeHtml(tree),
      'text/html;charset=utf-8',
    );

    const record = await applyPlan(plan.value, {
      destination: settings.value.destination,
      rootFolderName: settings.value.rootFolderName,
      useSubcategories: settings.value.useSubcategories,
      rootId,
    });

    applied.value = record;
    await writeApplied(record);
    await refreshBookmarks();
    pushToast(`已整理 ${record.moved} 条收藏`, 'success');
    return record;
  }

  async function undoLastApply(): Promise<{ moved: number; missing: number }> {
    if (!applied.value) throw new Error('没有可撤销的整理记录');
    const result = await undoApply(applied.value);
    await clearApplied();
    applied.value = null;
    await refreshBookmarks();
    pushToast(`已撤销，移回 ${result.moved} 条`, 'success');
    return result;
  }

  function exportFavorites(): void {
    downloadText(
      backupFilename('tidee-favorites', 'html'),
      treeToNetscapeHtml(bookmarkTree.value),
      'text/html;charset=utf-8',
    );
    pushToast('已导出可导入 Edge 的 HTML', 'success');
  }

  function exportMeta(): void {
    downloadText(
      backupFilename('tidee-ai-meta', 'json'),
      metaToJson(meta.value),
      'application/json;charset=utf-8',
    );
    pushToast('已导出描述数据', 'success');
  }

  async function clearAllMeta(): Promise<void> {
    await clearMeta();
    meta.value = {};
    pushToast('已清除全部描述', 'info');
  }

  return {
    settings,
    meta,
    applied,
    bookmarks,
    bookmarkTree,
    ready,
    analyzing,
    progress,
    toasts,
    initError,
    configured,
    analyzedItems,
    analyzedCount,
    pendingCount,
    reviewCount,
    categoryStats,
    plan,
    init,
    refreshBookmarks,
    saveSettings,
    updateSettings,
    entryFor,
    updateEntry,
    deleteEntry,
    analyzeOne,
    startAnalysis,
    cancelAnalysis,
    suggestCategories,
    applyNow,
    undoLastApply,
    exportFavorites,
    exportMeta,
    clearAllMeta,
    pushToast,
    dismissToast,
  };
}
