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
| Framework    | Next.js (App Router)            | 16.2.9     | Server Actions/RSC handle mutations without a separate API layer              |
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
- **CI hygiene gates**: the test job must pass `tsc → eslint → prettier --check → vitest → pnpm audit (--prod --audit-level critical)` before build/deploy proceeds, blocking formatting and **critical runtime-vuln** regressions pre-merge (current prod vulns are all transitive via `prisma>@prisma/dev>hono`, so the critical gate stays green; high/moderate are handled by Dependabot).
- **Dependency automation**: `.github/dependabot.yml` checks npm, GitHub Actions, and the Docker base image weekly, grouping minor/patch into a single PR and splitting majors into individual PRs (supply-chain/pin regression guard, minimal PR noise).
- **Healthcheck + hang detection**: `/api/health` verifies a `SELECT 1` DB ping (returns only a status string, no internals) and `compose.yaml` `healthcheck` probes every 30s — catching the "responding but DB is dead" hang that `restart: unless-stopped` (process-death only) misses, marking the container unhealthy. Since the runtime image has no curl/wget, the probe uses **node's global fetch**, with `start_period` covering `migrate deploy` + `next start` startup. Health is excluded from the `proxy.ts` matcher so it bypasses the IP rate limit and `/admin` guard (the probe always answers).
- **Admin audit log**: governance actions (feed CRUD/visibility, member approve/reject/block, report hide/unhide/dismiss, series CRUD, maintenance toggle, admin nickname) are appended to `AuditLog` via `logAudit`. Since admin is a singleton, "who" is implicit — so it records **what/when + a write-time summary snapshot** (preserved even if the target is later deleted), viewable newest-first at `/admin/audit`. `logAudit` is best-effort (never throws) so an audit failure can't block the governance action.

### 4.3 Prisma 7 driver adapter

Prisma 7 dropped the bundled query engine, so I adopted the `@prisma/adapter-better-sqlite3` driver adapter. Runtime queries no longer need the Rust engine binary, which compounded the image slimming in 4.1.

- **Concurrency tuning**: switched SQLite to **WAL mode** (`PRAGMA journal_mode=WAL`, persistent at the file level) so writes (view tracking, comments, likes) don't block reads, and made `busy_timeout` explicit via the adapter's `timeout` (5000ms). Feed/comment like toggles wrap `find→toggle→count` in a **`$transaction`** so concurrent toggles can't interleave between awaits and broadcast an inconsistent count over SSE. View tracking likewise wraps the **View insert + `viewCount` increment in one `$transaction`** (both roll back on failure), preventing drift/orphan rows, and the unread-notification count (bell badge) uses `@@index([userId, readAt])` to avoid a partial scan.

### 4.4 Membership — approval flow + role-union session

Extended auth from a single password-only admin to external members with a signup/approval flow.

- **Union session**: the cookie payload is modeled as `{role:"admin"} | {role:"member", userId, nickname}`. A distributive `Omit` utility serializes it without losing member-only fields.
- **Approval flow**: signup creates a `pending` user; an admin approval flips it to `approved`. Rejection keeps the row as `rejected` with a reason — re-applying with the same email reverts that row to `pending`, preserving the prior reason for the admin.
- **Password reset**: a 6-digit code is emailed (stored as a scrypt hash, never in plaintext), with a 3-minute expiry, an attempt limit, and a resend cooldown (anti email-bomb). The code email ships a **branded HTML template** (email-client-safe markup — table layout, inline styles, zero external resources; pure `lib/email-template.ts`) alongside a **plain-text fallback**. With no SMTP configured it falls back to a console log so local dev isn't blocked.
- Password hashing is implemented with the standard-library `scrypt` (`salt:hash`), verified without external dependencies.
- **Profile bio & avatar**: members edit a bio (160 chars) and avatar at `/account`, shown on `/u/[id]`. The avatar is a **member upload** (separate from the admin-only `uploadImage` — the save logic is shared via `lib/save-image.ts` `saveImage`, swapping only the guard to `getMemberSession` + a per-member rate limit). `avatarUrl` is zod-validated to **local `/uploads/<uuid>.<ext>` paths only** (blocking external URLs and `javascript:`), with empty meaning removed. Display falls back to a nickname-initial placeholder (shared `Avatar`) when there's no image. Uploads are validated not just by declared MIME but by **magic bytes** (`sniffImageType`) to reject disguised files (admin + member), and replacing/removing an avatar **cleans up the previous file from disk** (`deleteUpload`).
- **Member inline post images**: the member post editor uploads body images through the same `saveImage` infra (`getMemberSession` + a `postImageUpload` rate limit + magic bytes). Since the textarea is a controlled component, `spliceText` (pure) inserts `![](…?w&h)` at the cursor and `setContent` updates state/autosave, so the image rides #28's CLS-safe render (width/height, lazy). The file input is `sr-only` with a button trigger for keyboard access.

