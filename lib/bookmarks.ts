import type { AppliedItem, AppliedRecord, BookmarkItem, Destination, PlanCategory } from './types';
import { ROOT_FOLDER_FALLBACK } from './constants';
import { sanitizeFolderName } from './url';

export type BookmarkNode = chrome.bookmarks.BookmarkTreeNode;

export async function getTree(): Promise<BookmarkNode[]> {
  return chrome.bookmarks.getTree();
}

export function getRootNodes(tree: BookmarkNode[]): BookmarkNode[] {
  return tree[0]?.children ?? [];
}

export function destinationParentId(tree: BookmarkNode[], destination: Destination): string {
  const roots = getRootNodes(tree);
  const preferredId = destination === 'bar' ? '1' : '2';
  const preferred = roots.find((node) => node.id === preferredId);
  if (preferred) return preferred.id;
  const fallback = destination === 'bar' ? roots[0] : roots[1] ?? roots[0];
  if (!fallback) throw new Error('找不到 Edge 的收藏夹根目录');
  return fallback.id;
}

export function flattenTree(tree: BookmarkNode[]): BookmarkItem[] {
  const output: BookmarkItem[] = [];

  const walk = (node: BookmarkNode, path: string, parentId: string) => {
    for (const child of node.children ?? []) {
      if (child.url) {
        output.push({
          id: child.id,
          title: child.title || child.url,
          url: child.url,
          parentId,
          folderPath: path,
          dateAdded: child.dateAdded,
        });
      } else {
        const nextPath = path ? `${path} / ${child.title}` : child.title;
        walk(child, nextPath, child.id);
      }
    }
  };

  for (const root of getRootNodes(tree)) {
    walk(root, root.title, root.id);
  }
  return output;
}

export function findNode(tree: BookmarkNode[], id: string): BookmarkNode | undefined {
  const stack = [...tree];
  while (stack.length > 0) {
    const node = stack.pop()!;
    if (node.id === id) return node;
    if (node.children) stack.push(...node.children);
  }
  return undefined;
}

export function isDescendantOf(
  tree: BookmarkNode[],
  nodeId: string,
  ancestorId: string,
): boolean {
  const ancestor = findNode(tree, ancestorId);
  if (!ancestor) return false;
  return findNode(ancestor.children ?? [], nodeId) !== undefined;
}

async function getChildren(parentId: string): Promise<BookmarkNode[]> {
  return chrome.bookmarks.getChildren(parentId);
}

async function ensureChildFolder(
  parentId: string,
  title: string,
): Promise<{ id: string; created: boolean }> {
  const safeTitle = sanitizeFolderName(title, ROOT_FOLDER_FALLBACK);
  const children = await getChildren(parentId);
  const existing = children.find((child) => !child.url && child.title === safeTitle);
  if (existing) return { id: existing.id, created: false };
  const created = await chrome.bookmarks.create({ parentId, title: safeTitle });
  return { id: created.id, created: true };
}

export interface ApplyOptions {
  destination: Destination;
  rootFolderName: string;
  rootId?: string;
  useSubcategories: boolean;
}

export async function applyPlan(
  plan: PlanCategory[],
  options: ApplyOptions,
): Promise<AppliedRecord> {
  const tree = await getTree();
  const parentId = destinationParentId(tree, options.destination);
  const rootName = sanitizeFolderName(options.rootFolderName, ROOT_FOLDER_FALLBACK);

  let rootId = options.rootId;
  const createdFolderIds: string[] = [];

  if (!rootId) {
    const root = await ensureChildFolder(parentId, rootName);
    rootId = root.id;
    if (root.created) createdFolderIds.push(root.id);
  }

  const items: AppliedItem[] = [];
  const movedIds = new Set<string>();

  for (const category of plan) {
    const categoryFolder = await ensureChildFolder(rootId!, category.name);
    if (categoryFolder.created) createdFolderIds.push(categoryFolder.id);

    for (const sub of category.subcategories) {
      let targetId = categoryFolder.id;
      if (options.useSubcategories && sub.name !== '其他' && sub.items.length > 0) {
        const subFolder = await ensureChildFolder(categoryFolder.id, sub.name);
        if (subFolder.created) createdFolderIds.push(subFolder.id);
        targetId = subFolder.id;
      }

      for (const item of sub.items) {
        if (movedIds.has(item.bookmark.id)) continue;
        try {
          const [current] = await chrome.bookmarks.get(item.bookmark.id);
          if (!current || current.parentId === targetId) continue;
          const originalParentId = current.parentId ?? '';
          await chrome.bookmarks.move(item.bookmark.id, { parentId: targetId });
          items.push({
            id: item.bookmark.id,
            url: item.bookmark.url,
            originalParentId,
          });
          movedIds.add(item.bookmark.id);
        } catch {
          // A bookmark may have been deleted while the dashboard was open.
        }
      }
    }
  }

  return {
    at: Date.now(),
    rootId: rootId!,
    rootName,
    moved: items.length,
    items,
    createdFolderIds,
  };
}

export async function undoApply(record: AppliedRecord): Promise<{ moved: number; missing: number }> {
  let moved = 0;
  let missing = 0;

  for (const item of [...record.items].reverse()) {
    try {
      const [node] = await chrome.bookmarks.get(item.id);
      if (!node) {
        missing += 1;
        continue;
      }
      if (!item.originalParentId) {
        missing += 1;
        continue;
      }
      const parent = await chrome.bookmarks.get(item.originalParentId).catch(() => undefined);
      if (!parent?.length) {
        missing += 1;
        continue;
      }
      await chrome.bookmarks.move(item.id, { parentId: item.originalParentId });
      moved += 1;
    } catch {
      missing += 1;
    }
  }

  for (const folderId of [...record.createdFolderIds].reverse()) {
    try {
      const children = await getChildren(folderId);
      if (children.length === 0) await chrome.bookmarks.remove(folderId);
    } catch {
      // Folder already gone or no longer removable.
    }
  }

  return { moved, missing };
}
