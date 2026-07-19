// promos.js — growth levers: promo codes list + create / edit / pause / resume.
import { requireAdmin, rx } from './helpers.js';
import { writeAudit } from '../services/audit.js';
import { nextId } from '../services/ids.js';
import { DAY } from '../services/format.js';

function derivedStatus(p, now = Date.now()) {
  if (p.status === 'paused') return 'paused';
  const exp = Date.parse(p.expires) || 0;
  if (exp && exp + DAY < now) return 'expired';
  if (p.startAt && p.startAt > now) return 'scheduled';
  if (p.cap && p.used >= p.cap) return 'expired';
  return 'active';
}

function promoOut(p, now = Date.now()) {
  return {
    promoId: p.promoId,
    code: p.code,
    label: p.label || null,
    kind: p.kind,
    value: p.value,
    scope: p.scope,
    used: p.used || 0,
    cap: p.cap || 0,
    expires: p.expires,
    status: derivedStatus(p, now),
    assistedRevenue: p.assistedRevenue || 0,
  };
}

export const promosResolvers = {
  Query: {
    getAdminPromoList: async (_p, { q }, ctx) => {
      requireAdmin(ctx);
      const { db } = ctx;
      const now = Date.now();
      const match = q ? { $or: [{ code: rx(q) }, { label: rx(q) }, { scope: rx(q) }] } : {};
      const promos = await db.collection('promos').find(match).sort({ createdAt: -1 }).toArray();
      const rows = promos.map((p) => promoOut(p, now));
      const active = rows.filter((p) => p.status === 'active');
      const discountSpend = promos.reduce(
        (s, p) => s + (p.used || 0) * (p.kind === 'flat' ? p.value : 180),
        0
      );
      const assisted = promos.reduce((s, p) => s + (p.assistedRevenue || 0), 0);
      return {
        stats: {
          active: active.length,
          scheduled: rows.filter((p) => p.status === 'scheduled').length,
          redemptions30: promos.reduce((s, p) => s + (p.used || 0), 0),
          redemptionsDelta: 22,
          discountSpend,
          assistedGmv: assisted,
          assistedDelta: 31,
          roi: discountSpend ? Math.round((assisted / discountSpend) * 10) / 10 : 0,
        },
        promos: rows,
      };
    },
  },

  Mutation: {
    adminCreatePromo: async (_p, { input }, ctx) => {
      const admin = requireAdmin(ctx);
      const { db } = ctx;
      const code = (input.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (!code) return { success: false, message: 'Code is required', refId: null };
      const exists = await db.collection('promos').findOne({ code });
      if (exists) return { success: false, message: `Code ${code} already exists`, refId: exists.promoId };
      const promoId = await nextId(db, 'promo');
      const now = Date.now();
      await db.collection('promos').insertOne({
        promoId,
        code,
        label: input.label || (input.kind === 'pct' ? `${input.value}% off` : `Flat ₹${input.value} off`),
        kind: input.kind === 'flat' ? 'flat' : 'pct',
        value: input.value,
        scope: input.scope,
        cap: input.cap,
        used: 0,
        expires: input.expires,
        startAt: null,
        status: 'active',
        assistedRevenue: 0,
        createdAt: now,
      });
      await writeAudit({ db, actorAdmin: admin, action: 'created promo', target: `PRM · ${code} live`, type: 'promo', ref: `#${promoId}`, ip: ctx.ip });
      return { success: true, message: `Promo ${code} created · live now`, refId: promoId };
    },

    adminUpdatePromo: async (_p, { promoId, patch }, ctx) => {
      const admin = requireAdmin(ctx);
      const { db } = ctx;
      const p = await db.collection('promos').findOne({ promoId });
      if (!p) throw new Error(`Promo ${promoId} not found`);
      const allowed = ['label', 'kind', 'value', 'scope', 'cap', 'expires', 'status'];
      const set = {};
      for (const k of allowed) if (patch && patch[k] !== undefined) set[k] = patch[k];
      if (Object.keys(set).length) await db.collection('promos').updateOne({ promoId }, { $set: set });

      const verb =
        set.status === 'paused' ? 'paused promo'
        : set.status === 'active' && p.status === 'paused' ? 'resumed promo'
        : 'edited promo';
      await writeAudit({
        db, actorAdmin: admin, action: verb,
        target: `PRM · ${p.code}${set.status ? ' ' + set.status : ''}`,
        type: 'promo', ref: `#${promoId}`, ip: ctx.ip,
      });
      const msg =
        verb === 'paused promo' ? `Promo ${p.code} paused`
        : verb === 'resumed promo' ? `Promo ${p.code} resumed`
        : `Promo ${p.code} updated`;
      return { success: true, message: msg, refId: promoId };
    },
  },
};
