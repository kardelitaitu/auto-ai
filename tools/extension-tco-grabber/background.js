// background.js
const { chrome } = globalThis;
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'LINKS_FOUND') {
        const newLinks = request.links;

        chrome.storage.local.get(['tco_links'], (result) => {
            const existing = result.tco_links || [];
            let addedCount = 0;

            newLinks.forEach(link => {
                if (!existing.includes(link)) {
                    existing.push(link);
                    addedCount++;
                }
            });

            if (addedCount > 0) {
                chrome.storage.local.set({ tco_links: existing }, () => {
                    console.log(`[Background] Stored ${addedCount} new links. Total: ${existing.length}`);
                    updateBadge(existing.length);
                });
            } else {
                updateBadge(existing.length);
            }
        });
    }
});

function updateBadge(count) {
    chrome.action.setBadgeText({ text: count.toString() });
    chrome.action.setBadgeBackgroundColor({ color: '#1da1f2' });
}
