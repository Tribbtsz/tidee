<script setup lang="ts">
withDefaults(
  defineProps<{
    modelValue: boolean;
    label: string;
    hint?: string;
    disabled?: boolean;
  }>(),
  { hint: '', disabled: false },
);

const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>();

function toggle(current: boolean) {
  emit('update:modelValue', !current);
}
</script>

<template>
  <div class="ui-switch-row" @click="disabled ? null : toggle(modelValue)">
    <div class="min-w-0 flex-1">
      <span class="ui-switch-label">{{ label }}</span>
      <span v-if="hint" class="ui-switch-hint">{{ hint }}</span>
      <slot />
    </div>
    <button
      type="button"
      class="ui-switch-track"
      role="switch"
      :aria-checked="modelValue"
      :aria-label="label"
      :disabled="disabled"
      @click.stop="disabled ? null : toggle(modelValue)"
    >
      <span class="ui-switch-thumb" />
    </button>
  </div>
</template>
