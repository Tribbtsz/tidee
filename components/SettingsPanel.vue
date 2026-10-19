<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import {
  Check,
  CircleAlert,
  Database,
  Download,
  Eye,
  EyeOff,
  FolderTree,
  KeyRound,
  Loader2,
  Plus,
  RotateCcw,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
  Wand2,
} from '@lucide/vue';
import { ensureHostPermission, generateTaxonomy, testConnection } from '../lib/ai';
import { DEFAULT_CATEGORIES, UNCATEGORIZED } from '../lib/constants';
import type { CategoryDef, Settings } from '../lib/types';
import { categoryStyle } from '../composables/useBookmarkView';
import { useTidee } from '../composables/useTidee';
import { normalizeSettings } from '../lib/store';
import { hostOf } from '../lib/url';
import ConfirmDialog from './ConfirmDialog.vue';
import UiSelect from './UiSelect.vue';
import UiSwitch from './UiSwitch.vue';

const props = withDefaults(defineProps<{ embedded?: boolean }>(), { embedded: false });
const version = chrome.runtime.getManifest().version;

const {
  settings,
  bookmarks,
  applied,
  saveSettings,
  exportFavorites,
  exportMeta,
  clearAllMeta,
  undoLastApply,
  pushToast,
} = useTidee();

function clone(value: Settings): Settings {
  return JSON.parse(JSON.stringify(value)) as Settings;
}

const draft = ref<Settings>(clone(settings.value));
const showKey = ref(false);
const testing = ref(false);
const testMessage = ref<{ ok: boolean; text: string } | null>(null);
const suggesting = ref(false);
const undoBusy = ref(false);
const storageBytes = ref(0);
const clearConfirmOpen = ref(false);

const DRAFT_KEY = 'tidee.settings.draft.v1';

function loadDraft(): Settings | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    return normalizeSettings(JSON.parse(raw));
  } catch {
    return null;
  }
}

function clearDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // Ignore storage failures.
  }
}

const dirty = computed(() => JSON.stringify(draft.value) !== JSON.stringify(settings.value));
const configured = computed(
  () => Boolean(draft.value.baseUrl.trim() && draft.value.model.trim()),
);
const autoInterval = computed({
  get: () => String(draft.value.autoIntervalMinutes),
  set: (value: string) => {
    draft.value.autoIntervalMinutes = Number(value) || 1440;
  },
});
const intervalOptions = [
  { value: '30', label: '每 30 分钟' },
  { value: '120', label: '每 2 小时' },
  { value: '360', label: '每 6 小时' },
  { value: '1440', label: '每天' },
];

watch(
  settings,
  (value) => {
    if (!dirty.value) draft.value = clone(value);
  },
  { deep: true },
);

watch(
  draft,
  () => {
    try {
      if (dirty.value) {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draft.value));
      } else {
        localStorage.removeItem(DRAFT_KEY);
      }
    } catch {
      // Ignore quota or privacy-mode failures.
    }
  },
  { deep: true, flush: 'post' },
);

onMounted(async () => {
  const savedDraft = loadDraft();
  if (savedDraft) {
    draft.value = savedDraft;
  } else if (!dirty.value) {
    draft.value = clone(settings.value);
  }
  try {
    storageBytes.value = await chrome.storage.local.getBytesInUse(null);
  } catch {
    storageBytes.value = 0;
  }
});

async function test() {
  if (!configured.value) {
    testMessage.value = { ok: false, text: '先填写 API 地址和模型名' };
    return;
  }
  testing.value = true;
  testMessage.value = null;
  try {
    const allowed = await ensureHostPermission(draft.value.baseUrl);
    if (!allowed) throw new Error('没有获得访问该域名的权限');
    const result = await testConnection(draft.value);
    testMessage.value = {
      ok: true,
      text: `连接成功 · ${result.latencyMs} ms · ${result.model}`,
    };
  } catch (error) {
    testMessage.value = {
      ok: false,
      text: error instanceof Error ? error.message : String(error),
    };
  } finally {
    testing.value = false;
  }
}

