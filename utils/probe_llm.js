
import http from 'http';
import { fileURLToPath } from 'url';

export const PORTS = [12434, 11434, 8080, 5000];
export const PATHS = [
    '/v1/models',
    '/api/tags', // Ollama
    '/models',
    '/v1/chat/completions'
];

export async function check(port, path) {
    return new Promise((resolve) => {
        const req = http.get({
            hostname: 'localhost',
            port: port,
            path: path,
            timeout: 1000
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 200 || res.statusCode === 404 || res.statusCode === 405) {
                    console.log(`[FOUND] Port ${port}${path} -> Status ${res.statusCode}`);
                    resolve(true);
                } else {
                    resolve(false);
                }
            });
        });

        req.on('error', () => {
            resolve(false);
        });

        req.on('timeout', () => {
            req.destroy();
            resolve(false);
        });
    });
}

export async function probeAll() {
    console.log("Probing LLM endpoints...");
    for (const port of PORTS) {
        let portAlive = false;
        for (const path of PATHS) {
            const found = await check(port, path);
            if (found) portAlive = true;
        }
        if (!portAlive) console.log(`[Checking] Port ${port} seems closed or unresponsive.`);
    }
}

// Run if main module
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    probeAll();
}
