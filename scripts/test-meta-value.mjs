import { CLASSIFY_SYSTEM_PROMPT } from '../lib/prompt.ts';
import { DEFAULT_CATEGORIES, UNCATEGORIZED } from '../lib/constants.ts';

const base = (process.env.API_BASE || 'https://api.siliconflow.cn/v1').replace(/\/+$/, '');
const key = process.env.API_KEY;
const model = process.env.API_MODEL || 'THUDM/GLM-4-9B-0414';
const jsonMode = process.env.JSON_MODE !== '0';

if (!key) {
  console.error('API_KEY missing');
  process.exit(1);
}

const items = [
  {
    id: 'b0',
    title: '超光速',
    url: 'https://ftls.xyz',
    meta: '',
  },
  {
    id: 'b1',
    title: 'Hypefluency',
    url: 'https://hypefluency.com',
    meta: 'Strategic influencer marketing and digital campaigns in Mexico & LatAm. We connect brands with top creators to drive real reach, engagement, and measurable results.',
  },
  {
    id: 'b2',
    title: 'Global Qualitative Research Services | MindMarket',
    url: 'https://mindmarket.com',
    meta: 'MindMarket is a global qualitative market research agency specialising in consumer insights & qualitative market research methods.',
  },
  {
    id: 'b3',
    title: '空白Koobai',
    url: 'https://koobai.com',
    meta: '工作生活记录、折腾备忘, 同时分享下日常使用的软件、观看的影视、喜欢的好物等',
  },
  {
    id: 'b4',
    title: 'Readme | Litos',
    url: 'https://litos.vercel.app',
    meta: 'Litos is a modern blogging theme built on Astro.js, designed for developers. It supports multiple post layouts, photo displays, project displays, and more.',
  },
  {
    id: 'b5',
    title: '首页 • 偶然时刻',
    url: 'https://joeytoday.com',
    meta: '',
  },
];

const categories = [
  ...DEFAULT_CATEGORIES,
  { name: UNCATEGORIZED, description: '暂时无法确定归属的收藏' },
];

function payload(withMeta) {
  return JSON.stringify({
    categories: categories.map((category) => ({
      name: category.name,
      hint: category.description,
    })),
    items: items.map((item) => ({
      id: item.id,
      title: item.title,
      url: item.url,
      ...(withMeta && item.meta ? { meta: item.meta.slice(0, 500) } : {}),
    })),
  });
}

async function run(label, withMeta) {
  const system = withMeta
    ? `${CLASSIFY_SYSTEM_PROMPT}\n\n补充：如果条目带有 meta 字段，它是页面自己的摘要，可作为事实参考，但不要照抄，也不要被营销措辞带偏。`
    : CLASSIFY_SYSTEM_PROMPT;

  const body = {
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: payload(withMeta) },
    ],
    max_tokens: 4096,
    temperature: 0.2,
  };
  if (jsonMode) body.response_format = { type: 'json_object' };

  const started = Date.now();
  const response = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  const parsed = JSON.parse(text);
  console.log(`\n=== ${label} · ${model} · ${withMeta ? 'with meta' : 'title+url'} ===`);
  console.log(`status ${response.status} · ${Date.now() - started}ms · tokens ${parsed.usage?.total_tokens}`);
  const content = parsed.choices?.[0]?.message?.content ?? '';
  let result;
  try {
    result = JSON.parse(content);
  } catch {
    console.log('raw:', content.slice(0, 800));
    return;
  }
  for (const entry of result.items ?? []) {
    const item = items.find((value) => value.id === entry.id);
    console.log(
      `${entry.id} ${item?.url}\n  ${entry.category}/${entry.subcategory} · ${entry.description}`,
    );
  }
}

await run(
  jsonMode ? '9B baseline' : 'Air baseline',
  false,
);
if (process.env.WITH_META === '1') {
  await run(
    jsonMode ? '9B enriched' : 'Air enriched',
    true,
  );
}
