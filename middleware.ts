import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'node:crypto';

function verify(token: string, secret: string): boolean {
  const idx = token.lastIndexOf('.');
  if (idx === -1) return false;
  const value = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  const expected = createHmac('sha256', secret).update(value).digest('hex');
  return sig === expected;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isAdminPage = pathname === '/admin' || pathname.startsWith('/admin/');
  const isAdminApi = pathname.startsWith('/api/admin/');

  if (!isAdminPage && !isAdminApi) {
    return NextResponse.next();
  }

  if (pathname === '/admin/login' || pathname === '/api/admin/login') {
    return NextResponse.next();
  }

  const secret = process.env.ADMIN_PASSWORD;
  if (!secret) {
    return isAdminApi
      ? NextResponse.json({ error: 'ADMIN_PASSWORD not configured' }, { status: 500 })
      : NextResponse.next();
  }

  const token = req.cookies.get('admin_token')?.value;

  if (token && verify(token, secret)) {
    return NextResponse.next();
  }

  if (isAdminApi) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const loginUrl = req.nextUrl.clone();
  loginUrl.pathname = '/admin/login';
  return NextResponse.rewrite(loginUrl);
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
};
