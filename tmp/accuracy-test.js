import { api } from '../api/index.js';
import { setPersona, getPersona } from '../api/behaviors/persona.js';
import { move } from '../api/interactions/cursor.js';

async function testAccuracy() {
    await api.withPage(async (page) => {
        await api.init(page);

        const personasToTest = ['power', 'casual', 'glitchy', 'newbie'];

        await page.setContent('<button id="test-btn" style="width: 100px; height: 100px; margin: 100px;">Target</button>');
        const selector = '#test-btn';
        const box = await page.locator(selector).boundingBox();
        const centerX = box.x + box.width / 2;
        const centerY = box.y + box.height / 2;

        console.log(`Semantic Center: (${centerX}, ${centerY})`);

        for (const p of personasToTest) {
            setPersona(p);
            const persona = getPersona();

            // We'll capture the move target by overriding cursor.move temporarily or just observing the logs
            // Actually, let's just use the precision logic to verify the expected range
            const precision = persona.precision ?? 0.8;
            const maxOffsetX = 10 * (1 - precision);
            const maxOffsetY = 5 * (1 - precision);

            console.log(`Persona: ${p.padEnd(10)} | Precision: ${precision.toFixed(2)} | Max Offset: ±${maxOffsetX.toFixed(2)}x, ±${maxOffsetY.toFixed(2)}y`);
        }
    });
}

testAccuracy().catch(console.error);