async function suggest() {
  if (!configured.value) {
    pushToast('先填写 API 地址和模型', 'error');
    return;
  }
  if (bookmarks.value.length === 0) {
    pushToast('收藏夹是空的', 'error');
    return;
  }
  suggesting.value = true;
  try {
    const allowed = await ensureHostPermission(draft.value.baseUrl);
    if (!allowed) throw new Error('没有获得访问该 API 域名的权限');
    const result = await generateTaxonomy(
      draft.value,
      bookmarks.value.map((bookmark) => ({
        title: bookmark.title,
        host: hostOf(bookmark.url),
        folder: bookmark.folderPath,
      })),
    );
    const categories: CategoryDef[] = [...result.categories];
    if (!categories.some((category) => category.name === UNCATEGORIZED)) {
      categories.push({ name: UNCATEGORIZED, description: '暂时无法确定归属的收藏' });
    }
    draft.value.categories = categories;
    pushToast(`已生成 ${result.categories.length} 个候选分类，记得保存`, 'success');
  } catch (error) {
    pushToast(error instanceof Error ? error.message : String(error), 'error');
  } finally {
    suggesting.value = false;
  }
}

function addCategory() {
  if (draft.value.categories.length >= 20) return;
  draft.value.categories.push({ name: '新分类', description: '' });
}

function removeCategory(index: number) {
  if (draft.value.categories[index]?.name === UNCATEGORIZED) return;
  draft.value.categories.splice(index, 1);
}

function resetCategories() {
  draft.value.categories = DEFAULT_CATEGORIES.map((category) => ({ ...category }));
  draft.value.categories.push({ name: UNCATEGORIZED, description: '暂时无法确定归属的收藏' });
}

async function save() {
  if (!draft.value.baseUrl.trim() || !draft.value.model.trim()) {
    pushToast('API 地址和模型名不能为空', 'error');
    return;
  }
  const saved = await saveSettings(draft.value);
  draft.value = clone(saved);
  clearDraft();
  pushToast('设置已保存并生效', 'success');
}

function reset() {
  draft.value = clone(settings.value);
  clearDraft();
}

function clearMeta() {
  clearConfirmOpen.value = true;
}

async function confirmClearMeta() {
  clearConfirmOpen.value = false;
  await clearAllMeta();
  storageBytes.value = await chrome.storage.local.getBytesInUse(null).catch(() => 0);
}

async function undo() {
  undoBusy.value = true;
  try {
    await undoLastApply();
  } catch (error) {
    pushToast(error instanceof Error ? error.message : String(error), 'error');
  } finally {
    undoBusy.value = false;
  }
}

const sections = [
  { id: 'ai', label: '模型服务' },
  { id: 'automation', label: '自动整理' },
  { id: 'categories', label: '分类体系' },
  { id: 'organize', label: '整理方式' },
  { id: 'data', label: '数据与备份' },
  { id: 'about', label: '关于 tidee' },
];
</script>

