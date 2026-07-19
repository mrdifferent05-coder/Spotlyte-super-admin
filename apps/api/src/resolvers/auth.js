// auth.js — admin session lifecycle. JWT in httpOnly cookie `spotlyte_admin`.
import bcrypt from 'bcryptjs';
import { COOKIE_NAME, signAdminToken } from '../context.js';
import { writeAudit } from '../services/audit.js';

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: 12 * 60 * 60 * 1000,
};

function adminOut(a) {
  return { _id: String(a._id), adminId: a.adminId, name: a.name, email: a.email, role: a.role };
}

export async function loginAdmin(ctx, email, password) {
  const admin = await ctx.db.collection('admins').findOne({ email: (email || '').toLowerCase().trim() });
  if (!admin || !(await bcrypt.compare(password || '', admin.passwordHash))) {
    return { success: false, token: null, admin: null, message: 'Invalid email or password' };
  }
  const token = signAdminToken(admin);
  ctx.res?.cookie?.(COOKIE_NAME, token, COOKIE_OPTS);
  await writeAudit({
    db: ctx.db,
    actorAdmin: admin,
    action: 'login',
    target: 'Admin console access',
    type: 'auth',
    ip: ctx.ip,
  });
  return { success: true, token, admin: adminOut(admin), message: 'Welcome back' };
}

export const authResolvers = {
  Query: {
    getAdminMe: (_p, _a, ctx) => (ctx.admin ? adminOut(ctx.admin) : null),
  },
  Mutation: {
    adminLoginV2: async (_p, { email, password }, ctx) => loginAdmin(ctx, email, password),

    adminLogout: async (_p, _a, ctx) => {
      ctx.res?.clearCookie?.(COOKIE_NAME, { path: '/' });
      if (ctx.admin) {
        await writeAudit({ db: ctx.db, actorAdmin: ctx.admin, action: 'logout', target: 'Admin console', type: 'auth', ip: ctx.ip });
      }
      return { success: true, message: 'Signed out', refId: null };
    },

    // Legacy wrapper — same service, string token return.
    adminLogin: async (_p, { email, password }, ctx) => {
      const r = await loginAdmin(ctx, email, password);
      return r.success ? r.token : null;
    },
  },
};
