<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import {
  ArrowLeft,
  FolderTree,
  Inbox,
  Info,
  LayoutGrid,
  List,
  Menu,
  Search,
  Settings,
  Sparkles,
  X,
} from '@lucide/vue';
import AppSidebar from '../../components/AppSidebar.vue';
import AnalysisModal from '../../components/AnalysisModal.vue';
import ApplyModal from '../../components/ApplyModal.vue';
import BookmarkCard from '../../components/BookmarkCard.vue';
import BrandMark from '../../components/BrandMark.vue';
import CardActions from '../../components/CardActions.vue';
import ConfirmDialog from '../../components/ConfirmDialog.vue';
import DetailDrawer from '../../components/DetailDrawer.vue';
import RenameDialog from '../../components/RenameDialog.vue';
import SettingsPanel from '../../components/SettingsPanel.vue';
import ToastStack from '../../components/ToastStack.vue';
import { useTidee } from '../../composables/useTidee';
import { categoryStyle } from '../../composables/useBookmarkView';
import type { BookmarkItem, BookmarkMeta, Destination } from '../../lib/types';
import { needsReview } from '../../lib/review';

const tidee = useTidee();
const {
  settings,
  bookmarks,
  applied,
  ready,
  analyzing,
  progress,
  toasts,
  configured,
  analyzedCount,
  pendingCount,
  reviewCount,
  categoryStats,
  plan,
  init,
  entryFor,
  updateEntry,
  deleteEntry,
  analyzeOne,
  startAnalysis,
  cancelAnalysis,
  applyNow,
  undoLastApply,
  updateSettings,
  pushToast,
  dismissToast,
} = tidee;

const search = ref('');
const filter = ref('all');
const view = ref<'library' | 'settings'>('library');
const layout = ref<'grid' | 'list'>('grid');
const selected = ref<BookmarkItem | null>(null);
const showAnalysis = ref(false);
const showApply = ref(false);
const applying = ref(false);
const sidebarOpen = ref(false);
const searchRef = ref<HTMLInputElement | null>(null);
const oneAnalyzing = ref(false);
const showConfigNotice = ref(true);
const actionBookmark = ref<BookmarkItem | null>(null);
const actionAnchor = ref({ x: 0, y: 0 });
const renameTarget = ref<BookmarkItem | null>(null);
const renameOpen = ref(false);
const deleteTarget = ref<BookmarkItem | null>(null);
const deleteOpen = ref(false);

const planCount = computed(() => plan.value.reduce((sum, category) => sum + category.count, 0));
const activeCategory = computed(() =>
  filter.value.startsWith('cat:') ? filter.value.slice(4) : '',
);

const title = computed(() => {
  if (filter.value === 'pending') return '未读';
  if (filter.value === 'review') return '待确认';
  if (filter.value.startsWith('cat:')) return filter.value.slice(4);
  return '全部收藏';
});

const subtitle = computed(() => {
  if (filter.value === 'pending') return `还有 ${pendingCount.value} 条没有描述，读一遍后会出现在这里。`;
  if (filter.value === 'review') return `${reviewCount.value} 条的分类或描述还不够确定，值得看一眼。`;
  if (filter.value.startsWith('cat:')) {
    const category = settings.value.categories.find((item) => item.name === activeCategory.value);
    return category?.description || `${categoryStats.value.get(activeCategory.value) ?? 0} 条收藏`;
  }
  return `共 ${bookmarks.value.length} 条，${analyzedCount.value} 条已经有描述。`;
});

