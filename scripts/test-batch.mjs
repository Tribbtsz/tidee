import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { buildClassifyPayload, CLASSIFY_SYSTEM_PROMPT } from '../lib/prompt.ts';
import { DEFAULT_CATEGORIES, UNCATEGORIZED } from '../lib/constants.ts';

const base = (process.env.API_BASE || 'https://api.siliconflow.cn/v1').replace(/\/+$/, '');
const key = process.env.API_KEY;
const model = process.env.API_MODEL || 'THUDM/GLM-4-9B-0414';
const count = Number(process.env.BATCH || 20);
const offset = Number(process.env.OFFSET || 0);

if (!key) {
  console.error('API_KEY missing');
  process.exit(1);
}

const bookmarksPath = join(
  homedir(),
  'AppData/Local/Microsoft/Edge/User Data/Default/Bookmarks',
);
const raw = JSON.parse(await readFile(bookmarksPath, 'utf8'));

const items = [];
function walk(node, path) {
  for (const child of node.children ?? []) {
    if (child.url) {
      items.push({ title: child.title || child.url, url: child.url, folder: path });
    } else {
      walk(child, `${path} / ${child.title}`);
    }
  }
}
if (raw.roots.bookmark_bar) walk(raw.roots.bookmark_bar, raw.roots.bookmark_bar.name);
if (raw.roots.other) walk(raw.roots.other, raw.roots.other.name);

const sample = items
  .filter((item) => /^https?:/i.test(item.url))
  .slice(offset, offset + count);
const categories = [
  ...DEFAULT_CATEGORIES.map((category) => category.name),
  UNCATEGORIZED,
];
const refs = sample.map((item, index) => ({ ref: `b${index}`, ...item }));

const requestBody = {
  model,
  messages: [
    { role: 'system', content: CLASSIFY_SYSTEM_PROMPT },
    {
      role: 'user',
      content: buildClassifyPayload(
        [...DEFAULT_CATEGORIES, { name: UNCATEGORIZED, description: '确实无法判断归属时使用' }],
        refs,
      ),
    },
  ],
  max_tokens: 4096,
  temperature: 0.2,
};
if (process.env.JSON_MODE !== '0') requestBody.response_format = { type: 'json_object' };

const started = Date.now();
const response = await fetch(`${base}/chat/completions`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
  body: JSON.stringify(requestBody),
});

const latency = Date.now() - started;
const text = await response.text();
console.log(`status ${response.status} · ${latency}ms · ${sample.length} inputs`);

const payload = JSON.parse(text);
console.log('usage', JSON.stringify(payload.usage));
const content = payload.choices?.[0]?.message?.content ?? '';
let parsed;
try {
  parsed = JSON.parse(content);
} catch {
  console.log('--- raw content (not JSON) ---');
  console.log(content.slice(0, 3000));
  process.exit(1);
}

const returned = parsed.items ?? [];
const byId = new Map(returned.map((entry) => [entry.id, entry]));
console.log(`returned ${returned.length}/${sample.length}`);
const validCategories = new Set(categories);

for (let index = 0; index < refs.length; index += 1) {
  const ref = refs[index];
  const entry = byId.get(ref.ref);
  if (!entry) {
    console.log(`MISSING ${ref.ref} ${ref.title.slice(0, 50)}`);
    continue;
  }
  const flags = [];
  if (!validCategories.has(entry.category)) flags.push('BAD_CATEGORY');
  const descLength = [...String(entry.description ?? '')].length;
  if (descLength < 15 || descLength > 60) flags.push(`DESC_${descLength}`);
  if (entry.subcategory === entry.category) flags.push('SUB_EQ_CAT');
  if (!entry.subcategory || entry.subcategory === '未分类') flags.push('NO_SUB');
  if (entry.category === '未分类') flags.push('UNCATEGORIZED');
  console.log(
    `${ref.ref}\t${entry.category}/${entry.subcategory}\t${descLength}字\t${
      flags.join(',') || 'ok'
    }\t${ref.title.slice(0, 40)}`,
  );
}

console.log('\n--- sample output ---');
console.log(JSON.stringify(returned.slice(0, 3), null, 2));
