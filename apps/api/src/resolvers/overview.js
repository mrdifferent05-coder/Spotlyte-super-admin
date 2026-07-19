// overview.js — nav counts, ⌘K global search, and the /overview command center.
import { requireAdmin, rx, venueOut, disputeOut } from './helpers.js';
import { fmtINR } from '../services/money.js';
import { dateEyebrow, sparkDelta, timeAgo, avColor, initials, dayShort, nextMonday, DAY } from '../services/format.js';

const RANGE_DAYS = { Today: 1, Week: 7, '30D': 30 };
const SPORT_COLOR = {
  Football: 'var(--brand)',
  Cricket: 'var(--ink)',
  Badminton: 'var(--info)',
  Basketball: 'var(--warn)',
  Pickleball: 'var(--muted)',
  Tennis: 'var(--danger)',
};

export async function navCounts(db) {
  const [pendingOwners, pendingVenues, flaggedReviews, queuedPayouts, overdueInvoices, openDisputes] = await Promise.all([
    db.collection('owners').countDocuments({ kyc: { $in: ['review', 'docs'] } }),
    db.collection('venues').countDocuments({ status: { $in: ['pending', 'review'] } }),
    db.collection('reviews').countDocuments({ status: 'flagged' }),
    db.collection('payouts').countDocuments({ status: 'queued' }),
    db.collection('invoices').countDocuments({ status: 'overdue' }),
    db.collection('disputes').countDocuments({ status: 'open' }),
  ]);
  return { pendingOwners, pendingVenues, flaggedReviews, queuedPayouts, overdueInvoices, openDisputes };
}

