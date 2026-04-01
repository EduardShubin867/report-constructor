import { NextResponse } from 'next/server';
import { getPool, queryWithTimeout, TIMEOUT } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const pool = await getPool();
    await queryWithTimeout(pool.request(), 'SELECT 1', TIMEOUT.HEALTH);
    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ status: 'error', message }, { status: 503 });
  }
}
