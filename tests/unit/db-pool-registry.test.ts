const mockPoolInstances: MockConnectionPool[] = [];
const poolRegistryKey = Symbol.for('constructor.sqlPoolRegistry.v1');

function resetGlobalPoolRegistry() {
  delete (globalThis as unknown as { [key: symbol]: unknown })[poolRegistryKey];
}

class MockConnectionPool {
  connected = false;
  closed = false;
  errorHandler: ((error: Error) => void) | null = null;

  constructor(readonly config: unknown) {
    mockPoolInstances.push(this);
  }

  on(event: string, handler: (error: Error) => void) {
    if (event === 'error') this.errorHandler = handler;
    return this;
  }

  async connect() {
    await new Promise(resolve => setTimeout(resolve, 0));
    this.connected = true;
    return this;
  }

  request() {
    return {};
  }

  async close() {
    this.closed = true;
  }
}

jest.mock('mssql', () => ({
  __esModule: true,
  default: {
    ConnectionPool: MockConnectionPool,
    Int: 'Int',
  },
}));

jest.mock('@/lib/schema/store', () => ({
  getConnection: jest.fn(),
}));

describe('SQL pool registry', () => {
  const oldEnv = { ...process.env };

  beforeEach(() => {
    jest.resetModules();
    resetGlobalPoolRegistry();
    mockPoolInstances.length = 0;
    process.env = {
      ...oldEnv,
      DB_SERVER: 'devsql',
      DB_DATABASE: 'ExportUCS',
      DB_USER: 'Grafana',
      DB_PASSWORD: 'secret',
      DB_PORT: '1433',
      DB_ENCRYPT: 'false',
      DB_TRUST_CERT: 'true',
    };
  });

  afterAll(() => {
    process.env = oldEnv;
  });

  it('deduplicates concurrent default pool creation', async () => {
    const { getPool } = await import('@/lib/db');

    const [first, second] = await Promise.all([getPool(), getPool()]);

    expect(first).toBe(second);
    expect(mockPoolInstances).toHaveLength(1);
  });

  it('keeps connected pools in a process-wide registry across module reloads', async () => {
    const firstModule = await import('@/lib/db');
    const first = await firstModule.getPool();

    jest.resetModules();
    const secondModule = await import('@/lib/db');
    const second = await secondModule.getPool();

    expect(second).toBe(first);
    expect(mockPoolInstances).toHaveLength(1);
  });
});
