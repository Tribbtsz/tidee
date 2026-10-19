<script setup lang="ts">
import { CircleAlert, CircleCheck, Info, X } from '@lucide/vue';
import type { Toast } from '../composables/useTidee';

defineProps<{ toasts: Toast[] }>();
defineEmits<{ dismiss: [id: number] }>();
</script>

<template>
  <div class="toast-stack" aria-live="polite">
    <TransitionGroup name="fade">
      <div v-for="toast in toasts" :key="toast.id" class="toast" :data-tone="toast.tone">
        <CircleCheck v-if="toast.tone === 'success'" :size="16" class="mt-0.5 shrink-0 text-[var(--accent)]" />
        <CircleAlert v-else-if="toast.tone === 'error'" :size="16" class="mt-0.5 shrink-0 text-[var(--danger)]" />
        <Info v-else :size="16" class="mt-0.5 shrink-0 text-[var(--muted)]" />
        <span class="flex-1">{{ toast.message }}</span>
        <button class="btn-ghost -m-1 grid h-6 w-6 place-items-center rounded-md" @click="$emit('dismiss', toast.id)">
          <X :size="13" />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>
