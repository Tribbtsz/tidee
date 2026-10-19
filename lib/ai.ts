import { UNCATEGORIZED } from './constants';
import { buildClassifyPayload, buildTaxonomyPayload, CLASSIFY_SYSTEM_PROMPT, TAXONOMY_SYSTEM_PROMPT } from './prompt';
import { applyContentFallback, applyHostRule } from './rules';
import type { AiUsage, CategoryDef, ClassifiedItem, Settings } from './types';

export class AiError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'AiError';
    this.status = status;
  }
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatOptions {
  signal?: AbortSignal;
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
}

interface ChatResult {
  content: string;
  usage: AiUsage;
  model: string;
}

interface ChatResponse {
  model?: string;
  choices?: Array<{ message?: { content?: string | null } }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  error?: { message?: string; type?: string };
}

const EMPTY_USAGE: AiUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

export function chatEndpoint(baseUrl: string): string {
  const base = (baseUrl || '').trim().replace(/\/+$/, '');
  if (!base) throw new AiError('还没有填写 API 地址');
  if (base.endsWith('/chat/completions')) return base;
  return `${base}/chat/completions`;
}

export function parseJsonLoose(text: string): unknown {
  let value = (text || '').trim().replace(/^\uFEFF/, '');
  if (!value) throw new AiError('模型返回了空内容');

  const fenced = value.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced?.[1]) value = fenced[1].trim();

  try {
    return JSON.parse(value);
  } catch {
    const ranges: Array<[number, number]> = [];
    const arrayStart = value.indexOf('[');
    const arrayEnd = value.lastIndexOf(']');
    const objectStart = value.indexOf('{');
    const objectEnd = value.lastIndexOf('}');
    if (arrayStart >= 0 && arrayEnd > arrayStart) ranges.push([arrayStart, arrayEnd]);
    if (objectStart >= 0 && objectEnd > objectStart) ranges.push([objectStart, objectEnd]);

    for (const [start, end] of ranges.sort((a, b) => a[0] - b[0])) {
      try {
        return JSON.parse(value.slice(start, end + 1));
      } catch {
        // Try the next candidate.
      }
    }
    throw new AiError('模型返回的不是合法 JSON，请换一个模型或关闭 JSON 模式重试');
  }
}

function usageFrom(response: ChatResponse): AiUsage {
  const usage = response.usage;
  if (!usage) return { ...EMPTY_USAGE };
  const promptTokens = usage.prompt_tokens ?? 0;
  const completionTokens = usage.completion_tokens ?? 0;
  return {
    promptTokens,
    completionTokens,
    totalTokens: usage.total_tokens ?? promptTokens + completionTokens,
  };
}

async function readError(response: Response): Promise<string> {
  const text = await response.text().catch(() => '');
  if (!text) return `HTTP ${response.status}`;
  try {
    const parsed = JSON.parse(text) as { error?: { message?: string }; message?: string };
    return parsed.error?.message || parsed.message || text.slice(0, 300);
  } catch {
    return text.slice(0, 300);
  }
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      },
      { once: true },
    );
  });
}

function combineSignal(signal: AbortSignal | undefined, timeoutMs: number): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

async function postChat(
  settings: Settings,
  messages: ChatMessage[],
  options: ChatOptions,
  jsonMode: boolean,
): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (settings.apiKey.trim()) headers.Authorization = `Bearer ${settings.apiKey.trim()}`;

  const body: Record<string, unknown> = {
    model: settings.model,
    messages,
    temperature: options.temperature ?? settings.temperature,
    max_tokens: options.maxTokens ?? 4096,
    stream: false,
  };
  if (jsonMode) body.response_format = { type: 'json_object' };

  return fetch(chatEndpoint(settings.baseUrl), {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: combineSignal(options.signal, options.timeoutMs ?? 120_000),
  });
}

