/**
 * One-shot asset pipeline: downloads KanjiVG stroke data for every character
 * in our HIRAGANA / KATAKANA / KANJI_N5 lists into public/kanjivg/<cp>.svg.
 *
 * Run with: bun run strokes:build
 *
 * KanjiVG is CC BY-SA 3.0; see public/kanjivg/LICENSE.txt.
 */
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

import { HIRAGANA } from '../src/data/hiragana';
import { KATAKANA } from '../src/data/katakana';
import { KANJI_N5 } from '../src/data/kanjiN5';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'public', 'kanjivg');
const RAW_BASE = 'https://raw.githubusercontent.com/KanjiVG/kanjivg/master/kanji';

function codepointFor(char: string): string {
  const cp = char.codePointAt(0);
  if (cp === undefined) throw new Error(`no codepoint for ${char}`);
  return cp.toString(16).padStart(5, '0');
}

async function exists(p: string): Promise<boolean> {
  try { await fs.access(p); return true; } catch { return false; }
}

async function fetchOne(char: string): Promise<'ok' | 'cached' | 'missing'> {
  const cp = codepointFor(char);
  const outPath = path.join(OUT_DIR, `${cp}.svg`);
  if (await exists(outPath)) return 'cached';
  const url = `${RAW_BASE}/${cp}.svg`;
  const r = await fetch(url);
  if (!r.ok) {
    console.warn(`  missing: ${char} (${cp}) — HTTP ${r.status}`);
    return 'missing';
  }
  const body = await r.text();
  await fs.writeFile(outPath, body, 'utf-8');
  return 'ok';
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });

  const chars = [
    ...HIRAGANA.map(k => k.char),
    ...KATAKANA.map(k => k.char),
    ...KANJI_N5.map(k => k.char)
  ];
  const unique = Array.from(new Set(chars));
  console.log(`Fetching KanjiVG data for ${unique.length} characters…`);

  let ok = 0, cached = 0, missing = 0;
  for (const char of unique) {
    const res = await fetchOne(char);
    if (res === 'ok') ok++;
    else if (res === 'cached') cached++;
    else missing++;
  }

  const license = `KanjiVG stroke data © Ulrich Apel, licensed under CC BY-SA 3.0.
Source: https://github.com/KanjiVG/kanjivg
Attribution: https://kanjivg.tagaini.net/
`;
  await fs.writeFile(path.join(OUT_DIR, 'LICENSE.txt'), license, 'utf-8');

  console.log(`\nDone. fetched=${ok} cached=${cached} missing=${missing}`);
  if (missing > 0) {
    console.log('Missing characters will fall back to manual grading at runtime.');
  }
}

main().catch(e => { console.error(e); process.exit(1); });
