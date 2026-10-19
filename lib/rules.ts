import { hostOf } from './url';

interface HostRule {
  hosts: string[];
  category: string;
  subcategory: string;
}

/**
 * A few hosts are unambiguous enough that a small model should not be allowed
 * to overrule them. Everything else still comes from the model.
 */
const HOST_RULES: HostRule[] = [
  { hosts: ['github.com', 'gist.github.com'], category: 'AI 与开发', subcategory: '代码托管' },
  { hosts: ['figma.com'], category: '设计资源', subcategory: '设计工具' },
  { hosts: ['mail.google.com', 'wx.mail.qq.com'], category: '效率工具', subcategory: '邮箱' },
  { hosts: ['docs.qq.com'], category: '效率工具', subcategory: '在线文档' },
  { hosts: ['google.com'], category: '效率工具', subcategory: '搜索引擎' },
  {
    hosts: ['claude.ai', 'chat.deepseek.com', 'yuanbao.tencent.com'],
    category: 'AI 与开发',
    subcategory: 'AI 助手',
  },
];

const CONTENT_RULES: Array<{ test: RegExp; category: string; subcategory: string }> = [
  {
    test: /博客|blog|周刊|周报|文章|随笔|专栏|日志/i,
    category: '阅读与资讯',
    subcategory: '博客',
  },
  {
    test: /(?:\bai\b|llm|gpt|claude|deepseek|大模型|智能体|agent|提示词|prompt)/i,
    category: 'AI 与开发',
    subcategory: 'AI 工具',
  },
  {
    test: /设计|ui|ux|组件|图标|插画|字体|模板|配色|灵感|作品集|logo|figma/i,
    category: '设计资源',
    subcategory: '设计资源',
  },
  {
    test: /邮箱|mail|笔记|文档|docs|表格|协作|搜索|日历/i,
    category: '效率工具',
    subcategory: '效率工具',
  },
  {
    test: /社区|论坛|视频|直播|新闻|社交|twitter|x\.com|bilibili/i,
    category: '阅读与资讯',
    subcategory: '资讯',
  },
  {
    test: /购物|餐厅|美食|旅行|金融|影音|电影|剧集|直播/i,
    category: '生活服务',
    subcategory: '生活',
  },
];

export function applyContentFallback(
  title: string,
  url: string,
  description: string,
  availableCategories: string[],
): { category: string; subcategory: string } | null {
  const text = `${title} ${url} ${description}`;
  for (const rule of CONTENT_RULES) {
    if (!rule.test.test(text)) continue;
    if (!availableCategories.includes(rule.category)) continue;
    return { category: rule.category, subcategory: rule.subcategory };
  }
  return null;
}

export function applyHostRule(
  url: string,
  category: string,
  subcategory: string,
): { category: string; subcategory: string; applied: boolean } {
  const host = hostOf(url);
  if (!host) return { category, subcategory, applied: false };

  for (const rule of HOST_RULES) {
    if (!rule.hosts.includes(host)) continue;
    return {
      category: rule.category,
      subcategory: rule.subcategory,
      applied: true,
    };
  }
  return { category, subcategory, applied: false };
}