<template>
  <div :class="props.embedded ? 'settings-embedded' : ''">
    <Transition name="pop">
      <div v-if="dirty" class="settings-dirty-bar">
        <CircleAlert :size="18" class="shrink-0 text-[var(--danger)]" />
        <div class="min-w-0 flex-1">
          <div class="settings-dirty-title">有未保存的修改</div>
          <div class="settings-dirty-hint">已自动保留，刷新不会丢失；保存后才会生效。</div>
        </div>
        <button class="btn btn-soft text-[var(--danger)]" @click="reset">放弃</button>
        <button class="btn btn-primary" @click="save">
          <Save :size="14" />
          保存设置
        </button>
      </div>
    </Transition>

    <div :class="props.embedded ? 'settings-embedded-scroll' : ''">
      <div :class="props.embedded ? 'settings-single' : 'settings-grid'">
        <nav v-if="!props.embedded" class="settings-nav">
          <a v-for="section in sections" :key="section.id" class="nav-item" :href="`#${section.id}`">
            {{ section.label }}
          </a>
        </nav>

        <div>
      <!-- AI service -->
      <section id="ai" class="section">
        <div class="flex items-start gap-3">
          <div class="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-[var(--accent-soft)] text-[var(--accent-strong)]">
            <Sparkles :size="17" />
          </div>
          <div>
            <h2 class="section-title">模型服务</h2>
            <p class="section-desc">
              tidee 不内置服务商、地址、Key 或模型，全部由你填写。只接受 OpenAI 兼容接口。
            </p>
          </div>
        </div>

        <div class="mt-5 grid gap-3 sm:grid-cols-2">
          <div class="sm:col-span-2">
            <label class="label">API 地址</label>
            <input
              v-model="draft.baseUrl"
              class="field mono"
              placeholder="https://your-endpoint/v1"
              spellcheck="false"
            />
            <p class="hint mt-1.5">
              填你的服务商给的 Base URL。填到 <span class="mono">/v1</span> 为止即可，tidee 会自动补
              <span class="mono">/chat/completions</span>。
            </p>
          </div>

          <div>
            <label class="label">API Key</label>
            <div class="relative">
              <input
                v-model="draft.apiKey"
                class="field pr-10"
                :type="showKey ? 'text' : 'password'"
                placeholder="sk-..."
                autocomplete="off"
                spellcheck="false"
              />
              <button
                class="absolute right-1 top-1 grid h-8 w-8 place-items-center rounded-lg text-[var(--muted-2)] hover:bg-[var(--hover)]"
                type="button"
                :title="showKey ? '隐藏' : '显示'"
                @click="showKey = !showKey"
              >
                <EyeOff v-if="showKey" :size="14" />
                <Eye v-else :size="14" />
              </button>
            </div>
          </div>

          <div>
            <label class="label">模型</label>
            <input v-model="draft.model" class="field mono" placeholder="模型 ID" spellcheck="false" />
          </div>
        </div>

        <div class="mt-3 flex flex-wrap items-center gap-3">
          <button class="btn btn-soft btn-sm" :disabled="testing" @click="test">
            <Loader2 v-if="testing" :size="13" class="spin" />
            <KeyRound v-else :size="13" />
            测试连接
          </button>
          <span
            v-if="testMessage"
            class="flex items-center gap-1.5 text-[11px]"
            :class="testMessage.ok ? 'text-[var(--accent-strong)]' : 'text-[var(--danger)]'"
          >
            <Check v-if="testMessage.ok" :size="12" />
            <CircleAlert v-else :size="12" />
            {{ testMessage.text }}
          </span>
        </div>

        <details class="advanced-details mt-5 rounded-lg bg-[var(--surface-2)] px-4 py-3">
          <summary class="advanced-summary cursor-pointer text-[12px] font-semibold text-[var(--muted)]">
            高级参数
          </summary>
          <div class="mt-4 grid gap-3 sm:grid-cols-3">
            <div>
              <label class="label">温度</label>
              <input v-model.number="draft.temperature" type="number" min="0" max="1.5" step="0.1" class="field" />
            </div>
            <div>
              <label class="label">每批条数</label>
              <input v-model.number="draft.batchSize" type="number" min="1" max="50" step="1" class="field" />
            </div>
            <div>
              <label class="label">并发请求</label>
              <input v-model.number="draft.concurrency" type="number" min="1" max="4" step="1" class="field" />
            </div>
          </div>
          <UiSwitch
            v-model="draft.jsonMode"
            class="mt-3"
            label="优先使用 JSON 模式"
            hint="不支持时自动降级，不影响使用。"
          />
          <p class="hint mt-2">
            每批 40 条、2 路并发是默认值：125 条约 4 次请求。调到 50 可减少到 3 次，但单次更慢、失败影响更多条目；调回 20 则请求更多但更快。
          </p>
        </details>
      </section>

      <!-- Automation -->
      <section id="automation" class="section">
        <h2 class="section-title">自动整理</h2>
        <p class="section-desc">
          新增收藏后自动读一遍；浏览器关闭时由定时任务补上。只处理还没有描述的收藏。
        </p>

        <UiSwitch
          v-model="draft.autoAnalyze"
          class="mt-4"
          label="自动整理新增收藏"
          hint="新增书签约 1 分钟后处理；需要已经填写模型并授权接口域名。"
        />

        <div v-if="draft.autoAnalyze" class="mt-3 max-w-xs">
          <label class="label">后台检查频率</label>
          <UiSelect v-model="autoInterval" :options="intervalOptions" />
          <p class="hint mt-1.5">定时任务不会覆盖手动修改过的条目。</p>
        </div>
      </section>

      <!-- Categories -->
      <section id="categories" class="section">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 class="section-title">分类体系</h2>
            <p class="section-desc">
              模型只能从这里选择一级分类。分类越贴合你的收藏，结果越稳定。
            </p>
          </div>
          <div class="flex gap-2">
            <button class="btn btn-soft btn-sm" :disabled="suggesting" @click="suggest">
              <Loader2 v-if="suggesting" :size="13" class="spin" />
              <Wand2 v-else :size="13" />
              生成分类建议
            </button>
            <button class="btn btn-ghost btn-sm" @click="resetCategories">
              <RotateCcw :size="13" />
              默认
            </button>
          </div>
        </div>

        <div class="mt-4 space-y-2">
          <div
            v-for="(category, index) in draft.categories"
            :key="`${category.name}-${index}`"
            class="flex items-start gap-2 rounded-lg bg-[var(--surface-2)] p-2.5"
            :style="categoryStyle(category.name)"
          >
            <span class="cat-dot mt-3" />
            <div class="grid min-w-0 flex-1 gap-2 sm:grid-cols-[minmax(0,180px)_minmax(0,1fr)]">
              <input
                v-model="category.name"
                class="field h-9 text-[12.5px] font-semibold"
                maxlength="16"
                placeholder="分类名"
              />
              <input
                v-model="category.description"
                class="field h-9 text-[12px]"
                maxlength="40"
                placeholder="这个分类收纳什么（可选）"
              />
            </div>
            <button
              class="btn btn-ghost btn-icon btn-sm mt-1"
              :disabled="category.name === UNCATEGORIZED"
              :title="category.name === UNCATEGORIZED ? '系统保留分类' : '删除'"
              @click="removeCategory(index)"
            >
              <Trash2 :size="13" />
            </button>
          </div>
        </div>

        <button class="btn btn-ghost btn-sm mt-2" @click="addCategory">
          <Plus :size="13" />
          添加分类
        </button>
      </section>

      <!-- Organize -->
      <section id="organize" class="section">
        <h2 class="section-title">整理方式</h2>
        <p class="section-desc">决定写回 Edge 时，tidee 文件夹放在哪里。</p>

        <div class="mt-4 grid gap-2.5 sm:grid-cols-2">
          <button
            class="rounded-[10px] p-3.5 text-left transition-base"
            :class="
              draft.destination === 'other'
                ? 'option-selected bg-[var(--accent-soft)]'
                : 'bg-[var(--surface-2)] hover:bg-[var(--surface-3)]'
            "
            @click="draft.destination = 'other'"
          >
            <div class="text-[12.5px] font-semibold">其他收藏夹</div>
            <p class="mt-1 text-[11px] leading-relaxed text-[var(--muted)]">
              不占收藏夹栏，适合作为归档区。
            </p>
          </button>
          <button
            class="rounded-[10px] p-3.5 text-left transition-base"
            :class="
              draft.destination === 'bar'
                ? 'option-selected bg-[var(--accent-soft)]'
                : 'bg-[var(--surface-2)] hover:bg-[var(--surface-3)]'
            "
            @click="draft.destination = 'bar'"
          >
            <div class="text-[12.5px] font-semibold">收藏夹栏</div>
            <p class="mt-1 text-[11px] leading-relaxed text-[var(--muted)]">
              一眼可见，但会在栏上多一个文件夹。
            </p>
          </button>
        </div>

        <div class="mt-3 max-w-sm">
          <label class="label">根文件夹名</label>
          <input v-model="draft.rootFolderName" class="field" maxlength="40" />
        </div>

        <UiSwitch
          v-model="draft.useSubcategories"
          class="mt-4"
          label="在 Edge 里也创建二级分类文件夹"
          hint="默认关闭。开启后会出现几十个细分文件夹，适合收藏量很大、愿意维护的人。"
        />
      </section>

      <!-- Data -->
      <section id="data" class="section">
        <h2 class="section-title">数据与备份</h2>
        <p class="section-desc">
          收藏结构靠 Edge 账号同步；描述和标签只存在这台电脑的扩展里。
        </p>

        <div class="mt-4 grid gap-2 sm:grid-cols-2">
          <button class="btn btn-soft justify-start" @click="exportFavorites">
            <Download :size="14" />
            导出收藏夹 HTML
          </button>
          <button class="btn btn-soft justify-start" @click="exportMeta">
            <Database :size="14" />
            导出描述 JSON
          </button>
        </div>

        <div class="mt-4 flex items-center gap-2 rounded-[10px] bg-[var(--surface-2)] px-3.5 py-3 text-[11px] text-[var(--muted)]">
          <Database :size="13" class="shrink-0" />
          已用存储 {{ (storageBytes / 1024).toFixed(1) }} KB · {{ bookmarks.length }} 条收藏
        </div>

        <div v-if="applied" class="mt-4 flex flex-wrap items-center gap-2 rounded-[10px] bg-[var(--surface-2)] px-3.5 py-3">
          <FolderTree :size="14" class="shrink-0 text-[var(--muted)]" />
          <div class="min-w-0 flex-1 text-[11px] leading-relaxed text-[var(--muted)]">
            上次整理：{{ applied.moved }} 条 →
            <span class="mono">{{ applied.rootName }}</span>
            （{{ new Date(applied.at).toLocaleString('zh-CN') }}）
          </div>
          <button class="btn btn-soft btn-sm" :disabled="undoBusy" @click="undo">
            <Loader2 v-if="undoBusy" :size="13" class="spin" />
            <RotateCcw v-else :size="13" />
            撤销整理
          </button>
        </div>

        <div class="mt-4 rounded-[10px] bg-[var(--danger-soft)] p-3.5">
          <div class="flex items-start gap-2.5">
            <Trash2 :size="14" class="mt-0.5 shrink-0 text-[var(--danger)]" />
            <div class="min-w-0 flex-1">
              <p class="text-[11.5px] font-semibold text-[var(--danger)]">清除描述</p>
              <p class="mt-1 text-[10.5px] leading-relaxed text-[var(--danger)] opacity-80">
                删除所有描述、标签和分类，不影响 Edge 收藏夹。
              </p>
            </div>
            <button class="btn btn-danger btn-sm" @click="clearMeta">清除</button>
          </div>
        </div>
      </section>

      <!-- About -->
      <section id="about" class="section">
        <h2 class="section-title">关于 tidee</h2>
        <p class="section-desc">一个只做收藏整理的本地扩展。</p>

        <div class="mt-4 space-y-3 text-[12px] leading-relaxed text-[var(--muted)]">
          <div class="flex items-start gap-2.5">
            <ShieldCheck :size="14" class="mt-0.5 shrink-0 text-[var(--accent)]" />
            <p>
              不申请浏览记录、标签页或网页内容权限。发往模型的只有标题、网址和原文件夹名。
              不截图、不抓正文、不上传收藏夹。
            </p>
          </div>
          <div class="flex items-start gap-2.5">
            <FolderTree :size="14" class="mt-0.5 shrink-0 text-[var(--accent)]" />
            <p>
              写回时只移动书签、创建文件夹，不删除、不改标题和网址。执行前自动下载备份，
              并保留一次撤销记录。
            </p>
          </div>
          <div class="flex items-start gap-2.5">
            <Database :size="14" class="mt-0.5 shrink-0 text-[var(--accent)]" />
            <p>
              分类结构会通过 Edge 自带的收藏同步出现在其他设备；描述只在本机扩展里。
            </p>
          </div>
        </div>

        <div class="mt-4 flex items-center gap-2 text-[10.5px] text-[var(--muted-2)]">
          <span class="mono">tidee v{{ version }}</span>
          <span class="opacity-40">·</span>
          <span>Manifest V3</span>
          <span class="opacity-40">·</span>
          <span>Local-first</span>
        </div>
      </section>
        </div>
      </div>
    </div>
  </div>

  <ConfirmDialog
    :open="clearConfirmOpen"
    title="清除所有描述？"
    message="会删除所有描述、标签和分类，不影响 Edge 收藏夹。"
    confirm-label="清除"
    danger
    @confirm="confirmClearMeta"
    @cancel="clearConfirmOpen = false"
  />

</template>
