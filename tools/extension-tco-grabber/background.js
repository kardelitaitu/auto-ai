(() => {
    const chromeApi = globalThis["chrome"];
    if (!chromeApi) {
        throw new Error('Chrome API unavailable');
    }
    chromeApi.runtime.onMessage.addListener((request, _sender, _sendResponse) => {
        if (request.type === 'LINKS_FOUND') {
            const newLinks = request.links;

            chromeApi.storage.local.get(['tco_links'], (result) => {
                const existing = result.tco_links || [];
                let addedCount = 0;

                newLinks.forEach(link => {
                    if (!existing.includes(link)) {
                        existing.push(link);
                        addedCount++;
                    }
                });

                if (addedCount > 0) {
                    chromeApi.storage.local.set({ tco_links: existing }, () => {
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
        chromeApi.action.setBadgeText({ text: count.toString() });
        chromeApi.action.setBadgeBackgroundColor({ color: '#1da1f2' });
    }
})();
