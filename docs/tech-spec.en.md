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

- **Concurrency tuning**: switched SQLite to **WAL mode** (`PRAGMA journal_mode=WAL`, persistent at the file level) so writes (view tracking, comments, likes) don't block reads, and made `busy_timeout` explicit via the adapter's `timeout` (5000ms). Feed/comment like toggles wrap `find→toggle→count` in a **`$transaction`** so concurrent toggles can't interleave between awaits and broadcast an inconsistent count over SSE.

### 4.4 Membership — approval flow + role-union session

Extended auth from a single password-only admin to external members with a signup/approval flow.

- **Union session**: the cookie payload is modeled as `{role:"admin"} | {role:"member", userId, nickname}`. A distributive `Omit` utility serializes it without losing member-only fields.
- **Approval flow**: signup creates a `pending` user; an admin approval flips it to `approved`. Rejection keeps the row as `rejected` with a reason — re-applying with the same email reverts that row to `pending`, preserving the prior reason for the admin.
- **Password reset**: a 6-digit code is emailed (stored as a scrypt hash, never in plaintext), with a 3-minute expiry, an attempt limit, and a resend cooldown (anti email-bomb). With no SMTP configured it falls back to a console log so local dev isn't blocked.
- Password hashing is implemented with the standard-library `scrypt` (`salt:hash`), verified without external dependencies.

### 4.5 Three-tier visibility & access control (shared by feed and DFO)

Public / members-only / private (draft), implemented as an app-layer union type (SQLite has no native enums) and applied consistently to both single items and lists.

- **Single source of truth**: `checkAccess(visibility, role)` (single: ok / members-only / not-found) and `listableVisibilities(role)` (list filter) keep the rules in one place, shared by feed and DFO.
- Private returns a **404** to non-admins (hiding even its existence); members-only shows a **signup gate** to anonymous visitors; the admin can see private drafts in both lists and detail (with a "private" badge in lists). Private posts hide their share buttons to avoid surfacing dead external links.
- Migrations preserve the meaning of existing data (e.g. moving existing items to the appropriate tier) via hand-written data-conversion SQL.

### 4.6 Comments, likes & bookmarks

Two-level comments (replies), feed/comment likes, and personal bookmarks, built on Server Actions.

