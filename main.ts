// VOIDPULSE — hand-in program for make.fun's best-game-01.
// Copies game/ and screenshots/ from this repository into the output
// directory and seals them with the dossier the kit's library writes, so
// the grader can rebuild the exact same bytes from the same files.
// Runs on Node 22 with the standard library only; MAKEFUN_OUTPUT_DIR
// stands in for /output outside the grader.
import { cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const root = dirname(fileURLToPath(import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(root, 'game'), join(out, 'game'), { recursive: true });
cpSync(join(root, 'screenshots'), join(out, 'screenshots'), { recursive: true });

const dossier = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(out, 'dossier.json'), dossier);

console.log(`voidpulse: handed in game/ + screenshots/ -> ${out} (dossier ${dossier.length} bytes)`);