export const overviewResolvers = {
  Query: {
    getAdminNavCounts: async (_p, _a, ctx) => {
      requireAdmin(ctx);
      return navCounts(ctx.db);
    },

    adminGlobalSearch: async (_p, { q }, ctx) => {
      requireAdmin(ctx);
      const term = (q || '').trim();
      if (!term) return [];
      const r = rx(term);
      const { db } = ctx;
      const [owners, venues, bookings, users] = await Promise.all([
        db.collection('owners').find({ $or: [{ name: r }, { biz: r }, { ownerId: r }, { city: r }] }).limit(4).toArray(),
        db.collection('venues').find({ $or: [{ name: r }, { venueId: r }, { city: r }] }).limit(4).toArray(),
        db.collection('bookings').find({ $or: [{ bookingId: r }, { customerName: r }, { txnRef: r }] }).sort({ createdAt: -1 }).limit(4).toArray(),
        db.collection('customers').find({ $or: [{ name: r }, { email: r }, { userId: r }] }).limit(4).toArray(),
      ]);
      return [
        ...owners.map((o) => ({ kind: 'owner', id: o.ownerId, title: o.biz, sub: `${o.name} · ${o.city}`, badge: o.kyc })),
        ...venues.map((v) => ({ kind: 'venue', id: v.venueId, title: v.name, sub: `${v.sport || ''} · ${v.city}`, badge: v.status })),
        ...bookings.map((b) => ({ kind: 'booking', id: b.bookingId, title: `#${b.bookingId}`, sub: `${b.customerName} · ${b.venueName}`, badge: b.status })),
        ...users.map((u) => ({ kind: 'user', id: u.userId, title: u.name, sub: `${u.email || ''} · ${u.city || ''}`, badge: u.status })),
      ];
    },

    getAdminOverviewStat: async (_p, { range }, ctx) => {
      requireAdmin(ctx);
      const { db } = ctx;
      const now = Date.now();
      const rangeKey = RANGE_DAYS[range] ? range : '30D';
      const days = RANGE_DAYS[rangeKey];
      const since = now - days * DAY;
      const frac = days / 30;

      const [venues, owners, disputes, customers, reviewAgg, payoutAgg, rangeBookings, liveNow, upcoming] = await Promise.all([
        db.collection('venues').find({}).toArray(),
        db.collection('owners').find({}).toArray(),
        db.collection('disputes').find({}).toArray(),
        db.collection('customers').find({}).toArray(),
        db.collection('reviews').aggregate([
          { $match: { status: { $ne: 'deleted' } } },
          { $group: { _id: null, n: { $sum: 1 }, flagged: { $sum: { $cond: [{ $eq: ['$status', 'flagged'] }, 1, 0] } } } },
        ]).toArray(),
        db.collection('payouts').aggregate([
          { $match: { status: { $in: ['queued', 'processing'] } } },
          { $group: { _id: null, amount: { $sum: '$amount' }, owners: { $addToSet: '$ownerId' } } },
        ]).toArray(),
        db.collection('bookings').find({ createdAt: { $gte: since } }).toArray(),
        db.collection('bookings').countDocuments({
          status: 'confirmed',
          slotAt: { $gte: now - 2 * 60 * 60 * 1000, $lte: now + 2 * 60 * 60 * 1000 },
        }),
        db.collection('bookings').countDocuments({ status: 'confirmed', slotAt: { $gt: now } }),
      ]);

      const live = venues.filter((v) => v.status === 'live');
      const cities = new Set(venues.map((v) => v.city)).size;

      // Platform GMV — canonical marketplace metric from per-venue rolling 30D
      // GMV, scaled to the selected range; spark = elementwise sum of venue sparks.
      const gmv30 = live.reduce((s, v) => s + (v.revenue30d || 0), 0);
      const gmv = Math.round(gmv30 * frac);
      const platformSpark = live.reduce((acc, v) => {
        (v.spark || []).forEach((x, i) => (acc[i] = (acc[i] || 0) + x));
        return acc;
      }, []);
      const bookings30 = live.reduce((s, v) => s + (v.bookings30d || 0), 0);
      const bookingsInRange = Math.round(bookings30 * frac);

      const openDisputes = disputes.filter((d) => d.status !== 'resolved');
      const atRisk = openDisputes.reduce((s, d) => s + (d.amount || 0), 0);
      const highUrgency = openDisputes.filter((d) => d.urgency === 'high').length;
      const resolved30 = disputes.filter((d) => d.status === 'resolved' && (d.resolution?.at || 0) >= now - 30 * DAY).length;

      const pending = payoutAgg[0] || { amount: 0, owners: [] };
      const pendingOwners = owners.filter((o) => ['review', 'docs'].includes(o.kyc));
      const pendingVenues = venues.filter((v) => ['pending', 'review'].includes(v.status));

      const newUsers = customers.filter((c) => (c.joinedAt || 0) >= since).length;
      const returning = customers.filter((c) => (c.bookingsCount || 0) > 1).length;
      const returningPct = customers.length ? Math.round((returning / customers.length) * 100) : 0;

      const rated = live.filter((v) => v.rating);
      const avgRating = rated.length ? (rated.reduce((s, v) => s + v.rating, 0) / rated.length).toFixed(1) : '—';
      const reviewsTotal = reviewAgg[0]?.n || 0;
      const reviewsFlagged = reviewAgg[0]?.flagged || 0;

      const heroKpis = [
        {
          label: `Platform GMV · ${rangeKey}`,
          ...splitINR(gmv),
          deltaPercent: sparkDelta(platformSpark) ?? 0,
          meta: `Net revenue ${fmtINR(Math.round(gmv * 0.18))} · 18% take`,
          spark: platformSpark.length ? normalize(platformSpark) : [],
          tone: 'brand',
        },
        {
          label: `Bookings · ${rangeKey}`,
          value: bookingsInRange.toLocaleString('en-IN'),
          unit: null,
          deltaPercent: sparkDelta(live[0]?.spark) ?? 0,
          meta: `${liveNow} live · ${upcoming} upcoming`,
          spark: live[1]?.spark || live[0]?.spark || [],
          tone: 'brand',
        },
        {
          label: 'Pending payouts',
          ...splitINR(pending.amount),
          deltaPercent: null,
          meta: `Across ${pending.owners.length} owners · next Mon`,
          spark: live[2]?.spark || [],
          tone: 'info',
        },
        {
          label: 'Open disputes',
          value: String(openDisputes.length),
          unit: null,
          deltaPercent: resolved30 ? -resolved30 : null,
          meta: `${fmtINR(atRisk, { full: true })} at risk · ${highUrgency} high urgency`,
          spark: live[5]?.spark || live[0]?.spark || [],
          tone: 'danger',
        },
      ];

      const miniKpis = [
        { label: 'Active owners', value: String(owners.filter((o) => o.kyc === 'verified').length), sub: `${pendingOwners.length} awaiting review`, icon: 'owners', route: '/owners' },
        { label: 'Live venues', value: String(live.length), sub: `${pendingVenues.length} pending approval`, icon: 'venues', route: '/venues' },
        { label: `New users · ${rangeKey}`, value: String(newUsers), sub: `${returningPct}% returning bookers`, icon: 'users', route: '/users' },
        { label: 'Avg rating', value: String(avgRating), sub: `${reviewsTotal.toLocaleString('en-IN')} reviews · ${reviewsFlagged} flagged`, icon: 'reviews', route: '/reviews' },
      ];

      const approvalQueue = [
        ...pendingOwners.map((o) => ({
          kind: 'Owner KYC', refId: o.ownerId, name: o.biz, who: o.name, meta: o.city,
          status: o.kyc, submittedAgo: o.submittedAt ? timeAgo(o.submittedAt, now) : null,
          color: avColor(o.name), initials: initials(o.name), _at: o.submittedAt || 0,
        })),
        ...pendingVenues.map((v) => ({
          kind: 'Venue', refId: v.venueId, name: v.name, who: v.ownerName, meta: `${v.city} · ${(v.courts || []).length} courts`,
          status: v.status, submittedAgo: v.submittedAt ? timeAgo(v.submittedAt, now) : null,
          color: avColor(v.name), initials: initials(v.name), _at: v.submittedAt || 0,
        })),
      ]
        .sort((a, b) => b._at - a._at)
        .slice(0, 6)
        .map(({ _at, ...q }) => q);

      // Sport mix — real aggregation over bookings in range, revenue shares
      // presented against the platform GMV so the panel coheres with the hero.
      const bySport = {};
      for (const b of rangeBookings) {
        if (b.status === 'cancelled') continue;
        bySport[b.sport] = (bySport[b.sport] || 0) + (b.amount || 0);
      }
      const totalSport = Object.values(bySport).reduce((s, x) => s + x, 0) || 1;
      const sportMix = Object.entries(bySport)
        .sort((a, b) => b[1] - a[1])
        .map(([sport, rev]) => ({
          sport,
          percent: Math.round((rev / totalSport) * 100),
          revenue: Math.round(gmv * (rev / totalSport)),
          colorVar: SPORT_COLOR[sport] || 'var(--muted)',
        }));

      const urgencyRank = { high: 0, medium: 1, low: 2 };
      const topDisputes = openDisputes
        .sort((a, b) => (urgencyRank[a.urgency] - urgencyRank[b.urgency]) || (b.openedAt - a.openedAt))
        .slice(0, 6)
        .map((d) => disputeOut(d, now));

      const topVenues = live
        .sort((a, b) => (b.revenue30d || 0) - (a.revenue30d || 0))
        .slice(0, 7)
        .map((v) => venueOut(v, now));

      return {
        dateLine: `${dateEyebrow(now)} · ${live.length} LIVE VENUES · ${cities} CITIES`,
        heroKpis,
        miniKpis,
        approvalQueue,
        sportMix,
        openDisputes: topDisputes,
        topVenues,
      };
    },
  },
};

// '₹1.42 Cr' → { value: '₹1.42', unit: 'Cr' } so the StatCard can style the unit.
function splitINR(n) {
  const s = fmtINR(n);
  const m = s.match(/^(.+?)\s(Cr|L)$/);
  if (m) return { value: m[1], unit: m[2] };
  return { value: s, unit: null };
}

function normalize(arr) {
  const max = Math.max(...arr) || 1;
  return arr.map((x) => Math.round((x / max) * 96));
}
