const { chrome } = globalThis;

document.addEventListener('DOMContentLoaded', () => {
    const totalCountEl = document.getElementById('totalCount');
    const statusMsg = document.getElementById('statusMsg');

    // Load initial stats
    updateStats();

    // Listen for updates from background
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local' && changes.tco_links) {
            updateStats();
        }
    });


    // --- BUTTON HANDLERS ---

    document.getElementById('downloadBtn').addEventListener('click', async () => {
        const stored = await chrome.storage.local.get(['tco_links']);
        const allLinks = stored.tco_links || [];

        if (allLinks.length === 0) {
            statusMsg.textContent = "Nothing to download yet.";
            return;
        }

        const jsonStr = JSON.stringify(allLinks, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

        chrome.downloads.download({
            url: url,
            filename: `tco_links_${timestamp}.json`,
            saveAs: true
        });

        statusMsg.textContent = "Download started!";
    });

    document.getElementById('clearBtn').addEventListener('click', () => {
        if (confirm("Are you sure you want to clear all stored links?")) {
            chrome.storage.local.set({ tco_links: [] }, () => {
                updateStats();
                statusMsg.textContent = "Storage cleared.";
            });
        }
    });

    // --- HELPERS ---

    async function updateStats() {
        const stored = await chrome.storage.local.get(['tco_links']);
        const count = stored.tco_links ? stored.tco_links.length : 0;
        totalCountEl.textContent = count;
    }

    async function saveLinks(newLinks) {
        return new Promise((resolve) => {
            chrome.storage.local.get(['tco_links'], (result) => {
                const existing = result.tco_links || [];
                let added = 0;

                newLinks.forEach(link => {
                    if (!existing.includes(link)) {
                        existing.push(link);
                        added++;
                    }
                });

                chrome.storage.local.set({ tco_links: existing }, () => {
                    resolve(added);
                });
            });
        });
    }
});
