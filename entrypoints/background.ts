import {
  AUTO_ALARM,
  AUTO_SOON_ALARM,
  runAutoAnalysis,
  scheduleAutoSoon,
  syncAutoAlarm,
} from '../lib/auto';
import { readMeta, readSettings, STORAGE_KEYS, writeMeta } from '../lib/store';
import { urlKey } from '../lib/url';

async function runScheduledAnalysis(): Promise<void> {
  await chrome.action.setBadgeBackgroundColor({ color: '#6f756f' });
  await chrome.action.setBadgeText({ text: '…' });
  try {
    const result = await runAutoAnalysis();
    if (result?.remaining) {
      await scheduleAutoSoon(120_000);
    }
  } catch (error) {
    console.warn('[tidee] automatic analysis failed', error);
  } finally {
    await chrome.action.setBadgeText({ text: '' });
  }
}

async function scheduleForNewBookmark(): Promise<void> {
  const settings = await readSettings();
  if (!settings.autoAnalyze || !settings.baseUrl || !settings.model) return;
  await scheduleAutoSoon(60_000);
}

async function removeMetaForNode(node: chrome.bookmarks.BookmarkTreeNode): Promise<void> {
  if (!node.url) return;
  const meta = await readMeta();
  const key = urlKey(node.url);
  if (!meta[key]) return;
  delete meta[key];
  await writeMeta(meta);
}

export default defineBackground(() => {
  chrome.runtime.onInstalled.addListener(() => {
    chrome.action.setTitle({ title: 'tidee · 收藏整理' });
    void syncAutoAlarm();
  });

  chrome.runtime.onStartup.addListener(() => {
    void syncAutoAlarm();
  });

  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name !== AUTO_ALARM && alarm.name !== AUTO_SOON_ALARM) return;
    void runScheduledAnalysis();
  });

  chrome.bookmarks.onCreated.addListener((_id, node) => {
    if (!node.url) return;
    void scheduleForNewBookmark();
  });

  chrome.bookmarks.onRemoved.addListener((_id, info) => {
    void removeMetaForNode(info.node);
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes[STORAGE_KEYS.settings]) void syncAutoAlarm();
  });

  void syncAutoAlarm();

  chrome.action.onClicked.addListener(async () => {
    const url = chrome.runtime.getURL('dashboard.html');
    const tabs = await chrome.tabs.query({});
    const existing = tabs.find(
      (tab) => tab.url === url || tab.url?.startsWith(`${url}#`),
    );
    if (existing?.id) {
      await chrome.tabs.update(existing.id, { active: true });
      if (existing.windowId) {
        await chrome.windows.update(existing.windowId, { focused: true });
      }
      return;
    }
    await chrome.tabs.create({ url });
  });
});
