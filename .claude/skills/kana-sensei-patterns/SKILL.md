---
name: kana-sensei-patterns
description: Project-specific rules and patterns for Kana Sensei — a local React+TS Japanese practice app that shells out to `claude -p` on Santiago's Max subscription. Load whenever working in /Users/ogarcia/projects/e-japanese.
version: 1.0.0
source: local-codebase-analysis
analyzed_at: 2026-04-21
---

# Kana Sensei — Project Patterns

A single-user local Japanese practice app (hiragana, katakana, N5 kanji) with anime-based mnemonics, SRS, and Claude as an on-demand tutor. **Never treat this like a generic React app** — several non-obvious constraints control the design.

---

## 1. Runtime & package manager

**Use `bun`, never `npm` or `yarn`.**

- Install: `bun install`
- Dev: `bun run dev`
- Typecheck: `bun run typecheck`
- Add deps: `bun add <pkg>` / `bun add -d <pkg>`
- Lockfile is `bun.lock`. If `package-lock.json` ever appears, delete it.

Why: Santiago's explicit preference. The global memory has a `feedback_use_bun.md` entry — this skill mirrors it so the rule surfaces at project-load time too.

---

## 2. Stack — pinned, no substitutions

| Tool | Version | Why pinned |
|---|---|---|
| Vite | ^5.4 | v8 was in the scaffold; the project spec mandated v5 |
| React | ^18.3 | Not 19 — the original scaffold had 19 and it was downgraded intentionally |
| TypeScript | ~5.5 | Project spec; 6.x was in the scaffold, removed |
| Tailwind | ^3.4 | **Not v4.** The spec calls out "keep it stable" — v4's new engine hasn't earned its keep here |
| Zustand | ^4.5 | Single store, no middleware |
| React Router | ^6.26 | v7 explicitly avoided |
| Recharts | ^2.12 | Dashboard chart only |

**Do not add:** `@anthropic-ai/sdk`, testing frameworks, Electron, shadcn, or any CSS framework beyond Tailwind. The project spec forbids these by name.

---

## 3. Architecture — Vite plugin IS the backend

There is no separate Node server. `vite-memory-plugin.ts` (project root) registers three middleware endpoints on the Vite dev server:

- `GET /api/state` → reads `./memory/progress.json`, returns `"null"` if missing
- `POST /api/state` → validates JSON, writes the file
- `GET /api/quests` → lists `memory/quests/*.md`
- `POST /api/quests?date=YYYY-MM-DD` → writes `memory/quests/{date}.md`
- `POST /api/ask-claude` → **spawns `claude -p`** with a Spanish-tutor system prompt

State and quests persist across restarts because they're plain files in `./memory/`. That directory is in `.gitignore` — never commit it.

---

## 4. Claude integration — shell-out to `claude -p`, NOT the SDK

The `/api/ask-claude` handler spawns the Claude Code CLI and pipes stdout back. **Two invariants protect Santiago's Max subscription:**

### Invariant A — Hard guard on `ANTHROPIC_API_KEY`

If `process.env.ANTHROPIC_API_KEY` is non-empty when a request hits, the handler returns 400 with a guard error *before* spawning anything. Without this guard, the CLI would silently bill his API account instead of consuming Max quota.

```ts
// vite-memory-plugin.ts — this block must never be weakened
if (process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY.trim() !== '') {
  return json(res, 400, { error: 'ANTHROPIC_API_KEY is set ... ' });
}
```

### Invariant B — Child env scrubs the key

`spawn('claude', [...], { env: { ...process.env, ANTHROPIC_API_KEY: '' } })`. Even if the guard is bypassed, the child sees an empty key and falls back to Max-authed session.

### Rules when modifying ask-claude

