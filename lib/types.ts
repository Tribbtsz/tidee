export type ThemeMode = 'system' | 'light' | 'dark';

export type Destination = 'other' | 'bar';

export interface CategoryDef {
  name: string;
  description?: string;
}

export interface Settings {
  version: 1;
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature: number;
  batchSize: number;
  concurrency: number;
  jsonMode: boolean;
  categories: CategoryDef[];
  rootFolderName: string;
  destination: Destination;
  useSubcategories: boolean;
  autoAnalyze: boolean;
  autoIntervalMinutes: number;
  theme: ThemeMode;
}

export interface BookmarkMeta {
  url: string;
  title: string;
  category: string;
  subcategory: string;
  description: string;
  tags: string[];
  confidence: number;
  model: string;
  analyzedAt: number;
  sourceFolder: string;
  editedByUser?: boolean;
}

/** Keyed by urlKey(normalized URL). */
export type MetaMap = Record<string, BookmarkMeta>;

export interface BookmarkItem {
  id: string;
  title: string;
  url: string;
  parentId: string;
  folderPath: string;
  dateAdded?: number;
}

export interface AiUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface ClassifiedItem {
  category: string;
  subcategory: string;
  description: string;
  tags: string[];
  confidence: number;
}

export interface AnalysisProgress {
  total: number;
  done: number;
  failed: number;
  batches: number;
  completedBatches: number;
  currentBatch: number;
  usage: AiUsage;
  errors: string[];
  startedAt: number;
  finishedAt?: number;
  cancelled?: boolean;
}

export interface AppliedItem {
  id: string;
  url: string;
  originalParentId: string;
}

export interface AppliedRecord {
  at: number;
  rootId: string;
  rootName: string;
  moved: number;
  items: AppliedItem[];
  createdFolderIds: string[];
}

export interface PlanItem {
  bookmark: BookmarkItem;
  meta: BookmarkMeta;
}

export interface PlanSubcategory {
  name: string;
  items: PlanItem[];
}

export interface PlanCategory {
  name: string;
  subcategories: PlanSubcategory[];
  count: number;
}

export interface TestResult {
  ok: boolean;
  latencyMs: number;
  model?: string;
  message?: string;
}
