// Leonida Trophy Guide v3 build script: transfers application assets and screenshot bundles
// into the output destination, then compiles the distribution dossier using the vendored make.fun tool.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-frontend.ts';

const baseDir = fileURLToPath(new URL('.', import.meta.url));
const targetDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(targetDir, { recursive: true });
cpSync(join(baseDir, 'app'), join(targetDir, 'app'), { recursive: true });

const targetShotsDir = join(targetDir, 'screenshots');
mkdirSync(targetShotsDir, { recursive: true });
const sourceShotsDir = join(baseDir, 'screenshots');
if (existsSync(sourceShotsDir)) {
  cpSync(sourceShotsDir, targetShotsDir, { recursive: true });
}

writeFileSync(
  join(targetDir, 'dossier.json'),
  buildDossier(targetDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    app_max_files: 993,
    app_max_bytes: 50331648,
  }),
);
