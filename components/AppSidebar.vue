<script setup lang="ts">
import { computed } from 'vue';
import {
  CircleAlert,
  FolderOpen,
  Inbox,
  Monitor,
  Moon,
  Settings,
  Sun,
} from '@lucide/vue';
import BrandMark from './BrandMark.vue';
import { categoryStyle } from '../composables/useBookmarkView';
import { useTheme } from '../composables/useTheme';
import type { CategoryDef } from '../lib/types';

const props = defineProps<{
  categories: CategoryDef[];
  counts: Record<string, number>;
  total: number;
  pending: number;
  review: number;
  active: string;
  open: boolean;
}>();

const emit = defineEmits<{
  select: [value: string];
  close: [];
  openSettings: [];
}>();

const theme = useTheme();
const version = chrome.runtime.getManifest().version;
const themeIcon = computed(() => {
  if (theme.mode.value === 'light') return Sun;
  if (theme.mode.value === 'dark') return Moon;
  return Monitor;
});
const themeLabel = computed(() => {
  if (theme.mode.value === 'light') return '浅色';
  if (theme.mode.value === 'dark') return '深色';
  return '跟随系统';
});

function choose(value: string) {
  emit('select', value);
  emit('close');
}
</script>

<template>
  <aside class="sidebar" :data-open="open">
    <div class="brand">
      <div class="brand-mark"><BrandMark :size="20" /></div>
      <div class="min-w-0">
        <div class="brand-name">tidee</div>
        <div class="brand-sub">favorites, tidied</div>
      </div>
      <span class="ml-auto rounded-full bg-[var(--surface-2)] px-1.5 py-0.5 text-[9px] font-semibold text-[var(--muted-2)]">
        v{{ version }}
      </span>
    </div>

    <nav class="nav-group">
      <button class="nav-item" :data-active="active === 'all'" @click="choose('all')">
        <FolderOpen :size="15" />
        <span>全部收藏</span>
        <span class="nav-count">{{ total }}</span>
      </button>
      <button class="nav-item" :data-active="active === 'pending'" @click="choose('pending')">
        <Inbox :size="15" />
        <span>未读</span>
        <span class="nav-count">{{ pending }}</span>
      </button>
      <button class="nav-item" :data-active="active === 'review'" @click="choose('review')">
        <CircleAlert :size="15" />
        <span>待确认</span>
        <span class="nav-count">{{ review }}</span>
      </button>
    </nav>

    <nav class="nav-group">
      <div class="nav-label">分类</div>
      <button
        v-for="category in props.categories"
        :key="category.name"
        class="nav-item"
        :data-active="active === `cat:${category.name}`"
        :title="category.description"
        @click="choose(`cat:${category.name}`)"
      >
        <span class="cat-dot" :style="categoryStyle(category.name)" />
        <span class="min-w-0 flex-1 truncate">{{ category.name }}</span>
        <span class="nav-count">{{ counts[category.name] ?? 0 }}</span>
      </button>
    </nav>

    <div class="sidebar-footer">
      <button class="nav-item" @click="theme.cycle()">
        <component :is="themeIcon" :size="15" />
        <span>外观</span>
        <span class="ml-auto text-[10px] text-[var(--muted-2)]">{{ themeLabel }}</span>
      </button>
      <button
        class="nav-item"
        :data-active="active === 'settings'"
        @click="emit('openSettings')"
      >
        <Settings :size="15" />
        <span>设置</span>
      </button>
    </div>
  </aside>
</template>
