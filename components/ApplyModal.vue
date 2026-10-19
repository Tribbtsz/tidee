<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import {
  FolderTree,
  Loader2,
  RotateCcw,
  ShieldCheck,
  TriangleAlert,
  X,
} from '@lucide/vue';
import type { AppliedRecord, Destination, PlanCategory } from '../lib/types';
import { planTotals } from '../lib/plan';
import { categoryStyle } from '../composables/useBookmarkView';
import UiSelect from './UiSelect.vue';
import UiSwitch from './UiSwitch.vue';

const props = defineProps<{
  open: boolean;
  plan: PlanCategory[];
  destination: Destination;
  rootFolderName: string;
  useSubcategories: boolean;
  busy: boolean;
  applied: AppliedRecord | null;
}>();

const emit = defineEmits<{
  close: [];
  confirm: [
    value: { destination: Destination; rootFolderName: string; useSubcategories: boolean },
  ];
  undo: [];
}>();

const destination = ref<string>('other');
const rootName = ref('tidee');
const withSubs = ref(false);

const destinationOptions = [
  { value: 'other', label: '其他收藏夹' },
  { value: 'bar', label: '收藏夹栏' },
];

watch(
  () => props.open,
  (open) => {
    if (!open) return;
    destination.value = props.destination;
    rootName.value = props.rootFolderName;
    withSubs.value = props.useSubcategories;
  },
  { immediate: true },
);

const totals = computed(() => planTotals(props.plan, withSubs.value));
const subfolderCount = computed(() =>
  props.plan.reduce(
    (sum, category) =>
      sum + category.subcategories.filter((sub) => sub.name !== '其他').length,
    0,
  ),
);
</script>

<template>
  <Transition name="fade">
    <div v-if="open" class="scrim" @click="busy ? null : emit('close')">
      <Transition name="pop" appear>
        <div class="modal" role="dialog" aria-modal="true" @click.stop>
          <header class="modal-head">
            <div class="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-[var(--accent-soft)] text-[var(--accent-strong)]">
              <FolderTree :size="17" />
            </div>
            <div class="min-w-0 flex-1">
              <h2 class="text-[15px] font-bold">写回 Edge 收藏夹</h2>
              <p class="mt-0.5 text-[11.5px] text-[var(--muted)]">
                新建文件夹并移动书签，标题和网址保持不变。
              </p>
            </div>
            <button class="btn btn-ghost btn-icon btn-sm" :disabled="busy" @click="emit('close')">
              <X :size="15" />
            </button>
          </header>

          <div class="modal-body">
            <div v-if="plan.length === 0" class="rounded-[10px] bg-[var(--surface-2)] px-4 py-8 text-center">
              <FolderTree :size="22" class="mx-auto mb-2 text-[var(--muted-2)]" />
              <p class="text-[12.5px] font-semibold">还没有可整理的收藏</p>
              <p class="mt-1 text-[11.5px] text-[var(--muted)]">先读一批收藏，再回来写回。</p>
            </div>

            <template v-else>
              <div class="grid grid-cols-3 gap-2.5">
                <div class="rounded-[10px] bg-[var(--surface-2)] px-3 py-2.5">
                  <div class="text-[18px] font-bold tracking-tight">{{ totals.bookmarks }}</div>
                  <div class="text-[10.5px] text-[var(--muted-2)]">条收藏</div>
                </div>
                <div class="rounded-[10px] bg-[var(--surface-2)] px-3 py-2.5">
                  <div class="text-[18px] font-bold tracking-tight">{{ plan.length }}</div>
                  <div class="text-[10.5px] text-[var(--muted-2)]">个一级分类</div>
                </div>
                <div class="rounded-[10px] bg-[var(--surface-2)] px-3 py-2.5">
                  <div class="text-[18px] font-bold tracking-tight">{{ totals.folders }}</div>
                  <div class="text-[10.5px] text-[var(--muted-2)]">个文件夹</div>
                </div>
              </div>

              <div class="mt-4 max-h-[220px] space-y-1.5 overflow-y-auto pr-1">
                <div
                  v-for="category in plan"
                  :key="category.name"
                  class="flex items-center gap-2.5 rounded-lg bg-[var(--surface-2)] px-3 py-2"
                  :style="categoryStyle(category.name)"
                >
                  <span class="cat-dot" />
                  <span class="text-[12px] font-semibold">{{ category.name }}</span>
                  <span class="text-[10.5px] text-[var(--muted-2)]">
                    {{ category.subcategories.length }} 个子类
                  </span>
                  <span class="ml-auto text-[11px] tabular-nums text-[var(--muted)]">{{ category.count }}</span>
                </div>
              </div>

              <div class="mt-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <label class="label">放到哪里</label>
                  <UiSelect v-model="destination" :options="destinationOptions" />
                </div>
                <div>
                  <label class="label">根文件夹名</label>
                  <input v-model="rootName" class="field" maxlength="40" placeholder="tidee" />
                </div>
              </div>

              <UiSwitch
                v-model="withSubs"
                class="mt-4"
                label="同时创建二级分类文件夹"
                :hint="`会多出 ${subfolderCount} 个文件夹，建议熟悉后再开。`"
              />

              <div class="mt-4 flex items-start gap-2.5 rounded-[10px] bg-[var(--warn-soft)] px-3.5 py-3">
                <TriangleAlert :size="15" class="mt-0.5 shrink-0 text-[var(--warn)]" />
                <p class="text-[11px] leading-relaxed text-[var(--warn)]">
                  会移动 {{ totals.bookmarks }} 条书签。执行前自动下载一份可导入 Edge 的 HTML 备份，
                  写回后可以用“撤销”移回原位。
                </p>
              </div>

              <div class="mt-3 flex items-start gap-2.5 rounded-[10px] bg-[var(--surface-2)] px-3.5 py-3">
                <ShieldCheck :size="15" class="mt-0.5 shrink-0 text-[var(--accent)]" />
                <p class="text-[11px] leading-relaxed text-[var(--muted)]">
                  只改动文件夹结构和位置。不会删除收藏，不会修改标题或网址。
                </p>
              </div>
            </template>

            <div v-if="applied" class="mt-4 flex items-center gap-2 rounded-lg bg-[var(--surface-2)] px-3.5 py-3">
              <RotateCcw :size="14" class="shrink-0 text-[var(--muted)]" />
              <div class="min-w-0 flex-1 text-[11px] leading-relaxed text-[var(--muted)]">
                上次写回了 {{ applied.moved }} 条（{{ new Date(applied.at).toLocaleString('zh-CN') }}）
              </div>
              <button class="btn btn-ghost btn-sm" :disabled="busy" @click="emit('undo')">撤销</button>
            </div>
          </div>

          <footer class="modal-foot">
            <button class="btn btn-ghost btn-sm" :disabled="busy" @click="emit('close')">取消</button>
            <button
              class="btn btn-primary btn-sm"
              :disabled="busy || plan.length === 0 || !rootName.trim()"
              @click="
                emit('confirm', {
                  destination: destination as Destination,
                  rootFolderName: rootName,
                  useSubcategories: withSubs,
                })
              "
            >
              <Loader2 v-if="busy" :size="13" class="spin" />
              <FolderTree v-else :size="13" />
              {{ busy ? '正在写回…' : `写回 ${totals.bookmarks} 条` }}
            </button>
          </footer>
        </div>
      </Transition>
    </div>
  </Transition>
</template>
