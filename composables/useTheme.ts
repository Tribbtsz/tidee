import { computed, ref, watchEffect } from 'vue';
import type { ThemeMode } from '../lib/types';

const STORAGE_KEY = 'tidee.theme';
const mode = ref<ThemeMode>(readMode());
const systemDark = ref(false);

function readMode(): ThemeMode {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value === 'light' || value === 'dark' || value === 'system') return value;
  } catch {
    // localStorage can be unavailable in a few extension contexts.
  }
  return 'system';
}

function persist(value: ThemeMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Ignore.
  }
}

let media: MediaQueryList | null = null;

function attachMedia(): void {
  if (media || typeof window === 'undefined') return;
  media = window.matchMedia('(prefers-color-scheme: dark)');
  systemDark.value = media.matches;
  media.addEventListener('change', (event) => {
    systemDark.value = event.matches;
  });
}

export function useTheme() {
  attachMedia();

  const resolved = computed<'light' | 'dark'>(() => {
    if (mode.value === 'system') return systemDark.value ? 'dark' : 'light';
    return mode.value;
  });

  watchEffect(() => {
    document.documentElement.dataset.theme = resolved.value;
    document.documentElement.style.colorScheme = resolved.value;
  });

  function setMode(value: ThemeMode): void {
    mode.value = value;
    persist(value);
  }

  function cycle(): ThemeMode {
    const order: ThemeMode[] = ['system', 'light', 'dark'];
    const next = order[(order.indexOf(mode.value) + 1) % order.length]!;
    setMode(next);
    return next;
  }

  return { mode, resolved, setMode, cycle };
}
