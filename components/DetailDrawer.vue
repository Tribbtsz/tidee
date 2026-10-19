<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { ExternalLink, Loader2, Sparkles, Trash2, X } from '@lucide/vue';
import UiSelect from './UiSelect.vue';
import type { BookmarkItem, BookmarkMeta, CategoryDef } from '../lib/types';
import { confidenceLabel, faviconUrl, letterOf, categoryStyle } from '../composables/useBookmarkView';
import { displayUrl, hostOf } from '../lib/url';

const props = defineProps<{
  bookmark: BookmarkItem | null;
  meta: BookmarkMeta | undefined;
  categories: CategoryDef[];
  analyzing: boolean;
}>();

const emit = defineEmits<{
  close: [];
  save: [patch: Partial<BookmarkMeta>];
  analyze: [];
  remove: [];
}>();

const iconFailed = ref(false);
const saving = ref(false);

const form = reactive({
  category: '',
  subcategory: '',
  description: '',
  tags: '',
});

const style = computed(() =>
  props.meta ? categoryStyle(props.meta.category) : undefined,
);
const categoryOptions = computed(() =>
  props.categories.map((category) => ({ value: category.name, label: category.name })),
);

function reset() {
  form.category = props.meta?.category ?? props.categories[0]?.name ?? '未分类';
  form.subcategory = props.meta?.subcategory ?? '';
  form.description = props.meta?.description ?? '';
  form.tags = (props.meta?.tags ?? []).join('，');
  iconFailed.value = false;
}

watch(() => props.bookmark?.id, reset, { immediate: true });
watch(() => props.meta, reset);

function close() {
  emit('close');
}

async function save() {
  saving.value = true;
  try {
    emit('save', {
      category: form.category,
      subcategory: form.subcategory.trim(),
      description: form.description.trim(),
      tags: form.tags
        .split(/[,，]/)
        .map((tag) => tag.replace(/^#/, '').trim())
        .filter(Boolean)
        .slice(0, 4),
    });
    await new Promise((resolve) => setTimeout(resolve, 120));
  } finally {
    saving.value = false;
  }
}

function analyze() {
  emit('analyze');
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && props.bookmark) close();
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown);
  document.body.style.overflow = '';
});

watch(
  () => props.bookmark,
  (value) => {
    document.body.style.overflow = value ? 'hidden' : '';
  },
  { immediate: true },
);

