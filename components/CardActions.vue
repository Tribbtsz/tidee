<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue';
import { Copy, ExternalLink, Pencil, Trash2, Type } from '@lucide/vue';
import type { BookmarkItem } from '../lib/types';

const props = defineProps<{
  bookmark: BookmarkItem | null;
  x: number;
  y: number;
}>();

const emit = defineEmits<{
  close: [];
  open: [];
  edit: [];
  rename: [];
  copy: [];
  delete: [];
}>();

const style = computed(() => {
  const width = 196;
  const height = 5 * 32 + 44;
  const left = Math.min(Math.max(8, props.x - width + 10), window.innerWidth - width - 8);
  const top = Math.min(Math.max(8, props.y + 6), window.innerHeight - height - 8);
  return { left: `${left}px`, top: `${top}px`, width: `${width}px` };
});

function onPointerDown(event: PointerEvent) {
  const target = event.target as HTMLElement | null;
  if (target?.closest('.action-menu') || target?.closest('[data-card-menu]')) return;
  emit('close');
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') emit('close');
}

function act(action: 'open' | 'edit' | 'rename' | 'copy' | 'delete') {
  if (action === 'open') emit('open');
  else if (action === 'edit') emit('edit');
  else if (action === 'rename') emit('rename');
  else if (action === 'copy') emit('copy');
  else emit('delete');
  emit('close');
}

onMounted(() => {
  document.addEventListener('pointerdown', onPointerDown, true);
  window.addEventListener('keydown', onKeydown);
});

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onPointerDown, true);
  window.removeEventListener('keydown', onKeydown);
});
</script>

<template>
  <Teleport to="body">
    <Transition name="select-pop">
      <div v-if="bookmark" class="action-menu" :style="style" role="menu">
        <div class="action-menu-title">{{ bookmark.title }}</div>
        <button type="button" class="action-item" role="menuitem" @click="act('open')">
          <ExternalLink :size="14" />
          打开链接
        </button>
        <button type="button" class="action-item" role="menuitem" @click="act('edit')">
          <Pencil :size="14" />
          编辑描述
        </button>
        <button type="button" class="action-item" role="menuitem" @click="act('rename')">
          <Type :size="14" />
          重命名
        </button>
        <button type="button" class="action-item" role="menuitem" @click="act('copy')">
          <Copy :size="14" />
          复制链接
        </button>
        <div class="action-divider" />
        <button
          type="button"
          class="action-item action-danger"
          role="menuitem"
          @click="act('delete')"
        >
          <Trash2 :size="14" />
          删除收藏
        </button>
      </div>
    </Transition>
  </Teleport>
</template>
