# PROJECT KNOWLEDGE BASE

**Generated:** 2026-09-21 23:53 -06:00  
**Commit:** e08dc61  
**Branch:** MAIN

## OVERVIEW

ARKAIOS Educación Libre is a multi-surface educational platform: standalone vanilla HTML modules, Vercel serverless endpoints, a Capacitor Android shell, and an isolated enterprise TSX integration.

## STRUCTURE

```text
./
├── api/                         # Vercel serverless handlers; scoped rules in api/AGENTS.md
├── android-app/                 # Remote-site Capacitor Android wrapper; scoped rules apply
├── integrations/arkaios-empresarial/ # Separate TSX enterprise surface; scoped rules apply
├── css/styles.css               # Shared launcher-shell styles
├── js/main.js                   # Alternate iframe/workspace controller
├── tools/convert-html-plus.js   # Idempotent ARKAIOS HTML+ converter
├── index.html                   # Launcher, membership guard, menu, iframe workspace
├── modules.json                 # Generated root-module registry
├── generateModules.js           # Root-only HTML module manifest generator
├── arkaios-orquestador.js       # Optional shared template orchestration runtime
└── arkaios-biblioteca.js        # Optional library/PDF runtime
```

## WHERE TO LOOK

| Task | Location | Notes |
|---|---|---|
| Add an educational module | root `*.html`, then `generateModules.js` | Discovery is root-only and filename classification is heuristic. |
| Change launcher/menu/workspace | `index.html`, `modules.json`, `css/styles.css` | Modules load in `#plantillaFrame`; served origin is required. |
| Add ARKAIOS template behavior | `tools/convert-html-plus.js`, `arkaios-*.js`, `schemas/` | Converter injects scripts/body marker idempotently. |
| Serverless/API change | `api/`, `vercel.json` | Follow `api/AGENTS.md`. |
| Native wrapper change | `android-app/` | Follow `android-app/AGENTS.md`. |
| Enterprise TSX change | `integrations/arkaios-empresarial/` | Follow its scoped instructions. |

## CODE MAP

| Symbol/file | Type | Role |
|---|---|---|
| `index.html` | web entry | Fetches `modules.json`, guards membership, owns iframe workspace and calls `/api/save-material` and `/api/bridge`. |
| `generateModules.js` | Node ESM script | Rebuilds the manifest from root-level HTML files. |
| `arkaios-orquestador.js` | browser runtime | Discovers template hooks and calls AI orchestration/image endpoints. |
| `api/_coreProxy.js` | serverless helper | Shared Core/POS CORS/config/JSON forwarding contract. |
| `android-app/capacitor.config.json` | mobile config | Points Capacitor at the deployed web application. |

## CONVENTIONS

- Root modules are standalone vanilla HTML/JS; shared ARKAIOS runtimes are opt-in.
- New discoverable modules must be root-level `.html` files with relative `target` names; run `node generateModules.js` instead of hand-maintaining `modules.json`.
- Use `node tools/convert-html-plus.js <file.html> --dry-run` before conversion; add `--with-library` only when that UI is wanted.
- Template workspace persistence uses `ARKAIOS_getData` / `ARKAIOS_setData` and launcher `localStorage` keys.
- Keep print-oriented templates compatible with Carta output.

## ANTI-PATTERNS (THIS PROJECT)

- Do not assume the root has a dev server, linter, test runner, or web build command: none is configured.
- Do not test launcher/module API behavior from `file://`; it requires an HTTP(S) origin.
- Do not blindly edit the first `loadTemplate` in `index.html`: a later declaration overrides it.
- Do not assume routes referenced in browser code exist locally; `/api/pixabay`, `/api/freepik`, and `/api/grok` have no matching handlers at present.
- Preserve unrelated dirty worktree changes in `index.html`, `login.html`, and `api/elemia-bridge.js`.

## COMMANDS

```powershell
node generateModules.js
npm run convert:html-plus -- <file.html> --dry-run
npm run convert:html-plus -- <file.html> --with-library --template-id=<id>
```

## NOTES

- Vercel is the documented serverless target; GitHub Pages has two overlapping deployment workflows.
- There are no repository-owned automated tests. Validate modified surfaces manually; Android builds are scoped to `android-app/`.