const filtered = computed(() => {
  const query = search.value.trim().toLowerCase();
  let pool = bookmarks.value;

  if (filter.value === 'pending') {
    pool = pool.filter((bookmark) => !entryFor(bookmark));
  } else if (filter.value === 'review') {
    pool = pool.filter((bookmark) => {
      const entry = entryFor(bookmark);
      if (entry?.editedByUser) return false;
      return (
        needsReview(entry) ||
        (entry ? !settings.value.categories.some((category) => category.name === entry.category) : false)
      );
    });
  } else if (filter.value.startsWith('cat:')) {
    const category = filter.value.slice(4);
    pool = pool.filter((bookmark) => entryFor(bookmark)?.category === category);
  }

  if (!query) return pool;

  return pool.filter((bookmark) => {
    const entry = entryFor(bookmark);
    const haystack = [
      bookmark.title,
      bookmark.url,
      bookmark.folderPath,
      entry?.description,
      entry?.category,
      entry?.subcategory,
      entry?.tags.join(' '),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(query);
  });
});

interface Group {
  key: string;
  name: string;
  items: BookmarkItem[];
}

const groups = computed<Group[]>(() => {
  if (filter.value === 'pending') {
    return [{ key: 'pending', name: '未读', items: filtered.value }];
  }
  if (filter.value === 'review') {
    return [{ key: 'review', name: '待确认', items: filtered.value }];
  }
  if (filter.value.startsWith('cat:')) {
    return [
      {
        key: filter.value,
        name: activeCategory.value,
        items: filtered.value,
      },
    ];
  }

  const map = new Map<string, BookmarkItem[]>();
  for (const bookmark of filtered.value) {
    const entry = entryFor(bookmark);
    const key = entry?.category || '未读';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(bookmark);
  }

  const order = new Map(settings.value.categories.map((category, index) => [category.name, index]));
  const rank = (name: string): number => {
    if (name === '未读') return 10_000;
    return order.get(name) ?? 5_000;
  };
  const names = [...map.keys()].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));

  return names.map((name) => ({
    key: name,
    name,
    items: map.get(name)!,
  }));
});

const usedCategoryCount = computed(
  () => [...categoryStats.value.keys()].filter((name) => name !== '未分类').length,
);

const categoryChips = computed(() =>
  settings.value.categories
    .map((category) => ({
      name: category.name,
      count: categoryStats.value.get(category.name) ?? 0,
    }))
    .filter((category) => category.count > 0 || category.name === activeCategory.value),
);

const selectedMeta = computed(() =>
  selected.value ? entryFor(selected.value) : undefined,
);

watch(layout, (value) => {
  try {
    localStorage.setItem('tidee.layout', value);
  } catch {
    // Ignore.
  }
});

watch(selected, (value) => {
  if (!value) oneAnalyzing.value = false;
});

function applyHash() {
  view.value = location.hash === '#settings' ? 'settings' : 'library';
}

onMounted(async () => {
  const savedLayout = localStorage.getItem('tidee.layout');
  if (savedLayout === 'list' || savedLayout === 'grid') layout.value = savedLayout;
  applyHash();
  await init();
  window.addEventListener('keydown', onKeydown);
  window.addEventListener('hashchange', applyHash);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown);
  window.removeEventListener('hashchange', applyHash);
});

function onKeydown(event: KeyboardEvent) {
  const target = event.target as HTMLElement | null;
  const typing = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable;
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    searchRef.value?.focus();
    return;
  }
  if (event.key === '/' && !typing) {
    event.preventDefault();
    searchRef.value?.focus();
  }
}

function openBookmark(bookmark: BookmarkItem) {
  void chrome.tabs.create({ url: bookmark.url });
}

function openCardMenu(bookmark: BookmarkItem, event: MouseEvent) {
  actionBookmark.value = bookmark;
  actionAnchor.value = { x: event.clientX, y: event.clientY };
}

function closeCardMenu() {
  actionBookmark.value = null;
}

function editFromMenu() {
  if (actionBookmark.value) selected.value = actionBookmark.value;
}

function startRename() {
  if (!actionBookmark.value) return;
  renameTarget.value = actionBookmark.value;
  renameOpen.value = true;
}

function startDelete() {
  if (!actionBookmark.value) return;
  deleteTarget.value = actionBookmark.value;
  deleteOpen.value = true;
}

async function copyFromMenu() {
  const url = actionBookmark.value?.url;
  if (!url) return;
  try {
    await navigator.clipboard.writeText(url);
    pushToast('已复制链接', 'success');
  } catch {
    pushToast('复制失败，请手动复制', 'error');
  }
}

async function confirmRename(title: string) {
  const target = renameTarget.value;
  if (!target) return;
  try {
    await chrome.bookmarks.update(target.id, { title });
    renameOpen.value = false;
    renameTarget.value = null;
    pushToast('已重命名', 'success');
  } catch (error) {
    pushToast(error instanceof Error ? error.message : String(error), 'error');
  }
}

async function confirmDelete() {
  const target = deleteTarget.value;
  if (!target) return;
  try {
    await chrome.bookmarks.remove(target.id);
    if (selected.value?.id === target.id) selected.value = null;
    deleteOpen.value = false;
    deleteTarget.value = null;
    pushToast('已删除收藏', 'success');
  } catch (error) {
    pushToast(error instanceof Error ? error.message : String(error), 'error');
  }
}