async function requestChat(
  settings: Settings,
  messages: ChatMessage[],
  options: ChatOptions = {},
): Promise<ChatResult> {
  if (!settings.model?.trim()) throw new AiError('还没有填写模型名');

  let jsonMode = settings.jsonMode;
  let lastError: unknown;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      let response = await postChat(settings, messages, options, jsonMode);

      if (response.status === 400 && jsonMode) {
        const detail = await readError(response);
        if (/response_format|json_object|json mode/i.test(detail)) {
          jsonMode = false;
          response = await postChat(settings, messages, options, false);
        } else {
          throw new AiError(detail, 400);
        }
      }

      if (response.status === 429 || response.status >= 500) {
        const detail = await readError(response);
        if (attempt === 2) throw new AiError(detail, response.status);
        const retryAfter = Number(response.headers.get('retry-after') || 0);
        await sleep(Math.min(10_000, retryAfter > 0 ? retryAfter * 1000 : 800 * 2 ** attempt), options.signal);
        continue;
      }

      if (!response.ok) throw new AiError(await readError(response), response.status);

      const payload = (await response.json()) as ChatResponse;
      const content = payload.choices?.[0]?.message?.content ?? '';
      if (!content.trim()) throw new AiError('模型没有返回内容');

      return {
        content,
        usage: usageFrom(payload),
        model: payload.model || settings.model,
      };
    } catch (error) {
      lastError = error;
      if (error instanceof DOMException && error.name === 'AbortError') throw error;
      if (error instanceof AiError && error.status && error.status < 500 && error.status !== 429) throw error;
      if (attempt === 2) break;
      await sleep(800 * 2 ** attempt, options.signal);
    }
  }

  if (lastError instanceof Error) throw lastError;
  throw new AiError('请求 AI 失败');
}

export async function ensureHostPermission(baseUrl: string): Promise<boolean> {
  try {
    const url = new URL(baseUrl);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    const pattern = `${url.origin}/*`;
    const already = await chrome.permissions.contains({ origins: [pattern] });
    if (already) return true;
    return await chrome.permissions.request({ origins: [pattern] });
  } catch {
    return false;
  }
}

function readField(value: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    const field = value[key];
    if (field !== undefined && field !== null && field !== '') return field;
  }
  return undefined;
}

function readText(value: Record<string, unknown>, keys: string[]): string {
  const field = readField(value, keys);
  if (field && typeof field === 'object') {
    const object = field as Record<string, unknown>;
    return String(object.name ?? object.value ?? '').trim();
  }
  return String(field ?? '').trim();
}

function normalizeTagList(value: unknown): string[] {
  const list =
    typeof value === 'string' ? value.split(/[,，、]/).map((item) => item.trim()) : value;
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const item of list) {
    if (typeof item !== 'string') continue;
    const tag = item.replace(/^#/, '').replace(/\s+/g, ' ').trim().slice(0, 16);
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    tags.push(tag);
    if (tags.length === 3) break;
  }
  return tags;
}

export function normalizeCategory(value: string, categories: CategoryDef[]): string {
  const raw = (value || '').trim();
  if (!raw) return UNCATEGORIZED;
  const names = categories.map((category) => category.name);
  const exact = names.find((name) => name === raw);
  if (exact) return exact;
  const lower = raw.toLowerCase();
  const loose = names.find((name) => name.toLowerCase() === lower);
  if (loose) return loose;
  const included = names.find((name) => raw.includes(name) || name.includes(raw));
  return included ?? (names.includes(UNCATEGORIZED) ? UNCATEGORIZED : raw.slice(0, 20));
}

export interface ClassifiedEntry extends ClassifiedItem {
  ref: string;
}

