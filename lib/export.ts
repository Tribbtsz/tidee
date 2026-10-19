import type { MetaMap } from './types';
import type { BookmarkNode } from './bookmarks';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function seconds(dateAdded?: number): number {
  return Math.floor((dateAdded ?? Date.now()) / 1000);
}

function renderNodes(nodes: BookmarkNode[], depth: number): string {
  const pad = '  '.repeat(depth);
  let html = '';
  for (const node of nodes) {
    if (node.url) {
      html += `${pad}<DT><A HREF="${escapeHtml(node.url)}" ADD_DATE="${seconds(node.dateAdded)}">${escapeHtml(
        node.title || node.url,
      )}</A>\n`;
    } else {
      html += `${pad}<DT><H3 ADD_DATE="${seconds(node.dateAdded)}">${escapeHtml(
        node.title || '未命名文件夹',
      )}</H3>\n`;
      html += `${pad}<DL><p>\n`;
      html += renderNodes(node.children ?? [], depth + 1);
      html += `${pad}</DL><p>\n`;
    }
  }
  return html;
}

export function treeToNetscapeHtml(tree: BookmarkNode[]): string {
  const roots = tree[0]?.children ?? [];
  return `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<!-- This is an automatically generated file. It will be read and overwritten. DO NOT EDIT! -->
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
${renderNodes(roots, 1)}</DL><p>
`;
}

export function treeToJson(tree: BookmarkNode[]): string {
  return JSON.stringify(tree, null, 2);
}

export function metaToJson(meta: MetaMap): string {
  return JSON.stringify(
    {
      app: 'tidee',
      version: 1,
      exportedAt: new Date().toISOString(),
      count: Object.keys(meta).length,
      items: meta,
    },
    null,
    2,
  );
}

export function downloadText(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function backupFilename(prefix: string, extension: string): string {
  const now = new Date();
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    '-',
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
  ].join('');
  return `${prefix}-${stamp}.${extension}`;
}
