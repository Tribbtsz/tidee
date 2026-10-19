<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { ChevronDown } from '@lucide/vue';

export interface SelectOption {
  value: string;
  label: string;
}

const props = withDefaults(
  defineProps<{
    modelValue: string;
    options: SelectOption[];
    placeholder?: string;
    disabled?: boolean;
  }>(),
  { placeholder: '请选择', disabled: false },
);

const emit = defineEmits<{ 'update:modelValue': [value: string] }>();

const open = ref(false);
const trigger = ref<HTMLElement | null>(null);
const menuStyle = ref<Record<string, string>>({});

const currentLabel = computed(
  () =>
    props.options.find((option) => option.value === props.modelValue)?.label ??
    props.placeholder,
);

function position() {
  const rect = trigger.value?.getBoundingClientRect();
  if (!rect) return;
  const menuHeight = Math.min(236, props.options.length * 32 + 8);
  const spaceBelow = window.innerHeight - rect.bottom - 10;
  const openUp = spaceBelow < Math.min(160, menuHeight);
  const top = openUp
    ? Math.max(8, rect.top - menuHeight - 4)
    : rect.bottom + 4;
  menuStyle.value = {
    left: `${rect.left}px`,
    top: `${top}px`,
    width: `${Math.max(rect.width, 160)}px`,
    maxHeight: `${Math.min(236, openUp ? rect.top - 12 : spaceBelow)}px`,
  };
}

function onPointerDown(event: PointerEvent) {
  const target = event.target as HTMLElement | null;
  if (trigger.value?.contains(target)) return;
  if (target?.closest('.ui-select-menu')) return;
  close();
}

function addListeners() {
  window.addEventListener('pointerdown', onPointerDown, true);
  window.addEventListener('scroll', position, true);
  window.addEventListener('resize', position);
}

function removeListeners() {
  window.removeEventListener('pointerdown', onPointerDown, true);
  window.removeEventListener('scroll', position, true);
  window.removeEventListener('resize', position);
}

function close() {
  open.value = false;
}

function toggle() {
  if (props.disabled) return;
  open.value = !open.value;
}

function choose(value: string) {
  emit('update:modelValue', value);
  close();
  trigger.value?.focus();
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    close();
    return;
  }
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    toggle();
  }
}

watch(open, async (value) => {
  if (value) {
    position();
    await nextTick();
    position();
    addListeners();
  } else {
    removeListeners();
  }
});

onBeforeUnmount(removeListeners);
</script>

<template>
  <div class="ui-select">
    <button
      ref="trigger"
      type="button"
      class="ui-select-trigger"
      :class="{ 'is-open': open }"
      :disabled="disabled"
      :aria-expanded="open"
      aria-haspopup="listbox"
      @click="toggle"
      @keydown="onKeydown"
    >
      <span class="truncate" :class="{ 'text-[var(--muted-2)]': !modelValue }">
        {{ currentLabel }}
      </span>
      <ChevronDown :size="14" class="ui-select-chevron" />
    </button>

    <Teleport to="body">
      <Transition name="select-pop">
        <div v-if="open" class="ui-select-menu" :style="menuStyle" role="listbox">
          <button
            v-for="option in options"
            :key="option.value"
            type="button"
            class="ui-select-item"
            :class="{ 'is-selected': option.value === modelValue }"
            role="option"
            :aria-selected="option.value === modelValue"
            @click="choose(option.value)"
          >
            {{ option.label }}
          </button>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
