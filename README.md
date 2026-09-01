# rafaelpupio.com

Personal portfolio of **Rafael Pupio Vieira** — AI Engineer building agents & automation on 10+ years in administration, operations & financial operations.

Live at **[rafaelpupio.com](https://rafaelpupio.com)** (and [rafaelpupio.dev](https://rafaelpupio.dev)).

## How it works

- `index.html` — the whole site. Hand-written HTML/CSS/JS, zero frameworks, zero dependencies. Brutalist MANIFEST × LEDGER design, 7-language runtime i18n (EN · PT-BR · ES · FR · DE · IT · PL), reduced-motion support.
- `scripts/sync-repos.mjs` — regenerates the "Shipping Log" section from the live GitHub and GitLab APIs. All fetched text is HTML-escaped; curated card copy lives in `data/repo-overrides.json`.
- `.github/workflows/sync.yml` — runs the sync daily at 07:00 America/Cuiaba and commits only when something changed. Vercel redeploys on every push, so the site refreshes itself with no human in the loop.

A portfolio that rebuilds itself every morning — built as an agentic workflow with Claude Code: spec → persistent context → build → headless-browser visual QA → ship.

## Deploy

Static site, no build step. On Vercel: import this repo, framework preset **Other**, output directory **/** — done.
