# Technical Overview — BY Playground

A personal blog (public feed + member community + admin CMS) designed, built, deployed, and operated end to end by a single developer on a self-managed AWS Lightsail server, covering application code, CI/CD, and infrastructure.

> Korean: [tech-spec.md](tech-spec.md)

## 1. Summary

- **Type**: Personal full-stack web app — public feed · DFO character showcase · member community (comments, likes, notifications) · admin CMS
- **Stack**: Next.js 16 (App Router · Server Actions) · React 19 · Prisma 7 + SQLite · Tailwind v4 · TypeScript
- **Infra**: Docker · AWS Lightsail · nginx · GitHub Actions (CI/CD)
- **Scale**: Single repo, single SQLite database, one container — a deliberately lean setup

## 2. Architecture

```
Visitor/Member ─ HTTPS ─> nginx ──┬─ /uploads/*  → served directly from disk volume (static)
                                  └─ /*          → Next.js (next start, :3010, loopback)
                                                      │
                                  proxy.ts ─ global IP rate limit + /admin guard
                                                      │
                                  Server Actions / RSC
                                        │                    │
                          Prisma 7 (adapter) → SQLite    web-push → browser push
                                                             nodemailer (SMTP) → email

CI/CD: push to main → GitHub Actions
        test (tsc·eslint·vitest) → build & push image to GHCR → SSH deploy (pull & compose up + migrate deploy)
```

- **Rendering**: public lists server-render their first page (SEO, fast first paint), then the client loads more incrementally via a Server Action.
- **Auth & roles**: JWT session cookie signed with jose; the session is an `admin | member` union. `proxy.ts` (Next 16 middleware, Node runtime) guards `/admin` and applies a global request rate limit.
- **Files**: uploaded images live on a volume and are served by nginx directly, bypassing the app.

## 3. Tech Stack

| Area         | Tech                            | Version    | Rationale                                                                     |
| ------------ | ------------------------------- | ---------- | ----------------------------------------------------------------------------- |
| Framework    | Next.js (App Router)            | 16.2.7     | Server Actions/RSC handle mutations without a separate API layer              |
| UI           | React / Tailwind CSS            | 19.2 / v4  | —                                                                             |
| ORM/DB       | Prisma / SQLite                 | 7.8 / —    | Driver adapter (better-sqlite3 12.10) removes the runtime query-engine binary |
| Auth         | jose (JWT)                      | 6.2        | Lightweight signing that verifies even in middleware                          |
| Content      | react-markdown + remark-gfm     | 10.1 / 4.0 | Markdown rendering for post bodies                                            |
| Validation   | zod                             | 4.4        | Form and upload input validation                                              |
| Notif/Mail   | web-push / nodemailer           | —          | VAPID web push · SMTP (SES) transactional email                               |
| Sortable UI  | @dnd-kit                        | —          | Drag-to-reorder for DFO characters                                            |
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
- **Workflow**: `test → build/push (GHCR) → SSH deploy (+ `prisma migrate deploy`)`, with manual trigger (workflow_dispatch) and timeouts for visible failures.

### 4.3 Prisma 7 driver adapter

Prisma 7 dropped the bundled query engine, so I adopted the `@prisma/adapter-better-sqlite3` driver adapter. Runtime queries no longer need the Rust engine binary, which compounded the image slimming in 4.1.

### 4.4 Membership — approval flow + role-union session

Extended auth from a single password-only admin to external members with a signup/approval flow.

- **Union session**: the cookie payload is modeled as `{role:"admin"} | {role:"member", userId, nickname}`. A distributive `Omit` utility serializes it without losing member-only fields.
- **Approval flow**: signup creates a `pending` user; an admin approval flips it to `approved`. Rejection keeps the row as `rejected` with a reason — re-applying with the same email reverts that row to `pending`, preserving the prior reason for the admin.
- **Password reset**: a 6-digit code is emailed (stored as a scrypt hash, never in plaintext), with a 3-minute expiry and an attempt limit. With no SMTP configured it falls back to a console log so local dev isn't blocked.
- Password hashing is implemented with the standard-library `scrypt` (`salt:hash`), verified without external dependencies.

