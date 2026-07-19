// audit.js — the immutable audit trail. Insert-only; nothing ever edits or
// deletes rows here (Section 8.16).
import { nextId } from './ids.js';
import { auditTime } from './format.js';

/**
 * writeAudit({ db, actorAdmin, action, target, type, ref, ip, at })
 * action strings match the UI copy exactly: "approved KYC", "rejected venue",
 * "released payout", "featured venue", "resolved dispute", "suspended owner",
 * "edited promo", "hidden review", "issued invoice", "banned user", "login",
 * "exported data", "updated commission", …
 */
export async function writeAudit({ db, actorAdmin, actor, action, target, type, ref = null, ip = null, at = Date.now() }) {
  const logId = await nextId(db, 'log');
  const doc = {
    logId,
    actor: actor || (actorAdmin ? `${actorAdmin.name} (${actorAdmin.role === 'super' ? 'Admin' : actorAdmin.role})` : 'System'),
    actorAdminId: actorAdmin?.adminId || null,
    action,
    target,
    type,
    ref: ref || null,
    ip: ip || null,
    createdAt: at,
  };
  await db.collection('auditLogs').insertOne(doc);
  return doc;
}

export function auditEntryOut(a) {
  return {
    logId: a.logId,
    actor: a.actor,
    action: a.action,
    target: a.target,
    type: a.type,
    ref: a.ref || null,
    ip: a.ip || null,
    time: auditTime(a.createdAt),
    createdAt: a.createdAt,
  };
}
