import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { DEFAULT_CATEGORIES, UNCATEGORIZED } from '../lib/constants.ts';
import { buildClassifyPayload, CLASSIFY_SYSTEM_PROMPT } from '../lib/prompt.ts';

const base = (process.env.API_BASE || 'http://127.0.0.1:8787/v1').replace(/\/+$/, '');
const key = process.env.API_KEY || '';
const model = process.env.API_MODEL || 'THUDM/GLM-4-9B-0414';
const limit = Number(process.env.LIMIT || 125);
const maxTokens = Number(process.env.MAX_TOKENS || 8192);

const bookmarksPath = join(
  homedir(),
  'AppData/Local/Microsoft/Edge/User Data/Default/Bookmarks',
);
const raw = JSON.parse(await readFile(bookmarksPath, 'utf8'));

const items = [];
function walk(node) {
  for (const child of node.children ?? []) {
    if (child.url) items.push({ title: child.title || child.url, url: child.url });
    else walk(child);
  }
}
if (raw.roots.bookmark_bar) walk(raw.roots.bookmark_bar);
if (raw.roots.other) walk(raw.roots.other);

const sample = items.filter((item) => /^https?:/i.test(item.url)).slice(0, limit);
const refs = sample.map((item, index) => ({ ref: `b${index}`, ...item, folder: '' }));
const categories = [
  ...DEFAULT_CATEGORIES,
  { name: UNCATEGORIZED, description: '暂时无法确定归属的收藏' },
];

const body = {
  model,
  messages: [
    { role: 'system', content: CLASSIFY_SYSTEM_PROMPT },
    { role: 'user', content: buildClassifyPayload(categories, refs) },
  ],
  max_tokens: maxTokens,
  temperature: 0.2,
  response_format: { type: 'json_object' },
};

const started = Date.now();
const response = await fetch(`${base}/chat/completions`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    ...(key ? { Authorization: `Bearer ${key}` } : {}),
  },
  body: JSON.stringify(body),
  signal: AbortSignal.timeout(300_000),
});
const text = await response.text();
const latency = Date.now() - started;
console.log(`status ${response.status} · ${latency}ms · ${sample.length} inputs · max_tokens ${maxTokens}`);

if (!response.ok) {
  console.log(text.slice(0, 1500));
  process.exit(1);
}

const payload = JSON.parse(text);
const choice = payload.choices?.[0];
const content = choice?.message?.content ?? '';
console.log('finish_reason:', choice?.finish_reason);
console.log('usage:', JSON.stringify(payload.usage));
console.log('content chars:', content.length);

let parsed;
try {
  let cleaned = content.trim();
  const fenced = cleaned.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced?.[1]) cleaned = fenced[1].trim();
  parsed = JSON.parse(cleaned);
} catch (error) {
  console.log('JSON parse failed:', error instanceof Error ? error.message : String(error));
  console.log('content tail:', content.slice(-1200));
  process.exit(1);
}

const entries = Array.isArray(parsed) ? parsed : parsed.items ?? [];
const seen = new Set(entries.map((entry) => entry.id));
const missing = refs.filter((ref) => !seen.has(ref.ref));
const categoriesSeen = new Set(categories.map((category) => category.name));
const invalidCategories = entries.filter((entry) => !categoriesSeen.has(entry.category));
const shortDescriptions = entries.filter(
  (entry) => String(entry.description ?? '').trim().length < 15,
);

console.log(`returned ${entries.length}/${refs.length}`);
console.log(`missing ${missing.length}`, missing.slice(0, 8).map((item) => item.ref).join(', '));
console.log(`invalid categories ${invalidCategories.length}`);
console.log(`descriptions <15 chars ${shortDescriptions.length}`);
console.log('last item:', JSON.stringify(entries[entries.length - 1]));
