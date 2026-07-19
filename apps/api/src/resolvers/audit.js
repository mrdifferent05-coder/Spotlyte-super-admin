// audit.js — the immutable system-events feed. Read-only; rows are never
// edited or deleted by any mutation.
import { requireAdmin, rx } from './helpers.js';
import { auditEntryOut } from '../services/audit.js';

export const auditResolvers = {
  Query: {
    getAdminAuditLog: async (_p, { type, q, limit = 30, offset = 0 }, ctx) => {
      requireAdmin(ctx);
      const { db } = ctx;
      const match = {};
      if (type && type !== 'all') match.type = type;
      if (q) match.$or = [{ actor: rx(q) }, { action: rx(q) }, { target: rx(q) }, { ref: rx(q) }];
      const [total, rows] = await Promise.all([
        db.collection('auditLogs').countDocuments(match),
        db.collection('auditLogs').find(match).sort({ createdAt: -1 }).skip(offset).limit(Math.min(limit, 100)).toArray(),
      ]);
      return { total, entries: rows.map(auditEntryOut) };
    },
  },
};
