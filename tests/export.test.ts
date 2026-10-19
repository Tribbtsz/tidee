import { describe, expect, it } from 'vitest';
import { treeToNetscapeHtml } from '../lib/export';

const tree = [
  {
    id: '0',
    title: '',
    children: [
      {
        id: '1',
        title: '收藏夹栏',
        children: [
          {
            id: '10',
            title: 'Figma & <Design>',
            url: 'https://figma.com/?a=1&b=2',
            dateAdded: 1700000000000,
          },
        ],
      },
      {
        id: '2',
        title: '其他收藏夹',
        children: [
          {
            id: '20',
            title: 'UI',
            children: [
              { id: '21', title: 'Dribbble', url: 'https://dribbble.com', dateAdded: 1700000000000 },
            ],
          },
        ],
      },
    ],
  },
] as unknown as chrome.bookmarks.BookmarkTreeNode[];

describe('treeToNetscapeHtml', () => {
  const html = treeToNetscapeHtml(tree);

  it('starts with the Netscape header', () => {
    expect(html.startsWith('<!DOCTYPE NETSCAPE-Bookmark-file-1>')).toBe(true);
    expect(html).toContain('<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">');
  });

  it('escapes titles and URLs', () => {
    expect(html).toContain('Figma &amp; &lt;Design&gt;');
    expect(html).toContain('HREF="https://figma.com/?a=1&amp;b=2"');
  });

  it('keeps folder nesting', () => {
    expect(html).toContain('<H3 ADD_DATE=');
    expect(html).toContain('UI');
    expect(html).toContain('Dribbble');
  });

  it('uses seconds for ADD_DATE', () => {
    expect(html).toContain('ADD_DATE="1700000000"');
  });
});
