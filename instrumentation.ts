export async function register() {
  // Only run on the Node.js server runtime
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log('=== [Instrumentation] Server starting ===');
    console.log('[Instrumentation] DB config:', {
      server: process.env.DB_SERVER ?? '(not set)',
      database: process.env.DB_DATABASE ?? '(not set)',
      user: process.env.DB_USER ?? '(not set)',
      port: process.env.DB_PORT ?? '1433',
      encrypt: process.env.DB_ENCRYPT ?? '(not set)',
      trustCert: process.env.DB_TRUST_CERT ?? '(not set)',
    });

    try {
      const { getPool } = await import('./lib/db');
      const pool = await getPool();
      console.log('[Instrumentation] DB connection test: SUCCESS');
      // Run a simple test query
      const result = await pool.request().query('SELECT 1 AS ok');
      console.log('[Instrumentation] Test query result:', result.recordset);
    } catch (error) {
      console.error('[Instrumentation] DB connection test: FAILED');
      console.error('[Instrumentation] Error:', error);
    }
  }
}
