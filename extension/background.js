importScripts('lib.js');

const MENU_ID = 'verilens-check-image';

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: MENU_ID,
    title: 'Check with VeriLens',
    contexts: ['image']
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID || !tab?.id) return;

  const show = (payload) => chrome.tabs.sendMessage(tab.id, { type: 'verilens', ...payload }).catch(() => {});

  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['lib.js', 'content.js'] });
  } catch {
    // Browser-internal pages (chrome://, Web Store) can't be scripted
    chrome.action.setBadgeText({ text: '!', tabId: tab.id });
    chrome.action.setBadgeBackgroundColor({ color: '#6B1D2A', tabId: tab.id });
    return;
  }

  const settings = await VL.getSettings();
  show({ state: 'loading', imageUrl: info.srcUrl });

  try {
    const blob = await VL.fetchImage(info.srcUrl);
    const name = decodeURIComponent((info.srcUrl.split('?')[0].split('/').pop() || 'image').slice(0, 80));
    const data = await VL.analyze(blob, name, settings);
    show({ state: 'result', imageUrl: info.srcUrl, html: VL.renderReport(data), appUrl: settings.appUrl });
  } catch (err) {
    show({ state: 'error', imageUrl: info.srcUrl, message: err.message });
  }
});
