<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import {
  Ban,
  Check,
  CircleAlert,
  Loader2,
  Settings2,
  Sparkles,
  X,
} from '@lucide/vue';
import type { AnalysisScope } from '../lib/batch';
import type { AnalysisProgress } from '../lib/types';

const props = defineProps<{
  open: boolean;
  pending: number;
  reviewed: number;
  analyzed: number;
  batchSize: number;
  concurrency: number;
  model: string;
  configured: boolean;
  analyzing: boolean;
  progress: AnalysisProgress | null;
}>();

const emit = defineEmits<{
  close: [];
  start: [scope: AnalysisScope];
  cancel: [];
  openSettings: [];
}>();

const scope = ref<AnalysisScope>('pending');
const now = ref(Date.now());
let timer: ReturnType<typeof setInterval> | undefined;

watch(
  () => props.open,
  (open) => {
    if (open) {
      scope.value =
        props.pending > 0 ? 'pending' : props.reviewed > 0 ? 'review' : 'all';
      now.value = Date.now();
      timer ??= setInterval(() => {
        now.value = Date.now();
      }, 500);
    } else if (!props.analyzing) {
      clearInterval(timer);
      timer = undefined;
    }
  },
  { immediate: true },
);

watch(
  () => props.analyzing,
  (value) => {
    if (value) {
      now.value = Date.now();
      timer ??= setInterval(() => {
        now.value = Date.now();
      }, 500);
    } else if (!props.open) {
      clearInterval(timer);
      timer = undefined;
    }
  },
);

onBeforeUnmount(() => {
  clearInterval(timer);
});

const queueSize = computed(() => {
  if (scope.value === 'pending') return props.pending;
  if (scope.value === 'review') return props.reviewed;
  return props.pending + props.analyzed;
});
const batches = computed(() => Math.ceil(queueSize.value / Math.max(1, props.batchSize)));
const percent = computed(() => {
  const progress = props.progress;
  if (!progress || progress.total === 0) return 0;
  return Math.min(100, Math.round(((progress.done + progress.failed) / progress.total) * 100));
});
const elapsed = computed(() => {
  const progress = props.progress;
  if (!progress) return 0;
  const end = progress.finishedAt ?? now.value;
  return Math.max(0, Math.round((end - progress.startedAt) / 1000));
});
const finished = computed(() => Boolean(props.progress?.finishedAt));

function formatSeconds(value: number): string {
  if (value < 60) return `${value} 秒`;
  return `${Math.floor(value / 60)} 分 ${value % 60} 秒`;
}
</script>

