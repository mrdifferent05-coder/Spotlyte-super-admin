// venues.js — venue list page, tabbed detail, and approval / featuring flows.
import { requireAdmin, rx, venueOut, bookingOut, disputeOut, payoutOut } from './helpers.js';
import { writeAudit, auditEntryOut } from '../services/audit.js';
import { nextId } from '../services/ids.js';
import { timeAgo, dayShort, nextMonday, maskBank, todayEyebrow, DAY } from '../services/format.js';
import { fmtINR } from '../services/money.js';

const SLOT_RATES = { 'Home spotlight': 25000, 'Search top': 12000, 'City banner': 15000 };
const SLOT_TIMES = ['06:00', '08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00'];

async function findVenue(db, venueId) {
  const v = await db.collection('venues').findOne({ venueId });
  if (!v) throw new Error(`Venue ${venueId} not found`);
  return v;
}

export const venuesResolvers = {
  Query: {
    getAdminVenuePage: async (_p, { tab, q }, ctx) => {
      requireAdmin(ctx);
      const { db } = ctx;
      const search = q
        ? { $or: [{ name: rx(q) }, { ownerName: rx(q) }, { city: rx(q) }, { venueId: rx(q) }, { sport: rx(q) }] }
        : {};
      const tabFilter =
        tab === 'pending' ? { status: { $in: ['pending', 'review'] } }
        : tab === 'featured' ? { featured: true }
        : tab === 'paused' ? { status: { $in: ['paused', 'rejected'] } }
        : tab === 'all' || !tab ? {}
        : { status: tab };

      const all = await db.collection('venues').find(search).toArray();
      const counts = {
        all: all.length,
        live: all.filter((v) => v.status === 'live').length,
        pending: all.filter((v) => ['pending', 'review'].includes(v.status)).length,
        featured: all.filter((v) => v.featured).length,
        paused: all.filter((v) => ['paused', 'rejected'].includes(v.status)).length,
      };
      const now = Date.now();
      const live = all.filter((v) => v.status === 'live');
      const pendingDocs = all.filter((v) => ['pending', 'review'].includes(v.status) && v.submittedAt);
      const oldest = pendingDocs.length ? Math.min(...pendingDocs.map((v) => v.submittedAt)) : null;
      const occ = live.filter((v) => v.occupancy);
      const rows = all
        .filter((v) => matchTab(v, tabFilter))
        .sort((a, b) => (b.revenue30d || 0) - (a.revenue30d || 0) || (b.submittedAt || 0) - (a.submittedAt || 0));

      return {
        counts,
        stats: {
          live: counts.live,
          courtsTotal: all.reduce((s, v) => s + (v.courts || []).length, 0),
          pending: counts.pending,
          oldestAgo: oldest ? timeAgo(oldest, now) : '—',
          featured: counts.featured,
          avgOccupancy: occ.length ? Math.round(occ.reduce((s, v) => s + v.occupancy, 0) / occ.length) : 0,
          occDelta: 4,
        },
        total: rows.length,
        venues: rows.map((v) => venueOut(v, now)),
      };
    },

    getAdminVenueDetail: async (_p, { venueId }, ctx) => {
      requireAdmin(ctx);
      const { db } = ctx;
      const v = await findVenue(db, venueId);
      const now = Date.now();
      const startOfDay = new Date(new Date(now).toDateString()).getTime();

      const [owner, bookings, disputes, payoutsByVenue, activity, todays] = await Promise.all([
        db.collection('owners').findOne({ ownerId: v.ownerId }),
        db.collection('bookings').find({ venueId }).sort({ slotAt: -1 }).limit(60).toArray(),
        db.collection('disputes').find({ venueId }).sort({ openedAt: -1 }).toArray(),
        db.collection('payouts').find({ venueId }).sort({ periodTo: -1 }).toArray(),
        db.collection('auditLogs').find({ ref: `#${venueId}` }).sort({ createdAt: -1 }).limit(20).toArray(),
        db.collection('bookings').find({ venueId, slotAt: { $gte: startOfDay, $lt: startOfDay + DAY }, status: { $in: ['confirmed', 'completed'] } }).toArray(),
      ]);
      let payouts = payoutsByVenue;
      if (!payouts.length && v.ownerId) {
        payouts = await db.collection('payouts').find({ ownerId: v.ownerId }).sort({ periodTo: -1 }).toArray();
      }

      const tierPct = owner?.commissionTier?.pct ?? 18;
      // Slot availability — today's real bookings + venue blackouts on a
      // court × 2-hour grid (06:00 … 20:00).
      const bookedSet = new Set(
        todays.map((b) => {
          const h = new Date(b.slotAt).getHours();
          const slotH = Math.min(20, Math.max(6, h - (h % 2)));
          return `${b.courtName}|${String(slotH).padStart(2, '0')}:00`;
        })
      );
      const blackoutSet = new Set((v.blackouts || []).map((x) => `${x.court}|${x.time}`));
      const courts = (v.courts || []).map((c) => ({
        courtName: c.name,
        sport: c.sport,
        surface: c.surface,
        size: c.size,
        slots: SLOT_TIMES.map((t) => ({
          time: t,
          state: bookedSet.has(`${c.name}|${t}`) ? 'booked' : blackoutSet.has(`${c.name}|${t}`) ? 'blocked' : 'open',
        })),
      }));

      const settled = payouts.filter((p) => p.status === 'settled');
      const receivedTotal = settled.reduce((s, p) => s + p.amount, 0);
      const upcoming = payouts.find((p) => ['queued', 'processing'].includes(p.status));
      const bank = maskBank(owner?.bank?.bankName, owner?.bank?.accountNoMasked);

      return {
        venue: venueOut(v, now),
        ownerId: v.ownerId || null,
        photos: v.photos || [],
        games: v.games || [],
        courts,
        amenities: v.amenities || [],
        listing: {
          owner: owner ? { name: owner.name, ownerId: owner.ownerId } : { name: v.ownerName, ownerId: v.ownerId },
          sport: v.sport,
          courts: (v.courts || []).length,
          city: v.city,
          address: v.addr,
          listingId: v.venueId,
        },
        pricing: { offPeak: v.pricing?.offPeak ?? 900, peak: v.pricing?.peak ?? 1400, weekend: v.pricing?.weekend ?? 1800, feePct: tierPct },
        spark: v.spark || [],
        recentBookings: bookings.slice(0, 5).map((b) => bookingOut(b, tierPct)),
        bookings: bookings.map((b) => bookingOut(b, tierPct)),
        disputes: disputes.map((d) => disputeOut(d, now)),
        payoutSummary: {
          receivedTotal,
          receivedCount: settled.length,
          upcomingAmount: upcoming ? upcoming.amount : Math.round((v.revenue30d || 0) * 0.2),
          upcomingLabel: `Settles ${dayShort(nextMonday(now))} · ${bank}`,
          feePct: tierPct,
          tierName: owner?.commissionTier?.name || 'Standard',
          todayEyebrow: todayEyebrow(now),
        },
        payouts: payouts.map(payoutOut),
        activity: activity.map(auditEntryOut),
      };
    },
  },

  Mutation: {
    adminApproveVenueV2: async (_p, { venueId }, ctx) => {
      const admin = requireAdmin(ctx);
      const v = await findVenue(ctx.db, venueId);
      await ctx.db.collection('venues').updateOne({ venueId }, { $set: { status: 'live', approvedAt: Date.now(), updatedAt: Date.now() } });
      await writeAudit({ db: ctx.db, actorAdmin: admin, action: 'approved venue', target: `Venue · ${v.name}`, type: 'venue', ref: `#${venueId}`, ip: ctx.ip });
      return { success: true, message: 'Venue approved · live on marketplace', refId: venueId };
    },

    adminRejectVenue: async (_p, { venueId, reason, note }, ctx) => {
      const admin = requireAdmin(ctx);
      const v = await findVenue(ctx.db, venueId);
      await ctx.db.collection('venues').updateOne(
        { venueId },
        { $set: { status: 'rejected', rejection: { reason, note: note || null, at: Date.now() }, updatedAt: Date.now() } }
      );
      await writeAudit({ db: ctx.db, actorAdmin: admin, action: 'rejected venue', target: `Venue · ${v.name} — ${reason}`, type: 'venue', ref: `#${venueId}`, ip: ctx.ip });
      return { success: true, message: 'Listing rejected · owner notified', refId: venueId };
    },

    adminFeatureVenue: async (_p, { venueId, slot, months }, ctx) => {
      const admin = requireAdmin(ctx);
      const { db } = ctx;
      const v = await findVenue(db, venueId);
      const now = Date.now();
      const until = now + months * 30 * DAY;
      const budget = (SLOT_RATES[slot] || 25000) * months;
      await db.collection('venues').updateOne(
        { venueId },
        { $set: { featured: true, featuredSlot: slot, featuredUntil: until, updatedAt: now } }
      );
      const adId = await nextId(db, 'ad');
      await db.collection('adPlacements').insertOne({
        adId, venueId, ownerId: v.ownerId, venueName: v.name, ownerName: v.ownerName,
        slot, city: v.city, start: now, end: until, budget, spent: 0, clicks: 0, impressions: 0,
        status: 'active', linkedFeature: true, createdAt: now,
      });
      await writeAudit({ db, actorAdmin: admin, action: 'featured venue', target: `Venue · ${v.name} — ${slot} · ${months} mo`, type: 'feature', ref: `#${venueId}`, ip: ctx.ip });
      return { success: true, message: `${v.name} featured · ${slot} for ${months} month${months > 1 ? 's' : ''} (${fmtINR(budget)})`, refId: adId };
    },

    adminUnfeatureVenue: async (_p, { venueId }, ctx) => {
      const admin = requireAdmin(ctx);
      const v = await findVenue(ctx.db, venueId);
      await ctx.db.collection('venues').updateOne({ venueId }, { $set: { featured: false, featuredSlot: null, featuredUntil: null, updatedAt: Date.now() } });
      await ctx.db.collection('adPlacements').updateMany({ venueId, linkedFeature: true, status: 'active' }, { $set: { status: 'ended', end: Date.now() } });
      await writeAudit({ db: ctx.db, actorAdmin: admin, action: 'unfeatured venue', target: `Venue · ${v.name}`, type: 'feature', ref: `#${venueId}`, ip: ctx.ip });
      return { success: true, message: 'Removed from featured', refId: venueId };
    },

    adminPauseVenue: async (_p, { venueId }, ctx) => {
      const admin = requireAdmin(ctx);
      const v = await findVenue(ctx.db, venueId);
      await ctx.db.collection('venues').updateOne({ venueId }, { $set: { status: 'paused', updatedAt: Date.now() } });
      await writeAudit({ db: ctx.db, actorAdmin: admin, action: 'paused venue', target: `Venue · ${v.name}`, type: 'venue', ref: `#${venueId}`, ip: ctx.ip });
      return { success: true, message: 'Venue paused', refId: venueId };
    },

    // Rejected → back into the approvals queue for a fresh look.
    adminReReviewVenue: async (_p, { venueId }, ctx) => {
      const admin = requireAdmin(ctx);
      const v = await findVenue(ctx.db, venueId);
      await ctx.db.collection('venues').updateOne(
        { venueId },
        { $set: { status: 'review', submittedAt: Date.now(), rejection: null, updatedAt: Date.now() } }
      );
      await writeAudit({ db: ctx.db, actorAdmin: admin, action: 'moved venue to review', target: `Venue · ${v.name}`, type: 'venue', ref: `#${venueId}`, ip: ctx.ip });
      return { success: true, message: 'Back in review queue', refId: venueId };
    },

    adminResumeVenue: async (_p, { venueId }, ctx) => {
      const admin = requireAdmin(ctx);
      const v = await findVenue(ctx.db, venueId);
      await ctx.db.collection('venues').updateOne({ venueId }, { $set: { status: 'live', updatedAt: Date.now() } });
      await writeAudit({ db: ctx.db, actorAdmin: admin, action: 'resumed venue', target: `Venue · ${v.name}`, type: 'venue', ref: `#${venueId}`, ip: ctx.ip });
      return { success: true, message: 'Venue live', refId: venueId };
    },

    // Legacy wrapper — routes to the same services.
    adminApproveVenue: async (_p, { venueId, status, reason }, ctx) => {
      const self = venuesResolvers.Mutation;
      if (status === 'rejected') await self.adminRejectVenue(_p, { venueId, reason: reason || 'Other (specify)' }, ctx);
      else if (status === 'paused') await self.adminPauseVenue(_p, { venueId }, ctx);
      else await self.adminApproveVenueV2(_p, { venueId }, ctx);
      return 'ok';
    },
  },
};

function matchTab(v, filter) {
  if (!Object.keys(filter).length) return true;
  if (filter.featured) return !!v.featured;
  if (filter.status?.$in) return filter.status.$in.includes(v.status);
  if (typeof filter.status === 'string') return v.status === filter.status;
  return true;
}
