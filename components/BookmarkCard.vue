<script setup lang="ts">
import { computed, ref } from 'vue';
import { MoreHorizontal, Pencil } from '@lucide/vue';
import type { BookmarkItem, BookmarkMeta } from '../lib/types';
import { categoryStyle, faviconUrl, letterOf } from '../composables/useBookmarkView';
import { hostOf } from '../lib/url';
import { needsReview as isReviewNeeded } from '../lib/review';

const props = withDefaults(
  defineProps<{
    bookmark: BookmarkItem;
    meta?: BookmarkMeta;
    layout?: 'grid' | 'list';
  }>(),
  { layout: 'grid', meta: undefined },
);

defineEmits<{
  open: [bookmark: BookmarkItem];
  edit: [bookmark: BookmarkItem];
  menu: [bookmark: BookmarkItem, event: MouseEvent];
}>();

const iconFailed = ref(false);
const iconUrl = computed(() => faviconUrl(props.bookmark.url, 32));
const style = computed(() => (props.meta ? categoryStyle(props.meta.category) : undefined));
const needsReview = computed(() => isReviewNeeded(props.meta));
</script>

<template>
  <article
    v-if="layout === 'grid'"
    class="bm-card group"
    :style="style"
    tabindex="0"
    role="button"
    @click="$emit('open', bookmark)"
    @keydown.enter="$emit('open', bookmark)"
  >
    <div class="flex items-start gap-2.5">
      <img
        v-if="iconUrl && !iconFailed"
        :src="iconUrl"
        alt=""
        class="favicon mt-0.5"
        loading="lazy"
        @error="iconFailed = true"
      />
      <div v-else class="favicon-tile">{{ letterOf(bookmark) }}</div>

      <div class="min-w-0 flex-1">
        <h3 class="bm-title">{{ bookmark.title }}</h3>
        <div class="mt-1 truncate text-[10.5px] text-[var(--muted-2)]">
          {{ hostOf(bookmark.url) }}
        </div>
      </div>

      <span
        v-if="needsReview"
        class="shrink-0 rounded-full bg-[var(--warn-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--warn)]"
      >
        待确认
      </span>
    </div>

    <p class="bm-desc" :data-empty="!meta?.description">
      {{ meta?.description || '还没有描述' }}
    </p>

    <div class="mt-auto flex flex-wrap items-center gap-1.5">
      <span v-if="meta" class="tag" :style="style">{{ meta.category }}</span>
      <span v-for="tag in meta?.tags.slice(0, 2)" :key="tag" class="tag">{{ tag }}</span>
      <div class="ml-auto flex items-center gap-0.5">
        <button
          class="grid h-6 w-6 place-items-center rounded-md text-[var(--muted-2)] opacity-60 transition-base hover:bg-[var(--hover)] hover:text-[var(--ink)] hover:opacity-100 focus:opacity-100"
          title="编辑描述"
          aria-label="编辑描述"
          @click.stop="$emit('edit', bookmark)"
        >
          <Pencil :size="13" />
        </button>
        <button
          class="grid h-6 w-6 place-items-center rounded-md text-[var(--muted-2)] opacity-60 transition-base hover:bg-[var(--hover)] hover:text-[var(--ink)] hover:opacity-100 focus:opacity-100"
          title="更多操作"
          aria-label="更多操作"
          data-card-menu
          @click.stop="$emit('menu', bookmark, $event)"
        >
          <MoreHorizontal :size="14" />
        </button>
      </div>
    </div>
  </article>

  <article
    v-else
    class="bm-row group flex cursor-pointer items-center gap-3 rounded-[10px] bg-[var(--surface)] p-3.5 hover:bg-[var(--surface-2)]"
    :style="style"
    tabindex="0"
    role="button"
    @click="$emit('open', bookmark)"
    @keydown.enter="$emit('open', bookmark)"
  >
    <img
      v-if="iconUrl && !iconFailed"
      :src="iconUrl"
      alt=""
      class="favicon"
      loading="lazy"
      @error="iconFailed = true"
    />
    <div v-else class="favicon-tile h-7 w-7">{{ letterOf(bookmark) }}</div>

    <div class="min-w-0 flex-1">
      <div class="flex items-baseline gap-2">
        <h3 class="truncate text-[13px] font-semibold">{{ bookmark.title }}</h3>
        <span class="hidden shrink-0 text-[10px] text-[var(--muted-2)] sm:inline">
          {{ hostOf(bookmark.url) }}
        </span>
        <span v-if="needsReview" class="shrink-0 text-[10px] font-semibold text-[var(--warn)]">待确认</span>
      </div>
      <p class="line-clamp-1 text-[11.5px] text-[var(--muted)]">
        {{ meta?.description || '还没有描述' }}
      </p>
    </div>

    <span v-if="meta" class="chip hidden shrink-0 md:inline-flex">
      <span class="cat-dot" />
      {{ meta.category }}
    </span>

    <span class="hidden shrink-0 text-[10.5px] text-[var(--muted-2)] lg:block">
      {{ meta?.tags.slice(0, 2).join(' · ') }}
    </span>

    <div class="flex shrink-0 items-center gap-0.5">
      <button
        class="grid h-7 w-7 place-items-center rounded-md text-[var(--muted-2)] transition-base hover:bg-[var(--hover)] hover:text-[var(--ink)]"
        title="编辑描述"
        aria-label="编辑描述"
        @click.stop="$emit('edit', bookmark)"
      >
        <Pencil :size="14" />
      </button>
      <button
        class="grid h-7 w-7 place-items-center rounded-md text-[var(--muted-2)] transition-base hover:bg-[var(--hover)] hover:text-[var(--ink)]"
        title="更多操作"
        aria-label="更多操作"
        data-card-menu
        @click.stop="$emit('menu', bookmark, $event)"
      >
        <MoreHorizontal :size="15" />
      </button>
    </div>
  </article>
</template>