- Never switch to the `@anthropic-ai/sdk` Node SDK — that would require an API key.
- Never remove the guard. If you need to test the API path (you don't), ask first.
- Model selector accepts `"sonnet" | "opus"` and maps straight to `--model`. Don't invent other values.
- The system prompt hard-codes Spanish output and an anime reference palette (Naruto, JJK, Death Note, One Piece, Demon Slayer, AoT, Chainsaw Man, FMA, Evangelion, Ghibli, HxH, Berserk). Adding a new anime is fine; silently dropping Spanish is not.

---

## 5. State model — single file, debounced writes

`src/store/useStore.ts` is the only zustand store. Shape = `AppState` (see `src/lib/types.ts`):

```ts
{
  user: { name, started_on, streak, last_session },
  progress: Record<char, ProgressEntry>,     // keyed by the literal kana/kanji char
  settings: { mode, daily_goal, preferred_model },
  session_log: [{ date, chars_reviewed, accuracy }],   // capped at 90
  chat_history: [{ role, content, model, timestamp }]  // capped at 20
}
```

### Persistence rules

- All mutators call `saveStateDebounced(stripStore({ ...get(), … }))` with a 500ms debounce.
- `stripStore` must peel off every action key (hydrate, gradeChar, introduceChar, setMode, setModel, appendChat, logSession) before writing — otherwise functions get JSON.stringified as `{}` and pollute the file.
- When you add a new action, update `stripStore`'s destructure list too.
- Caps (20 chat / 90 sessions) are enforced on append, not on read.

### Hydration has a race guard

`hydrate()` is behind a module-level `hydratePromise` and a `get().hydrated` check both before and after the `await loadState()`. React 18 StrictMode double-invokes `useEffect`, and without this guard the second hydrate could stomp in-memory progress with DEFAULT_STATE. Don't remove either check.

---

## 6. SRS algorithm (`src/lib/srs.ts`)

- New entries start with `interval_hours: 0.1`, `ease: 2.5`, `due_at: now`.
- Grades: `again` (interval→0.1, ease−0.2), `hard` (×1.2, ease−0.15), `good` (×ease), `easy` (×ease×1.3, ease+0.15).
- Ease floor: 1.3.
- `applyGrade` returns a **new** entry (immutable). Never mutate `ProgressEntry` in place — the store's React updates rely on reference change.
- `isDue(entry, now?)` compares `due_at` to `now`. When calling from `.filter()`, wrap as `.filter(e => isDue(e))` — passing `isDue` bare sends `.filter`'s index as the `now` arg and trips a TS overload error.

---

## 7. Content & UX rules

### Language

**All user-facing copy is Spanish.** Commit messages, code comments, and tool output can stay English. If a mnemonic needs an English word (e.g. "key" for き), that's fine as a bridge, but the surrounding sentence stays Spanish.

### Anime references in mnemonics

Gold-standard mnemonic has: (a) visual shape association, (b) sound anchor, (c) anime reference. Allowed anime palette — keep it to:

> Naruto · JJK · Death Note · One Piece · Demon Slayer · AoT · Chainsaw Man · FMA · Evangelion · Ghibli · HxH · Berserk

If you must reach outside the palette, flag it in the PR.

### Placeholders

`mnemonic: "(pendiente)"` is the accepted placeholder for unfinished content. Never ship a mnemonic like `"TODO"` or `"(fill me)"` — Santiago greps for `(pendiente)` to find what's left. Current state (as of 2026-04-21): hiragana 0, katakana 38, kanji N5 104 placeholders.

### Visual palette

Tailwind colors are **constrained**: `neutral-*` + `emerald-500` (correct) + `rose-500` (wrong) + `amber-500` (warning). No other hues. No dark-mode variants. No gradients beyond extremely subtle ones.

Japanese glyphs use the `.font-ja` utility (`'Hiragino Mincho ProN', 'Yu Mincho', serif`). Everywhere else, system-ui.

Max content width 720px, centered. Top nav bar with app name left, streak count right.

---

## 8. File layout

```
src/
  data/         hiragana.ts, katakana.ts, kanjiN5.ts   (content, no logic)
  lib/          types.ts, srs.ts, memoryClient.ts, askClaude.ts, parseQuest.ts
  store/        useStore.ts    (the only zustand store)
  components/   Nav.tsx, KanaCard.tsx, GradeButtons.tsx, MnemonicPanel.tsx
  pages/        Dashboard.tsx, Practice.tsx, LearnNew.tsx, QuestImport.tsx, AskClaude.tsx
```

Rules:
- Files stay under ~400 lines. Practice.tsx is the longest at time of writing; split if it grows.
- `data/*` files are pure exports of `KanaInfo[]`. No imports beyond `../lib/types`.
- `lib/*` files are framework-free (no React). `srs.ts` and `parseQuest.ts` are pure functions.
- Routes are declared only in `src/App.tsx`. Don't nest Routers.

---

## 9. Validation checklist (run before declaring work done)

```bash
bun run typecheck                      # must be clean
bun run dev &                          # starts Vite on :5173
curl -s http://localhost:5173/api/state   # returns "null" or valid JSON

# Guard positive test — MUST return the guard error, not a Claude response:
kill %1
ANTHROPIC_API_KEY=sk-test bun run dev &
sleep 2
curl -s -X POST http://localhost:5173/api/ask-claude \
  -H 'Content-Type: application/json' \
  -d '{"prompt":"hola","model":"sonnet"}'
# ↑ expect: {"error":"ANTHROPIC_API_KEY is set …"}

kill %1; unset ANTHROPIC_API_KEY; bun run dev &
curl -s -X POST http://localhost:5173/api/ask-claude \
  -H 'Content-Type: application/json' \
  -d '{"prompt":"Di hola en japonés en una palabra","model":"sonnet"}'
# ↑ expect: Spanish response
kill %1
```

If either curl behaves wrong, the Max-subscription protection is broken — stop and fix before merging.

---

## 10. Out of scope — do not build

The spec explicitly rules these out; don't volunteer them:

- Authentication / multi-user support
- Mobile layout beyond basic responsive
- Dark mode
- Deployment config (Vercel, Netlify, Docker)
- Audio / speech
- Testing frameworks (Vitest, Jest, Playwright)
- Electron wrapper

If Santiago asks for one of these, confirm scope first — it probably means the constraint has relaxed.

---

## 11. Commit conventions

Git history so far uses mixed-case prefixes (`Chore:`, `chore:`, `feat:`). Going forward, prefer lowercase conventional commits: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`. Co-author attribution is disabled globally in Santiago's `~/.claude/settings.json` — don't re-add it.
