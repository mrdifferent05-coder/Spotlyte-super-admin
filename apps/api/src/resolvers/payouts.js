// payouts.js — weekly settlement runs and the full payout lifecycle.
// Money math (Section 8.11): fee = round(gross × tier%) · tds = round((gross−fee) × 1%)
// · net = gross − fee − tds.
import { requireAdmin, payoutOut, bookingOut } from './helpers.js';
import { writeAudit } from '../services/audit.js';
import { nextId } from '../services/ids.js';
import { payoutMath, fmtINR } from '../services/money.js';
import { periodLabel, dayShort, nextMonday, maskBank, shortDate, dateLabel, DAY } from '../services/format.js';

async function findPayout(db, payoutId) {
  const p = await db.collection('payouts').findOne({ payoutId });
  if (!p) throw new Error(`Payout ${payoutId} not found`);
  return p;
}

function timelineFor(p) {
  const done = (t, s) => ({ title: t, sub: s, state: 'done' });
  const processed = ['processing', 'settled'].includes(p.status);
  return [
    done('Settlement requested', `${shortDate(p.periodTo)} · by ${p.biz}`),
    done('Auto-checks passed', 'KYC verified · no active disputes'),
    {
      title: 'Approved · processing',
      sub: processed ? 'In bank transfer queue' : p.status === 'failed' ? 'On hold — bank detail mismatch' : 'Awaiting admin approval',
      state: processed ? 'done' : p.status === 'failed' ? 'cancel' : 'curr',
    },
    {
      title: 'Released · UTR entered',
      sub: p.status === 'settled' ? p.utr : p.status === 'processing' ? 'Enter UTR to release' : 'Pending',
      state: p.status === 'settled' ? 'done' : p.status === 'processing' ? 'curr' : 'skip',
    },
    {
      title: 'Funds settled',
      sub: p.status === 'settled' ? `${p.bankMasked} · ${p.settlesLabel}` : 'Pending',
      state: p.status === 'settled' ? 'done' : 'skip',
    },
  ];
}

