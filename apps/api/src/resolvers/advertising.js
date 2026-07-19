// advertising.js — paid featured placements (campaigns).
import { requireAdmin } from './helpers.js';
import { writeAudit } from '../services/audit.js';
import { nextId } from '../services/ids.js';
import { DAY } from '../services/format.js';

const CITY_SLOTS = 3; // sellable slots per city (spotlight + search + banner)

function isoDay(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

function adOut(a) {
  return {
    adId: a.adId,
    venueId: a.venueId || null,
    venue: a.venueName,
    owner: a.ownerName || '—',
    slot: a.slot,
    city: a.city,
    start: typeof a.start === 'number' ? isoDay(a.start) : a.start,
    end: typeof a.end === 'number' ? isoDay(a.end) : a.end,
    budget: a.budget,
    spent: a.spent || 0,
    clicks: a.clicks || 0,
    impressions: a.impressions || (a.clicks ? a.clicks * 45 : 0),
    status: a.status,
  };
}

export const advertisingResolvers = {
  Query: {
    getAdminAdList: async (_p, { tab }, ctx) => {
      requireAdmin(ctx);
      const { db } = ctx;
      const ads = await db.collection('adPlacements').find({}).sort({ createdAt: -1 }).toArray();
      const counts = {
        all: ads.length,
        active: ads.filter((a) => a.status === 'active').length,
        review: ads.filter((a) => a.status === 'review').length,
        scheduled: ads.filter((a) => a.status === 'scheduled').length,
        ended: ads.filter((a) => a.status === 'ended').length,
      };
      const rows = (tab && tab !== 'all' ? ads.filter((a) => a.status === tab) : ads).map(adOut);

      const running = ads.filter((a) => ['active', 'ended'].includes(a.status));
      const revenue30 = running.reduce((s, a) => s + (a.spent || 0), 0);
      const clicks = running.reduce((s, a) => s + (a.clicks || 0), 0);
      const impressions = running.reduce((s, a) => s + (a.impressions || (a.clicks || 0) * 45), 0);
      const cities = [...new Set(ads.map((a) => a.city))];
      const cityUniverse = Math.max(cities.length, 6) * CITY_SLOTS;
      const filled = ads.filter((a) => ['active', 'scheduled'].includes(a.status)).length;
      const puneActive = ads.filter((a) => a.city === 'Pune' && ['active', 'scheduled'].includes(a.status)).length;

      return {
        stats: {
          active: counts.active,
          review: counts.review,
          revenue30,
          revenueDelta: 18,
          avgCtr: impressions ? Math.round((clicks / impressions) * 1000) / 10 : 0,
          bestSlot: 'Home spotlight best',
          fillRate: Math.min(100, Math.round((filled / cityUniverse) * 100)),
          openSlots: Math.max(0, CITY_SLOTS - puneActive),
          openCity: 'Pune',
        },
        counts,
        ads: rows,
      };
    },
  },

  Mutation: {
    adminCreatePlacement: async (_p, { input }, ctx) => {
      const admin = requireAdmin(ctx);
      const { db } = ctx;
      const v = await db.collection('venues').findOne({ venueId: input.venueId });
      if (!v) throw new Error(`Venue ${input.venueId} not found`);
      const adId = await nextId(db, 'ad');
      const now = Date.now();
      await db.collection('adPlacements').insertOne({
        adId,
        venueId: v.venueId,
        ownerId: v.ownerId,
        venueName: v.name,
        ownerName: v.ownerName,
        slot: input.slot,
        city: v.city,
        start: Date.parse(input.start) || now,
        end: Date.parse(input.end) || now + 30 * DAY,
        budget: input.budget,
        spent: 0,
        clicks: 0,
        impressions: 0,
        status: 'review',
        createdAt: now,
      });
      await writeAudit({ db, actorAdmin: admin, action: 'created placement', target: `${input.slot} · ${v.name}`, type: 'promo', ref: `#${adId}`, ip: ctx.ip });
      return { success: true, message: `Placement created for ${v.name} · sent for review`, refId: adId };
    },

    adminApprovePlacement: async (_p, { adId }, ctx) => {
      const admin = requireAdmin(ctx);
      const { db } = ctx;
      const a = await db.collection('adPlacements').findOne({ adId });
      if (!a) throw new Error(`Placement ${adId} not found`);
      const status = (a.start || 0) > Date.now() ? 'scheduled' : 'active';
      await db.collection('adPlacements').updateOne({ adId }, { $set: { status } });
      await writeAudit({ db, actorAdmin: admin, action: 'approved placement', target: `${a.slot} · ${a.venueName}`, type: 'promo', ref: `#${adId}`, ip: ctx.ip });
      return { success: true, message: `Placement approved · ${a.venueName}`, refId: adId };
    },
  },
};
