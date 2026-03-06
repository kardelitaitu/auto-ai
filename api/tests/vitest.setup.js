import { mkdirSync } from 'fs';
import { resolve } from 'path';

mkdirSync(resolve(process.cwd(), 'coverage', '.tmp'), { recursive: true });