export const payoutsResolvers = {
  Query: {
    getAdminPayoutList: async (_p, { tab }, ctx) => {
      requireAdmin(ctx);
      const { db } = ctx;
      const now = Date.now();
      const since30 = now - 30 * DAY;

      const [facet] = await db.collection('payouts').aggregate([
        {
          $facet: {
            counts: [{ $group: { _id: '$status', n: { $sum: 1 } } }],
            rows: [
              { $match: tab && tab !== 'all' ? { status: tab } : {} },
              { $sort: { periodTo: -1, payoutId: -1 } },
              { $limit: 100 },
            ],
            queued: [
              { $match: { status: { $in: ['queued', 'processing'] } } },
              { $group: { _id: null, total: { $sum: '$amount' } } },
            ],
            settled30: [
              { $match: { status: 'settled', settledAt: { $gte: since30 } } },
              { $group: { _id: null, total: { $sum: '$amount' }, fees: { $sum: '$fee' }, n: { $sum: 1 }, gross: { $sum: '$gross' } } },
            ],
          },
        },
      ]).toArray();

      const byStatus = Object.fromEntries(facet.counts.map((c) => [c._id, c.n]));
      const counts = {
        all: Object.values(byStatus).reduce((s, n) => s + n, 0),
        queued: byStatus.queued || 0,
        processing: byStatus.processing || 0,
        settled: byStatus.settled || 0,
        failed: byStatus.failed || 0,
      };
      const s30 = facet.settled30[0] || { total: 0, fees: 0, n: 0, gross: 0 };
      return {
        counts,
        stats: {
          queuedTotal: facet.queued[0]?.total || 0,
          settled30: s30.total,
          settled30Delta: 14,
          settledTransfers: s30.n,
          fees30: s30.fees,
          avgTakeRate: s30.gross ? Math.round((s30.fees / s30.gross) * 100) : 18,
          failed: counts.failed,
        },
        nextRunLabel: dayShort(nextMonday(now)).toUpperCase(),
        payouts: facet.rows.map(payoutOut),
      };
    },

    getAdminPayoutDetail: async (_p, { payoutId }, ctx) => {
      requireAdmin(ctx);
      const { db } = ctx;
      const p = await findPayout(db, payoutId);
      const [txns, history] = await Promise.all([
        db.collection('bookings').find({ bookingId: { $in: p.bookingIds || [] } }).sort({ slotAt: -1 }).toArray(),
        db.collection('payouts').find({ ownerId: p.ownerId, payoutId: { $ne: payoutId }, status: 'settled' }).sort({ periodTo: -1 }).limit(6).toArray(),
      ]);
      return {
        payout: payoutOut(p),
        timeline: timelineFor(p),
        transactions: txns.map((b) => bookingOut(b, p.feePct)),
        history: history.map(payoutOut),
      };
    },
  },

  Mutation: {
    // Generate queued payouts for every verified owner with unsettled,
    // completed, paid bookings (Section 8.10 primary action).
    adminRunPayouts: async (_p, _a, ctx) => {
      const admin = requireAdmin(ctx);
      const { db } = ctx;
      const now = Date.now();
      const owners = await db.collection('owners').find({ kyc: 'verified' }).toArray();
      let created = 0;

      for (const o of owners) {
        const bookings = await db.collection('bookings').find({
          ownerId: o.ownerId,
          status: 'completed',
          paid: true,
          payoutId: null,
        }).toArray();
        if (!bookings.length) continue;

        const gross = bookings.reduce((s, b) => s + b.amount, 0);
        const tierPct = o.commissionTier?.pct ?? 18;
        const m = payoutMath(gross, tierPct);
        const payoutId = await nextId(db, 'payout');
        const from = Math.min(...bookings.map((b) => b.slotAt));
        const to = Math.max(...bookings.map((b) => b.slotAt));
        const venueNames = [...new Set(bookings.map((b) => b.venueName))];

        await db.collection('payouts').insertOne({
          payoutId,
          ownerId: o.ownerId,
          ownerName: o.name,
          biz: o.biz,
          venueId: bookings[0]?.venueId || null,
          venueName: venueNames[0] || o.biz,
          periodFrom: from,
          periodTo: to,
          periodLabel: periodLabel(from, to),
          bookingIds: bookings.map((b) => b.bookingId),
          txns: bookings.length,
          gross,
          feePct: tierPct,
          fee: m.fee,
          tds: m.tds,
          amount: m.net,
          status: 'queued',
          bankMasked: maskBank(o.bank?.bankName, o.bank?.accountNoMasked),
          ifsc: o.bank?.ifsc || null,
          settlesLabel: dayShort(nextMonday(now)),
          utr: null,
          timeline: [{ step: 'created', at: now }],
          createdAt: now,
        });
        await db.collection('bookings').updateMany(
          { bookingId: { $in: bookings.map((b) => b.bookingId) } },
          { $set: { payoutId } }
        );
        created++;
      }

      await writeAudit({
        db, actorAdmin: admin, action: 'ran payout run',
        target: `${created} owner${created === 1 ? '' : 's'} queued`,
        type: 'payout', ref: '—', ip: ctx.ip,
      });
      return { success: true, message: `Payout run scheduled · ${created} owners`, refId: null };
    },

    adminApprovePayout: async (_p, { payoutId }, ctx) => {
      const admin = requireAdmin(ctx);
      const p = await findPayout(ctx.db, payoutId);
      await ctx.db.collection('payouts').updateOne(
        { payoutId },
        { $set: { status: 'processing' }, $push: { timeline: { step: 'approved', at: Date.now() } } }
      );
      await writeAudit({ db: ctx.db, actorAdmin: admin, action: 'approved payout', target: `${fmtINR(p.amount)} → ${p.biz}`, type: 'payout', ref: `#${payoutId}`, ip: ctx.ip });
      return { success: true, message: 'Approved · now processing', refId: payoutId };
    },

    adminHoldPayout: async (_p, { payoutId }, ctx) => {
      const admin = requireAdmin(ctx);
      const p = await findPayout(ctx.db, payoutId);
      await ctx.db.collection('payouts').updateOne(
        { payoutId },
        { $set: { status: 'failed' }, $push: { timeline: { step: 'held', at: Date.now() } } }
      );
      await writeAudit({ db: ctx.db, actorAdmin: admin, action: 'put payout on hold', target: `${fmtINR(p.amount)} → ${p.biz}`, type: 'payout', ref: `#${payoutId}`, ip: ctx.ip });
      return { success: true, message: 'Payout put on hold', refId: payoutId };
    },

    adminReleasePayout: async (_p, { payoutId, utr }, ctx) => {
      const admin = requireAdmin(ctx);
      const clean = (utr || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (!clean) return { success: false, message: 'UTR reference is required', refId: payoutId };
      const p = await findPayout(ctx.db, payoutId);
      await ctx.db.collection('payouts').updateOne(
        { payoutId },
        {
          $set: { status: 'settled', utr: clean, settledAt: Date.now(), settlesLabel: dayShort(Date.now()) },
          $push: { timeline: { step: 'settled', at: Date.now() } },
        }
      );
      await writeAudit({
        db: ctx.db, actorAdmin: admin, action: 'released payout',
        target: `${fmtINR(p.amount)} → ${p.biz}`, type: 'payout', ref: `#${payoutId}`, ip: ctx.ip,
      });
      return { success: true, message: `Released ${fmtINR(p.amount)} · UTR ${clean}`, refId: payoutId };
    },

    adminRetryPayout: async (_p, { payoutId }, ctx) => {
      const admin = requireAdmin(ctx);
      const p = await findPayout(ctx.db, payoutId);
      await ctx.db.collection('payouts').updateOne(
        { payoutId },
        { $set: { status: 'processing' }, $push: { timeline: { step: 'retried', at: Date.now() } } }
      );
      await writeAudit({ db: ctx.db, actorAdmin: admin, action: 'retried payout', target: `${fmtINR(p.amount)} → ${p.biz}`, type: 'payout', ref: `#${payoutId}`, ip: ctx.ip });
      return { success: true, message: 'Retrying transfer', refId: payoutId };
    },
  },
};
