# spotlyte. admin — Super Admin Console

The internal command center for the **Spotlyte** sports-venue booking marketplace (India).
Two apps in one npm-workspaces monorepo:

| App | Stack | Port |
|---|---|---|
| `apps/api` | Node.js · Express · **Apollo Server 4** (`expressMiddleware` at `POST /graphql`) · **MongoDB native driver only** (no Mongoose, no ODM) | `:4000` |
| `apps/admin-web` | **Next.js 14 App Router** · React 18 · Tailwind CSS (tokens via CSS variables) · **Apollo Client** (SSR-safe registry pattern) | `:3000` |

The console covers the whole marketplace operation: owner KYC onboarding, venue
approvals & featuring, all bookings & refunds, customer moderation, review
moderation with auto-flag rules, weekly owner payouts & settlements (UTR flow),
GST invoicing, promo codes, paid advertising placements, dispute resolution
with escrow, and an immutable audit log of every admin action.

---

## Quick start

Prereqs: **Node 20+** and a **MongoDB** listening on `mongodb://127.0.0.1:27017`
(any 6.x/7.x/8.x server — `docker run -p 27017:27017 mongo:7` works fine).

```bash
cp .env.example .env        # defaults work for local dev
npm install                 # installs both workspaces

npm run seed                # wipe + insert the full demo marketplace
npm run dev:api             # → GraphQL at http://localhost:4000/graphql
npm run dev:web             # → console at http://localhost:3000
```

Sign in at `http://localhost:3000/login`:

```
priya@spotlyte.in / admin123
```

The seed is deterministic and dated relative to *now*, so the console lands
alive: 14 owners across every KYC state (Farhan Qureshi waiting in review),
16 venues (Maidan HSR live + featured at ₹5.1L GMV, SportHaus Powai pending),
~65 bookings incl. today's slots for the availability grid, 12 payouts,
GST invoices + auto-issued booking receipts, 8 promo codes, 6 ad placements,
9 disputes with escrow threads, and a populated audit trail.

## Offline acceptance suite (no MongoDB needed)

```bash
npm run test:acceptance --workspace apps/api
```

Runs the Section-13 checklist end-to-end — the **real seed, schema and
resolvers** — against an in-memory driver fake (`apps/api/test/fake-mongo.mjs`,
built on [mingo](https://www.npmjs.com/package/mingo)): login/guards, nav
counts, overview ranges, ⌘K search, the full Farhan KYC flow (request docs →
approve on Growth 16%), venue approve/reject/feature/pause, a 60% slider
refund, the payout lifecycle with UTR `AXISN12345678` and the
`gross − fee(tier%) − TDS(1%) = net` math, dispute investigate → support reply
→ Partial-50 resolution with escrow release + linked-booking refund, review
moderation + phone-number auto-flag, GST invoice math, promo/ads CRUD, audit
pagination, and the legacy `getSuperAdmin*` compatibility layer.
**104 checks, all green.**

## Environment

```
MONGODB_URI              mongodb://127.0.0.1:27017     # db name `spotlyte`
JWT_SECRET               signs the httpOnly admin cookie (12h)
PORT                     4000
WEB_ORIGIN               http://localhost:3000          # CORS allow-list
NEXT_PUBLIC_GRAPHQL_URL  http://localhost:4000/graphql
```

## Architecture notes

**GraphQL schema** — `apps/api/src/graphql/`
- `typeDefs.base.js` — the owner-app production schema, kept compatible and
  cleaned per spec §9.1 (duplicate `DailyAvailability` / `UpdateCourtInput` /
  `BlackoutInput` / `VenueActionInput` removed, the two `Sport` declarations
  merged, the small `PayoutStat` renamed `VenuePayoutInfo`, spacing normalized).
- `typeDefs.admin.js` — the §9.2 admin extension verbatim, plus a clearly
  marked *console additions* block (list-page composites + field extensions on
  `AdminVenueItem` / `AdminBookingItem` / `DisputeListItem`).
- Merged with `@graphql-tools/merge` so shared types resolve once. Legacy
  `adminLogin` / `adminApproveVenue` / `adminApproveOwner` /
  `adminUpdateDispute` remain as thin wrappers over the same services.

**API discipline** — single `MongoClient` in `db.js` (the only place a client
is created), idempotent `ensureIndexes` on boot, atomic human-readable IDs via
a `counters` collection (`OWN-2040`, `VEN-7100`, `BKG-48210`, `PO-3072`,
`SP-7D2X9A`, …), money as integer rupees, aggregation pipelines (`$facet`) for
list counts+stats+rows in one round-trip, and display strings (period labels,
"38 min ago", `HDFC ••7723`) computed server-side. Every `getAdmin*` resolver
requires the admin context (`UNAUTHENTICATED` / 401 otherwise) and **every
admin mutation writes an immutable audit row** — nothing ever edits or deletes
`auditLogs`.

**Auth** — `adminLoginV2` verifies bcrypt, signs a 12h JWT into the httpOnly
`spotlyte_admin` cookie (sameSite=lax); `middleware.ts` bounces cookie-less
visitors to `/login`; Apollo Client sends `credentials:'include'` and a
top-level error link redirects on `UNAUTHENTICATED`. Logins are audited with
request IP.

**Design system** — the approved warm-paper editorial identity is reproduced
exactly: tokens from spec §5.2 as CSS variables (mapped into
`tailwind.config.ts`), Outfit / Archivo / Instrument Serif italic / JetBrains
Mono via `next/font`, the 60-name inline SVG icon set (24px grid, 1.6 stroke),
light/dark + compact/regular/comfy density toggles persisted on `<html>`,
dark-pill toasts, and the full shared-UI kit of §7 (`StatCard`, `Panel`,
`SecHead`, `Tabs`, `useSort`/`Th`, `Badge`, `Sparkline`, `Pipeline`,
`ActivityLog`, `RequestDocsModal`, …) in `components/ui`.

## Repository map

```
apps/api/src
├─ index.js                 Express + Apollo bootstrap (cors, cookies, 5mb JSON)
├─ db.js                    MongoClient singleton · getDb() · ensureIndexes()
├─ context.js               { db, admin, ip } from the JWT cookie per request
├─ graphql/                 typeDefs.base (cleaned) · typeDefs.admin · merge
├─ resolvers/               auth · overview · owners · venues · bookings · users
│                           reviews · payouts · invoices · promos · advertising
│                           disputes · audit · legacy (+ helpers, JSON scalar)
├─ services/                money (fee/TDS/GST/refund math) · ids (counters)
│                           audit (writeAudit) · format · autoflag
└─ seed/seed.js             deterministic demo marketplace (npm run seed)

apps/admin-web
├─ app/(console)/           overview · owners[/id] · venues[/id] · bookings[/id]
│                           users[/id] · reviews · payouts[/id] · invoices[/id]
│                           promos · advertising · disputes[/id] · audit
├─ app/login                branded login card (error shake)
├─ components/ui            primitives + Icon set · components/shell (Sidebar,
│                           Topbar, ⌘K palette, settings menu)
├─ lib/                     apollo (SSR-safe) · gql documents · format (fmtINR,
│                           avColor, initials) · toast · csv export
└─ middleware.ts            auth redirect for all console routes
```
