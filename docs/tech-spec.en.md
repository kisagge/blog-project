# Technical Overview — BY Playground

A personal blog (public feed + admin CMS) designed, built, deployed, and operated end to end by a single developer on a self-managed AWS Lightsail server, covering application code, CI/CD, and infrastructure.

> Korean: [tech-spec.md](tech-spec.md)

## 1. Summary

- **Type**: Personal full-stack web app (public feed + admin CMS)
- **Stack**: Next.js 16 (App Router · Server Actions) · React 19 · Prisma 7 + SQLite · Tailwind v4 · TypeScript
- **Infra**: Docker · AWS Lightsail · nginx · GitHub Actions (CI/CD)
- **Scale**: Single repo, single SQLite database, one container — a deliberately lean setup

## 2. Architecture

```
Visitor ── HTTPS ──> nginx ──┬─ /uploads/*  → served directly from disk volume (static)
                             └─ /*          → Next.js (next start, :3010, loopback)
                                                  │
                                   Server Actions / RSC
                                                  │
                                   Prisma 7 (driver adapter) → SQLite (/data/prod.db)

CI/CD: push to main → GitHub Actions
        test (tsc·eslint·vitest) → build & push image to GHCR → SSH deploy (pull & compose up)
```

- **Rendering**: the public feed server-renders its first page (SEO, fast first paint), then the client loads more incrementally via a Server Action.
- **Auth**: JWT session cookie signed with jose; `proxy.ts` (Next 16 middleware) protects `/admin`.
- **Files**: uploaded images live on a volume and are served by nginx directly, bypassing the app.

## 3. Tech Stack

| Area         | Tech                            | Version    | Rationale                                                                     |
| ------------ | ------------------------------- | ---------- | ----------------------------------------------------------------------------- |
| Framework    | Next.js (App Router)            | 16.2.7     | Server Actions/RSC handle mutations without a separate API layer              |
| UI           | React / Tailwind CSS            | 19.2 / v4  | —                                                                             |
| ORM/DB       | Prisma / SQLite                 | 7.8 / —    | Driver adapter (better-sqlite3 12.10) removes the runtime query-engine binary |
| Auth         | jose (JWT)                      | 6.2        | Lightweight signing that verifies even in the edge middleware                 |
| Content      | react-markdown + remark-gfm     | 10.1 / 4.0 | Markdown rendering for post bodies                                            |
| Validation   | zod                             | 4.4        | Form and upload input validation                                              |
| Testing      | Vitest                          | 4.1        | Pure-logic + temp-SQLite integration tests                                    |
| Build/Deploy | Docker · GitHub Actions · nginx | —          | GHCR image + SSH deploy                                                       |

## 4. Engineering Highlights

### 4.1 Container image optimization — 2.05GB → 876MB (−57%)

Traced slow/hanging deploys to the runtime image, analyzed it, and removed three sources of bloat.

- **Production-only dependencies**: the runner uses `pnpm install --prod`, dropping dev dependencies (node_modules 934MB → 676MB).
- **Build toolchain isolated**: moved `python3/make/g++` to a build-only stage; the runtime copies only the compiled native binary.
- **Layer duplication removed**: `chown -R` was duplicating the entire node_modules (~640MB) into a new overlay layer — replaced with `COPY --chown`.
- **Result**: first-pull time on deploy dropped from **10m32s to 37s**. Verified locally by running the actual container (migrate, queries, image upload) before shipping.

### 4.2 Deploy pipeline diagnosis & hardening

Diagnosed production deploy failures from logs and system metrics, then hardened the pipeline incrementally.

- **Disk exhaustion**: accumulated unused images filled `/`, stalling layer extraction → added a cleanup step before `pull` plus per-step timing logs.
- **Out of memory**: on a 512MB instance, deploys OOM-killed the container (→ 504) → fixed with a 2GB swap file, recommended an instance upsize.
- **Workflow**: `test → build/push (GHCR) → SSH deploy`, with manual trigger (workflow_dispatch) and `script_stop`/timeouts for visible failures.

### 4.3 Prisma 7 driver adapter

Prisma 7 dropped the bundled query engine, so I adopted the `@prisma/adapter-better-sqlite3` driver adapter. Runtime queries no longer need the Rust engine binary, which compounded the image slimming in 4.1.

### 4.4 Maintenance mode

Lets the admin toggle the public site on/off for external visitors, backed by a singleton settings row and a guard utility.

- The guard lives in a **layout**, not the page, so it runs before the `loading.tsx` Suspense boundary — giving non-admins a **clean 307 redirect** to `/maintenance` with no skeleton flash.
- The same guard is applied to the infinite-scroll Server Action to prevent data leakage.

### 4.5 Feed search + infinite scroll

Combines title/body/summary substring search with 10-item infinite scroll.

- A `take+1` fetch determines whether a next page exists without a separate count query.
- Search is debounced at 300ms and uses a **request sequence (reqId) to discard stale responses** during fast typing, avoiding races. The query syncs to `?q=` for shareable results.

### 4.6 Testing approach

Mocking Prisma calls for DB logic only restates the code, so I built an integration helper (`lib/test-db.ts`) that runs **real queries against a temporary SQLite database**, covering pagination, search, and the settings toggle. Test count went from 17 to 28.

## 5. Outcomes

- Runtime image **2.05GB → 876MB (−57%)**, first deploy pull **10m32s → 37s**
- Diagnosed and resolved production incidents (disk exhaustion, OOM), restoring deploy reliability
- Removed the runtime engine binary via the Prisma 7 driver adapter
- Introduced integration tests (17 → 28); CI gates on typecheck, lint, test, and image build
- Per-feature PRs, automated deploys, and pre-1.0 semver for a clean change history
