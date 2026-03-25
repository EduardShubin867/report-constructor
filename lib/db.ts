import sql from 'mssql';

const config: sql.config = {
  server: process.env.DB_SERVER!,
  database: process.env.DB_DATABASE ?? 'ExportUCS',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT ?? '1433', 10),
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_CERT !== 'false',
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

let pool: sql.ConnectionPool | null = null;

export async function getPool(): Promise<sql.ConnectionPool> {
  if (!pool) {
    try {
      console.log('Attempting to connect to database with config:', {
        server: config.server,
        database: config.database,
        user: config.user,
        port: config.port,
        options: config.options,
        // intentionally omitting password
      });
      const newPool = new sql.ConnectionPool(config);
      
      newPool.on('error', (err) => {
        console.error('SQL Pool Error:', err);
      });

      pool = await newPool.connect();
      console.log('Successfully connected to database.');
    } catch (error) {
      console.error('Failed to connect to database. Error details:', error);
      console.error('Connection config was:', {
        server: config.server,
        database: config.database,
        user: config.user,
        port: config.port,
        options: config.options,
      });
      throw error; // Rethrow to let the caller handle it (or fail)
    }
  }
  return pool;
}

export { sql };
