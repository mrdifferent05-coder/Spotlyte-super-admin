// disputes.js — resolution center with escrow. Resolutions:
// FULL_REFUND | PARTIAL_50 | WALLET_CREDIT | REJECT_CLAIM.
import { requireAdmin, rx, disputeOut } from './helpers.js';
import { writeAudit } from '../services/audit.js';
import { refundAmount, fmtINR } from '../services/money.js';
import { timeAgo, auditTime, DAY } from '../services/format.js';

const RESOLUTIONS = {
  FULL_REFUND: { pct: 100, label: (amt) => `Full refund ${fmtINR(amt, { full: true })} → customer`, favour: 'customer' },
  PARTIAL_50: { pct: 50, label: (amt) => `Partial refund ${fmtINR(Math.round(amt / 2), { full: true })} → customer`, favour: 'customer' },
  WALLET_CREDIT: { pct: 0, label: (amt) => `${fmtINR(amt, { full: true })} spotlyte wallet credit`, favour: 'customer' },
  REJECT_CLAIM: { pct: 0, label: () => 'Claim rejected · favour owner', favour: 'owner' },
};

async function findDispute(db, disputeId) {
  const d = await db.collection('disputes').findOne({ disputeId });
  if (!d) throw new Error(`Dispute ${disputeId} not found`);
  return d;
}