- Replies are allowed only on top-level comments (depth check); deletion branches soft/hard depending on whether children exist. Likes toggle with a `(user, target)` unique constraint. Authors can edit their own comments (`editedAt` recorded → "(edited)" marker, propagated live via SSE). Under popular sort, deleted comments sink to the bottom regardless of likes (`deletedAt` nulls-first).
- **Bookmarks**: isomorphic to likes (`Bookmark` `(user, feed)` unique toggle) but **member-only and personal**, so no public count or real-time (SSE) — just an optimistic toggle with debounce (admin is excluded from the button/action since there's no admin saved list). Viewed newest-saved-first at `/account/saved` (the list card markup is shared with public listings via `FeedCardItem`); posts that became private/hidden after saving are filtered out by member-visibility rules.
- To receive notifications for admin-authored posts, a non-loginable **reserved admin User** (singleton) lets an admin — who has no `userId` in the session — be represented as author/recipient in the domain model.

### 4.7 PWA + web push + in-app notifications

Built an installable PWA alongside notifications.

- **PWA**: `manifest` + a service worker (offline caching) + icons. The service worker focuses/opens the relevant URL on push receipt/click.
- **Web push**: VAPID-based (web-push); per-device subscriptions are stored unique by `endpoint`, and expired (404/410) subscriptions are pruned during send.
- **In-app notification center**: a comment notifies the feed owner, a reply notifies the parent comment's author. Entering the page auto-marks read; clicking a notification deep-links via `?c={commentId}` to **scroll and highlight that comment** (auto-expanding the parent thread for replies). This is groundwork for generalizing "owner" to user-authored posts later.
- **@mention notifications**: an `@nickname` in a comment notifies the mentioned **approved member** (in-app + push). Since nicknames have **no DB uniqueness and allow spaces/punctuation**, instead of regex parsing it **iterates approved members and matches `@<nickname>` as a substring** (robust to spaces and Korean suffixes; self, non-mentioned, `notifyOnMention`-off, and non-approved users are skipped). The rendered comment highlights `@tokens` in color (no link, since nicknames aren't unique). Mention fan-out is **batched** since there can be many targets — in-app via `createMany`+`groupBy` (bulk unread tally), push via a single `pushSubscription … userId in [...]` lookup then parallel sends — so it's **constant queries regardless of target count** (N+1 removed).
- **Notification preferences**: members toggle delivery per type (replies, comments on my posts, **mentions**) via `User.notifyOnReply/notifyOnComment/notifyOnMention`. Control is per-event, so turning one off **suppresses both in-app and push** (the notify functions check the recipient's preference and skip). Orthogonal to per-device push subscription (`PushToggle`) — one is "which events", the other "this device". Entry point: while on the notification center (`/notifications`) the header bell **switches to a settings gear** (unread is already marked 0 there, so the badge is moot — members only; admin keeps the bell).
- **Real-time notifications (SSE)**: the header bell badge updates live via **Server-Sent Events** (web push covers closed tabs, SSE covers open ones — complementary). On a single container, an **in-memory channel bus** (`lib/events.ts`, same shape as the rate-limit Map) has `createNotification`/`markAllRead` publish the unread count, and the `/api/events` route streams it to subscribers via a `ReadableStream`. **No nginx change** (response `X-Accel-Buffering: no` + a 25s heartbeat avoid buffering and idle timeouts); on disconnect (`req.signal` abort/cancel) the subscription and interval are cleaned up to prevent leaks. EventSource auto-reconnects and the current count is re-sent on connect to resync.
- **Real-time comments (SSE)**: extends the same bus with a `feed:{id}` channel. The add/delete comment server actions publish a `CommentEvent` (the created node / deleted id), and the `/api/feed-events` route streams it under the **same access gate as the post detail** (`checkAccess` + draft/hidden blocking; public posts allow anon). The client merges into the tree with the **same pure functions used for optimistic insertion** (`merge.ts`'s `applyCreated`/`applyEdited`/`applyDeleted`/`applyLikeCount`), and **id-based dedup** absorbs the overlap among the author's optimistic insert, the SSE echo, and a `loadMore` re-appearance (remote events don't scroll). **Both comment and post like counts propagate live** over the same channel (rapid toggles are debounced to one request ~500ms). Since the like button is a sibling outside the comment tree, a single EventSource on the `feed:{id}` channel is **shared via a client provider (`FeedEventsProvider`)** so the comment section and like button split one connection (avoiding duplicate connections for anonymous viewers on public posts). The channel carries a `FeedEvent` union (comment events ∪ `feedLike`) and each consumer branches on `kind`. Events occurring during a disconnect (deploy restart, network drop) aren't received live, but **on reconnect (EventSource `onopen` firing again) the provider fans out a `resync` signal** so the comment section refetches a page (sized to the current load) and the like button refetches its summary, replacing state with server truth (mirroring how the unread bell re-sends its current value on connect).

### 4.8 Global request rate limiting (abuse prevention)

To curb general request floods, `proxy.ts` applies a fixed-window per-IP counter (429 beyond 120 req/10s).

- Confirmed from the docs that the Next 16 proxy runs on the **Node runtime**, so in-memory `Map` state persists within the single-instance (`next start`) process — reliable without an external store.
- The matcher covers dynamic requests broadly but excludes static assets, images, and uploads so normal traffic (prefetch, images) doesn't consume the budget.
- For human/bot separation on **signup, login, and password-reset requests**, an optional **Cloudflare Turnstile CAPTCHA** is added and verified in the server action. With no secret configured the widget isn't shown and verification passes — **fully inert** (the same graceful degradation as SMTP/TOTP). Tokens are single-use, so the widget resets on a failed verification.

### 4.9 Maintenance mode

Lets the admin toggle the public site on/off for external visitors, backed by a singleton settings row and a guard utility.

- The guard lives in a **layout**, not the page, so it runs before the `loading.tsx` Suspense boundary — giving non-admins a **clean 307 redirect** to `/maintenance` with no skeleton flash.
- The same guard is applied to the infinite-scroll Server Action to prevent data leakage.

### 4.10 Feed search + infinite scroll

Combines title/body/summary search with 10-item infinite scroll. Queries of 3+ chars use **SQLite FTS5 full-text search**; otherwise (empty or 2-char) it falls back to substring match, newest-first.

- **FTS5 full-text search**: a `feed_fts` virtual table (**external content** — no duplicated body text, shares "Feed"'s rowid) indexed with the **trigram tokenizer**, preserving Korean/CJK substring matching (e.g. "물고기" matches inside "강아지물고기") like LIKE while using an inverted index. `AFTER INSERT/UPDATE/DELETE` triggers keep it in sync with Feed automatically (no app-code change), and the migration backfills existing rows. Virtual tables/triggers can't be expressed as Prisma models, so they live in **raw SQL outside schema.prisma** (authored via `migrate dev --create-only`, applied in prod by `migrate deploy`; the test DB mirrors the same DDL in `lib/test-db.ts`'s SCHEMA).
- **Relevance ranking & query composition**: `bm25(feed_fts, 10,5,1)` weights title > summary > content. Search obtains only the **ranked Feed.id candidates** from FTS, then reuses the existing Prisma path for access/author/tag filters and SELECT (DRY) — candidate ids are non-sensitive; the real data is gated by the second Prisma stage. Multiple tokens are AND-ed (all must appear); FTS operators/quotes are phrase-escaped and bound via `?`. Tokens under 3 chars are trigram-ineligible, so they take the contains fallback.
- A `take+1` (fallback) / candidate slice (FTS) determines whether a next page exists without a separate count query.
- Search is debounced at 300ms and uses a **request sequence (reqId) to discard stale responses** during fast typing, avoiding races. The query syncs to `?q=` for shareable results.
- **Related posts**: the post detail footer recommends posts sharing tags (`getRelatedFeeds`). Candidates come from `feedTags.some` + `listableVisibilities(role)` (the same access gate as search), re-sorted by **shared-tag count → recency** (self and private/hidden/draft excluded; nothing shown if the post has no tags).

### 4.11 Testing approach

Mocking Prisma calls for DB logic only restates the code, so I built an integration helper (`lib/test-db.ts`) that runs **real queries against a temporary SQLite database**, covering pagination, search, access control, the approval flow, comment depth, likes, notifications, rate limiting, and reporting. Test count grew from **17 to 264**.

### 4.12 Content reporting & moderation

Added user reporting of member content (comments and member posts) with admin moderation.

- **Report ingestion**: `Report(targetType,targetId,reporterId,reason,detail,status)` with `@@unique([targetType,targetId,reporterId])` for **one report per member per target**. The server rejects own content, admin content, and already-hidden targets; since SQLite lacks `createMany.skipDuplicates`, duplicates are de-duped by **catching the unique-violation (P2002)**. Only the first report of a new target notifies the reserved admin (in-app + push), curbing brigading spam.
- **Reversible hiding**: a separate `hiddenAt` (on Comment and Feed), distinct from user deletion (`deletedAt`), represents moderation hiding; hiding marks that target's pending reports `resolved`. Hidden content is filtered out of **every consumer** — listings (searchFeeds), profiles (listMemberPosts, getCommentsByUser), detail (admin-only view), and the comment tree (body blanked) — and the admin can restore it anytime.
- **Admin queue** (`/admin/reports`): split into "pending"/"hidden" **sub-tabs**. Groups reports per target with count, reasons, and a preview; hide/dismiss, plus an unhide list for hidden content. The pending count shows as an admin-nav badge — **updated live via SSE (`reports` channel)** on new reports/resolution without a refresh.

### 4.13 Admin stats dashboard

`/admin/stats` adds view/signup trends, top posts, and headline numbers (CSS bars, no charting library).

- **KST-correct aggregation**: `View.day` is already a KST `YYYY-MM-DD` **string**, so `view.groupBy(by:["day"])` gives daily view counts with no raw SQL (lexical = chronological order). `User.createdAt`, however, is a `DateTime`, so daily signups use **raw SQL `date(createdAt, '+9 hours')`** to extract the KST day (Prisma `groupBy` would split the timestamp by the second). Both trends build a recent-N-day KST window and **fill missing days with 0**.
- Top posts use cumulative `Feed.viewCount desc` (one view = one unique View row). Access inherits the `/admin` layout's `verifySession()`. Bars keep the label and value as real text with the bar itself `aria-hidden`, so the chart is screen-reader accessible.

### 4.14 Error boundaries (recoverable failure handling)

Added App Router error boundaries so a render-time exception no longer leaks a blank screen or the framework default.

- **`app/error.tsx`** (root segment): catches render exceptions for any page without a closer boundary and recovers with a Korean fallback + **retry** (`unstable_retry`). It renders inside the root layout, so the header stays.
- **`app/global-error.tsx`**: the last-resort fallback for exceptions thrown by the root layout itself (session/notification DB calls, etc.) — it replaces the root layout, so it renders its own `<html>/<body>` plus `globals.css`.
- Both share one fallback (`app/error-fallback.tsx`) for DRY: a single `<main>` landmark and `h1`, the message region scoped with `role="alert"`, and a home link as a plain `<a>` (hard navigation) so it works even when the router tree is gone. Note this Next version names the recovery prop **`unstable_retry`**, not `reset`.

## 5. Outcomes

- Runtime image **2.05GB → 876MB (−57%)**, first deploy pull **10m32s → 37s**
- Diagnosed and resolved production incidents (disk exhaustion, OOM), restoring deploy reliability
- Removed the runtime engine binary via the Prisma 7 driver adapter
- Grew from a single admin to approved members with comments, likes, notifications, reporting/moderation, and PWA (role-union session, shared access control)
- Introduced integration tests (17 → 264); CI gates on typecheck, lint, test, and image build
- Per-feature PRs, automated deploys, and pre-1.0 semver for a clean change history
