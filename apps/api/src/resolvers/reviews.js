// reviews.js — moderation queue + auto-flag rules settings.
import { requireAdmin } from './helpers.js';
import { writeAudit } from '../services/audit.js';
import { getRules, DEFAULT_RULES } from '../services/autoflag.js';
import { timeAgo, avColor, initials, DAY } from '../services/format.js';

export const reviewsResolvers = {
  Query: {
    getAdminReviewList: async (_p, { tab }, ctx) => {
      requireAdmin(ctx);
      const { db } = ctx;
      const now = Date.now();

      const [facet] = await db.collection('reviews').aggregate([
        { $match: { status: { $ne: 'deleted' } } },
        {
          $facet: {
            counts: [{ $group: { _id: '$status', n: { $sum: 1 } } }],
            rows: [
              { $match: tab && tab !== 'all' ? { status: tab } : {} },
              { $sort: { createdAt: -1 } },
              { $limit: 60 },
              { $lookup: { from: 'customers', localField: 'customerId', foreignField: 'userId', as: 'cust' } },
              { $lookup: { from: 'venues', localField: 'venueId', foreignField: 'venueId', as: 'ven' } },
            ],
            agg: [
              {
                $group: {
                  _id: null,
                  n: { $sum: 1 },
                  avg: { $avg: '$rating' },
                  oneStar: { $sum: { $cond: [{ $eq: ['$rating', 1] }, 1, 0] } },
                  recent: { $sum: { $cond: [{ $gte: ['$createdAt', now - 30 * DAY] }, 1, 0] } },
                },
              },
            ],
          },
        },
      ]).toArray();

      const byStatus = Object.fromEntries(facet.counts.map((c) => [c._id, c.n]));
      const counts = {
        all: Object.values(byStatus).reduce((s, n) => s + n, 0),
        flagged: byStatus.flagged || 0,
        pending: byStatus.pending || 0,
        visible: byStatus.visible || 0,
        hidden: byStatus.hidden || 0,
      };
      const a = facet.agg[0] || { n: 0, avg: 0, oneStar: 0 };
      return {
        counts,
        stats: {
          total: a.n,
          totalDelta: a.n ? Math.round(((a.recent || 0) / a.n) * 100) : null,
          avg: a.avg ? Math.round(a.avg * 10) / 10 : null,
          flagged: counts.flagged,
          pending: counts.pending,
          oneStarRate: a.n ? Math.round((a.oneStar / a.n) * 1000) / 10 : 0,
        },
        reviews: facet.rows.map((r) => {
          const userName = r.cust[0]?.name || r.customerName || 'Customer';
          return {
            reviewId: r.reviewId,
            user: userName,
            venue: r.ven[0]?.name || r.venueName || '—',
            text: r.text,
            rating: r.rating,
            status: r.status,
            flags: r.flags || 0,
            dateAgo: timeAgo(r.createdAt, now),
            color: avColor(userName),
            initials: initials(userName),
          };
        }),
      };
    },

    getAdminAutoflagRules: async (_p, _a, ctx) => {
      requireAdmin(ctx);
      return getRules(ctx.db);
    },
  },

  Mutation: {
    adminModerateReview: async (_p, { reviewId, action }, ctx) => {
      const admin = requireAdmin(ctx);
      const { db } = ctx;
      const r = await db.collection('reviews').findOne({ reviewId });
      if (!r) throw new Error(`Review ${reviewId} not found`);
      const set =
        action === 'approve' ? { status: 'visible' }
        : action === 'hide' ? { status: 'hidden' }
        : action === 'escalate' ? { status: 'flagged' }
        : action === 'delete' ? { status: 'deleted', deletedAt: Date.now() }
        : null;
      if (!set) throw new Error(`Unknown moderation action: ${action}`);
      const update = { $set: set };
      if (action === 'escalate') update.$inc = { flags: 1 };
      await db.collection('reviews').updateOne({ reviewId }, update);

      const verb = { approve: 'approved review', hide: 'hidden review', escalate: 'escalated review', delete: 'deleted review' }[action];
      await writeAudit({
        db, actorAdmin: admin, action: verb,
        target: r.flags ? `Review flagged ×${r.flags}` : `Review · ${r.rating}★`,
        type: 'review', ref: `#${reviewId}`, ip: ctx.ip,
      });
      const msg = { approve: 'Review approved · visible', hide: 'Review hidden', escalate: 'Review escalated · flagged', delete: 'Review deleted' }[action];
      return { success: true, message: msg, refId: reviewId };
    },

    adminSetAutoflagRules: async (_p, { rules }, ctx) => {
      const admin = requireAdmin(ctx);
      const merged = { ...DEFAULT_RULES, ...(rules || {}) };
      await ctx.db.collection('settings').updateOne({ _id: 'autoflag' }, { $set: { rules: merged } }, { upsert: true });
      await writeAudit({
        db: ctx.db, actorAdmin: admin, action: 'updated auto-flag rules',
        target: Object.entries(merged).filter(([, v]) => v).map(([k]) => k).join(', ') || 'all off',
        type: 'config', ref: '#CFG-AUTOFLAG', ip: ctx.ip,
      });
      return { success: true, message: 'Auto-flag rules saved', refId: 'autoflag' };
    },
  },
};
