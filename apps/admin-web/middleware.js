import { NextResponse } from 'next/server';

// Redirects unauthenticated visitors of any console route to /login.
// (JWT validity is enforced by the API on every request; presence check here.)
export function middleware(req) {
  const { pathname } = req.nextUrl;
  const authed = req.cookies.has('spotlyte_admin');

  if (pathname === '/login') {
    if (authed) return NextResponse.redirect(new URL('/overview', req.url));
    return NextResponse.next();
  }
  if (!authed) {
    return NextResponse.redirect(new URL('/login', req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
};
