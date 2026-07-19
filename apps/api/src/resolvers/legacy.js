// legacy.js — minimal implementations of the base file's early super-admin
// queries so the owner-app schema stays live against the same database.
import { requireAdmin } from './helpers.js';
import { DAY } from '../services/format.js';

export const legacyResolvers = {
  Query: {
    getSuperAdmin: (_p, _a, ctx) => {
      requireAdmin(ctx);
      return { _id: ctx.admin.adminId, name: ctx.admin.name };
    },

    getSuperAdminOverview: async (_p, _a, ctx) => {
      requireAdmin(ctx);
      const { db } = ctx;
      const now = Date.now();
      const monthStart = new Date(new Date(now).getFullYear(), new Date(now).getMonth(), 1).getTime();
      const prevStart = new Date(new Date(now).getFullYear(), new Date(now).getMonth() - 1, 1).getTime();
      const dayStart = new Date(new Date(now).toDateString()).getTime();

      const agg = async (from, to) => {
        const [r] = await ctx.db.collection('bookings').aggregate([
          { $match: { createdAt: { $gte: from, $lt: to } } },
          {
            $group: {
              _id: null,
              gmv: { $sum: { $cond: ['$paid', '$amount', 0] } },
              n: { $sum: 1 },
              cxl: { $sum: { $cond: [{ $in: ['$status', ['cancelled', 'no-show']] }, 1, 0] } },
            },
          },
        ]).toArray();
        return r || { gmv: 0, n: 0, cxl: 0 };
      };
      const [cur, prev, today, bySport] = await Promise.all([
        agg(monthStart, now),
        agg(prevStart, monthStart),
        db.collection('bookings').countDocuments({ createdAt: { $gte: dayStart } }),
        db.collection('bookings').aggregate([{ $group: { _id: '$sport', count: { $sum: 1 } } }]).toArray(),
      ]);
      return {
        merchandValueThisMonth: cur.gmv,
        merchandValueLastMonth: prev.gmv,
        bookingsThisMonth: cur.n,
        bookingsLastMonth: prev.n,
        bookingsToday: today,
        commissionThisMonth: Math.round(cur.gmv * 0.18),
        commissionLastMonth: Math.round(prev.gmv * 0.18),
        cancellationThisMonth: cur.cxl,
        cancellationLastMonth: prev.cxl,
        bookingBySports: bySport.map((s) => ({ sport: s._id, count: s.count })),
      };
    },

    getSuperAdminVenues: async (_p, { status }, ctx) => {
      requireAdmin(ctx);
      const match = status?.length ? { status: { $in: status } } : {};
      const venues = await ctx.db.collection('venues').find(match).toArray();
      return venues.map(legacyVenue);
    },
    getSuperAdminVenue: async (_p, { id }, ctx) => {
      requireAdmin(ctx);
      const v = await ctx.db.collection('venues').findOne({ venueId: id });
      return v ? legacyVenue(v) : null;
    },
    getSuperAdminOwners: async (_p, { status }, ctx) => {
      requireAdmin(ctx);
      const match = status?.length ? { kyc: { $in: status } } : {};
      const owners = await ctx.db.collection('owners').find(match).toArray();
      return owners.map(legacyOwner);
    },
    getSuperAdminOwner: async (_p, { id }, ctx) => {
      requireAdmin(ctx);
      const o = await ctx.db.collection('owners').findOne({ ownerId: id });
      return o ? legacyOwner(o) : null;
    },
    getSuperAdminCustomers: async (_p, _a, ctx) => {
      requireAdmin(ctx);
      const users = await ctx.db.collection('customers').find({}).toArray();
      return users.map(legacyCustomer);
    },
    getSuperAdminCustomer: async (_p, { id }, ctx) => {
      requireAdmin(ctx);
      const u = await ctx.db.collection('customers').findOne({ userId: id });
      return u ? legacyCustomer(u) : null;
    },
    getSuperAdminBookings: async (_p, { venueId, customerId }, ctx) => {
      requireAdmin(ctx);
      const match = {};
      if (venueId) match.venueId = venueId;
      if (customerId) match.customerId = customerId;
      const bookings = await ctx.db.collection('bookings').find(match).sort({ createdAt: -1 }).limit(200).toArray();
      return bookings.map(legacyBooking);
    },
    getSuperAdminBooking: async (_p, { id }, ctx) => {
      requireAdmin(ctx);
      const b = await ctx.db.collection('bookings').findOne({ bookingId: id });
      return b ? legacyBooking(b) : null;
    },
    getSuperAdminSports: async (_p, _a, ctx) => {
      requireAdmin(ctx);
      const sports = ['Football', 'Cricket', 'Badminton', 'Basketball', 'Pickleball', 'Tennis'];
      const counts = await ctx.db.collection('venues').aggregate([{ $group: { _id: '$sport', n: { $sum: 1 } } }]).toArray();
      const map = Object.fromEntries(counts.map((c) => [c._id, c.n]));
      return sports.map((s) => ({ _id: s.toLowerCase(), title: s, slug: s.toLowerCase(), url: null, image: null, noVenue: map[s] || 0 }));
    },
    getSuperAdminReviews: async (_p, _a, ctx) => {
      requireAdmin(ctx);
      const reviews = await ctx.db.collection('reviews').find({ status: { $ne: 'deleted' } }).toArray();
      return reviews.map((r) => ({ _id: r.reviewId, uuid: r.reviewId, review: r.text, rating: r.rating, status: r.status, createdAt: r.createdAt }));
    },
    getSuperAdminDisputes: async (_p, { status }, ctx) => {
      requireAdmin(ctx);
      const match = status?.length ? { status: { $in: status } } : {};
      const disputes = await ctx.db.collection('disputes').find(match).toArray();
      return disputes.map(legacyDispute);
    },
    getSuperAdminDispute: async (_p, { id }, ctx) => {
      requireAdmin(ctx);
      const d = await ctx.db.collection('disputes').findOne({ disputeId: id });
      return d ? legacyDispute(d) : null;
    },
    getSuperAdminPayouts: async (_p, _a, ctx) => {
      requireAdmin(ctx);
      const payouts = await ctx.db.collection('payouts').find({}).toArray();
      return payouts.map((p) => ({
        _id: p.payoutId, bookingIds: p.bookingIds || [], status: p.status, amount: p.amount,
        periodFrom: String(p.periodFrom), periodEnd: String(p.periodTo),
      }));
    },
    getSuperAdminAudits: async (_p, _a, ctx) => {
      requireAdmin(ctx);
      const logs = await ctx.db.collection('auditLogs').find({}).sort({ createdAt: -1 }).limit(200).toArray();
      return logs.map((a) => ({
        _id: a.logId, uuid: a.logId, type: a.type, what: `${a.actor} ${a.action} ${a.target}`,
        refID: a.ref, ip: a.ip, status: 'ok', createdAt: String(a.createdAt),
      }));
    },
  },
};