const deleteMessage = computed(() =>
  deleteTarget.value
    ? `将从 Edge 收藏夹删除「${deleteTarget.value.title.slice(0, 60)}」，不影响其他收藏。`
    : '',
);

function openSettings() {
  showAnalysis.value = false;
  showApply.value = false;
  selected.value = null;
  view.value = 'settings';
  if (location.hash !== '#settings') location.hash = 'settings';
}

function closeSettings() {
  view.value = 'library';
  if (location.hash) {
    history.replaceState(null, '', `${location.pathname}${location.search}`);
  }
}

function selectFilter(value: string) {
  filter.value = value;
  search.value = '';
  if (view.value !== 'library') closeSettings();
}

async function saveEntry(patch: Partial<BookmarkMeta>) {
  if (!selected.value) return;
  await updateEntry(selected.value, patch);
  pushToast('已保存修改', 'success');
}

async function removeEntry() {
  if (!selected.value) return;
  await deleteEntry(selected.value);
  pushToast('已删除这条描述', 'info');
  selected.value = null;
}

async function analyzeSelected() {
  if (!selected.value || oneAnalyzing.value) return;
  oneAnalyzing.value = true;
  try {
    await analyzeOne(selected.value);
    pushToast('这一条读完了', 'success');
  } catch (error) {
    pushToast(error instanceof Error ? error.message : String(error), 'error');
  } finally {
    oneAnalyzing.value = false;
  }
}

async function onStartAnalysis(scope: 'pending' | 'review' | 'all') {
  try {
    await startAnalysis(scope);
  } catch (error) {
    pushToast(error instanceof Error ? error.message : String(error), 'error');
  }
}

async function onApply(value: {
  destination: Destination;
  rootFolderName: string;
  useSubcategories: boolean;
}) {
  applying.value = true;
  try {
    await updateSettings(value);
    await applyNow();
    showApply.value = false;
    pushToast('已写回收藏夹，可用设置页的“撤销整理”恢复', 'success');
  } catch (error) {
    pushToast(error instanceof Error ? error.message : String(error), 'error');
  } finally {
    applying.value = false;
  }
}

async function onUndo() {
  applying.value = true;
  try {
    await undoLastApply();
    showApply.value = false;
  } catch (error) {
    pushToast(error instanceof Error ? error.message : String(error), 'error');
  } finally {
    applying.value = false;
  }
}

const counts = computed(() => Object.fromEntries(categoryStats.value) as Record<string, number>);
</script>

