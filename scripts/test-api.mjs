const base = (process.env.API_BASE || 'https://api.siliconflow.cn/v1').replace(/\/+$/, '');
const key = process.env.API_KEY;
const model = process.env.API_MODEL || 'GLM-4-9B-0414';

if (!key) {
  console.error('API_KEY missing');
  process.exit(1);
}

const endpoint = `${base}/chat/completions`;

async function chat(label, body) {
  const started = Date.now();
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(body),
  });
  const latency = Date.now() - started;
  const text = await response.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = { raw: text.slice(0, 800) };
  }
  console.log(`\n=== ${label} ===`);
  console.log(`status: ${response.status}  latency: ${latency}ms`);
  console.log(JSON.stringify(parsed, null, 2).slice(0, 6000));
  return { status: response.status, parsed };
}

const categories = ['设计灵感', 'UI 与素材', 'AI 工具', '开发与代码', '资讯与社区', '未分类'];
const items = [
  {
    id: 'b0',
    title: '黑洞背景 - Inspira UI',
    url: 'https://inspira-ui.com/components/black-hole',
    folder: '其他收藏夹 / ui',
  },
  {
    id: 'b1',
    title: 'Free React credit card components | Untitled UI',
    url: 'https://www.untitledui.com/react/components/credit-cards',
    folder: '其他收藏夹 / ui',
  },
  {
    id: 'b2',
    title: 'X 上的 码农暖爸：推荐一个基于 WebGPU 的实时液态玻璃球编辑器',
    url: 'https://x.com/example/status/1234567890',
    folder: '其他收藏夹 / ui',
  },
  {
    id: 'b3',
    title: 'OpenModel | Multi-model LLM gateway and ops console',
    url: 'https://openmodel.ai',
    folder: '其他收藏夹',
  },
  {
    id: 'b4',
    title: '我这一生如履薄冰，你说，我能走到对岸吗？（21 岁生日总结）',
    url: 'https://my.minecraft.kim/blog/21',
    folder: '其他收藏夹',
  },
];

await chat('ping (json mode)', {
  model,
  messages: [
    { role: 'system', content: '只输出 JSON：{"ok":true}' },
    { role: 'user', content: 'ping' },
  ],
  max_tokens: 100,
  temperature: 0,
  response_format: { type: 'json_object' },
});

const system = `你是浏览器收藏整理引擎。为每条收藏输出一级分类、二级分类、中文描述和标签。
一级分类只能从给定列表中选择：${categories.join('、')}。
描述 20-45 个汉字，说明页面是什么、能用来做什么，不要复述标题。
标签 2-4 个。只输出 JSON，不要 Markdown。
格式：{"items":[{"id":"b0","category":"","subcategory":"","description":"","tags":[],"confidence":0.9}]}`;

await chat('classification (json mode)', {
  model,
  messages: [
    { role: 'system', content: system },
    { role: 'user', content: JSON.stringify({ items }) },
  ],
  max_tokens: 1600,
  temperature: 0.2,
  response_format: { type: 'json_object' },
});

await chat('plain text quality', {
  model,
  messages: [
    {
      role: 'system',
      content: '你是一个中文收藏整理助手，回答简洁准确。',
    },
    {
      role: 'user',
      content:
        '用一句话说明这个页面是什么、能用来做什么：https://inspira-ui.com/components/black-hole （标题：黑洞背景 - Inspira UI）',
    },
  ],
  max_tokens: 200,
  temperature: 0.3,
});