const legacyVenue = (v) => ({
  _id: v.venueId, venueId: v.venueId, userId: v.ownerId, venueName: v.name, status: v.status,
  venueStatus: v.status, address: v.addr, city: v.city, noCourt: (v.courts || []).length,
  amenities: v.amenities || [], venuePhotos: v.photos || [], revenue30d: v.revenue30d || 0,
  bookings30d: v.bookings30d || 0, occupancyRate: v.occupancy || 0, disputes: v.disputeCount || 0,
  createdAt: String(v.createdAt || ''),
});
const legacyOwner = (o) => ({
  _id: o.ownerId, uuid: o.ownerId, phone: o.phone || '', fullName: o.name, email: o.email,
  businessName: o.biz, gstin: o.legal?.gstin, pan: o.legal?.pan, bankName: o.bank?.bankName,
  accountHolderName: o.bank?.accountHolder, ifscCode: o.bank?.ifsc, status: o.kyc,
  createdAt: String(o.createdAt || ''),
});
const legacyCustomer = (u) => ({
  _id: u.userId, uuid: u.userId, name: u.name, email: u.email, phone: u.phone, city: u.city,
  status: u.status, lastLogin: u.lastSeenAt, createdAt: u.joinedAt, spend: u.lifetimeSpend || 0,
  noBooking: u.bookingsCount || 0,
});
const legacyBooking = (b) => ({
  _id: b.bookingId, bookingId: b.bookingId, customerName: b.customerName, customerPhone: b.customerPhone,
  date: new Date(b.slotAt).toISOString().slice(0, 10), timeRange: b.time, fromTime: b.time,
  sport: b.sport, courtName: b.courtName, venueName: b.venueName, amount: b.amount, total: b.amount,
  status: b.status, duration: `${b.durationMin || 60} min`, paymentMethod: b.method, createdAt: b.createdAt,
});
const legacyDispute = (d) => ({
  _id: d.disputeId, disputeId: d.disputeId, disputeRef: `#${d.disputeId}`, venueId: d.venueId,
  bookingId: d.bookingId, status: d.status, urgency: d.urgency, reason: d.reason,
  courtName: d.courtName, amount: d.amount, createdAt: d.openedAt,
});
