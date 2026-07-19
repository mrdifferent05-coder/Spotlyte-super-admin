// invoices.js — GST tax & billing. Rule: total = round(amount × 1.18); a user
// tax invoice is auto-created on every paid booking (applied by the seed /
// booking ingestion path).
import { requireAdmin, invoiceOut } from './helpers.js';
import { writeAudit } from '../services/audit.js';
import { nextId } from '../services/ids.js';
import { gst, fmtINR } from '../services/money.js';
import { monthYear, DAY } from '../services/format.js';

export const invoicesResolvers = {
  Query: {
    getAdminInvoiceList: async (_p, { audience, tab }, ctx) => {
      requireAdmin(ctx);
      const { db } = ctx;
      const aud = audience === 'user' ? 'user' : 'owner';

      const [facet] = await db.collection('invoices').aggregate([
        { $match: { audience: aud } },
        {
          $facet: {
            counts: [{ $group: { _id: '$status', n: { $sum: 1 } } }],
            rows: [
              { $match: tab && tab !== 'all' ? { status: tab } : {} },
              { $sort: { issuedAt: -1 } },
              { $limit: 120 },
            ],
            agg: [
              {
                $group: {
                  _id: null,
                  n: { $sum: 1 },
                  billed: { $sum: '$total' },
                  tax: { $sum: '$tax' },
                  collected: { $sum: { $cond: [{ $eq: ['$status', 'paid'] }, '$total', 0] } },
                  outstanding: { $sum: { $cond: [{ $in: ['$status', ['due', 'overdue']] }, '$total', 0] } },
                  avg: { $avg: '$total' },
                },
              },
            ],
          },
        },
      ]).toArray();

      const byStatus = Object.fromEntries(facet.counts.map((c) => [c._id, c.n]));
      const counts = {
        all: Object.values(byStatus).reduce((s, n) => s + n, 0),
        due: byStatus.due || 0,
        overdue: byStatus.overdue || 0,
        paid: byStatus.paid || 0,
      };
      const a = facet.agg[0] || { n: 0, billed: 0, tax: 0, collected: 0, outstanding: 0, avg: 0 };
      const stats =
        aud === 'owner'
          ? {
              billed: a.billed,
              outstanding: a.outstanding,
              due: counts.due,
              overdue: counts.overdue,
              collected: a.collected,
              collectionRate: a.billed ? Math.round((a.collected / a.billed) * 1000) / 10 : 0,
            }
          : {
              count: a.n,
              gstCollected: a.tax,
              avgInvoice: Math.round(a.avg || 0),
              autoIssued: 100,
            };
      return { stats, counts, invoices: facet.rows.map(invoiceOut) };
    },

    getAdminInvoiceDoc: async (_p, { invoiceId }, ctx) => {
      requireAdmin(ctx);
      const { db } = ctx;
      const inv = await db.collection('invoices').findOne({ invoiceId });
      if (!inv) throw new Error(`Invoice ${invoiceId} not found`);
      let buyer = { name: inv.partyName, sub: inv.subLabel };
      if (inv.audience === 'owner') {
        const o = await db.collection('owners').findOne({ ownerId: inv.partyId });
        if (o) buyer = { name: o.legal?.legalName || o.biz, gstin: o.legal?.gstin, pan: o.legal?.pan, city: o.city, contact: o.name, email: o.email };
      } else {
        const u = await db.collection('customers').findOne({ userId: inv.partyId });
        if (u) buyer = { name: u.name, email: u.email, city: u.city, phone: u.phone };
      }
      return {
        invoice: invoiceOut(inv),
        seller: {
          name: 'Spotlyte Technologies Pvt Ltd',
          address: '4th Floor, Indiqube Alpha, HSR Layout, Bangalore 560102',
          gstin: '29AASCS7448K1ZM',
          pan: 'AASCS7448K',
          email: 'billing@spotlyte.in',
        },
        buyer,
        lines: [
          { desc: lineDesc(inv), amount: inv.amount },
          { desc: 'GST (18%) — CGST 9% + SGST 9%', amount: inv.tax },
        ],
        notes:
          inv.audience === 'owner'
            ? 'Payable within 14 days of issue. Auto-debit is attempted on the registered settlement account.'
            : 'Tax invoice auto-issued on payment capture. Amount already collected at booking.',
      };
    },
  },

  Mutation: {
    adminCreateInvoice: async (_p, { input }, ctx) => {
      const admin = requireAdmin(ctx);
      const { db } = ctx;
      const aud = input.audience === 'user' ? 'user' : 'owner';
      const amount = Math.round(input.amount);
      const tax = gst(amount);
      const total = amount + tax;
      const now = Date.now();

      let partyName = input.partyId;
      let subLabel = null;
      if (aud === 'owner') {
        const o = await db.collection('owners').findOne({ ownerId: input.partyId });
        if (!o) throw new Error(`Owner ${input.partyId} not found`);
        partyName = o.biz;
        subLabel = o.name;
      } else {
        const u = await db.collection('customers').findOne({ userId: input.partyId });
        if (!u) throw new Error(`User ${input.partyId} not found`);
        partyName = u.name;
        subLabel = input.type;
      }

      const invoiceId = await nextId(db, aud === 'owner' ? 'invoiceOwner' : 'invoiceUser');
      await db.collection('invoices').insertOne({
        invoiceId,
        audience: aud,
        partyId: input.partyId,
        partyName,
        subLabel,
        type: input.type,
        period: input.period || monthYear(now),
        amount,
        tax,
        total,
        status: 'due',
        issuedAt: now,
        dueAt: now + 14 * DAY,
        createdAt: now,
      });
      await writeAudit({
        db, actorAdmin: admin, action: 'issued invoice',
        target: `${fmtINR(total, { full: true })} → ${partyName}`,
        type: 'invoice', ref: `#${invoiceId}`, ip: ctx.ip,
      });
      return { success: true, message: `Invoice ${invoiceId} created · ${fmtINR(total, { full: true })} incl. GST`, refId: invoiceId };
    },
  },
};

function lineDesc(inv) {
  if (inv.type === 'Subscription') return `Spotlyte ${inv.period} subscription — platform access`;
  if (inv.type === 'Commission') return `Marketplace commission — ${inv.period}`;
  return `Court booking — ${inv.subLabel || inv.period}`;
}
