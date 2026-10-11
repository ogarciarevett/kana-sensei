# Kana Sensei

A local Japanese practice app with SRS, writing exercises, quests, and one tutor
available through Claude Code, Codex CLI, or Cursor Agent CLI. Select a provider
on the teacher page. All three receive the same lesson instructions, including
Spanish explanations and anime mnemonics.

## Run locally

Install Node 20+, Bun, and the CLI for your preferred provider. Then run:

```bash
bun install --frozen-lockfile
bun run dev
```

Open http://127.0.0.1:5173 and choose **Teacher**. The existing
`/ask-claude` page URL still works. Progress and chat history remain in
`memory/progress.json`. The backend runs only in the Vite development server;
`bun run preview` serves static assets without tutor or persistence endpoints.
The server stays on loopback. Prompts are sent to the selected provider's service;
local storage does not mean offline inference.

## Claude Code

Install [Claude Code](https://code.claude.com/docs/en/setup), then generate a
subscription token in your own private terminal:

```bash
claude setup-token
unset ANTHROPIC_API_KEY
bun run dev
```

The setup command displays a token. Store it in 1Password and inject it into the
dev server environment as `CLAUDE_CODE_OAUTH_TOKEN` using your secret manager.
Never paste it into source files, command arguments, shell history, or chat.
The app does not run setup or persist the token.

On macOS, you can cache the same token through the **Keychain Access** GUI as a
generic password with service name `kana-sensei.claude-oauth` and account `oauth`.
Keep 1Password as the source of truth. Unlock the cache before starting a lesson.
At the first lesson, macOS can ask to allow `security` to read the item. Click Always Allow.
The environment token takes precedence; otherwise the server retrieves this
specific cache internally. A missing or locked cache produces setup guidance.
The app does not read Claude's credential files or require their private schema.

Choose **Claude** on the teacher page and select **sonnet** or **opus**.
`ANTHROPIC_API_KEY` is rejected for Claude requests to preserve subscription
billing. Other provider credentials and API override variables are excluded from
the Claude subprocess environment.
See [Claude authentication](https://code.claude.com/docs/en/authentication).

## Codex

Install and authenticate [Codex CLI](https://developers.openai.com/codex/cli/):

```bash
codex login
bun run dev
```

Choose **Codex** on the teacher page. The adapter uses your CLI login and its
default model, with a read-only, ephemeral execution. No additional app token is
needed. `CODEX_HOME` is supported if you keep CLI authentication in a custom
location. Claude's sonnet and opus settings are not forwarded to Codex.
See [non-interactive execution](https://developers.openai.com/codex/noninteractive/).

## Cursor

Install [Cursor Agent CLI](https://cursor.com/docs/cli/installation) and sign in:

```bash
cursor-agent login
bun run dev
```

Choose **Cursor** on the teacher page. The adapter launches `cursor-agent` in
read-only Ask mode using the CLI's default model. The desktop editor's `cursor`
command alone is insufficient. For unattended authentication, inject
`CURSOR_API_KEY` from 1Password into the dev server environment. It is passed only
to the Cursor subprocess, never as a command flag or browser value.
See [headless execution](https://cursor.com/docs/cli/headless).

## How the shared teacher works

`server/teacher.ts` exposes one `Teacher.ask` interface and three CLI adapters.
The app has a real backend, so instruction-file shims alone would not change its
Claude-only endpoint. Keeping the existing CLI approach avoids SDK dependencies
and gives all providers one tutor prompt and consistent validation and errors.

Requests use `POST /api/ask` with a prompt and provider and require
`Content-Type: application/json`. API requests accept only the local server Host
and, when supplied, a local Origin with the actual listening port. This also
protects progress and quest endpoints; progress writes require JSON. The old
`POST /api/ask-claude` endpoint defaults to Claude for compatibility.
Each subprocess receives the prompt through stdin and runs from a disposable
empty directory, separate from learner files and project instructions. Claude
has no tools and no session persistence; Codex uses read-only ephemeral mode;
Cursor uses Ask mode and trusts only the generated empty working directory.
Cursor may retain sessions in its own global CLI storage.
CLI failures and diagnostics are never copied into browser errors.

## Checks and privacy

```bash
bun run test
bun run build
brew install gitleaks
bun run check:secrets
# After staging changes, before every push:
bun run check:staged
```

CI runs the tests, production build, and gitleaks. Tests use synthetic prompts and
mocked credentials; they never require a real token or a paid model call.
`memory/`, learner exports, environment files, local provider settings, credential
files, and logs are ignored. Review staged paths and content before committing;
gitleaks does not identify every kind of personal learner data.

## Daily flow and stroke data

1. Get a daily quest from your preferred teacher.
2. Paste it into `/quest/import`.
3. Go to `/practice` for SRS review.
4. Ask your teacher to check your Japanese.

Writing mode uses KanjiVG stroke data for direction, shape, and order grading.
The SVGs are included under `public/kanjivg/`. To refresh them:

```bash
bun run strokes:build
```

KanjiVG is copyright Ulrich Apel, licensed under CC BY-SA 3.0.
See `public/kanjivg/LICENSE.txt` and [KanjiVG](https://kanjivg.tagaini.net/).
