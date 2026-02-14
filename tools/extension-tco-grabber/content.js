(() => {
    const chromeApi = globalThis["chrome"];
    if (!chromeApi) {
        throw new Error('Chrome API unavailable');
    }
    let collectedLinks = new Set();
    let debounceTimer = null;

    function scan() {
        const links = Array.from(document.querySelectorAll('a[href*="t.co/"]'));
        const newBatch = [];

        links.forEach(link => {
            if (!(link instanceof HTMLAnchorElement)) return;
            const href = link.href;
            if (href && !collectedLinks.has(href)) {
                collectedLinks.add(href);
                newBatch.push(href);
            }
        });

        if (newBatch.length > 0) {
            console.log(`[t.co Grabber] Found ${newBatch.length} new links.`);
            chromeApi.runtime.sendMessage({ type: 'LINKS_FOUND', links: newBatch });
        }
    }

    // Initial Scan
    scan();

    // Observer for infinite scroll
    const observer = new MutationObserver(() => {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(scan, 1000); // Scan 1s after DOM settles
    });

    observer.observe(document.body, { childList: true, subtree: true });

    console.log("[t.co Grabber] Auto-scanner active.");
})();