<template>
  <div class="app-shell">
    <AppSidebar
      :categories="settings.categories"
      :counts="counts"
      :total="bookmarks.length"
      :pending="pendingCount"
      :review="reviewCount"
      :active="view === 'settings' ? 'settings' : filter"
      :open="sidebarOpen"
      @select="selectFilter"
      @close="sidebarOpen = false"
      @open-settings="openSettings"
    />

    <div v-if="sidebarOpen" class="sidebar-scrim" @click="sidebarOpen = false" />

    <main class="main">
      <header v-if="view === 'library'" class="topbar">
        <button class="btn btn-ghost btn-icon sidebar-toggle" @click="sidebarOpen = true">
          <Menu :size="17" />
        </button>

        <div class="search-box">
          <Search :size="15" />
          <input
            ref="searchRef"
            v-model="search"
            class="search-input"
            type="search"
            placeholder="搜索标题、描述、标签或域名"
            spellcheck="false"
          />
          <span class="kbd absolute right-2 top-1/2 hidden -translate-y-1/2 sm:inline-flex">/</span>
        </div>

        <div class="ml-auto flex items-center gap-2">
          <div class="hidden items-center rounded-lg bg-[var(--surface-2)] p-0.5 sm:flex">
            <button
              class="grid h-7 w-7 place-items-center rounded-md transition-base"
              :class="layout === 'grid' ? 'bg-[var(--accent)] text-[var(--accent-ink)]' : 'text-[var(--muted-2)]'"
              title="卡片视图"
              @click="layout = 'grid'"
            >
              <LayoutGrid :size="14" />
            </button>
            <button
              class="grid h-7 w-7 place-items-center rounded-md transition-base"
              :class="layout === 'list' ? 'bg-[var(--accent)] text-[var(--accent-ink)]' : 'text-[var(--muted-2)]'"
              title="列表视图"
              @click="layout = 'list'"
            >
              <List :size="14" />
            </button>
          </div>

          <button class="btn btn-soft btn-sm sm:h-9" :disabled="planCount === 0" @click="showApply = true">
            <FolderTree :size="14" />
            <span class="hidden sm:inline">写回</span>
            <span v-if="planCount" class="text-[10px] text-[var(--muted-2)]">{{ planCount }}</span>
          </button>

          <button class="btn btn-primary btn-sm sm:h-9" @click="showAnalysis = true">
            <Sparkles :size="14" />
            <span class="hidden sm:inline">读一遍</span>
          </button>

          <button class="btn btn-ghost btn-icon btn-sm sm:hidden" title="设置" @click="openSettings">
            <Settings :size="15" />
          </button>
        </div>
      </header>

      <header v-else class="topbar">
        <button class="btn btn-ghost btn-icon sidebar-toggle" @click="sidebarOpen = true">
          <Menu :size="17" />
        </button>
        <button class="btn btn-ghost btn-sm" @click="closeSettings">
          <ArrowLeft :size="14" />
          返回工作台
        </button>
        <span class="ml-1 text-[13px] font-semibold">设置</span>
        <span class="ml-auto text-[11px] text-[var(--muted-2)]">只保存在本机</span>
      </header>

      <div v-if="view === 'library'" class="content">
        <div class="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div class="eyebrow mono">Collection / {{ bookmarks.length }}</div>
            <h1 class="page-title mt-1.5">{{ title }}</h1>
            <p class="page-sub">{{ subtitle }}</p>
          </div>
          <div v-if="search" class="text-[11px] text-[var(--muted-2)]">
            “{{ search }}” · {{ filtered.length }} 个结果
          </div>
        </div>

        <div
          v-if="ready && !configured && showConfigNotice"
          class="mt-4 flex items-center gap-2.5 rounded-[10px] bg-[var(--surface-2)] px-3.5 py-2.5"
        >
          <Info :size="14" class="shrink-0 text-[var(--muted)]" />
          <p class="min-w-0 flex-1 text-[11.5px] leading-relaxed text-[var(--muted)]">
            还没有配置模型。收藏已经读入，配置后就能生成分类和描述。
          </p>
          <button class="btn btn-soft btn-sm" @click="openSettings">去设置</button>
          <button class="btn btn-ghost btn-icon btn-sm" title="暂时隐藏" @click="showConfigNotice = false">
            <X :size="14" />
          </button>
        </div>

        <div class="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <div class="stat">
            <div class="stat-value">{{ bookmarks.length }}</div>
            <div class="stat-label">总收藏</div>
          </div>
          <div class="stat">
            <div class="stat-value text-[var(--accent-strong)]">{{ analyzedCount }}</div>
            <div class="stat-label">有描述</div>
          </div>
          <div class="stat">
            <div class="stat-value">{{ usedCategoryCount }}</div>
            <div class="stat-label">已用分类</div>
          </div>
          <div class="stat">
            <div class="stat-value" :class="reviewCount ? 'text-[var(--warn)]' : ''">{{ reviewCount }}</div>
            <div class="stat-label">待确认</div>
          </div>
        </div>

        <div class="mt-5 flex gap-1.5 overflow-x-auto pb-1">
          <button class="chip" :data-active="filter === 'all'" @click="selectFilter('all')">全部</button>
          <button class="chip" :data-active="filter === 'pending'" @click="selectFilter('pending')">
            未读 {{ pendingCount }}
          </button>
          <button class="chip" :data-active="filter === 'review'" @click="selectFilter('review')">
            待确认 {{ reviewCount }}
          </button>
          <span class="mx-1 w-px shrink-0 bg-[var(--line)]" />
          <button
            v-for="category in categoryChips"
            :key="category.name"
            class="chip"
            :data-active="filter === `cat:${category.name}`"
            @click="selectFilter(`cat:${category.name}`)"
          >
            <span class="cat-dot" :style="categoryStyle(category.name)" />
            {{ category.name }} {{ category.count }}
          </button>
        </div>

        <div v-if="!ready" class="mt-6 grid gap-3 sm:grid-cols-3">
          <div v-for="index in 6" :key="index" class="skeleton h-36" />
        </div>

        <template v-else-if="filtered.length > 0">
          <section v-for="group in groups" :key="group.key">
            <div class="cat-header">
              <span
                v-if="group.name !== '未读'"
                class="cat-dot"
                :style="categoryStyle(group.name)"
              />
              <Inbox v-else :size="13" class="text-[var(--muted-2)]" />
              <span class="cat-title">{{ group.name }}</span>
              <span class="cat-count">{{ group.items.length }}</span>
              <span class="ml-1 h-px flex-1 bg-[var(--line)]" />
            </div>

            <div v-if="layout === 'grid'" class="bm-grid">
              <BookmarkCard
                v-for="bookmark in group.items"
                :key="bookmark.id"
                :bookmark="bookmark"
                :meta="entryFor(bookmark)"
                layout="grid"
                @open="openBookmark"
                @edit="selected = $event"
                @menu="openCardMenu"
              />
            </div>
            <div v-else class="space-y-1.5">
              <BookmarkCard
                v-for="bookmark in group.items"
                :key="bookmark.id"
                :bookmark="bookmark"
                :meta="entryFor(bookmark)"
                layout="list"
                @open="openBookmark"
                @edit="selected = $event"
                @menu="openCardMenu"
              />
            </div>
          </section>
        </template>

        <div v-else-if="ready" class="mt-10 flex flex-col items-center justify-center rounded-[10px] bg-[var(--surface-2)] px-6 py-16 text-center">
          <div class="empty-wave"><BrandMark :size="34" /></div>
          <h3 class="mt-4 text-[14px] font-semibold">
            {{ search ? '没有匹配的收藏' : '这里还是空的' }}
          </h3>
          <p class="mt-1.5 max-w-[42ch] text-[12px] leading-relaxed text-[var(--muted)]">
            {{
              search
                ? '换一个关键词，或清空搜索看看全部。'
                : filter === 'pending'
                  ? '所有收藏都已经有描述了。'
                  : '先读一遍收藏，结果会按分类出现在这里。'
            }}
          </p>
          <button v-if="!search && filter !== 'pending'" class="btn btn-soft btn-sm mt-4" @click="showAnalysis = true">
            <Sparkles :size="13" />
            读一遍
          </button>
        </div>

      </div>

      <div v-else class="content">
        <SettingsPanel embedded />
      </div>
    </main>

    <DetailDrawer
      :bookmark="selected"
      :meta="selectedMeta"
      :categories="settings.categories"
      :analyzing="oneAnalyzing || analyzing"
      @close="selected = null"
      @save="saveEntry"
      @analyze="analyzeSelected"
      @remove="removeEntry"
    />

    <AnalysisModal
      :open="showAnalysis"
      :pending="pendingCount"
      :reviewed="reviewCount"
      :analyzed="analyzedCount"
      :batch-size="settings.batchSize"
      :concurrency="settings.concurrency"
      :model="settings.model"
      :configured="configured"
      :analyzing="analyzing"
      :progress="progress"
      @close="showAnalysis = false"
      @start="onStartAnalysis"
      @cancel="cancelAnalysis"
      @open-settings="openSettings"
    />

    <ApplyModal
      :open="showApply"
      :plan="plan"
      :destination="settings.destination"
      :root-folder-name="settings.rootFolderName"
      :use-subcategories="settings.useSubcategories"
      :busy="applying"
      :applied="applied"
      @close="showApply = false"
      @confirm="onApply"
      @undo="onUndo"
    />

    <CardActions
      :bookmark="actionBookmark"
      :x="actionAnchor.x"
      :y="actionAnchor.y"
      @close="closeCardMenu"
      @open="actionBookmark && openBookmark(actionBookmark)"
      @edit="editFromMenu"
      @rename="startRename"
      @copy="copyFromMenu"
      @delete="startDelete"
    />

    <RenameDialog
      :open="renameOpen"
      :current-title="renameTarget?.title ?? ''"
      @confirm="confirmRename"
      @cancel="renameOpen = false"
    />

    <ConfirmDialog
      :open="deleteOpen"
      title="删除这个收藏？"
      :message="deleteMessage"
      confirm-label="删除"
      danger
      @confirm="confirmDelete"
      @cancel="deleteOpen = false"
    />

    <ToastStack :toasts="toasts" @dismiss="dismissToast" />
  </div>
</template>