### 4.5 Three-tier visibility & access control (shared by feed and DFO)

Public / members-only / private (draft), implemented as an app-layer union type (SQLite has no native enums) and applied consistently to both single items and lists.

- **Single source of truth**: `checkAccess(visibility, role)` (single: ok / members-only / not-found) and `listableVisibilities(role)` (list filter) keep the rules in one place, shared by feed and DFO.
- Private returns a **404** to non-admins (hiding even its existence); members-only shows a **signup gate** to anonymous visitors; the admin can see private drafts in both lists and detail (with a "private" badge in lists). Private posts hide their share buttons to avoid surfacing dead external links.
- Migrations preserve the meaning of existing data (e.g. moving existing items to the appropriate tier) via hand-written data-conversion SQL.

### 4.6 Comments, likes & bookmarks

Two-level comments (replies), feed/comment likes, and personal bookmarks, built on Server Actions.

- Replies are allowed only on top-level comments (depth check); deletion branches soft/hard depending on whether children exist. Likes toggle with a `(user, target)` unique constraint. Authors can edit their own comments (`editedAt` recorded → "(edited)" marker, propagated live via SSE). Under popular sort, deleted comments sink to the bottom regardless of likes (`deletedAt` nulls-first). Like/reaction buttons **roll back the optimistic toggle on failure (e.g. a 429)** — reverting only the un-committed local change, with SSE as the authoritative count source (shared across comment/feed likes and reactions). Sort (popular/newest) swaps the server ordering via a `?sort=` URL link + `key` remount (load-more and SSE resync re-pass the same `sort`), and the control is an **accessible segmented toggle** (`role="group"` + `aria-current`, exposing the active sort to screen readers).
- **Bookmarks**: isomorphic to likes (`Bookmark` `(user, feed)` unique toggle) but **member-only and personal**, so no public count or real-time (SSE) — just an optimistic toggle with debounce (admin is excluded from the button/action since there's no admin saved list). Viewed newest-saved-first at `/account/saved` (the list card markup is shared with public listings via `FeedCardItem`); posts that became private/hidden after saving are filtered out by member-visibility rules.
- To receive notifications for admin-authored posts, a non-loginable **reserved admin User** (singleton) lets an admin — who has no `userId` in the session — be represented as author/recipient in the domain model.
- **Comment emoji reactions**: a separate model (`CommentReaction`, unique `(comment, user, emoji)`) that **coexists** with the ♥ like, attaching a fixed 5-emoji set (👍 😂 😮 😢 🎉) to comments/replies. **Homomorphic** to the like toggle — `$transaction` makes toggle+count atomic, and an SSE `reaction` event broadcasts the live count (the viewer's own `reacted` is owned by the component's optimistic state, so others' reactions never overwrite my toggle). Aggregation batches via `getReactionSummaries` (`groupBy(commentId,emoji)` once, attached to nodes like the like `likedIds`, count>0 only). Emoji constants/labels live in a client-safe module (`lib/reactions.ts`; DB functions stay server-only). Chips use `aria-pressed`; the add-picker uses `aria-haspopup`/`aria-expanded` + `menuitemcheckbox` (Esc/outside-click close, focus return). Clicks are optimistic with a 500ms debounce (even-clicks no-op), and **on action failure (e.g. the global IP 429) the optimistic state rolls back** (a re-toggle mid-flight is preserved via a race guard — the same pattern as the follow button).
- **Post emoji reactions**: the same 5-emoji set also applies to **posts (feeds)** (`FeedReaction`, unique `(feed, user, emoji)` — homomorphic to `CommentReaction`, reusing the `lib/reactions.ts` constants verbatim). Comment reactions ride on tree nodes and update via `comment-section`'s SSE merge, but post reactions — **like the like button — have the leaf component subscribe to the feed SSE directly** (`feedReaction` events update counts; on reconnect `getFeedReactionSummaryAction` resyncs, except it preserves the optimistic state while a toggle is in flight). Placed below the like/bookmark row, sharing the single feed SSE connection.

### 4.7 PWA + web push + in-app notifications

Built an installable PWA alongside notifications.

- **PWA**: `manifest` + a service worker (offline caching) + icons. The service worker focuses/opens the relevant URL on push receipt/click.
- **Web push**: VAPID-based (web-push); per-device subscriptions are stored unique by `endpoint`, and expired (404/410) subscriptions are pruned during send — dead endpoints are collected and removed in a **single `deleteMany({ endpoint: { in: [...] } })`** (no per-subscription queries).
- **Fire-and-forget failure visibility**: server notifications/schedulers that intentionally `.catch()` to avoid blocking the main flow (`comment-actions`, `report-actions`, `follows`, `scheduled`, `push:cleanup`) no longer swallow errors silently — `lib/log.ts swallow(tag)` logs a single **tag + message** line to the container log (no stack — saves 512MB log budget while keeping debug visibility).
- **In-app notification center**: a comment notifies the feed owner, a reply notifies the parent comment's author. Entering the page auto-marks read; clicking a notification deep-links via `?c={commentId}` to **scroll and highlight that comment** (auto-expanding the parent thread for replies). This is groundwork for generalizing "owner" to user-authored posts later.
- **@mention notifications**: an `@nickname` in a comment notifies the mentioned **approved member** (in-app + push). Since nicknames have **no DB uniqueness and allow spaces/punctuation**, instead of regex parsing it **iterates approved members and matches `@<nickname>` as a substring** (robust to spaces and Korean suffixes; self, non-mentioned, `notifyOnMention`-off, and non-approved users are skipped). The rendered comment highlights `@tokens` in color (no link, since nicknames aren't unique). Mention fan-out is **batched** since there can be many targets — in-app via `createMany`+`groupBy` (bulk unread tally), push via a single `pushSubscription … userId in [...]` lookup then parallel sends — so it's **constant queries regardless of target count** (N+1 removed).
- **Member follow + activity feed**: members follow other **approved members** (self-referential `Follow(followerId, followingId)` join — unique + bidirectional indexes; self/admin/non-approved targets rejected). `/following` aggregates followed members' posts via a single `authorId in [...]` query, newest first, gated by **`listableVisibilities(role)`** so private/hidden/draft/non-followed posts are excluded (one query regardless of how many you follow). Profiles show follower/following counts + an optimistic `FollowButton` (`aria-pressed`). Following someone sends the target an in-app + push notification (`notifyFollow`, respecting `notifyOnFollow`, only on a newly-created follow — same pattern as the other notifications).
- **Notification preferences**: members toggle delivery per type (replies, comments on my posts, **mentions**, **follows**) via `User.notifyOnReply/notifyOnComment/notifyOnMention/notifyOnFollow`. Control is per-event, so turning one off **suppresses both in-app and push** (the notify functions check the recipient's preference and skip). Orthogonal to per-device push subscription (`PushToggle`) — one is "which events", the other "this device". Entry point: while on the notification center (`/notifications`) the header bell **switches to a settings gear** (unread is already marked 0 there, so the badge is moot — members only; admin keeps the bell).
- **Real-time notifications (SSE)**: the header bell badge updates live via **Server-Sent Events** (web push covers closed tabs, SSE covers open ones — complementary). On a single container, an **in-memory channel bus** (`lib/events.ts`, same shape as the rate-limit Map) has `createNotification`/`markAllRead` publish the unread count, and the `/api/events` route streams it to subscribers via a `ReadableStream`. **No nginx change** (response `X-Accel-Buffering: no` + a 25s heartbeat avoid buffering and idle timeouts); on disconnect (`req.signal` abort/cancel) the subscription and interval are cleaned up to prevent leaks. EventSource auto-reconnects and the current count is re-sent on connect to resync.
- **Real-time comments (SSE)**: extends the same bus with a `feed:{id}` channel. The add/delete comment server actions publish a `CommentEvent` (the created node / deleted id), and the `/api/feed-events` route streams it under the **same access gate as the post detail** (`checkAccess` + draft/hidden blocking; public posts allow anon). The client merges into the tree with the **same pure functions used for optimistic insertion** (`merge.ts`'s `applyCreated`/`applyEdited`/`applyDeleted`/`applyLikeCount`), and **id-based dedup** absorbs the overlap among the author's optimistic insert, the SSE echo, and a `loadMore` re-appearance (remote events don't scroll). **Both comment and post like counts propagate live** over the same channel (rapid toggles are debounced to one request ~500ms). Since the like button is a sibling outside the comment tree, a single EventSource on the `feed:{id}` channel is **shared via a client provider (`FeedEventsProvider`)** so the comment section and like button split one connection (avoiding duplicate connections for anonymous viewers on public posts). The channel carries a `FeedEvent` union (comment events ∪ `feedLike`) and each consumer branches on `kind`. Events occurring during a disconnect (deploy restart, network drop) aren't received live, but **on reconnect (EventSource `onopen` firing again) the provider fans out a `resync` signal** so the comment section refetches a page (sized to the current load) and the like button refetches its summary, replacing state with server truth (mirroring how the unread bell re-sends its current value on connect).

### 4.8 Global request rate limiting (abuse prevention)

To curb general request floods, `proxy.ts` applies a fixed-window per-IP counter (429 beyond 120 req/10s).

- Confirmed from the docs that the Next 16 proxy runs on the **Node runtime**, so in-memory `Map` state persists within the single-instance (`next start`) process — reliable without an external store.
- **Hard bucket cap (memory safety valve)**: beyond the 60s expiry sweep, a `MAX_BUCKETS` ceiling (50k) prevents the `Map` from growing unbounded into OOM (single 512MB container) when unique keys (IP/userId) flood a window (effectively an attack) — if still over the cap after the expiry sweep, it `clear()`s wholesale (memory protection takes priority over a momentary limit reset).
- The matcher covers dynamic requests broadly but excludes static assets, images, and uploads so normal traffic (prefetch, images) doesn't consume the budget.
- For human/bot separation on **signup, login, and password-reset requests**, an optional **Cloudflare Turnstile CAPTCHA** is added and verified in the server action. With no secret configured the widget isn't shown and verification passes — **fully inert** (the same graceful degradation as SMTP/TOTP). Tokens are single-use, so the widget resets on a failed verification.
- **Per-action limits**: since the global cap (12/s) is loose against targeted abuse (login brute force, signup spam, reset-code flooding, report abuse), the same `rateLimit` util is reused per action (`allowAction(scope, id)`). Anonymous actions key by **IP** (login 10/5min, signup 5/10min, reset request 5/10min); reporting keys by **member userId** (10/10min). The gate runs **before** Turnstile so it works even when the CAPTCHA is inert, and adds defense-in-depth when it's on. (The per-email 60s cooldown on reset requests and the `(target, reporter)` unique constraint on reports remain as separate protections.)

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
- **Snippets & highlighting**: while searching, result cards show a **match-centered body excerpt** instead of the summary (`makeSnippet` — strips markdown, then a ±radius window around the first matched token with `…` when truncated). Since `content` isn't in the list SELECT, it's fetched in **one extra query keyed by the page-slice ids only** (non-search and the saved list skip it). Matched tokens in the title/excerpt are wrapped in `<mark>` by **splitting the string and wrapping only the matched fragments** (regex metachars escaped) — no HTML injection, XSS-safe.
- **Related posts**: the post detail footer recommends posts sharing tags (`getRelatedFeeds`). Candidates come from `feedTags.some` + `listableVisibilities(role)` (the same access gate as search), re-sorted by **shared-tag count → recency** (self and private/hidden/draft excluded; nothing shown if the post has no tags).
- **Admin feed search**: unlike the public FTS (which pins `status=published` and returns `hasMore`), `/admin/feeds` needs **drafts included and total-count pagination**, so `getAdminFeedsPage(page,size,q)` adds a **title/slug `contains`** filter via a server-rendered GET form. `Pager` takes a `query` prop to preserve `?q=` across page navigation. A lightweight `contains` (instead of reusing the public FTS) keeps draft visibility and a consistent total.
- **Community search filter bar**: `/community` (member posts) adds a **sort toggle (latest/popular) + popular tag chips**. Sort is a new `sort?: "latest" | "popular"` on `searchFeeds` — **omitted preserves current behavior** (FTS relevance / otherwise latest, so `/feed` and existing tests are unaffected); `popular` is `viewCount desc` (same as the popular ranking; the FTS path re-sorts by the sort key instead of rank). Since `q` is client state (debounce + `replaceState`), sort is kept as client state too and re-queried together; the toggle is the same accessible segmented control as comment sort (`role="group"`/`aria-current`), gated to community via a `showSort` prop. Tag chips come from `getTagsWithCounts(role, {author:"member", limit})` (author-scoped extension) and link via `?tag=` (active chip `aria-current`, with a clear link).
- **Series/collections**: admin posts can be grouped into an ordered series with a `/series` index, `/series/[slug]` page, and a post-detail series box ("Kth of N + prev/next in series"). `Feed.seriesId`+`seriesOrder` (many-to-one, SetNull on delete so posts survive) + `Series`. A series has no visibility of its own — it's **derived from the contained posts** (`getSeriesWithCounts` lists only series with a viewer-visible post; `getSeriesPosts`/`getSeriesContext` filter by `listableVisibilities(role)`; a private-only series 404s for non-admins). Membership is set via the feed-form `series` select; ordering is **@dnd-kit drag reorder** on the series edit page (`reorderSeries` transaction, same as the DFO showcase). Card rendering, the index, and CRUD reuse `toFeedCard` / the tag index / the admin-action patterns. **Per-series RSS** (`/series/[slug]/rss.xml`) offers series-level subscription — it **shares a pure builder (`lib/rss.ts renderRssFeed`)** with the global post feed (`/rss.xml`) so channel/item XML and escaping live in one place; since feed readers are anonymous it includes only `getSeriesPosts(id,"anon")` **public posts** in series order, and 404s for an unknown slug or a series with no public posts (consistent with the page hiding it). Discoverability comes from the series page's `<head>` `alternate` link plus a header RSS link.

### 4.11 Testing approach

Mocking Prisma calls for DB logic only restates the code, so I built an integration helper (`lib/test-db.ts`) that runs **real queries against a temporary SQLite database**, covering pagination, search, access control, the approval flow, comment depth, likes, notifications, rate limiting, and reporting. The auth layer is guarded too: **JWT forgery rejection** (wrong secret, tampered token), **session/reset cookies** (`next/headers` mocked), **DAL authorization** (role, approval, `verifySession` redirect — `React cache()` worked around via per-scenario `resetModules` + re-import), and **auth server actions** (signin, signup, the 3-stage forgot-password — dependencies mocked, asserting `redirect()`'s `NEXT_REDIRECT` throw). **Core client components are also covered with RTL (jsdom)** — the comment-tree merge pure logic (`merge`: create/edit/delete/like/dedup), comment item (author link, edit/delete permissions, edit flow), share bar (clipboard, native share, X intent), nav drawer (role-based menu, `aria-expanded`, `inert`, Esc), and comment-section SSE wiring (emit fake events → tree updates). Server actions, EventSource, and toast are isolated via `vi.mock`/injection. Test count grew from **17 to 583**.

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

### 4.15 HTTP security headers (CSP, etc.)

`next.config.ts`'s `headers()` applies security headers to all routes (the header builder is inlined in `next.config.ts` and exposed via named exports for tests — the runtime image doesn't copy `lib/`, so importing lib from the config would crash startup).

- **Headers**: `Content-Security-Policy` + `X-Frame-Options: DENY` · `X-Content-Type-Options: nosniff` · `Referrer-Policy: strict-origin-when-cross-origin` · `Permissions-Policy` (camera/mic/geolocation off) · `Strict-Transport-Security` (prod only).
- **CSP approach**: nonces would force every page into dynamic rendering in this Next version (giving up static optimization/caching), so instead `script`/`style` allow `'unsafe-inline'` while **external script origins are whitelisted** (Turnstile `challenges.cloudflare.com`, Kakao SDK `t1.kakaocdn.net`), and `frame-ancestors 'none'` · `object-src 'none'` · `base-uri 'self'` · `form-action 'self'` shut down clickjacking/injection surface. External https images (post bodies, Neople) are allowed via `img-src https:`; fonts are self-hosted by `next/font` (`font-src 'self'`). `upgrade-insecure-requests` and HSTS apply only in prod (avoiding local http breakage). User content carries low residual injection risk since react-markdown never renders raw HTML.

### 4.16 SEO structured data (JSON-LD)

Post detail pages emit **schema.org JSON-LD** (`BlogPosting` + `BreadcrumbList`) and an explicit **canonical** to surface search rich snippets (author, published/modified dates, breadcrumb).

- **Separate builder**: `lib/structured-data.ts` (pure) assembles a `@graph` of BlogPosting + Breadcrumb, reusing the existing `absoluteUrl`/`isoInstant`. `datePublished = publishedAt ?? createdAt`, `dateModified = updatedAt`; the author is a `Person` with a `/u/{id}` URL for members or name-only for the admin; `image` is the dynamic OG route; `publisher` is the site Organization + logo.
- **Gating**: JSON-LD is injected **only for public, published posts** (matching the OG image — members-only/private/draft are excluded so gated content never leaks into structured data). The canonical is set on any viewable post to prevent duplicate indexing from `?c=`/`?sort=` query params.
- **Safe injection**: inlined via `dangerouslySetInnerHTML`, but serialization escapes `<` to `<` so a `</script>` in a title/summary can't break or inject markup (no nonce needed since CSP allows `script-src 'unsafe-inline'`).
- **Home site identity**: the home page (`/`) injects a `WebSite` + `Organization` `@graph` once via `buildSiteJsonLd()` (cross-referenced by `@id`). `WebSite.potentialAction` is a **`SearchAction`** (target `/feed?q={search_term_string}` — the existing public search route), offering a Google sitelinks search box. Site name/description come from shared constants in `lib/share.ts` (`SITE_NAME`/`SITE_DESCRIPTION`), matching the post-detail publisher.

### 4.17 Discovery pages (popular posts, tag index)

Two pages (`/feed/popular`, `/feed/tags`) surface the accumulating view counts and tags publicly, placed under `app/feed/` to inherit the maintenance-mode guard.

- **Popular posts**: `getPublicTopFeeds(role)` returns published, non-hidden posts by cumulative view count within the **viewer's visible range** (`listableVisibilities`) — unlike the admin-only `getTopFeeds`, it filters visibility so it's safe to expose publicly. Cards reuse `FeedCardItem`.
- **Tag index**: `getTagsWithCounts(role)` aggregates post counts via `feedTag.groupBy` + a relation `where` (visible posts), returning **only tags with at least one visible post** plus their counts, sorted descending (private/hidden-only tags are excluded so links never dead-end).
- **Dedicated tag route** `/feed/tags/[slug]`: instead of the `?tag=` query filter, an SSR route with a **per-tag canonical URL + `CollectionPage`/`ItemList`/`BreadcrumbList` JSON-LD** (`buildTagJsonLd`). `getFeedsByTag(slug, role)` returns the tag's viewer-visible posts (admin + member) newest-first — the same scope as the tag index, so clicking a tag never 404s (zero visible + non-admin → 404, hiding private-only tags); both the cards and structured data expose only `listableVisibilities(role)` posts. Tag chips (cards + index) point here to concentrate internal links, and the sitemap lists public tag pages. `?tag=` is kept for backward compatibility. **Slug normalization**: Next passes the dynamic `[slug]` param **URL-encoded (not decoded)**, so Korean arrives percent-encoded; the lookup side (`tagSlugVariants`) therefore **decodes + matches both NFC and NFD forms** — fixing (migration-free) the regression where Korean tags 404'd. Writes go through `slugifyTag` (NFC-normalized) for new tags, and legacy slugs stored as NFD (decomposed jamo, e.g. from macOS input) are still found via the dual-form match. **Tag OG image**: tag pages also get a dynamic OG card (`#tag` + public post count) via a colocated `opengraph-image.tsx` — reusing the **shared builder `lib/og.tsx ogImage(title, subtitle)`** (Pretendard, 1200×630) with the post OG; the count comes from `countFeedsByTag(slug,"anon")` (**public-only**, mirroring the post OG's public gating), and an unknown or zero-public-post tag falls back to the default brand card.
- **Profile comment deep-link**: clicking a recent comment on `/u/[id]` navigates to `/feed/{slug}?c={commentId}`, scrolling to and highlighting that comment/reply (same mechanism as notification deep-links — `comment-item` auto-expands the parent thread when the target is a reply).
- Entry points were added to the nav drawer, the homepage browse cards, and the sitemap (including individual tag URLs that have at least one public admin post).

### 4.18 Automated DB backups

A **credential-free local backup** guarding `/data/prod.db` (WAL) against corruption, accidental deletion, and bad migrations.

- **Script** (`scripts/backup-db.sh`): sqlite **online `.backup`** (a consistent snapshot even under concurrent writes, WAL-aware) → gzip → `find -mtime` rotation over N days (`BACKUP_KEEP_DAYS`, default 14). The runtime image adds the `sqlite3` CLI and bakes in the script (leaving the app dependency graph untouched — reflecting the 502 lesson from importing lib into `next.config`, only a self-contained shell script is used).
- **Schedule** (`.github/workflows/backup.yml`): daily at 04:00 KST + manual (`workflow_dispatch`). It reuses the **same SSH secrets** as the deploy to run `docker compose exec -T web sh scripts/backup-db.sh` on the host — a precise schedule with no always-on sidecar (saving RAM on the 512MB instance).
- Restorability is guarded by a test (gunzip the snapshot, `PRAGMA integrity_check` = ok, rows preserved, plus rotation). Off-site replication (R2/B2 for instance loss) is left as a follow-up.

### 4.19 Reading experience (prev/next, progress bar, back-to-top)

Three lightweight reading aids on the post detail page.

- **Prev/next post**: `getAdjacentFeeds(feed, role)` fetches the chronologically adjacent post on each side within the viewer's visible range and the **same author class** (admin↔admin, member↔member) so navigation stays inside the collection the reader is browsing. Rendered in the article footer in the `RelatedFeeds` style (hidden when neither exists).
- **Reading progress bar** (`reading-progress-bar`): a top-fixed bar reflects document scroll progress, throttled with a passive scroll listener + `requestAnimationFrame`, and is `aria-hidden` (decorative).
- **Back-to-top** (`back-to-top-button`): appears bottom-right past a scroll threshold (not rendered when hidden, so it's out of the focus order) and scrolls to the top on click.
- **Motion & focus a11y**: CSS transitions, animations, and `scroll-behavior` are neutralized by `globals.css`'s `@media (prefers-reduced-motion: reduce)`, but **JS smooth scroll can't be stopped by a media query**, so a shared `prefersReducedMotion()` (`lib/motion`) branches at the call sites — back-to-top and comment deep-link scrolls jump instantly when reduce-motion is preferred. On top of the box-shadow focus ring for form inputs, a consistent `:focus-visible` outline ring is added globally for **buttons, links, and summary** (replacing the browser default, theme-aware via currentColor).

### 4.20 Code syntax highlighting

The shared markdown renderer (`MarkdownContent`, used by both the post body and the editor preview) gained `rehype-highlight` (highlight.js). **Post detail is a server component, so highlighting runs once at server render** — public readers get static HTML with `hljs` classes and zero extra client JS. highlight.js was chosen over shiki to keep the bundle/image lean. Token colors are defined directly in `globals.css` to match all **three themes (light/dark/brand)** rather than importing a fixed theme; fenced code blocks get horizontal scroll + `font-mono`, and the inline-code background is neutralized inside `pre`. Raw HTML stays disallowed, so it's XSS-safe.

### 4.21 Draft autosave (localStorage, accumulation/quota-safe)

The authoring editors (member and admin) gained localStorage autosave to prevent work loss on refresh/accidental navigation. The core is a **safe store** (`lib/draft-store.ts`) built to prevent accumulation/quota blowups.

- **Safeguards**: one key per post (`byjang-draft:<scope>:<id|new>`) that **overwrites (never appends)** — no unbounded key growth. Each entry carries `savedAt` for a **7-day TTL**; a mount-time `pruneDrafts()` sweeps expired entries and trims to a count cap (12). Serialized length over a cap (1M code units) is skipped. If `setItem` throws `QuotaExceededError`, it **prunes and retries once, then gives up silently** — autosave is best-effort and must never block typing/submit (`typeof window` guard + try/catch throughout).
- **Both editors**: the member editor is controlled (save/restore by value); the admin form is uncontrolled, so it reads `FormData` on `form onInput` and restores via `elements.namedItem` (after image insertion it dispatches a synthetic `input` event so autosave catches it). A `DraftRestoreBanner` offers **restore/dismiss** only when the saved draft differs from the initial content (never auto-overwrites).
- **Lifecycle**: clears the key on submit (success ends via redirect); if validation fails without a redirect, a `state`-change effect **re-saves** the current values to close the data-loss window.
- **Comment box**: the top-level comment input uses the same `draft-store` (key `member:comment:<feedId>`, 600ms debounce) — short enough to **restore silently** on mount (no banner), cleared on successful submit (reply forms are excluded as transient).

### 4.22 Image CLS fix + lazy-load

Body images rendered without dimensions, shifting the layout on load (CLS). Since nginx serves `/uploads/*` directly (making `next/image` a poor fit), the fix is **plain `<img>` + dimension attributes**.

- **Measure on upload**: `uploadImage` reads the buffer with `image-size` (header-only parse) and appends `?w=&h=` to the inserted markdown URL (`lib/image-size.ts` is `server-only` — isolated because `lib/upload.ts` is also imported client-side). Corrupt/unsupported → null, so only the query is omitted (upload still succeeds).
- **Render**: `MarkdownContent`'s custom `img` parses w/h from the src query and sets `width/height`, so the browser reserves space by aspect ratio (zero shift), with `[&_img]:h-auto` keeping it responsive. Every body image gets `loading="lazy" decoding="async"`; query-less external images get lazy only. The query is ignored by nginx and the dev route (file served as-is).

### 4.23 Scheduled publishing

Admins can set a future publish time **at post-creation only**; the post stays hidden until then, when a cron publishes it.

- **Model reuse**: a scheduled post = `status:"draft"` + a new `scheduledAt`. Drafts are already excluded from every public surface (list/search/detail-for-non-author/sitemap/RSS/tags/related/popular/adjacent) by the existing `status:"published"` filter, so **zero public-query changes**. Publishing only flips `draft→published`; the `visibility` chosen at creation goes live as-is.
- **Publish trigger (in-app scheduler)**: since the container (`next start`) is always running, a Next **`instrumentation.ts`** starts `startPublishScheduler` once at boot, which calls `publishDueFeeds` (`updateMany` over `status="draft" ∧ scheduledAt≤now`, clearing `scheduledAt`) every **2 minutes** — **no external cron or secret** (GitHub Actions `schedule` is throttled to multi-hour delays on low-activity repos, so it was removed). Single process → one interval (globalThis guard against double-start); `updateMany` is idempotent. **Manual backup**: the same logic is exposed at `/api/cron/publish-scheduled` (header `CRON_SECRET`, **constant-time compare**, 401 if unset), triggerable via `publish-scheduled.yml` (`workflow_dispatch`).
- **Time**: input is **react-day-picker** (date) + a time input → `"YYYY-MM-DDTHH:MM"` (KST wall-clock) submitted via a hidden input, converted with `kstWallClockToUtc` (browser-TZ-independent, rejects calendar overflow). Past/invalid → form error. The form shows a **human-readable preview** (`formatKstWallClock`) plus a **client-side past-time warning** (judged via `lib/kst`, not the `server-only` `decideSchedule`). The **edit screen has no schedule control** (creation-only is enforced: `updateFeed` ignores `scheduledAt`).
- **Admin ops**: the list shows a "🕒 scheduled: {time}" badge + a **"Publish now"** safety valve. Member drafts (`scheduledAt` null) are unaffected.

### 4.24 In-site game (`/play`)

A new genre, built incrementally with a consistent **logic/render separation** (game rules as pure functions → unit-tested; rendering only draws that state). The first attempt, a **three.js turn-based SRPG** (Aether Tactics), reached S1–S4 but was discontinued and archived (`docs/games/archive/srpg-design.md`) — that genre leans heavily on content (maps/balance/story), a poor fit at hobby scale; the `three` dependency and the `app/play/`·`lib/game/srpg/` code were removed (preserved in git history). It has pivoted to a lighter **roguelike text RPG** (`docs/games/text-rpg-design.md`) — a pure engine + procedural generation + seeded determinism for self-replenishing content, with a member leaderboard (Prisma). **S1 (pure engine) is done**: `lib/game/rogue/` implements a seeded PRNG (mulberry32), player/growth, enemies/depth-scaling, combat, items, events, dungeon, a **single reducer** (`run.ts`), and scoring as pure functions with zero three/DOM/DB deps → unit-tested under jsdom/Vitest (34 tests, including same-seed + same-action-sequence = identical-state determinism). **S2 (text UI) is done**: `/play` (approved members + admin — `MemberGate` for everyone else) renders the engine through a thin React shell. A pure view-model (`app/play/view.ts` — `hudView`/`actionsFor`, unit-tested) maps state → an HUD summary and context-sensitive action buttons; the client shell holds one run via `useState`+`reduce`. **Accessibility**: the adventure log is `role="log"`+`aria-live="polite"`, death is `role="alert"`, HP is `role="progressbar"` plus text, and actions are semantic `<button>`s with full keyboard control (**number shortcuts · Enter for the primary action**). The seed is generated **once on client mount** (avoiding non-pure server randomness and hydration mismatch), and a seed input replays the same dungeon (determinism). **S3 (content/balance) is done**: content expanded while staying pure/deterministic — an 8-enemy roster with **depth gating** (`minDepth` unlocks tougher foes deeper), 3 bosses that **cycle per floor** (same depth = same boss), **5-tier** weapons/armor + a greater potion (appears at depth ≥ 4), and weighted sub-outcomes for rest (normal / campfire full-heal / herb → potion) and traps (damage / gold loss), plus cycling floor-flavor text. Event kinds and the `shopStock` signature are preserved, so the UI and existing tests stay compatible (only engine unit tests grew). **S4 (persistence/leaderboard) is done**: a Prisma `RogueScore` (per-run results, `@@index([score])` for ranking) records a score when the run ends (death). **The score is recomputed server-side from stats (depth·kills·gold)** (shared `scoreFromStats` — client-submitted scores aren't trusted, blocking arbitrary injection); the server action is guarded by `getMemberSession` + zod validation + a rate limit (`rogueScore`). **Admins can play but aren't members, so their runs are skipped** (`{skipped:true}`). The leaderboard is deduped to each member's best run (top runs fetched, deduped in app layer), rendered as a score-descending `<table>`, and refreshed via `router.refresh()` after a successful submit. Integration tests (temp SQLite) cover recompute, normalization, dedup, and ordering. Next is S5+ (classes/skills · shareable seed URLs · daily challenge).

## 5. Outcomes

- Runtime image **2.05GB → 876MB (−57%)**, first deploy pull **10m32s → 37s**
- Diagnosed and resolved production incidents (disk exhaustion, OOM), restoring deploy reliability
- Removed the runtime engine binary via the Prisma 7 driver adapter
- Grew from a single admin to approved members with comments, likes, notifications, reporting/moderation, and PWA (role-union session, shared access control)
- Introduced integration tests (17 → 583); CI gates on typecheck, lint, test, and image build
- Per-feature PRs, automated deploys, and pre-1.0 semver for a clean change history
