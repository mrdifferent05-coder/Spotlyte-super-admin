// users.js — customer base list, detail, and moderation (flag / ban / reinstate).
import { requireAdmin, rx, bookingOut } from './helpers.js';
import { writeAudit } from '../services/audit.js';
import { dateLabel, monthYear, relDayLabel, spark, DAY } from '../services/format.js';
import { avColor, initials } from '../services/format.js';

function userOut(u, now = Date.now()) {
  return {
    userId: u.userId,
    name: u.name,
    email: u.email || null,
    phone: u.phone || null,
    city: u.city || null,
    joined: u.joinedAt ? monthYear(u.joinedAt) : null,
    bookings: u.bookingsCount || 0,
    spend: u.lifetimeSpend || 0,
    lastSeen: u.lastSeenAt ? relDayLabel(u.lastSeenAt, now) : '—',
    status: u.status,
    color: avColor(u.name),
    initials: initials(u.name),
  };
}

async function findUser(db, userId) {
  const u = await db.collection('customers').findOne({ userId });
  if (!u) throw new Error(`User ${userId} not found`);
  return u;
}

export const usersResolvers = {
  Query: {
    getAdminUserList: async (_p, { tab, q, limit = 100, offset = 0 }, ctx) => {
      requireAdmin(ctx);
      const { db } = ctx;
      const now = Date.now();
      const search = q ? { $or: [{ name: rx(q) }, { email: rx(q) }, { city: rx(q) }, { userId: rx(q) }] } : {};
      const tabFilter = tab && tab !== 'all' ? { status: tab } : {};

      const [facet] = await db.collection('customers').aggregate([
        { $match: search },
        {
          $facet: {
            counts: [{ $group: { _id: '$status', n: { $sum: 1 } } }],
            rows: [{ $match: tabFilter }, { $sort: { lastSeenAt: -1 } }, { $skip: offset }, { $limit: limit }],
            total: [{ $match: tabFilter }, { $count: 'n' }],
            agg: [
              {
                $group: {
                  _id: null,
                  n: { $sum: 1 },
                  spend: { $sum: '$lifetimeSpend' },
                  bookings: { $sum: '$bookingsCount' },
                  newMonth: { $sum: { $cond: [{ $gte: ['$joinedAt', now - 30 * DAY] }, 1, 0] } },
                  active: { $sum: { $cond: [{ $gte: ['$lastSeenAt', now - 30 * DAY] }, 1, 0] } },
                },
              },
            ],
          },
        },
      ]).toArray();

      const byStatus = Object.fromEntries(facet.counts.map((c) => [c._id, c.n]));
      const counts = {
        all: Object.values(byStatus).reduce((s, n) => s + n, 0),
        active: byStatus.active || 0,
        flagged: byStatus.flagged || 0,
        banned: byStatus.banned || 0,
      };
      const a = facet.agg[0] || { n: 0, spend: 0, bookings: 0, newMonth: 0, active: 0 };
      return {
        counts,
        stats: {
          registered: a.n,
          registeredDelta: a.n ? Math.round((a.newMonth / a.n) * 100) : null,
          newThisMonth: a.newMonth,
          monthlyActive: a.active,
          activePct: a.n ? Math.round((a.active / a.n) * 1000) / 10 : 0,
          avgLtv: a.n ? Math.round(a.spend / a.n) : 0,
          avgBookings: a.n ? Math.round((a.bookings / a.n) * 10) / 10 : 0,
          flaggedBanned: counts.flagged + counts.banned,
        },
        users: facet.rows.map((u) => userOut(u, now)),
        total: facet.total[0]?.n || 0,
      };
    },

    getAdminUserDetail: async (_p, { userId }, ctx) => {
      requireAdmin(ctx);
      const { db } = ctx;
      const u = await findUser(db, userId);
      const bookings = await db.collection('bookings').find({ customerId: userId }).sort({ slotAt: -1 }).limit(20).toArray();
      const cancels = bookings.filter((b) => ['cancelled', 'no-show'].includes(b.status)).length;
      const count = u.bookingsCount || bookings.length;
      return {
        user: userOut(u),
        activityStats: {
          bookings: count,
          spend: u.lifetimeSpend || 0,
          avgTicket: count ? Math.round((u.lifetimeSpend || 0) / count) : 0,
          cancellations: cancels,
          joined: u.joinedAt ? dateLabel(u.joinedAt) : '—',
          flaggedNote: u.status === 'flagged' ? u.flagNote || '3 chargebacks in 30 days' : null,
        },
        bookings: bookings.map((b) => bookingOut(b)),
        spark: u.spark || spark(parseInt(userId.slice(4)) || 7, 14, 0),
      };
    },
  },

  Mutation: {
    adminFlagUser: async (_p, { userId }, ctx) => {
      const admin = requireAdmin(ctx);
      const u = await findUser(ctx.db, userId);
      await ctx.db.collection('customers').updateOne({ userId }, { $set: { status: 'flagged' } });
      await writeAudit({ db: ctx.db, actorAdmin: admin, action: 'flagged user', target: `User · ${u.name}`, type: 'account', ref: `#${userId}`, ip: ctx.ip });
      return { success: true, message: 'User flagged for review', refId: userId };
    },
    adminBanUser: async (_p, { userId }, ctx) => {
      const admin = requireAdmin(ctx);
      const u = await findUser(ctx.db, userId);
      await ctx.db.collection('customers').updateOne({ userId }, { $set: { status: 'banned' } });
      await writeAudit({ db: ctx.db, actorAdmin: admin, action: 'banned user', target: `User · ${u.name}`, type: 'account', ref: `#${userId}`, ip: ctx.ip });
      return { success: true, message: 'User banned', refId: userId };
    },
    adminReinstateUser: async (_p, { userId }, ctx) => {
      const admin = requireAdmin(ctx);
      const u = await findUser(ctx.db, userId);
      await ctx.db.collection('customers').updateOne({ userId }, { $set: { status: 'active' } });
      await writeAudit({ db: ctx.db, actorAdmin: admin, action: 'reinstated user', target: `User · ${u.name}`, type: 'account', ref: `#${userId}`, ip: ctx.ip });
      return { success: true, message: 'User reinstated', refId: userId };
    },
  },
};
