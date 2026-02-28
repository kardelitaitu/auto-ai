/**
 * prompt-test.js
 * Standalone test: logs exactly what gets sent to the LLM and what comes back.
 * Run: node prompt-test.js
 */

import { REPLY_SYSTEM_PROMPT, buildReplyPrompt } from './utils/twitter-reply-prompt.js';
import { ensureOllama } from './utils/local-ollama-manager.js';
import openrouterFetch, { loadPrimaryModel as loadOpenRouterModel } from './utils/openrouter-key-manager.js';
import apifreellmFetch, { loadApiFreeLLMConfig } from './utils/apifreellm-manager.js';
import { readFile } from 'fs/promises';
import { resolve } from 'path';

// ─── Internal Ollama Fetch Utility ──────────────────────────────────────────
async function ollamaFetch(path, body, endpoint) {
    const isChat = path === '/v1/chat/completions';
    const url = `${endpoint.replace(/\/$/, '')}${isChat ? '/api/chat' : path}`;

    const isThinkingModel = body.model && (
        body.model.toLowerCase().includes('think') ||
        body.model.toLowerCase().includes('r1') ||
        body.model.toLowerCase().includes('reason')
    );

    const reqBody = isChat ? {
        model: body.model,
        messages: body.messages,
        options: {
            temperature: body.temperature,
            num_predict: body.max_tokens
        },
        stream: body.stream ?? false,
        ...(isThinkingModel ? { think: true } : {})
    } : body;

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reqBody)
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Ollama error (${response.status}): ${errText}`);
    }

    const json = await response.json();

    if (isChat) {
        return {
            choices: [{
                message: {
                    content: json.message?.content || '',
                    reasoning: json.message?.reasoning || null
                }
            }],
            usage: {
                prompt_tokens: json.prompt_eval_count || 0,
                completion_tokens: json.eval_count || 0,
                total_tokens: (json.prompt_eval_count || 0) + (json.eval_count || 0)
            }
        };
    }
    return json;
}

// ─── Config Loader ──────────────────────────────────────────────────────────
async function getActiveLLM() {
    const raw = await readFile(resolve(process.cwd(), 'config/settings.json'), 'utf8');
    const settings = JSON.parse(raw);

    // Priority 1: Local Ollama
    if (settings.llm?.local?.enabled) {
        await ensureOllama();
        const endpoint = settings.llm.local.endpoint || 'http://localhost:11434';
        const model = settings.llm.local.model || 'hermes3:8b';
        return {
            name: 'Ollama',
            model: model,
            fetch: async (path, body) => ollamaFetch(path, body, endpoint)
        };
    }

    // Priority 2: OpenRouter (Free API)
    if (settings.open_router_free_api?.enabled) {
        const model = await loadOpenRouterModel();
        return {
            name: 'OpenRouter',
            model: model,
            fetch: async (path, body) => openrouterFetch('/chat/completions', body)
        };
    }

    // Priority 3: ApiFreeLLM
    if (settings.llm?.apifreellm?.enabled) {
        return {
            name: 'ApiFreeLLM',
            model: 'default',
            fetch: async (path, body) => {
                const combined = `${body.messages.find(m => m.role === 'system').content}\n\n${body.messages.find(m => m.role === 'user').content}`;
                const res = await apifreellmFetch('/chat', combined);
                return { choices: [{ message: { content: res.response } }] };
            }
        };
    }

    throw new Error('No LLM provider enabled in settings.json');
}

const activeLLM = await getActiveLLM();
const LLM_MODEL = activeLLM.model;
const LLM_PROVIDER = activeLLM.name;

// ─── Test Tweets ───────────────────────────────────────────────────────────
const TESTS = [
    {
        label: 'Tech Thread',
        author: 'technews',
        tweet: 'Just discovered that AI can now write code better than most junior developers. The future is here.',
        replies: [
            { author: 'dev1', text: 'This is terrifying for new grads honestly' },
            { author: 'coder42', text: 'Meanwhile I still cant get AI to center a div' },
            { author: 'skeptical_sam', text: 'Give it a few years and it will be writing entire microservices' },
            { author: 'senior_lead', text: 'It writes the code, but can it explain *why* it chose that specific pattern? Doubt it.' },
            { author: 'stack_overflow_vet', text: 'RIP to my reputation points. AI is the new Google.' },
            { author: 'product_pro', text: 'If it speeds up the MVP phase, I am all for it. Juniors need to level up to architects.' },
            { author: 'bug_hunter', text: 'I spent 3 hours debugging AI code yesterday. It was confident, but completely wrong.' },
            { author: 'frontend_fan', text: 'Still waiting for it to handle complex CSS animations without losing its mind.' },
            { author: 'backend_guru', text: 'The logic is 80% there, but the edge cases are where the real engineering happens.' },
            { author: 'ai_optimist', text: 'This just means we get to spend more time on high-level strategy and less on boilerplate.' },
            { author: 'security_first', text: 'Hope people realize the security risks of blindly pasting AI-generated snippets.' },
            { author: 'old_school_c', text: 'Wake me up when it can manage memory as well as a human in C++.' },
            { author: 'career_coach', text: 'Juniors: Start learning how to prompt and audit. That is your new job description.' },
            { author: 'open_source_hero', text: 'Is the training data even legal? The licensing discussion is going to be a mess.' },
            { author: 'no_code_nic', text: 'First it was low-code, now its AI. The barrier to entry is officially gone.' },
            { author: 'crypto_coder', text: 'Wait until we integrate this into smart contract auditing. Game changer.' },
            { author: 'ui_ux_designer', text: 'Coding is one thing. Understanding user empathy is another.' },
            { author: 'data_viz_expert', text: 'It handled my Python data cleaning script in seconds. I am impressed.' },
            { author: 'embedded_guy', text: 'I would like to see it write a driver for a custom FPGA. Then we can talk.' },
            { author: 'quantum_leap', text: 'We are just scratching the surface. This is the 1990s internet moment for dev.' }
        ],
    },
    {
        label: 'Travel Thread',
        author: 'globetrotter_alex',
        tweet: 'Quit my 9-5 to travel the world with just a backpack. Best decision I ever made. ✈️🌍',
        replies: [
            { author: 'corporate_claire', text: 'I wish I had the courage (and the savings) to do this!' },
            { author: 'budget_nomad', text: 'Hostel life is great until you hit 30, then your back demands a hotel.' },
            { author: 'visa_guru', text: 'People always forget the nightmare of digital nomad visa paperwork.' },
            { author: 'pixel_perfect', text: 'Show us the "behind the scenes" of the 12-hour bus rides, not just the sunsets!' },
            { author: 'minimalist_max', text: 'Packing for a year in one 40L bag is the ultimate spatial reasoning game.' },
            { author: 'insurance_ian', text: 'Hope you got world-class travel insurance. One motorbike mishap and it’s over.' },
            { author: 'foodie_fernando', text: 'The street food in Vietnam will change your life. Don’t skip the back alleys.' },
            { author: 'wifi_seeker', text: 'How do you find stable internet in the middle of the jungle? Asking for a friend.' },
            { author: 'eco_traveler', text: 'The carbon footprint of "finding yourself" is getting harder to ignore.' },
            { author: 'local_lens', text: 'Please remember to respect local customs and not just treat countries like photo backdrops.' },
            { author: 'hidden_gem_hunter', text: 'Avoid the tourist traps in Bali; go north if you want the real experience.' },
            { author: 'solo_sara', text: 'Solo travel is the best therapy. You learn who you really are when your flight is canceled.' },
            { author: 'gear_head_99', text: 'What’s the camera setup? Those drone shots are crisp.' },
            { author: 'miles_and_points', text: 'Did you fund this with credit card churning or pure savings?' },
            { author: 'homesick_henry', text: 'I did it for 6 months and ended up missing my own bed and a reliable shower.' },
            { author: 'street_smart', text: 'Keep your passport in a hidden pouch. Pickpockets in Europe are pros.' },
            { author: 'remote_regina', text: 'Welcome to the club! Work-from-anywhere is a trap if you forget to actually explore.' },
            { author: 'language_learner', text: 'Did you learn the local phrases or are you just "loud Englishing" your way through?' },
            { author: 'jetlag_jerry', text: 'The first week is just me sleeping in different time zones. Not very glamorous.' },
            { author: 'future_traveler', text: 'Saved. This is the sign I needed to book that one-way ticket to Tokyo.' }
        ]
    },
    {
        label: 'Gaming Thread',
        author: 'esports_daily',
        tweet: 'Competitive gaming is more mentally exhausting than most traditional sports. The burnout rate is insane.',
        replies: [
            { author: 'sweaty_gamer', text: 'Bro try hitting a curveball, then we can talk about exhaustion.' },
            { author: 'starcraft_vet', text: 'APM required at the top level is literally destroying wrists. Physical toll is real.' },
            { author: 'casual_andy', text: 'You’re sitting in an ergonomic chair drinking G-Fuel. Let’s calm down.' },
            { author: 'psych_coach', text: 'The cognitive load required to track 10 players, cooldowns, and macro strategy simultaneously is unmatched.' },
            { author: 'fps_god', text: 'I play 12 hours a day and feel fine. Weak mental.' },
            { author: 'team_manager', text: 'We have literal sports psychologists on staff now just to keep our 19-year-olds from cracking.' },
            { author: 'boomer_bob', text: 'Go outside and touch grass.' },
            { author: 'mmo_grinder', text: 'Raid leading 40 people for 6 hours is peak leadership training, I don\'t care what anyone says.' },
            { author: 'coach_carter', text: 'Reaction times peak at 21 for esports. Traditional sports you can play into your 30s.' },
            { author: 'moba_main', text: 'The toxicity alone is enough to cause mental breakdowns.' }
        ]
    },
    {
        label: 'Crypto Thread',
        author: 'web3_whale',
        tweet: 'If you aren\'t holding at least 50% of your net worth in Bitcoin right now, you fundamentally don\'t understand macroeconomics.',
        replies: [
            { author: 'tradfi_tom', text: 'Or maybe we just like assets that actually produce cash flow?' },
            { author: 'laser_eyes', text: 'Have fun staying poor.' },
            { author: 'skeptic_sally', text: 'It\'s an unregulated casino heavily manipulated by tether printing. Stop giving financial advice.' },
            { author: 'bitcoin_maxi', text: 'Fiat is literally melting ice cubes. The halving is priced in, but the scarcity isn\'t.' },
            { author: 'altcoin_degen', text: 'BTC is boomer coin now. I\'m 100% in solana meme coins.' },
            { author: 'econ_professor', text: 'Bitcoin lacks the velocity to function as a currency and the stability to be a store of value.' },
            { author: 'tech_bro', text: 'The underlying blockchain tech is what matters. The price is just noise.' },
            { author: 'bag_holder', text: 'I bought at 70k. Please tell me it goes back up.' },
            { author: 'indexer_ira', text: 'I\'ll stick to my S&P 500 index funds. Low stress, guaranteed long-term returns.' },
            { author: 'macro_mike', text: 'Actually, looking at M2 money supply vs BTC market cap, this is the most asymmetric bet in history.' }
        ]
    },
    {
        label: 'Fitness Thread',
        author: 'iron_addict',
        tweet: 'Cardio is completely unnecessary for fat loss. Just lift heavy, eat protein, and stay in a caloric deficit. Stop wasting hours on the treadmill.',
        replies: [
            { author: 'runner_rick', text: 'Tell that to my cardiovascular health and resting heart rate of 45.' },
            { author: 'gym_bro', text: 'Cardio kills your gains bro.' },
            { author: 'science_lifter', text: 'Technically true for fat loss, but cardio increases your energy expenditure making the deficit easier to maintain.' },
            { author: 'yoga_yolanda', text: 'Not everything is about aesthetics. Movement is medicine.' },
            { author: 'power_peter', text: 'If you do squats for sets of 10, that IS cardio.' },
            { author: 'keto_karen', text: 'Actually, you just need to cut out carbs completely. Calories aren\'t real.' },
            { author: 'marathon_mary', text: 'I enjoy eating 3000 calories a day. Good luck doing that without running.' },
            { author: 'physio_phil', text: 'Your heart is a muscle too. Train it.' },
            { author: 'casual_steve', text: 'I just walk my dog for 30 minutes a day and I feel great.' },
            { author: 'bodybuilder_brian', text: 'Try cutting to 5% bodyfat without adding minimum 45 mins of incline walking a day. Impossible.' }
        ]
    },
    {
        label: 'Gaming/Hardware Thread',
        author: 'pc_master_race',
        tweet: 'Consoles are just overpriced, locked-down PCs from 4 years ago. If you aren’t building your own rig, you aren’t gaming properly.',
        replies: [
            { author: 'couch_potato', text: 'I just want to press one button and play from my sofa. Not everyone wants to troubleshoot drivers.' },
            { author: 'gpu_hoarder', text: 'Good luck building a PC that matches PS5 performance for the same price right now.' },
            { author: 'frame_hunter', text: 'If it’s not 165Hz UWQHD, I don’t even want to look at the screen.' },
            { author: 'nintendo_fan', text: 'Graphics don’t matter if the gameplay is boring. Gameplay > Teraflops.' },
            { author: 'modder_pro', text: 'Can you install a 100GB overhaul mod on a console? Case closed.' },
            { author: 'budget_gamer', text: 'The elitism in the PC community is why people stay away.' },
            { author: 'tech_specs_only', text: 'Benchmarks don’t lie. The Ryzen/RTX combo destroys any custom APU.' },
            { author: 'retro_ryan', text: 'I’m still playing on a CRT. Input lag is the only stat that matters.' },
            { author: 'dev_perspective', text: 'Optimizing for one set of hardware is why console games often look more polished at launch.' },
            { author: 'rgb_lover', text: 'If your case doesn’t look like a nightclub, are you even a gamer?' }
        ]
    },
    {
        label: 'Crypto/Web3 Thread',
        author: 'whale_watcher',
        tweet: 'VC-backed L2s are just exit liquidity for the founders. Real decentralization only happens on L1 with PoW.',
        replies: [
            { author: 'eth_maximalist', text: 'The trilemma is real. You can’t have security and speed without trade-offs.' },
            { author: 'airdrop_hunter', text: 'I don’t care about the tech, I just want to know when the snapshot is.' },
            { author: 'solana_speed', text: 'PoW is a dinosaur. High throughput and sub-penny fees are the only way to mass adoption.' },
            { author: 'gas_fee_victim', text: 'I tried to swap $50 on L1 and the gas was $80. Decentralization is for the rich apparently.' },
            { author: 'node_runner', text: 'If I can’t run a node on a Raspberry Pi, it’s not decentralized.' },
            { author: 'stable_sam', text: 'Most people just want a digital dollar that doesn’t lose 20% value overnight.' },
            { author: 'audit_expert', text: 'Centralized sequencers are a massive single point of failure. People are blind to the risk.' },
            { author: 'moon_boi', text: 'Stop overcomplicating it. Green candles are all that matters.' },
            { author: 'sec_spy', text: 'The regulation storm is coming for those "decentralized" foundations.' },
            { author: 'rust_dev', text: 'Build it in Rust or don’t build it at all. Memory safety is non-negotiable for DeFi.' }
        ]
    },
    {
        label: 'Productivity/Work Thread',
        author: 'hustle_hard',
        tweet: 'Remote work is killing company culture and mentorship. If you aren’t in the office 4 days a week, you’re invisible during promotion season.',
        replies: [
            { author: 'commute_hater', text: 'I save 10 hours a week not sitting in traffic. That’s my "promotion".' },
            { author: 'introvert_dev', text: 'My productivity tripled when I stopped getting interrupted by "quick chats" at my desk.' },
            { author: 'hr_helen', text: 'Culture isn’t about free snacks and ping pong tables. It’s about trust and results.' },
            { author: 'digital_nomad', text: 'I’m doing my best work from a beach in Bali. Stay in your cubicle if you want.' },
            { author: 'middle_manager', text: 'It’s impossible to gauge team morale through a Zoom screen. I miss the energy.' },
            { author: 'junior_junior', text: 'Actually, as a new hire, I feel totally lost without being able to shadow someone in person.' },
            { author: 'data_worker', text: 'The "visibility" you’re talking about is just office politics, not actual output.' },
            { author: 'family_man', text: 'Being home for dinner every night is worth more than any corporate title.' },
            { author: 'office_landlord', text: 'Commercial real estate is sweating right now. Of course they want you back.' },
            { author: 'slack_ninja', text: 'If you can’t mentor someone via async docs and Loom, you’re just a bad mentor.' }
        ]
    },
    {
        label: 'Food & Culinary Thread',
        author: 'chef_marco',
        tweet: 'Authentic carbonara only uses guanciale, pecorino, and eggs. If you add cream, you aren\'t making Italian food, you’re making soup.',
        replies: [
            { author: 'home_cook_jen', text: 'I just use bacon and parmesan because that’s what is in my fridge. Tastes fine to me!' },
            { author: 'fusion_finest', text: 'Food evolves. Why be a gatekeeper? Cream makes it silky.' },
            { author: 'nutrition_nick', text: 'The calorie count on the authentic version is insane. I use Greek yogurt instead.' },
            { author: 'grandma_rosa', text: 'My family in Rome has been making it this way for 80 years. Don’t disrespect the tradition.' },
            { author: 'umami_expert', text: 'Try adding a drop of fish sauce. It’s not "authentic," but it’s a cheat code for depth.' },
            { author: 'lactose_free_leo', text: 'Is there any version of this that won’t kill my stomach?' },
            { author: 'michelin_fan', text: 'It’s all about the emulsion technique. Most people scramble the eggs anyway.' },
            { author: 'ingredient_hunter', text: 'Finding real guanciale in a small town is basically impossible.' },
            { author: 'carb_loader', text: 'As long as the pasta is al dente, I don’t care what’s in the sauce.' },
            { author: 'food_sci_guy', text: 'Technically, the egg yolks provide enough fat that cream is chemically redundant.' }
        ]
    },
    {
        label: 'Photography & Optics Thread',
        author: 'glass_collector',
        tweet: 'Stop buying the latest mirrorless bodies. A 10-year-old DSLR with a high-end prime lens will still outperform any modern kit lens.',
        replies: [
            { author: 'street_shooter', text: 'Eye-autofocus on the new Sony changed my life. I never miss a shot now.' },
            { author: 'vintage_vibes', text: 'I’m still shooting film. Digital has no soul, regardless of the megapixels.' },
            { author: 'bokeh_beast', text: 'F/1.2 or bust. If the background isn’t a blurry mess, what’s the point?' },
            { author: 'weight_watcher', text: 'My back thanks me every day for switching from a heavy DSLR to mirrorless.' },
            { author: 'pixel_peeper', text: 'The dynamic range on the new sensors is objectively better. You can’t argue with math.' },
            { author: 'budget_snapper', text: 'Used 5D Mark III is the best value in photography history. Period.' },
            { author: 'vlogger_val', text: 'Can your 10-year-old DSLR shoot 4K 60fps with no crop? Didn’t think so.' },
            { author: 'composition_king', text: 'The gear doesn’t matter if your lighting and framing are trash.' },
            { author: 'iphone_is_enough', text: 'The best camera is the one that’s in your pocket. Computational photography is winning.' },
            { author: 'pro_editor', text: 'Just shoot in RAW. I can fix a "bad" lens in Lightroom in two clicks.' }
        ]
    },
    {
        label: 'Biology & Science Thread',
        author: 'lab_rat_sam',
        tweet: 'The "nature vs. nurture" debate is over. Epigenetics shows that your lifestyle can literally change how your genes are expressed.',
        replies: [
            { author: 'dna_dan', text: 'You can’t out-lifestyle a hereditary mutation. Let’s not oversimplify.' },
            { author: 'bio_hacker', text: 'This is why I track my sleep, glucose, and cortisol every single day.' },
            { author: 'skeptic_scientist', text: 'The media hypes up epigenetics way too much. Most "changes" are transient and not inherited.' },
            { author: 'neuro_natalie', text: 'Neuroplasticity is the real game changer. Your brain is literally a muscle.' },
            { author: 'evolution_envoy', text: 'Natural selection still holds the wheel in the long run.' },
            { author: 'med_student_01', text: 'Studying this for my finals. The methyl groups are basically the "software" of the cell.' },
            { author: 'fitness_phil', text: 'So if I workout, I’m making my future kids healthier? That’s wild.' },
            { author: 'ethics_eric', text: 'If lifestyle changes genes, does that mean we start blaming people for their biology?' },
            { author: 'microbe_mike', text: 'Don’t forget the microbiome. You’re more bacteria than human anyway.' },
            { author: 'data_dr', text: 'We need larger longitudinal studies before making these "lifestyle" claims.' }
        ]
    },
    {
        label: 'Hobbies & Flower/Plant Thread',
        author: 'green_thumb_pro',
        tweet: 'Fiddle Leaf Figs are the most overrated "aesthetic" plants. They are drama queens that die if you even look at them wrong. Grow Pothos instead.',
        replies: [
            { author: 'plant_mom', text: 'But the Pothos doesn’t give that interior designer look! I’ll take the drama.' },
            { author: 'succulent_stan', text: 'Try growing Lithops. They look like rocks and you water them twice a year.' },
            { author: 'botany_bill', text: 'Fiddle Leafs just need consistent light. People treat them like furniture, not living things.' },
            { author: 'apartment_jungle', text: 'I have 40 plants and the only one that died was a "hard to kill" snake plant. Explain that.' },
            { author: 'propagation_petra', text: 'Pothos is great because you can turn one plant into ten for free.' },
            { author: 'orchid_outcast', text: 'If you think Fiddle Leafs are hard, stay far away from Orchids.' },
            { author: 'soil_scientist', text: 'It’s all about the drainage. 90% of plant deaths are just overwatering.' },
            { author: 'cat_parent_99', text: 'Most of these are toxic to cats. I’m stuck with spider plants and cat grass.' },
            { author: 'zen_gardener', text: 'The struggle of keeping a difficult plant alive is part of the meditation.' },
            { author: 'plastic_pat', text: 'I bought a high-quality fake one. Zero stress, 100% green.' }
        ]
    },
    {
        label: 'Street Photography (Visual)',
        author: 'lens_culture',
        tweet: '', // [IMAGE: A high-contrast B&W shot of an elderly man sitting alone in a neon-lit Tokyo alley]
        replies: [
            { author: 'f_stop_fan', text: 'The leading lines in this are incredible. 35mm?' },
            { author: 'grain_is_good', text: 'That film grain adds so much character to his expression.' },
            { author: 'street_soul', text: 'Tokyo at 2 AM hits different. Great catch.' },
            { author: 'editing_eric', text: 'Crushed blacks are a bit much for me, but the composition is solid.' },
            { author: 'candid_clara', text: 'Did you ask for permission or was this a drive-by shot?' },
            { author: 'shadow_hunter', text: 'The way the neon hits the rain puddles... perfection.' },
            { author: 'gear_head', text: 'Leica Q2? The sharpness is unmistakable.' },
            { author: 'moody_marcus', text: 'This feels like a still from a Blade Runner deleted scene.' },
            { author: 'print_master', text: 'I would buy a physical print of this for my office.' },
            { author: 'minimalist_max', text: 'Too much clutter in the background. Should have opened the aperture more.' },
            { author: 'story_teller', text: 'You can see a whole lifetime of stories in those eyes.' },
            { author: 'color_grade_guy', text: 'B&W was the right choice. Color would have been too distracting here.' },
            { author: 'cyber_punk', text: 'Neo-Tokyo vibes are off the charts.' },
            { author: 'shutter_speed', text: 'How did you keep it so sharp in low light without a tripod?' },
            { author: 'travel_tom', text: 'I walked past that exact alley last month. Never saw it like this.' }
        ]
    },
    {
        label: 'Macro Biology (Visual)',
        author: 'micro_world',
        tweet: '', // [VIDEO: A 4K macro timelapse of a Cordyceps fungus emerging from an ant]
        replies: [
            { author: 'nature_is_metal', text: 'Absolutely terrifying. The Last of Us was a documentary.' },
            { author: 'bio_ben', text: 'The way it highjacks the nervous system is fascinating and cruel.' },
            { author: 'fungi_fanatic', text: 'Incredible detail on the fruiting body. What magnification is this?' },
            { author: 'nightmare_fuel', text: 'Thanks, I didn’t plan on sleeping tonight anyway.' },
            { author: 'entomology_elsa', text: 'Camponotus leonardi is the specific ant species for those wondering.' },
            { author: 'evolution_nerd', text: 'Evolutionary arms races are peak biology.' },
            { author: 'sci_comm_sam', text: 'This needs to be in the next David Attenborough series.' },
            { author: 'lab_tech', text: 'The lighting on this timelapse is so consistent. How many days was the shoot?' },
            { author: 'zombie_horde', text: 'And so it begins. 2026 is the year of the fungus.' },
            { author: 'micro_macro', text: 'The scale of life we usually ignore is so complex.' },
            { author: 'garden_gal', text: 'And this is why I wear gloves when I’m weeding.' },
            { author: 'pixel_peeper', text: 'That 4K detail is crisp. You can see the individual spores.' }
        ]
    },
    {
        label: 'ASMR Cooking (Audio-Visual)',
        author: 'silent_kitchen',
        tweet: '', // [VIDEO: High-speed POV of a chef making hand-pulled noodles with intense sound design]
        replies: [
            { author: 'asmr_addict', text: 'The sound of the dough hitting the table... my brain is tingling.' },
            { author: 'carb_king', text: 'I’ve watched this 10 times and I’m still hungry.' },
            { author: 'chef_pro', text: 'His technique is flawless. Look at that gluten development.' },
            { author: 'sound_designer', text: 'The foley work here is a bit exaggerated, but it works for the vibe.' },
            { author: 'kitchen_noob', text: 'I tried this and ended up with dough on my ceiling.' },
            { author: 'fast_fingers', text: 'The editing is so satisfying. Perfectly synced with the thumping.' },
            { author: 'noodle_lover', text: 'Biang Biang noodles? I can smell the chili oil through the screen.' },
            { author: 'lofi_lisa', text: 'This plus some lofi beats would be the ultimate chill video.' },
            { author: 'clean_freak', text: 'Beautiful, but imagine the flour cleanup after that.' },
            { author: 'secret_sauce', text: 'What’s the hydration percentage on that dough? It looks so supple.' },
            { author: 'sharp_edge', text: 'That knife work at the end was terrifyingly fast.' },
            { author: 'hungry_henry', text: 'Ordered ramen halfway through watching this.' }
        ]
    },
    {
        label: 'Space Photography (Visual)',
        author: 'hubble_deep_field',
        tweet: '', // [IMAGE: A deep space composite showing a collision between two spiral galaxies]
        replies: [
            { author: 'astro_amy', text: 'The scale of this is just impossible for the human brain to grasp.' },
            { author: 'physics_phil', text: 'Will the stars actually collide? Or is there too much empty space?' },
            { author: 'cosmic_clark', text: 'In about 4 billion years, that’s us and Andromeda.' },
            { author: 'wallpaper_wizard', text: 'Immediate desktop background. Absolutely stunning.' },
            { author: 'alien_believer', text: 'Imagine how many civilizations are being extinguished in this one photo.' },
            { author: 'math_matt', text: 'Gravity is the ultimate sculptor.' },
            { author: 'dark_matter_detective', text: 'The gravitational lensing on the edges is clearly visible here.' },
            { author: 'existential_ed', text: 'We are literally just dust. This is humbling.' },
            { author: 'stargazer_99', text: 'Which telescope took this? JWST or Hubble?' },
            { author: 'flat_earth_troll', text: 'Nice CGI. Looks like a marble floor.' },
            { author: 'nebula_nancy', text: 'The colors represent different gases, right? Hydrogen is the red?' },
            { author: 'light_year_lenny', text: 'We are looking at ghosts. This happened millions of years ago.' }
        ]
    }
];

// ─── Helpers ───────────────────────────────────────────────────────────────
const DIVIDER = '─'.repeat(70);
const HEADER = (label) => `\n${'═'.repeat(70)}\n  TEST: ${label}\n${'═'.repeat(70)}`;

function countTokensApprox(text) {
    return Math.round(text.length / 4);
}

async function callLLM(systemPrompt, userPrompt) {
    const startMs = Date.now();
    const data = await activeLLM.fetch('/v1/chat/completions', {
        model: LLM_MODEL,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
        ],
        temperature: 0.8,
        max_tokens: 2048,
        stream: false,
    });

    const elapsedMs = Date.now() - startMs;
    const messageObj = data.choices?.[0]?.message;
    let content = messageObj?.content ?? '';
    let reasoning = messageObj?.reasoning ?? messageObj?.reasoning_content ?? '';

    // DeepSeek R1 fallback: Extract <think> from content if present
    if (content.includes('<think>')) {
        const match = content.match(/<think>([\s\S]*?)<\/think>/);
        if (match) {
            reasoning = match[1] + '\n' + reasoning; // prepend to any existing
            content = content.replace(/<think>[\s\S]*?<\/think>\s*/g, '');
        }
    }

    // Clean up carriage returns that break terminal output
    content = content.replace(/\r/g, '').trim();
    reasoning = reasoning.replace(/\r/g, '').trim();

    const usage = data.usage ?? null;

    return { content, reasoning, elapsedMs, usage, raw: data };
}

// ─── Main ──────────────────────────────────────────────────────────────────
async function runTest({ label, author, tweet, replies }) {
    console.log(HEADER(label));

    const systemPrompt = REPLY_SYSTEM_PROMPT;
    const userPrompt = buildReplyPrompt(tweet, author, replies);

    // Helper to clean CRLF for terminal output
    const cleanOutput = (str) => str.replace(/\r/g, '');

    // ── SENT ──
    console.log('\n📤 SYSTEM PROMPT:');
    console.log(DIVIDER);
    console.log(cleanOutput(systemPrompt));
    console.log(DIVIDER);
    console.log(`   ~${countTokensApprox(systemPrompt)} tokens`);

    console.log('\n📤 USER PROMPT:');
    console.log(DIVIDER);
    console.log(cleanOutput(userPrompt));
    console.log(DIVIDER);
    console.log(`   ~${countTokensApprox(userPrompt)} tokens`);

    console.log(`\n📊 TOTAL SENT: ~${countTokensApprox(systemPrompt) + countTokensApprox(userPrompt)} tokens`);

    // ── CALL ──
    console.log('\n⏳ Calling LLM...\n');
    try {
        const { content, reasoning, elapsedMs, usage, raw } = await callLLM(systemPrompt, userPrompt);

        console.log('📥 RECEIVED:');
        console.log(DIVIDER);
        if (reasoning) {
            console.log('🤔 REASONING:');
            console.log(cleanOutput(reasoning));
            console.log(DIVIDER);
        }
        console.log(cleanOutput(content) || '(empty content)');

        if (!content && !reasoning) {
            console.log('\n⚠️ RAW JSON RESPONSE:');
            console.log(JSON.stringify(raw, null, 2));
        }

        console.log(DIVIDER);
        console.log(`   Time: ${elapsedMs}ms`);
        if (usage) {
            console.log(`   Tokens — prompt: ${usage.prompt_tokens}, completion: ${usage.completion_tokens}, total: ${usage.total_tokens}`);
        }
    } catch (err) {
        console.error('❌ LLM call failed:', err.message);
    }
}

console.log(`\nPrompt Test — Provider: ${LLM_PROVIDER}\n`);

if (LLM_PROVIDER === 'local') {
    const baseUrl = LLM_ENDPOINT.replace(/\/api\/.*$/, '').replace(/\/$/, '');
    console.log(`⏳ Preloading model '${LLM_MODEL}' into VRAM...`);
    try {
        await fetch(`${baseUrl}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: LLM_MODEL, keep_alive: '10m' })
        });
        console.log(`✅ Model loaded.`);
    } catch (e) {
        console.error(`❌ Failed to preload model: ${e.message}`);
    }
}

// Randomly select one test to run instead of all of them
const randomTest = TESTS[Math.floor(Math.random() * TESTS.length)];
console.log(`🎲 Selected variant: ${randomTest.label} (1 of ${TESTS.length})`);

await runTest(randomTest);

console.log('\n\nDone.\n');