export async function classifyBatch(
  settings: Settings,
  categories: CategoryDef[],
  batch: Array<{ ref: string; title: string; url: string; folder: string }>,
  options: ChatOptions = {},
): Promise<{ entries: ClassifiedEntry[]; usage: AiUsage; model: string }> {
  const result = await requestChat(
    settings,
    [
      { role: 'system', content: CLASSIFY_SYSTEM_PROMPT },
      { role: 'user', content: buildClassifyPayload(categories, batch) },
    ],
    options,
  );

  const parsed = parseJsonLoose(result.content) as { items?: unknown } | unknown[];
  const parsedObject =
    parsed && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  const rawItems = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsedObject.items)
      ? parsedObject.items
      : Array.isArray(parsedObject.results)
        ? parsedObject.results
        : Array.isArray(parsedObject.data)
          ? parsedObject.data
          : Array.isArray(parsedObject.list)
            ? parsedObject.list
            : [];
  const known = new Set(batch.map((item) => item.ref));
  const urlByRef = new Map(batch.map((item) => [item.ref, item.url]));
  const titleByRef = new Map(batch.map((item) => [item.ref, item.title]));

  const entries: ClassifiedEntry[] = [];
  for (const raw of rawItems) {
    if (!raw || typeof raw !== 'object') continue;
    const value = raw as Record<string, unknown>;
    let ref = readText(value, ['id', 'ref', '编号']);

    // Small models often rewrite ids ("0:3" -> "3", "b3", or just the index).
    // Since each call handles one batch, the trailing number is enough.
    if (!known.has(ref)) {
      const numbers = ref.match(/\d+/g);
      const index = numbers ? Number(numbers[numbers.length - 1]) : Number.NaN;
      if (Number.isInteger(index) && batch[index]) ref = batch[index]!.ref;
    }
    if (!known.has(ref) && rawItems.length === batch.length) {
      const positional = batch[entries.length];
      if (positional) ref = positional.ref;
    }
    if (!known.has(ref)) continue;

    const confidenceRaw = Number(readField(value, ['confidence', '置信度', '把握']));
    const confidence = Number.isFinite(confidenceRaw)
      ? Math.min(1, Math.max(0, confidenceRaw > 1 ? confidenceRaw / 100 : confidenceRaw))
      : 0.5;

    let normalizedCategory = normalizeCategory(
      readText(value, ['category', '分类', '类目']),
      categories,
    );
    let subcategory = readText(value, ['subcategory', '二级分类', '子分类'])
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 12);

    let description = readText(value, ['description', '描述', '简介', '说明'])
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 90);

    if (normalizedCategory === UNCATEGORIZED) {
      const fallback = applyContentFallback(
        titleByRef.get(ref) ?? '',
        urlByRef.get(ref) ?? '',
        description,
        categories.map((category) => category.name),
      );
      if (fallback) {
        normalizedCategory = fallback.category;
        if (!subcategory) subcategory = fallback.subcategory;
      }
    }

    if (subcategory === normalizedCategory || subcategory === UNCATEGORIZED) subcategory = '';

    const ruled = applyHostRule(urlByRef.get(ref) ?? '', normalizedCategory, subcategory);
    const ruleCategoryExists = categories.some((item) => item.name === ruled.category);
    const finalCategory = ruleCategoryExists ? ruled.category : normalizedCategory;
    const finalSubcategory = ruleCategoryExists ? ruled.subcategory : subcategory;

    description = description
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 90);
    const looksLikeAssistant =
      finalCategory.includes('AI') || finalSubcategory.includes('助手');
    if (looksLikeAssistant && !/AI|模型|对话|问答|助手|写作|代码|生成|编程/i.test(description)) {
      description = 'AI 对话助手，问答和写作。';
    }

    entries.push({
      ref,
      category: finalCategory,
      subcategory: finalSubcategory,
      description,
      tags: normalizeTagList(readField(value, ['tags', '标签'])).filter(
        (tag) => tag !== finalCategory,
      ),
      confidence,
    });
  }

  if (entries.length === 0) throw new AiError('模型没有返回可用的分类结果，请重试');
  return { entries, usage: result.usage, model: result.model };
}

export async function generateTaxonomy(
  settings: Settings,
  items: Array<{ title: string; host: string; folder: string }>,
  options: ChatOptions = {},
): Promise<{ categories: CategoryDef[]; usage: AiUsage }> {
  const result = await requestChat(
    settings,
    [
      { role: 'system', content: TAXONOMY_SYSTEM_PROMPT },
      { role: 'user', content: buildTaxonomyPayload(items.slice(0, 160)) },
    ],
    { ...options, maxTokens: 1200 },
  );

  const parsed = parseJsonLoose(result.content) as { categories?: unknown };
  if (!Array.isArray(parsed?.categories)) throw new AiError('模型没有返回分类列表');

  const seen = new Set<string>();
  const categories: CategoryDef[] = [];
  for (const raw of parsed.categories) {
    if (!raw || typeof raw !== 'object') continue;
    const value = raw as Record<string, unknown>;
    const name = String(value.name ?? '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 16);
    if (!name || seen.has(name) || name === UNCATEGORIZED) continue;
    seen.add(name);
    categories.push({
      name,
      description: String(value.description ?? '').trim().slice(0, 30),
    });
    if (categories.length === 12) break;
  }

  if (categories.length < 4) throw new AiError('模型给出的分类太少，请重试或手动编辑');
  return { categories, usage: result.usage };
}

export async function testConnection(
  settings: Settings,
  options: ChatOptions = {},
): Promise<{ latencyMs: number; model: string; usage: AiUsage }> {
  const startedAt = performance.now();
  const result = await requestChat(
    settings,
    [
      { role: 'system', content: '你是连通性测试。只输出 JSON：{"ok":true}' },
      { role: 'user', content: 'ping' },
    ],
    { ...options, maxTokens: 30, temperature: 0 },
  );
  return {
    latencyMs: Math.round(performance.now() - startedAt),
    model: result.model,
    usage: result.usage,
  };
}
