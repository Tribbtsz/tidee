<script setup lang="ts">
withDefaults(defineProps<{ size?: number }>(), { size: 22 });
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
  >
    <path
      d="M2.2 9.1c2.4-3.1 4.4-3.1 6.8 0s4.4 3.1 6.8 0 3.7-2.4 6 0"
      stroke="currentColor"
      stroke-width="2.1"
      stroke-linecap="round"
    />
    <path
      d="M2.2 15.2c2.4-3.1 4.4-3.1 6.8 0s4.4 3.1 6.8 0 3.7-2.4 6 0"
      stroke="currentColor"
      stroke-width="2.1"
      stroke-linecap="round"
      opacity=".55"
    />
  </svg>
</template>
