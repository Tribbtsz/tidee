<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { Pencil } from '@lucide/vue';

const props = defineProps<{
  open: boolean;
  currentTitle: string;
}>();

const emit = defineEmits<{
  confirm: [title: string];
  cancel: [];
}>();

const value = ref('');
const input = ref<HTMLInputElement | null>(null);

watch(
  () => props.open,
  async (open) => {
    if (!open) return;
    value.value = props.currentTitle;
    await nextTick();
    input.value?.focus();
    input.value?.select();
  },
);

function confirm() {
  const title = value.value.trim();
  if (!title) return;
  emit('confirm', title);
}

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
              <Pencil :size="16" class="mt-0.5 shrink-0 text-[var(--muted)]" />
              <div class="min-w-0 flex-1">
                <h2 class="text-[14px] font-bold">重命名收藏</h2>
                <p class="mt-1 text-[11.5px] leading-relaxed text-[var(--muted)]">
                  只改 Edge 里显示的名称，网址不变。
                </p>
                <input
                  ref="input"
                  v-model="value"
                  class="field mt-3"
                  maxlength="300"
                  @keydown.enter.prevent="confirm"
                />
              </div>
            </div>
          </div>
          <div class="modal-foot">
            <button class="btn btn-ghost btn-sm" @click="emit('cancel')">取消</button>
            <button class="btn btn-primary btn-sm" :disabled="!value.trim()" @click="confirm">
              保存
            </button>
          </div>
        </div>
      </Transition>
    </div>
  </Transition>
</template>
