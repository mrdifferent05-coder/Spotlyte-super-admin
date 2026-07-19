// owners.js — owner list, detail (KYC flow) and every owner mutation.
import { requireAdmin, rx, ownerOut, venueOut } from './helpers.js';
import { writeAudit, auditEntryOut } from '../services/audit.js';
import { nextId } from '../services/ids.js';
import { TIERS } from '../services/money.js';
import { sparkDelta, spark, dateLabel, dayShort, nextMonday } from '../services/format.js';

const TAB_FILTER = {
  review: { kyc: 'review' },
  docs: { kyc: 'docs' },
  verified: { kyc: 'verified' },
  suspended: { kyc: { $in: ['suspended', 'rejected'] } },
};

// The canonical owner-doc catalog (Section 8.3 modal list).
export const OWNER_DOC_TYPES = [
  'PAN Card', 'GST Certificate', 'Business Registration / LLP',
  'Bank account proof (cancelled cheque)', 'Identity proof (Aadhaar)',
  'Venue ownership / lease deed', 'Authorised signatory letter', 'Cancelled cheque',
];

async function findOwner(db, ownerId) {
  const o = await db.collection('owners').findOne({ ownerId });
  if (!o) throw new Error(`Owner ${ownerId} not found`);
  return o;
}

export const ownersResolvers = {
  Query: {
    getAdminOwnerList: async (_p, { tab, q, limit = 100, offset = 0 }, ctx) => {
      requireAdmin(ctx);
      const { db } = ctx;
      const match = q
        ? { $or: [{ name: rx(q) }, { biz: rx(q) }, { city: rx(q) }, { ownerId: rx(q) }] }
        : {};
      const [facet] = await db.collection('owners').aggregate([
        { $match: match },
        {
          $facet: {
            counts: [{ $group: { _id: '$kyc', n: { $sum: 1 } } }],
            rows: [
              { $match: TAB_FILTER[tab] || {} },
              { $sort: { submittedAt: -1, revenue: -1 } },
              { $skip: offset },
              { $limit: limit },
            ],
            total: [{ $match: TAB_FILTER[tab] || {} }, { $count: 'n' }],
            gmv: [{ $group: { _id: null, total: { $sum: '$revenue' } } }],
            cities: [{ $group: { _id: '$city' } }],
            top: [{ $sort: { revenue: -1 } }, { $limit: 1 }],
          },
        },
      ]).toArray();

      const byKyc = Object.fromEntries(facet.counts.map((c) => [c._id, c.n]));
      const counts = {
        all: Object.values(byKyc).reduce((s, n) => s + n, 0),
        review: byKyc.review || 0,
        docs: byKyc.docs || 0,
        verified: byKyc.verified || 0,
        suspended: (byKyc.suspended || 0) + (byKyc.rejected || 0),
      };
      const owners = facet.rows.map((o) => ownerOut(o));
      const allSpark = facet.rows.length ? facet.rows[0].spark : null;
      return {
        counts,
        stats: {
          verified: counts.verified,
          cities: facet.cities.filter((c) => c._id).length,
          awaiting: counts.review + counts.docs,
          review: counts.review,
          docs: counts.docs,
          gmv30d: facet.gmv[0]?.total || 0,
          gmvDelta: sparkDelta(allSpark) ?? 12,
          topBiz: facet.top[0]?.biz || '—',
          suspended: counts.suspended,
        },
        owners,
        total: facet.total[0]?.n || 0,
      };
    },

    getAdminOwnerDetail: async (_p, { ownerId }, ctx) => {
      requireAdmin(ctx);
      const { db } = ctx;
      const o = await findOwner(db, ownerId);
      const [venues, activity] = await Promise.all([
        db.collection('venues').find({ ownerId }).sort({ revenue30d: -1 }).toArray(),
        db.collection('auditLogs').find({ ref: `#${ownerId}` }).sort({ createdAt: -1 }).limit(20).toArray(),
      ]);
      const pipelineStep = o.kyc === 'docs' ? 1 : o.kyc === 'review' ? 2 : o.kyc === 'verified' ? 4 : 2;
      return {
        owner: ownerOut(o),
        pipelineStep,
        documents: (o.documents || []).map((d) => ({
          name: d.name,
          ref: d.ref || null,
          status: d.status,
          fileUrl: d.fileUrl || null,
        })),
        venues: venues.map((v) => venueOut(v)),
        contact: { contact: o.name, email: o.email, phone: o.phone, city: o.city },
        legal: o.legal || {},
        bank: o.bank || {},
        plan: {
          ...(o.plan || {}),
          commissionLine: `${o.commissionTier?.pct ?? 18}% commission`,
          memberSince: o.joinedAt ? dateLabel(o.joinedAt) : '—',
          renews: o.plan?.renews || null,
          billing: o.plan?.billing || null,
        },
        cancellationPolicy: o.cancellationPolicy || { tier: 'Flexible', text: 'Full refund up to 24 h before slot' },
        lifetime: {
          gmv: o.revenue || 0,
          pendingPayout: o.pendingPayout || 0,
          rating: o.rating || null,
          ratingSub: o.rating ? 'across venues' : 'no reviews yet',
          disputes: o.disputeCount || 0,
          disputesSub: o.disputeCount ? 'lifetime' : 'clean record',
          spark: o.spark || spark(3, 14, 1),
        },
        activity: activity.map(auditEntryOut),
      };
    },
  },

  Mutation: {
    adminInviteOwner: async (_p, { input }, ctx) => {
      const admin = requireAdmin(ctx);
      const { db } = ctx;
      const ownerId = await nextId(db, 'owner');
      const now = Date.now();
      await db.collection('owners').insertOne({
        ownerId,
        name: input.name,
        biz: input.biz,
        email: (input.email || '').toLowerCase(),
        phone: input.phone || null,
        city: input.city || null,
        kyc: 'review',
        commissionTier: { name: 'Standard', pct: 18 },
        plan: { name: 'Starter', priceMo: 0, commissionPct: 20, billing: 'Not set up', renews: '—' },
        legal: { legalName: input.biz, pan: null, gstin: null, regType: guessRegType(input.biz) },
        bank: { verified: false },
        cancellationPolicy: { tier: 'Flexible', text: 'Full refund up to 24 h before slot' },
        documents: OWNER_DOC_TYPES.slice(0, 6).map((name) => ({ name, ref: null, status: 'missing', fileUrl: null })),
        requestedDocs: [],
        revenue: 0, pendingPayout: 0, rating: null, disputeCount: 0, venueCount: 0,
        spark: spark(now % 97, 14, 0),
        joinedAt: now, submittedAt: now, createdAt: now, updatedAt: now,
      });
      await writeAudit({ db, actorAdmin: admin, action: 'invited owner', target: `Owner · ${input.name}`, type: 'account', ref: `#${ownerId}`, ip: ctx.ip });
      return { success: true, message: 'Invite sent', refId: ownerId };
    },

    adminApproveOwnerKyc: async (_p, { ownerId, commissionTier }, ctx) => {
      const admin = requireAdmin(ctx);
      const { db } = ctx;
      const o = await findOwner(db, ownerId);
      const tierName = (commissionTier || 'Standard').split(/[\s—-]/)[0];
      const tier = TIERS[tierName] || TIERS.Standard;
      await db.collection('owners').updateOne(
        { ownerId },
        {
          $set: {
            kyc: 'verified',
            commissionTier: { name: tier.name, pct: tier.pct },
            'bank.verified': true,
            documents: (o.documents || []).map((d) => ({ ...d, status: 'verified', reviewedAt: Date.now() })),
            updatedAt: Date.now(),
          },
        }
      );
      await writeAudit({ db, actorAdmin: admin, action: 'approved KYC', target: `Owner · ${o.name}`, type: 'approval', ref: `#${ownerId}`, ip: ctx.ip });
      await writeAudit({ db, actorAdmin: admin, action: 'set commission tier', target: `${tier.name} — ${tier.pct}%`, type: 'payout', ref: `#${ownerId}`, ip: ctx.ip });
      return { success: true, message: `KYC approved · ${o.biz} is live`, refId: ownerId };
    },

    adminRejectOwnerKyc: async (_p, { ownerId, reason, note }, ctx) => {
      const admin = requireAdmin(ctx);
      const { db } = ctx;
      const o = await findOwner(db, ownerId);
      await db.collection('owners').updateOne(
        { ownerId },
        { $set: { kyc: 'rejected', rejection: { reason, note: note || null, at: Date.now() }, updatedAt: Date.now() } }
      );
      await writeAudit({ db, actorAdmin: admin, action: 'rejected KYC', target: `Owner · ${o.name} — ${reason}`, type: 'account', ref: `#${ownerId}`, ip: ctx.ip });
      return { success: true, message: 'KYC rejected · owner notified', refId: ownerId };
    },

    adminRequestOwnerDocs: async (_p, { ownerId, docs, note }, ctx) => {
      const admin = requireAdmin(ctx);
      const { db } = ctx;
      const o = await findOwner(db, ownerId);
      const requested = new Set(docs);
      await db.collection('owners').updateOne(
        { ownerId },
        {
          $set: {
            kyc: 'docs',
            requestedDocs: docs,
            docRequestNote: note || null,
            documents: (o.documents || []).map((d) => (requested.has(d.name) ? { ...d, status: 'missing' } : d)),
            updatedAt: Date.now(),
          },
        }
      );
      await writeAudit({
        db, actorAdmin: admin, action: 'requested documents',
        target: docs.length ? docs.slice(0, 2).join(' + ') + (docs.length > 2 ? ` +${docs.length - 2}` : '') : 'additional documents',
        type: 'docs', ref: `#${ownerId}`, ip: ctx.ip,
      });
      return { success: true, message: `Requested ${docs.length} document${docs.length === 1 ? '' : 's'} · owner notified`, refId: ownerId };
    },

    adminSuspendOwner: async (_p, { ownerId }, ctx) => {
      const admin = requireAdmin(ctx);
      const o = await findOwner(ctx.db, ownerId);
      await ctx.db.collection('owners').updateOne({ ownerId }, { $set: { kyc: 'suspended', updatedAt: Date.now() } });
      await writeAudit({ db: ctx.db, actorAdmin: admin, action: 'suspended owner', target: `Owner · ${o.name}`, type: 'account', ref: `#${ownerId}`, ip: ctx.ip });
      return { success: true, message: 'Owner suspended', refId: ownerId };
    },

    adminReinstateOwner: async (_p, { ownerId }, ctx) => {
      const admin = requireAdmin(ctx);
      const o = await findOwner(ctx.db, ownerId);
      await ctx.db.collection('owners').updateOne({ ownerId }, { $set: { kyc: 'verified', updatedAt: Date.now() } });
      await writeAudit({ db: ctx.db, actorAdmin: admin, action: 'reinstated owner', target: `Owner · ${o.name}`, type: 'account', ref: `#${ownerId}`, ip: ctx.ip });
      return { success: true, message: 'Owner reinstated', refId: ownerId };
    },

    // ── Legacy wrappers (base schema) — same service paths ──
    adminVerifyOwnerDoc: async (_p, { ownerId, doc }, ctx) => {
      const admin = requireAdmin(ctx);
      const o = await findOwner(ctx.db, ownerId);
      await ctx.db.collection('owners').updateOne(
        { ownerId },
        { $set: { documents: (o.documents || []).map((d) => (d.name === doc ? { ...d, status: 'verified', reviewedAt: Date.now() } : d)) } }
      );
      await writeAudit({ db: ctx.db, actorAdmin: admin, action: 'verified document', target: `${doc} · ${o.biz}`, type: 'docs', ref: `#${ownerId}`, ip: ctx.ip });
      return 'ok';
    },

    adminApproveOwner: async (_p, { ownerId, status, reason, docs }, ctx) => {
      const self = ownersResolvers.Mutation;
      if (status === 'verified') await self.adminApproveOwnerKyc(_p, { ownerId, commissionTier: 'Standard' }, ctx);
      else if (status === 'rejected') await self.adminRejectOwnerKyc(_p, { ownerId, reason: reason || 'Other (specify)' }, ctx);
      else if (status === 'docs') await self.adminRequestOwnerDocs(_p, { ownerId, docs: docs || [] }, ctx);
      else if (status === 'suspended') await self.adminSuspendOwner(_p, { ownerId }, ctx);
      return 'ok';
    },
  },
};

function guessRegType(biz = '') {
  if (/llp/i.test(biz)) return 'LLP';
  if (/pvt|private/i.test(biz)) return 'Private Limited';
  return 'Proprietorship';
}
