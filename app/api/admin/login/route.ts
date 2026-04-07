import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'node:crypto';

const MAX_AGE = 60 * 60 * 24;

function sign(value: string, secret: string): string {
  const sig = createHmac('sha256', secret).update(value).digest('hex');
  return `${value}.${sig}`;
}

function verify(token: string, secret: string): boolean {
  const idx = token.lastIndexOf('.');
  if (idx === -1) return false;
  const value = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  const expected = createHmac('sha256', secret).update(value).digest('hex');
  return sig === expected;
}

export async function POST(req: NextRequest) {
  const secret = process.env.ADMIN_PASSWORD;
  if (!secret) {
    return NextResponse.json({ error: 'ADMIN_PASSWORD not configured' }, { status: 500 });
  }

  const body = await req.json();
  const { password } = body;

  if (password !== secret) {
    return NextResponse.json({ error: 'Неверный пароль' }, { status: 401 });
  }

  const token = sign('admin', secret);
  const res = NextResponse.json({ ok: true });

  res.cookies.set('admin_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: MAX_AGE,
    path: '/',
  });

  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set('admin_token', '', { maxAge: 0, path: '/' });
  return res;
}

export { verify };