<template>
  <Transition name="fade">
    <div v-if="open" class="scrim" @click="analyzing ? null : emit('close')">
      <Transition name="pop" appear>
        <div class="modal" role="dialog" aria-modal="true" @click.stop>
          <header class="modal-head">
            <div class="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-[var(--accent-soft)] text-[var(--accent-strong)]">
              <Sparkles :size="17" />
            </div>
            <div class="min-w-0 flex-1">
              <h2 class="text-[15px] font-bold">先读一遍你的收藏</h2>
              <p class="mt-0.5 text-[11.5px] text-[var(--muted)]">
                只发送标题、网址和原文件夹，不抓取网页内容。
              </p>
            </div>
            <button class="btn btn-ghost btn-icon btn-sm" :disabled="analyzing" @click="emit('close')">
              <X :size="15" />
            </button>
          </header>

          <div class="modal-body">
            <div
              v-if="!configured"
              class="rounded-[10px] bg-[var(--surface-2)] p-4"
            >
              <div class="flex items-start gap-2.5">
                <CircleAlert :size="16" class="mt-0.5 shrink-0 text-[var(--warn)]" />
                <div>
                  <p class="text-[12.5px] font-semibold">还没有配置模型</p>
                  <p class="mt-1 text-[11.5px] leading-relaxed text-[var(--muted)]">
                    填入 API 地址、Key 和模型名后就能开始。所有请求由你的扩展直接发往服务商。
                  </p>
                  <button class="btn btn-primary btn-sm mt-3" @click="emit('openSettings')">
                    <Settings2 :size="13" />
                    去设置
                  </button>
                </div>
              </div>
            </div>

            <template v-else-if="!analyzing && !finished">
              <div class="grid gap-2.5 sm:grid-cols-3">
                <button
                  class="rounded-[10px] p-3.5 text-left transition-base"
                  :class="
                    scope === 'pending'
                      ? 'option-selected bg-[var(--accent-soft)]'
                      : 'bg-[var(--surface-2)] hover:bg-[var(--surface-3)]'
                  "
                  :disabled="pending === 0"
                  @click="scope = 'pending'"
                >
                  <div class="flex items-center justify-between">
                    <span class="text-[12.5px] font-semibold">只读新的</span>
                    <span class="text-[10px] text-[var(--muted-2)]">{{ pending }} 条</span>
                  </div>
                  <p class="mt-1 text-[11px] leading-relaxed text-[var(--muted)]">
                    跳过已有描述，只补新增。
                  </p>
                </button>

                <button
                  class="rounded-[10px] p-3.5 text-left transition-base"
                  :class="
                    scope === 'review'
                      ? 'option-selected bg-[var(--accent-soft)]'
                      : 'bg-[var(--surface-2)] hover:bg-[var(--surface-3)]'
                  "
                  :disabled="reviewed === 0"
                  @click="scope = 'review'"
                >
                  <div class="flex items-center justify-between">
                    <span class="text-[12.5px] font-semibold">重读有问题的</span>
                    <span class="text-[10px] text-[var(--muted-2)]">{{ reviewed }} 条</span>
                  </div>
                  <p class="mt-1 text-[11px] leading-relaxed text-[var(--muted)]">
                    未分类、描述过短或分类过旧。
                  </p>
                </button>

                <button
                  class="rounded-[10px] p-3.5 text-left transition-base"
                  :class="
                    scope === 'all'
                      ? 'option-selected bg-[var(--accent-soft)]'
                      : 'bg-[var(--surface-2)] hover:bg-[var(--surface-3)]'
                  "
                  @click="scope = 'all'"
                >
                  <div class="flex items-center justify-between">
                    <span class="text-[12.5px] font-semibold">全部重读</span>
                    <span class="text-[10px] text-[var(--muted-2)]">{{ pending + analyzed }} 条</span>
                  </div>
                  <p class="mt-1 text-[11px] leading-relaxed text-[var(--muted)]">
                    覆盖所有描述，包括手动修改。
                  </p>
                </button>
              </div>

              <div class="mt-4 rounded-[10px] bg-[var(--surface-2)] p-3.5">
                <div class="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11.5px]">
                  <span class="text-[var(--muted)]">
                    <b class="font-semibold text-[var(--ink)]">{{ queueSize }}</b> 条
                  </span>
                  <span class="text-[var(--muted)]">
                    <b class="font-semibold text-[var(--ink)]">{{ batches }}</b> 次请求
                  </span>
                  <span class="ml-auto mono text-[10.5px] text-[var(--muted-2)]">{{ model }}</span>
                </div>
                <p class="mt-2 text-[10.5px] leading-relaxed text-[var(--muted-2)]">
                  每批 {{ batchSize }} 条，{{ concurrency }} 路并发。批越大请求越少、单次越慢。失败会自动重试，中断后已完成的结果会保留。
                </p>
              </div>
            </template>

            <template v-else>
              <div class="rounded-[10px] bg-[var(--surface-2)] p-4">
                <div class="mb-2 flex items-center justify-between gap-3">
                  <span class="flex items-center gap-2 text-[12.5px] font-semibold">
                    <Loader2 v-if="analyzing" :size="14" class="spin text-[var(--accent)]" />
                    <Check v-else :size="14" class="text-[var(--accent)]" />
                    {{ analyzing ? '正在读' : '读完了' }}
                  </span>
                  <span class="mono text-[10.5px] text-[var(--muted-2)]">{{ percent }}%</span>
                </div>

                <div class="progress-track">
                  <div class="progress-fill" :style="{ width: `${percent}%` }" />
                </div>

                <div class="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px] text-[var(--muted)] sm:grid-cols-4">
                  <span>完成 <b class="text-[var(--ink)]">{{ progress?.done ?? 0 }}</b></span>
                  <span>失败 <b :class="progress?.failed ? 'text-[var(--danger)]' : 'text-[var(--ink)]'">{{ progress?.failed ?? 0 }}</b></span>
                  <span>批次 <b class="text-[var(--ink)]">{{ progress?.completedBatches ?? 0 }}/{{ progress?.batches ?? 0 }}</b></span>
                  <span>用时 <b class="text-[var(--ink)]">{{ formatSeconds(elapsed) }}</b></span>
                </div>

                <div class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10.5px] text-[var(--muted-2)]">
                  <span>tokens {{ (progress?.usage.totalTokens ?? 0).toLocaleString() }}</span>
                  <span v-if="progress?.cancelled">已手动停止</span>
                </div>

                <div v-if="progress?.errors.length" class="mt-3 space-y-1">
                  <p
                    v-for="(error, index) in progress.errors.slice(0, 3)"
                    :key="index"
                    class="rounded-md bg-[var(--danger-soft)] px-2 py-1 text-[10.5px] leading-relaxed text-[var(--danger)]"
                  >
                    {{ error }}
                  </p>
                </div>
              </div>

              <p v-if="finished && progress?.failed" class="mt-3 text-[11px] leading-relaxed text-[var(--muted)]">
                失败条目没有写入结果，下次选“只读新的”会自动重试。
              </p>
              <p v-if="!finished && !analyzing" class="mt-3 text-[11px] text-[var(--muted)]">
                关闭窗口不会中断读取。
              </p>
            </template>
          </div>

          <footer class="modal-foot">
            <template v-if="analyzing">
              <span class="mr-auto text-[10.5px] text-[var(--muted-2)]">可以关闭窗口，读取会继续</span>
              <button class="btn btn-soft btn-sm" @click="emit('cancel')">
                <Ban :size="13" />
                停止
              </button>
              <button class="btn btn-ghost btn-sm" @click="emit('close')">收起</button>
            </template>
            <template v-else-if="finished">
              <button class="btn btn-primary btn-sm" @click="emit('close')">完成</button>
            </template>
            <template v-else>
              <button class="btn btn-ghost btn-sm" @click="emit('close')">取消</button>
              <button class="btn btn-primary btn-sm" :disabled="!configured || queueSize === 0" @click="emit('start', scope)">
                <Sparkles :size="13" />
                开始读 {{ queueSize }} 条
              </button>
            </template>
          </footer>
        </div>
      </Transition>
    </div>
  </Transition>
</template>
