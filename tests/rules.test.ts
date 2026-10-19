import { describe, expect, it } from 'vitest';
import { applyContentFallback, applyHostRule } from '../lib/rules';

describe('applyHostRule', () => {
  it('corrects unambiguous hosts', () => {
    expect(applyHostRule('https://github.com/user/repo', '设计资源', '灵感')).toEqual({
      category: 'AI 与开发',
      subcategory: '代码托管',
      applied: true,
    });
  });

  it('handles www and subdomains', () => {
    expect(applyHostRule('https://www.figma.com/file/x', '未分类', '').category).toBe('设计资源');
    expect(applyHostRule('https://mail.google.com/mail/u/0', '未分类', '').category).toBe('效率工具');
  });

  it('leaves unknown hosts untouched', () => {
    expect(applyHostRule('https://example.com/post', '阅读与资讯', '个人博客')).toEqual({
      category: '阅读与资讯',
      subcategory: '个人博客',
      applied: false,
    });
  });

  it('does not match lookalike domains', () => {
    expect(applyHostRule('https://notgithub.com/x', '设计资源', '').applied).toBe(false);
  });
});

describe('applyContentFallback', () => {
  const categories = ['设计资源', 'AI 与开发', '阅读与资讯', '效率工具', '生活服务', '未分类'];

  it('rescues blogs into reading', () => {
    expect(
      applyContentFallback('某某的博客', 'https://example.com', '', categories),
    ).toEqual({ category: '阅读与资讯', subcategory: '博客' });
  });

  it('rescues AI tools', () => {
    expect(
      applyContentFallback('Claude', 'https://claude.ai', '', categories),
    ).toEqual({ category: 'AI 与开发', subcategory: 'AI 工具' });
  });

  it('rescues design resources', () => {
    expect(
      applyContentFallback('图标库', 'https://example.com/icons', '', categories),
    ).toEqual({ category: '设计资源', subcategory: '设计资源' });
  });

  it('returns null when nothing matches', () => {
    expect(applyContentFallback('某个页面', 'https://example.com', '', categories)).toBeNull();
  });

  it('respects a custom category list', () => {
    expect(applyContentFallback('某某的博客', 'https://example.com', '', ['设计资源'])).toBeNull();
  });
});
