import type { CategoryDef, Settings } from './types';

export const UNCATEGORIZED = '未分类';

export const DEFAULT_CATEGORIES: CategoryDef[] = [
  { name: '设计资源', description: '设计灵感、作品集、UI 组件、图标、插画、配色、字体和模板' },
  { name: 'AI 与开发', description: 'AI 模型与助手、编程、框架、代码片段和开发者工具' },
  { name: '阅读与资讯', description: '个人与技术博客、周刊、文章、社交媒体、论坛、视频和新闻' },
  { name: '效率工具', description: '搜索引擎、邮箱、笔记、文档、协作和日常工具' },
  { name: '生活服务', description: '购物、餐饮、出行、影音、金融和生活服务' },
];

export const DEFAULT_SETTINGS: Settings = {
  version: 1,
  baseUrl: '',
  apiKey: '',
  model: '',
  temperature: 0.2,
  batchSize: 40,
  concurrency: 2,
  jsonMode: true,
  categories: DEFAULT_CATEGORIES,
  rootFolderName: 'tidee',
  destination: 'other',
  useSubcategories: false,
  autoAnalyze: true,
  autoIntervalMinutes: 1440,
  theme: 'system',
};

export const ROOT_FOLDER_FALLBACK = 'tidee';
export const MAX_BATCH_SIZE = 50;
