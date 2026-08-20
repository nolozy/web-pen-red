// Toolbar icon click -> toggle the mini toolbar on the active tab.
chrome.action.onClicked.addListener((tab) => {
  if (!tab || tab.id === undefined) return;
  chrome.tabs.sendMessage(tab.id, { type: 'WEB_PEN_RED_TOGGLE' }, () => {
    // Pages such as chrome://, the Web Store or PDF viewers cannot host a
    // content script. Swallow the resulting "no receiving end" error.
    void chrome.runtime.lastError;
  });
});
