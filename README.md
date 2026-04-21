# Kana Sensei

Local app for practicing Japanese, built for my personal workflow.

## Prerequisites
- Node 20+
- Claude Code installed and authenticated with my Max plan
- `ANTHROPIC_API_KEY` must NOT be set in the shell (`echo $ANTHROPIC_API_KEY` should be empty)

## Run
```bash
bun install
bun run strokes:build    # one-time: fetch KanjiVG stroke data (~800KB into public/kanjivg)
bun run dev
```
App opens at http://localhost:5173. State persists to `./memory/progress.json`.

## Stroke data (writing mode)
Practice mode **Escribir** uses KanjiVG stroke data for per-stroke grading
(direction, shape, order). Files live in `public/kanjivg/<codepoint>.svg`.
KanjiVG is © Ulrich Apel, licensed under CC BY-SA 3.0 —
see `public/kanjivg/LICENSE.txt` and https://kanjivg.tagaini.net/.

## Daily flow
1. Get the daily quest from my Claude scheduled task (runs in Claude.ai).
2. Paste it into `/quest/import`.
3. Go to `/practice` for SRS review.
4. Use `/ask-claude` whenever I want Claude to check my Japanese.

## Safety
The app refuses to call Claude if `ANTHROPIC_API_KEY` is set — that would bill my API account instead of using my Max subscription. If you see that error, run `unset ANTHROPIC_API_KEY` and restart the dev server (`bun run dev`).
