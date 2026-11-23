// Solmar Bay — the gta6-01 hand-in program. Node 22, standard library only.
//
// The game lives in this repository's game/ folder: plain static files that a desktop
// browser loads offline (game/index.html plus its ES modules; no library, no network
// request, nothing fetched at run time). Running this file assembles the entry the
// grader reads: it copies game/ and screenshots/ into the output directory and writes
// dossier.json there, the summary the judge reads, using the vendored make.fun
// library (vendor/makefun-game.ts, the kit's copy, unchanged).
//
// Play it locally first with `node serve.ts`, then open http://localhost:8080.
// The grader runs this program with /output as the destination; outside the grader,
// MAKEFUN_OUTPUT_DIR stands in for it:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function copyTree(from, to) {
  mkdirSync(to, { recursive: true });
  cpSync(from, to, { recursive: true });
}

function handIn() {
  // The playable game, exactly as it sits in the repository.
  copyTree(join(repoRoot, 'game'), join(outputDir, 'game'));

  // The screenshots, when they have been taken; an entry without them is not valid,
  // so a missing folder here means the build step before this one was skipped.
  const shots = join(repoRoot, 'screenshots');
  if (existsSync(shots)) copyTree(shots, join(outputDir, 'screenshots'));

  // The dossier the judge reads. Its caps are the scorer's own (reference/gate.json):
  // the text is capped at 160 KiB, at most 4 screenshots of 256 KiB each, game/ at
  // most 993 files and 48 MiB in all. Anything over those limits is refused by the
  // gate, so the numbers below match it exactly rather than guessing.
  const dossier = buildDossier(outputDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  });
  writeFileSync(join(outputDir, 'dossier.json'), dossier);
}

handIn();
