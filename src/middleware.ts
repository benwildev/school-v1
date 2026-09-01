import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const SESSION_COOKIE_NAME = '__edusmart_session';
const AUTH_SECRET = process.env.AUTH_SECRET || 'edusmart-bd-dev-secret-key-at-least-32-chars-long!';
const encodedKey = new TextEncoder().encode(AUTH_SECRET);

const PUBLIC_PATHS = [
  '/login',
  '/api/auth/login',
  '/favicon.ico',
  '/robots.txt',
  '/sitemap.xml',
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Allow public routes and static assets
  if (
    PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith('/_next') || pathname.startsWith('/static'))
  ) {
    return NextResponse.next();
  }

  // 2. Extract Session Cookie or Bearer Token
  let token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    const authHeader = req.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
  }

  // 3. Unauthenticated handling
  if (!token) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 4. Verify Token at Edge
  try {
    const { payload } = await jwtVerify(token, encodedKey, { algorithms: ['HS256'] });

    const userId = payload.userId as string;
    const activeSchoolId = (payload.activeSchoolId as string) || '';
    const isSuperAdmin = Boolean(payload.isSuperAdmin);

    // Platform routes require SuperAdmin
    if (pathname.startsWith('/platform') && !isSuperAdmin) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ success: false, error: 'Forbidden: SuperAdmin privileges required' }, { status: 403 });
      }
      return NextResponse.redirect(new URL('/unauthorized', req.url));
    }

    // Sanitize downstream headers: explicitly strip any client-supplied spoofed headers first
    const requestHeaders = new Headers(req.headers);
    requestHeaders.delete('x-user-id');
    requestHeaders.delete('x-active-school-id');
    requestHeaders.delete('x-is-super-admin');

    // Inject exclusively cryptographically verified identity claims
    requestHeaders.set('x-user-id', userId);
    if (activeSchoolId) {
      requestHeaders.set('x-active-school-id', activeSchoolId);
    }
    if (isSuperAdmin) {
      requestHeaders.set('x-is-super-admin', 'true');
    }

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  } catch {
    // Invalid / expired token
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ success: false, error: 'Session expired or invalid' }, { status: 401 });
    }
    const loginUrl = new URL('/login', req.url);
    return NextResponse.redirect(loginUrl);
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
