import { createLogger } from '../api/utils/logger.js';

const logger = createLogger('hanging-task.js');

export default async function (page, payload) {
    const timeout = payload.hangTime || 10000;
    logger.info(`Starting hanging task for ${timeout}ms...`);

    return new Promise((resolve) => {
        setTimeout(() => {
            logger.info('Hanging task finally resolved (this should not be seen if timed out)');
            resolve({ success: true });
        }, timeout);
    });
}
