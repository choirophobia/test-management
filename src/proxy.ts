import { NextResponse, type NextRequest } from 'next/server';

const SESSION_COOKIE = 'hub_session';

/**
 * A fast first check: no session cookie, no page. It only looks for the cookie; whether the
 * session is valid is checked again next to every database read (requireUser).
 */
export function proxy(request: NextRequest) {
  if (request.cookies.has(SESSION_COOKIE)) return NextResponse.next();
  const { pathname, search } = request.nextUrl;
  const login = new URL('/login', request.url);
  if (pathname !== '/') login.searchParams.set('next', `${pathname}${search}`);
  return NextResponse.redirect(login);
}

export const config = {
  // Everything except the sign-in pages, the ingest API (it has its own token) and static files.
  matcher: ['/((?!login|api/ingest|_next/static|_next/image|favicon\\.ico).*)'],
};
