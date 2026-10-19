import { describe, expect, it } from 'vitest';
import { normalizeSettings } from '../lib/store';

describe('normalizeSettings', () => {
  it('starts empty when nothing was configured', () => {
    const settings = normalizeSettings(undefined);
    expect(settings.baseUrl).toBe('');
    expect(settings.model).toBe('');
    expect(settings.apiKey).toBe('');
  });

  it('migrates the old nine-category default to the five-category set', () => {
    const settings = normalizeSettings({
      categories: [
        { name: '设计灵感' },
        { name: 'UI 与素材' },
        { name: 'AI 工具' },
        { name: '开发与代码' },
        { name: '效率与办公' },
        { name: '资讯与社区' },
        { name: '学习与文档' },
        { name: '生活与服务' },
        { name: '未分类' },
      ],
    });
    const names = settings.categories.map((category) => category.name);
    expect(names).toContain('设计资源');
    expect(names).toContain('阅读与资讯');
    expect(names).toContain('未分类');
    expect(names).not.toContain('设计灵感');
  });

  it('keeps a custom category list', () => {
    const settings = normalizeSettings({
      categories: [{ name: '我的分类' }, { name: '未分类' }],
    });
    expect(settings.categories.map((category) => category.name)).toEqual([
      '我的分类',
      '未分类',
    ]);
  });

  it('defaults to 40 per batch', () => {
    expect(normalizeSettings(undefined).batchSize).toBe(40);
  });
});
