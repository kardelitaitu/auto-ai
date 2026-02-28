import { api } from '../api/index.js';
import { createLogger } from '../utils/logger.js';

export default async function puterTestTask(page, _payload) {
    const logger = createLogger(`puterTestTask.js`);

    logger.info('🚀 Starting Basic Puter Chat...');

    return await api.withPage(page, async () => {
        try {
            await api.init(page, { logger });

            // 1. Navigate to Google to provide a "Real" origin (fixes IndexedDB error)
            logger.info('🌐 Navigating to Google (establishing real origin)...');
            await api.goto('https://www.google.com', { waitUntil: 'domcontentloaded' });

            // 2. Refresh models (Sync with local DB)
            logger.info('🔄 Syncing models...');
            await api.puter.refreshModels();

            // 3. Set a model and chat
            api.puter.setSmart('gpt-4o-mini', true);
            api.puter.rate('gpt-4o-mini', 10);

            logger.info('💬 Sending basic chat request...');
            const response = await api.puter('Tell me a short joke.');
            
            return { success: true, response };
        } catch (error) {
            logger.error(`❌ Task failed: ${error.message}`);
            return { success: false, error: error.message };
        }
    });
}
