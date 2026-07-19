// context.js — builds { db, admin, ip, res } for every GraphQL request from
// the httpOnly JWT cookie `spotlyte_admin`.
import jwt from 'jsonwebtoken';
import { getDb } from './db.js';

export const COOKIE_NAME = 'spotlyte_admin';

export function signAdminToken(admin) {
  return jwt.sign(
    { adminId: admin.adminId, role: admin.role },
    process.env.JWT_SECRET || 'dev-secret',
    { expiresIn: '12h' }
  );
}

export async function buildContext({ req, res }) {
  const db = await getDb();
  let admin = null;
  const token = req.cookies?.[COOKIE_NAME] || bearer(req);
  if (token) {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
      admin = await db.collection('admins').findOne(
        { adminId: payload.adminId },
        { projection: { passwordHash: 0 } }
      );
    } catch {
      admin = null; // expired / tampered — treated as unauthenticated
    }
  }
  const ip =
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.socket?.remoteAddress?.replace('::ffff:', '') ||
    '127.0.0.1';
  return { db, admin, ip, req, res };
}

function bearer(req) {
  const h = req.headers?.authorization || '';
  return h.startsWith('Bearer ') ? h.slice(7) : null;
}
