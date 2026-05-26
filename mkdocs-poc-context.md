# MkDocs Living-Docs PoC — Handoff Context

> **For the next Claude Code session.** Read this file in full before doing anything else. Respond to the user in Korean (the user's preferred language for discussion). Write all code and comments in English. Do not use emojis.

## TL;DR

The user (Taekyung Kil, `tkil@tribalscale.com`) is building a Proof-of-Concept for a **living technical documentation system** that they will eventually roll out to their main Android codebase (WSL Android — `~/tk-work/wsl-android/wsl-android`). This PoC must NOT touch the WSL repo. It will be built in a separate side project on the user's machine. The user will tell you the path and GitHub URL of that side project in their first message.

The PoC verifies the end-to-end workflow before committing the team to it.

## End goal (the system being designed)

A documentation system with these properties:

1. **Source of truth lives in the code repo** (markdown files under `docs/`), not in an external tool (Confluence / Eraser / Notion). This is non-negotiable — drift between code and external docs is the failure mode we are designing against.
2. **Readers see a polished site**, not raw markdown. Sidebar navigation, search, dark mode, inline Mermaid diagrams.
3. **Auto-updated on release**. When a `release/9.1.xxx` branch merges into `develop` (the release line in WSL's git workflow), the docs site rebuilds. Eventually, Anthropic's official `claude-code-action` will analyze PR diffs and propose doc updates as comments / commits.
4. **Audience: a developer or technical PM with some domain familiarity.** Not Android internals expert, not non-technical. Domain language for "what" / "why", code pointers for "where".

## Decided stack

| Layer | Tool | Why |
|---|---|---|
| Doc source | Markdown + Mermaid diagrams, in-repo `docs/` folder | Git diff / PR review / drift detection all work natively |
| Static site generator | **MkDocs Material** | Python-based, native Mermaid support, GitHub Pages friendly, ~30-line config, very popular |
| Hosting | GitHub Pages (deployed via Actions) | Free for public repos, integrated, no extra credentials |
| Build trigger | GitHub Action on push to `develop`, paths-filtered to `docs/**` and config files | Releases-only cadence, low noise |
| Future: AI-assisted doc updates | `anthropics/claude-code-action` (official) | Reads PR diffs, can comment / commit. Anthropic's "Documentation Sync" is an official example use case. NOT part of THIS PoC, but the design must leave room for it. |

## Rejected alternatives (and why — so the user does not re-litigate)

- **Eraser direct API**: requires paid Eraser team plan + usage-based pricing ($0.20–$0.80 per call), source-of-truth lives off-repo, breaks PR review. Eraser is fine as an export/sharing tool but not as the system of record.
- **GitHub Wiki**: separate git repo, no PR co-review with code changes, no branch protection, drift risk. Reading UX is OK but the auto-update story falls apart.
- **Docusaurus**: heavier (React build), feature-rich but overkill for this scope. Reconsider only if MkDocs proves too limited.
- **PlantUML / D2 instead of Mermaid**: PlantUML needs JVM in CI, D2 has no native GitHub render. Mermaid wins on ubiquity + zero infra.
- **`android:configChanges` Activity-recreation tricks for the WSL refactor**: not part of THIS PoC, mentioned only because the user may bring it up. Ignore unless asked.

## Document taxonomy (the user has agreed to this)

Each capability (a user-facing feature area, not a code package) gets its own folder. Inside, at most four document types:

```
docs/
  index.md                              # site landing, links to capabilities
  glossary.md                           # domain terms (one place, referenced by all)
  capabilities/
    <capability-name>/
      overview.md                       # what + why, in domain language. 5-minute read.
      architecture.md                   # how it's built. Mermaid diagrams. Code map table.
      playbook.md                       # common issues + triage steps
      decisions/                        # ADRs — one file per architectural decision
        001-something.md
  cross-cutting/                        # things that don't fit a single capability (analytics, ads, cast)
  reference/                            # build variants, dep map, CI — meta stuff
```

Rule: **never invent a 5th doc type per capability.** Adding categories explodes maintenance cost. Four is enough (overview/architecture/decisions/playbook). Diátaxis-inspired but trimmed.

## Tone guide (verified with the user)

| Good | Bad |
|---|---|
| "Rotating the device into landscape takes the player fullscreen" | "ORIENTATION_LANDSCAPE triggers mVideoPlayer.setFullScreen(true)" |
| "The player is owned by SingleActivity, not by the screen, so rotation does not stop playback" | "AspVideoPlayer instance cached at SingleActivity scope" |
| Code pointers in a table: `app/src/.../EventFragment.java` | (omitting code pointers) |

Domain terms (heat, event, replay, broadcast) used freely — `glossary.md` is the safety net. Android framework terms (Fragment, Activity) used freely — audience is assumed to know Android basics.

## Examples already written (in WSL repo, for tone/structure reference only)

The user agreed on the tone after seeing these two files in the WSL repo. **Do not push them to GitHub — they are draft references.** Paths:

- `~/tk-work/wsl-android/wsl-android/docs/capabilities/video-playback/overview.md` — domain-friendly overview
- `~/tk-work/wsl-android/wsl-android/docs/capabilities/video-playback/architecture.md` — technical companion with 2 Mermaid diagrams

If the user asks to see the sample tone, read these. Do NOT replicate WSL's domain (surf league / video player) in the side-project PoC — invent or use the side project's actual domain.

## PoC scope (what to build in the side project)

Five-step plan the user has approved:

1. **Add 4 files to the side project's repo:**
   - `mkdocs.yml` (root)
   - `requirements-docs.txt` (root) — Python deps, used only in CI
   - `.github/workflows/docs.yml` — build + deploy to GitHub Pages
   - `docs/index.md` — landing page
2. **Add 1–2 sample capability pages** matching the side project's actual domain. Include at least one Mermaid diagram so the user can verify Mermaid renders properly.
3. **Local preview**: confirm `mkdocs serve` runs on the user's machine and the site looks reasonable at `http://127.0.0.1:8000`. If the user does not have Python / does not want to install it, skip this step and rely on GitHub Pages preview.
4. **First push + GitHub Pages activation**:
   - Confirm GitHub repo Settings → Pages → Source is set to "GitHub Actions" (user must do this in browser; do not assume it's already done)
   - Push branch, watch Action run, verify deployed URL
5. **Validation checklist** (run with the user):
   - Sidebar navigation auto-built from `nav:` in `mkdocs.yml`
   - Mermaid diagram renders inline
   - Search box works
   - Dark mode toggle works
   - Path-filtered trigger: edit a non-docs file, push, confirm Action does NOT re-run

After step 5, the PoC is complete. The user will then decide whether to roll this out to WSL Android.

**Do NOT add `claude-code-action` integration in this PoC** unless the user explicitly asks. That is a separate follow-up — the docs-as-code workflow must work first.

## Concrete file contents (use these verbatim, adjusting `site_name` / `repo_url` / `nav:` to the side project)

### `mkdocs.yml`
```yaml
site_name: <SIDE_PROJECT_NAME> Documentation
repo_url: https://github.com/<USER>/<SIDE_PROJECT>
docs_dir: docs

theme:
  name: material
  features:
    - navigation.tabs
    - navigation.sections
    - navigation.expand
    - search.suggest
    - content.code.copy
  palette:
    - scheme: default
      primary: blue
      toggle:
        icon: material/brightness-7
        name: Switch to dark mode
    - scheme: slate
      primary: blue
      toggle:
        icon: material/brightness-4
        name: Switch to light mode

markdown_extensions:
  - pymdownx.superfences:
      custom_fences:
        - name: mermaid
          class: mermaid
          format: !!python/name:pymdownx.superfences.fence_code_format
  - admonition
  - tables
  - toc:
      permalink: true

nav:
  - Home: index.md
  - Capabilities:
      - "<Capability A>": capabilities/<slug-a>/overview.md
```

### `requirements-docs.txt`
```
mkdocs==1.6.1
mkdocs-material==9.5.49
pymdown-extensions==10.13
```

### `.github/workflows/docs.yml`
```yaml
name: Deploy Documentation

on:
  push:
    branches: [main]   # user may want develop instead — confirm with user
    paths:
      - 'docs/**'
      - 'mkdocs.yml'
      - 'requirements-docs.txt'
      - '.github/workflows/docs.yml'

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.x'
      - run: pip install -r requirements-docs.txt
      - run: mkdocs build --strict
      - uses: actions/upload-pages-artifact@v3
        with:
          path: site/

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

### `docs/index.md`
A short landing page. Adapt the wording to the side project:
```markdown
# <Side Project Name> Documentation

Welcome. This site documents <project> at the capability level.

## Browse capabilities

- [<Capability A>](capabilities/<slug-a>/overview.md) — one-line summary
```

## Information to collect from the user at session start

Ask these (concisely, ideally in one message):

1. **Side project local path** (e.g. `~/projects/foo`)
2. **GitHub URL** (e.g. `https://github.com/user/foo`) and whether it is **public or private**
   - If private: ask whether they have GitHub Pro / Team / Enterprise. Free private repos cannot use GitHub Pages — fallback is **Read the Docs** (free for private docs).
3. **Default branch** of the side project (`main` vs `master` vs `develop`)
4. **The side project's actual domain** in one sentence — enough to write a sample `overview.md` that fits, instead of generic placeholder content
5. **Whether the user has Python installed locally** — affects whether `mkdocs serve` preview is viable in step 3

## Working preferences (from the user's CLAUDE.md and from this session)

- **Respond in Korean.** Code and comments in English.
- **No emojis.**
- **Always research before coding.** Present recommendations + reasoning before implementing.
- **Wait for user confirmation before non-trivial implementation.**
- **No `Co-Authored-By` trailer** on commits.
- **No fallback / hack workarounds** — fix the root cause.
- The user is experienced — be concise, do not over-explain basics, but do clearly state trade-offs.

## What NOT to do in this session

- Do NOT modify the WSL Android repo at `~/tk-work/wsl-android/wsl-android`. That is the production codebase.
- Do NOT push to GitHub on the user's behalf without explicit confirmation.
- Do NOT add `claude-code-action` automation yet — that comes after PoC validates.
- Do NOT propose moving to GitHub Wiki, Confluence, Eraser, Docusaurus, or any other tool — those were already evaluated and rejected. If the user reopens the decision, push back with the reasoning above.
- Do NOT skip the validation checklist in step 5. The whole point of the PoC is end-to-end verification.

## End state of the PoC

When done, the user has:

- A working GitHub Pages URL serving their side project's docs
- A confirmed automatic rebuild on push to the chosen branch when `docs/**` changes
- A pattern they can copy-paste into the WSL Android repo with confidence

The next phase (after PoC) is rolling this out to WSL Android, adding `claude-code-action` for AI-assisted doc updates, and seeding the initial capability docs for WSL. None of that is in scope for this session.