function formatTime(value: number) {
  return new Date(value).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
</script>

<template>
  <Transition name="fade">
    <div v-if="bookmark" class="drawer-scrim" @click="close" />
  </Transition>

  <Transition name="drawer">
    <aside v-if="bookmark" class="drawer" role="dialog" aria-modal="true" :style="style">
      <header class="flex items-start gap-3 p-5">
        <img
          v-if="faviconUrl(bookmark.url) && !iconFailed"
          :src="faviconUrl(bookmark.url, 48)"
          alt=""
          class="mt-0.5 h-8 w-8 rounded-lg object-contain"
          @error="iconFailed = true"
        />
        <div v-else class="favicon-tile h-8 w-8">{{ letterOf(bookmark) }}</div>

        <div class="min-w-0 flex-1">
          <h2 class="text-[15px] font-semibold leading-snug">{{ bookmark.title }}</h2>
          <div class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-[var(--muted-2)]">
            <span>{{ hostOf(bookmark.url) }}</span>
            <span class="opacity-40">·</span>
            <span class="truncate">{{ bookmark.folderPath }}</span>
          </div>
        </div>

        <button class="btn btn-ghost btn-icon btn-sm" title="关闭" @click="close">
          <X :size="15" />
        </button>
      </header>

      <div class="drawer-body">
        <a
          class="mb-5 flex items-center gap-2 rounded-lg bg-[var(--surface-2)] px-3 py-2 text-[11.5px] text-[var(--muted)] transition-base hover:text-[var(--ink)]"
          :href="bookmark.url"
          target="_blank"
          rel="noreferrer"
        >
          <ExternalLink :size="13" class="shrink-0" />
          <span class="truncate">{{ displayUrl(bookmark.url, 90) }}</span>
        </a>

        <template v-if="meta">
          <div class="mb-4 flex items-center justify-between gap-3">
            <span class="chip" :style="style">
              <span class="cat-dot" />
              {{ meta.category }}
            </span>
            <span class="text-[10.5px] text-[var(--muted-2)]">
              把握 {{ confidenceLabel(meta.confidence) }}
            </span>
          </div>

          <div class="space-y-4">
            <div>
              <label class="label">一级分类</label>
              <UiSelect v-model="form.category" :options="categoryOptions" />
            </div>

            <div>
              <label class="label">二级分类</label>
              <input v-model="form.subcategory" class="field" placeholder="例如：组件库、配色、AI 助手" />
            </div>

            <div>
              <div class="mb-1.5 flex items-baseline justify-between">
                <label class="label mb-0">描述</label>
                <span class="text-[10px] text-[var(--muted-2)]">{{ form.description.length }}/90</span>
              </div>
              <textarea
                v-model="form.description"
                class="field"
                maxlength="90"
                placeholder="这个页面是什么、能用来做什么"
              />
            </div>

            <div>
              <label class="label">标签</label>
              <input v-model="form.tags" class="field" placeholder="用逗号分隔，最多 4 个" />
            </div>
          </div>

          <div class="mt-5 rounded-lg bg-[var(--surface-2)] px-3 py-2.5 text-[10.5px] leading-relaxed text-[var(--muted-2)]">
            <div>模型：{{ meta.model || '未知' }}</div>
            <div>生成时间：{{ formatTime(meta.analyzedAt) }}</div>
            <div class="truncate">原文件夹：{{ meta.sourceFolder || '—' }}</div>
            <div v-if="meta.editedByUser" class="mt-1 text-[var(--accent-strong)]">
              已手动修改，重读有问题的条目时会跳过
            </div>
          </div>

          <div class="mt-4 flex items-center gap-4">
            <button
              class="flex items-center gap-1.5 text-[11px] text-[var(--muted-2)] transition-base hover:text-[var(--accent-strong)]"
              :disabled="analyzing"
              @click="emit('analyze')"
            >
              <Loader2 v-if="analyzing" :size="12" class="spin" />
              <Sparkles v-else :size="12" />
              重读这一条
            </button>
            <button
              class="flex items-center gap-1.5 text-[11px] text-[var(--muted-2)] transition-base hover:text-[var(--danger)]"
              @click="emit('remove')"
            >
              <Trash2 :size="12" />
              删除这条描述
            </button>
          </div>
        </template>

        <div v-else class="rounded-[10px] bg-[var(--surface-2)] px-4 py-6 text-center">
          <Sparkles :size="20" class="mx-auto mb-2 text-[var(--accent)]" />
          <p class="text-[12.5px] font-semibold">这条还没有描述</p>
          <p class="mt-1 text-[11.5px] text-[var(--muted)]">单独读这一条，或回到列表批量处理。</p>
          <button class="btn btn-primary btn-sm mt-3" :disabled="analyzing" @click="analyze">
            <Loader2 v-if="analyzing" :size="13" class="spin" />
            <Sparkles v-else :size="13" />
            {{ analyzing ? '读取中…' : '读这一条' }}
          </button>
        </div>
      </div>

      <footer v-if="meta" class="flex items-center justify-end gap-2 bg-[var(--surface-2)] px-5 py-3">
        <button class="btn btn-ghost btn-sm" @click="close">取消</button>
        <button class="btn btn-primary btn-sm" :disabled="saving" @click="save">
          <Loader2 v-if="saving" :size="13" class="spin" />
          保存修改
        </button>
      </footer>
    </aside>
  </Transition>
</template>
