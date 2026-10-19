<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue';
import { Info } from '@lucide/vue';

const props = withDefaults(
  defineProps<{
    open: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    danger?: boolean;
  }>(),
  {
    confirmLabel: '确定',
    cancelLabel: '取消',
    danger: false,
  },
);

const emit = defineEmits<{ confirm: []; cancel: [] }>();

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && props.open) emit('cancel');
}

onMounted(() => window.addEventListener('keydown', onKeydown));
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown));
</script>

<template>
  <Transition name="fade">
    <div v-if="open" class="scrim" @click="emit('cancel')">
      <Transition name="pop" appear>
        <div
          class="modal"
          style="width: min(420px, 100%)"
          role="dialog"
          aria-modal="true"
          @click.stop
        >
          <div class="modal-body">
            <div class="flex items-start gap-2.5">
              <Info :size="16" class="mt-0.5 shrink-0 text-[var(--warn)]" />
              <div>
                <h2 class="text-[14px] font-bold">{{ title }}</h2>
                <p class="mt-1.5 text-[12px] leading-relaxed text-[var(--muted)]">{{ message }}</p>
              </div>
            </div>
          </div>
          <div class="modal-foot">
            <button class="btn btn-ghost btn-sm" @click="emit('cancel')">{{ cancelLabel }}</button>
            <button
              class="btn btn-sm"
              :class="danger ? 'btn-danger' : 'btn-primary'"
              @click="emit('confirm')"
            >
              {{ confirmLabel }}
            </button>
          </div>
        </div>
      </Transition>
    </div>
  </Transition>
</template>