### 4.5 Three-tier visibility & access control (shared by feed and DFO)

Public / members-only / private (draft), implemented as an app-layer union type (SQLite has no native enums) and applied consistently to both single items and lists.

- **Single source of truth**: `checkAccess(visibility, role)` (single: ok / members-only / not-found) and `listableVisibilities(role)` (list filter) keep the rules in one place, shared by feed and DFO.
- Private returns a **404** to non-admins (hiding even its existence); members-only shows a **signup gate** to anonymous visitors; the admin can see private drafts in both lists and detail (with a "private" badge in lists). Private posts hide their share buttons to avoid surfacing dead external links.
- Migrations preserve the meaning of existing data (e.g. moving existing items to the appropriate tier) via hand-written data-conversion SQL.

### 4.6 Comments & likes

Two-level comments (replies) plus feed and comment likes, built on Server Actions.

- Replies are allowed only on top-level comments (depth check); deletion branches soft/hard depending on whether children exist. Likes toggle with a `(user, target)` unique constraint.
- To receive notifications for admin-authored posts, a non-loginable **reserved admin User** (singleton) lets an admin — who has no `userId` in the session — be represented as author/recipient in the domain model.

### 4.7 PWA + web push + in-app notifications

Built an installable PWA alongside notifications.

- **PWA**: `manifest` + a service worker (offline caching) + icons. The service worker focuses/opens the relevant URL on push receipt/click.
- **Web push**: VAPID-based (web-push); per-device subscriptions are stored unique by `endpoint`, and expired (404/410) subscriptions are pruned during send.
- **In-app notification center**: a comment notifies the feed owner, a reply notifies the parent comment's author. Entering the page auto-marks read; clicking a notification deep-links via `?c={commentId}` to **scroll and highlight that comment** (auto-expanding the parent thread for replies). This is groundwork for generalizing "owner" to user-authored posts later.

### 4.8 Global request rate limiting (abuse prevention)

To curb general request floods, `proxy.ts` applies a fixed-window per-IP counter (429 beyond 120 req/10s).

- Confirmed from the docs that the Next 16 proxy runs on the **Node runtime**, so in-memory `Map` state persists within the single-instance (`next start`) process — reliable without an external store.
- The matcher covers dynamic requests broadly but excludes static assets, images, and uploads so normal traffic (prefetch, images) doesn't consume the budget.

### 4.9 Maintenance mode

Lets the admin toggle the public site on/off for external visitors, backed by a singleton settings row and a guard utility.

- The guard lives in a **layout**, not the page, so it runs before the `loading.tsx` Suspense boundary — giving non-admins a **clean 307 redirect** to `/maintenance` with no skeleton flash.
- The same guard is applied to the infinite-scroll Server Action to prevent data leakage.

### 4.10 Feed search + infinite scroll

Combines title/body/summary substring search with 10-item infinite scroll.

- A `take+1` fetch determines whether a next page exists without a separate count query.
- Search is debounced at 300ms and uses a **request sequence (reqId) to discard stale responses** during fast typing, avoiding races. The query syncs to `?q=` for shareable results.

### 4.11 Testing approach

Mocking Prisma calls for DB logic only restates the code, so I built an integration helper (`lib/test-db.ts`) that runs **real queries against a temporary SQLite database**, covering pagination, search, access control, the approval flow, comment depth, likes, notifications, and rate limiting. Test count grew from **17 to 121**.

## 5. Outcomes

- Runtime image **2.05GB → 876MB (−57%)**, first deploy pull **10m32s → 37s**
- Diagnosed and resolved production incidents (disk exhaustion, OOM), restoring deploy reliability
- Removed the runtime engine binary via the Prisma 7 driver adapter
- Grew from a single admin to approved members with comments, likes, notifications, and PWA (role-union session, shared access control)
- Introduced integration tests (17 → 121); CI gates on typecheck, lint, test, and image build
- Per-feature PRs, automated deploys, and pre-1.0 semver for a clean change history