export const disputesResolvers = {
  Query: {
    getAdminDisputePage: async (_p, { tab, q }, ctx) => {
      requireAdmin(ctx);
      const { db } = ctx;
      const now = Date.now();
      const match = q ? { $or: [{ disputeId: rx(q) }, { customerName: rx(q) }, { venueName: rx(q) }, { reason: rx(q) }] } : {};
      const all = await db.collection('disputes').find(match).toArray();

      const counts = {
        all: all.length,
        open: all.filter((d) => d.status === 'open').length,
        investigating: all.filter((d) => d.status === 'investigating').length,
        resolved: all.filter((d) => d.status === 'resolved').length,
      };
      const unresolved = all.filter((d) => d.status !== 'resolved');
      const resolved = all.filter((d) => d.status === 'resolved' && d.resolution?.at);
      const resolved30 = resolved.filter((d) => d.resolution.at >= now - 30 * DAY);
      const avgDays = resolved.length
        ? Math.round((resolved.reduce((s, d) => s + (d.resolution.at - d.openedAt), 0) / resolved.length / DAY) * 10) / 10
        : 0;
      const customerFavour = resolved30.filter((d) => d.resolution?.favour !== 'owner').length;

      const urgencyRank = { high: 0, medium: 1, low: 2 };
      const rows = (tab && tab !== 'all' ? all.filter((d) => d.status === tab) : all).sort(
        (a, b) => (a.status === 'resolved') - (b.status === 'resolved') || urgencyRank[a.urgency] - urgencyRank[b.urgency] || b.openedAt - a.openedAt
      );

      return {
        counts,
        stats: {
          open: counts.open,
          investigating: counts.investigating,
          atRisk: unresolved.reduce((s, d) => s + (d.amount || 0), 0),
          avgResolutionDays: avgDays,
          avgResolutionDelta: -12,
          resolved30: resolved30.length,
          customerFavourPct: resolved30.length ? Math.round((customerFavour / resolved30.length) * 100) : 0,
        },
        disputes: rows.map((d) => disputeOut(d, now)),
      };
    },

    getAdminDisputeDetailV2: async (_p, { disputeId }, ctx) => {
      requireAdmin(ctx);
      const { db } = ctx;
      const d = await findDispute(db, disputeId);
      const now = Date.now();

      const timeline = [
        { title: 'Dispute opened', sub: `${d.reason} · ${timeAgo(d.openedAt, now)}`, state: 'done' },
        { title: 'Escrow hold placed', sub: `${fmtINR(d.amount, { full: true })} held from settlement`, state: 'done' },
        { title: 'Evidence requested', sub: 'Both parties notified', state: d.status === 'open' ? 'curr' : 'done' },
        d.status === 'resolved'
          ? { title: 'Resolved', sub: d.resolution?.label || 'Closed', state: 'done' }
          : { title: 'Under investigation', sub: d.status === 'investigating' ? 'Admin reviewing evidence' : 'Pending triage', state: d.status === 'investigating' ? 'curr' : 'skip' },
      ];

      return {
        dispute: disputeOut(d, now),
        escrowHeld: d.escrowHeld !== false && d.status !== 'resolved',
        escrowAmount: d.amount || 0,
        caseDetails: {
          customer: { name: d.customerName, userId: d.customerId },
          owner: { name: d.ownerName, ownerId: d.ownerId },
          venue: { name: d.venueName, venueId: d.venueId },
          slot: d.slotLabel,
          reason: d.reason,
          opened: timeAgo(d.openedAt, now),
          bookingId: d.bookingId,
        },
        timeline,
        thread: (d.thread || []).map((m) => ({
          senderRole: m.senderRole,
          senderName: m.senderName,
          message: m.message,
          timeLabel: m.at ? timeAgo(m.at, now) : '—',
        })),
        resolution: d.resolution || null,
      };
    },
  },

  Mutation: {
    adminMarkDisputeInvestigating: async (_p, { disputeId }, ctx) => {
      const admin = requireAdmin(ctx);
      const d = await findDispute(ctx.db, disputeId);
      await ctx.db.collection('disputes').updateOne({ disputeId }, { $set: { status: 'investigating' } });
      await writeAudit({ db: ctx.db, actorAdmin: admin, action: 'marked dispute investigating', target: `${d.reason} · ${d.venueName}`, type: 'dispute', ref: `#${disputeId}`, ip: ctx.ip });
      return { success: true, message: 'Marked investigating', refId: disputeId };
    },

    adminAddDisputeMessage: async (_p, { disputeId, message }, ctx) => {
      const admin = requireAdmin(ctx);
      await findDispute(ctx.db, disputeId);
      await ctx.db.collection('disputes').updateOne(
        { disputeId },
        { $push: { thread: { senderRole: 'admin', senderName: 'spotlyte Support', senderId: admin.adminId, message, at: Date.now() } } }
      );
      await writeAudit({ db: ctx.db, actorAdmin: admin, action: 'replied on dispute', target: 'Support message added', type: 'dispute', ref: `#${disputeId}`, ip: ctx.ip });
      return { success: true, message: 'Message sent to both parties', refId: disputeId };
    },

    adminResolveDisputeV2: async (_p, { disputeId, resolution, note }, ctx) => {
      const admin = requireAdmin(ctx);
      const { db } = ctx;
      const d = await findDispute(db, disputeId);
      const spec = RESOLUTIONS[resolution];
      if (!spec) throw new Error(`Unknown resolution: ${resolution}`);
      const now = Date.now();
      const label = spec.label(d.amount);

      await db.collection('disputes').updateOne(
        { disputeId },
        {
          $set: {
            status: 'resolved',
            escrowHeld: false,
            resolution: { type: resolution, label, note: note || null, byAdminId: admin.adminId, at: now, favour: spec.favour },
          },
          $push: {
            thread: {
              senderRole: 'admin', senderName: 'spotlyte Support', senderId: admin.adminId,
              message: `Resolution: ${label}. Escrow released.`, at: now,
            },
          },
        }
      );

      // Options 1–2 write a refund record on the linked booking (Section 8.15).
      if (spec.pct > 0 && d.bookingId) {
        const b = await db.collection('bookings').findOne({ bookingId: d.bookingId });
        if (b) {
          const amount = refundAmount(b.amount, spec.pct);
          await db.collection('bookings').updateOne(
            { bookingId: d.bookingId },
            {
              $set: {
                status: 'refunded',
                refund: { pct: spec.pct, amount, reason: `Dispute resolution · ${d.reason}`, note: note || null, at: now, byAdminId: admin.adminId },
              },
            }
          );
        }
      }

      await writeAudit({
        db, actorAdmin: admin, action: 'resolved dispute',
        target: spec.favour === 'owner' ? `Claim rejected · ${d.venueName}` : `${label.replace(' → customer', '')} → ${d.customerName}`,
        type: 'dispute', ref: `#${disputeId}`, ip: ctx.ip,
      });
      return { success: true, message: `Dispute resolved · ${label}`, refId: disputeId };
    },

    // Legacy wrapper.
    adminUpdateDispute: async (_p, { id, status }, ctx) => {
      const self = disputesResolvers.Mutation;
      if (status === 'investigating') await self.adminMarkDisputeInvestigating(_p, { disputeId: id }, ctx);
      else if (status === 'resolved') await self.adminResolveDisputeV2(_p, { disputeId: id, resolution: 'FULL_REFUND' }, ctx);
      return 'ok';
    },
  },
};
