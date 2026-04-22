import { POST } from '@/app/api/admin/connections/route';
import { closePoolsForConnection } from '@/lib/db';
import { loadConnections, saveConnection } from '@/lib/schema/store';
import { createJsonRequest } from '../helpers/next-request';

jest.mock('@/lib/schema/store', () => ({
  loadConnections: jest.fn(),
  saveConnection: jest.fn(),
}));

jest.mock('@/lib/db', () => ({
  closePoolsForConnection: jest.fn(),
}));

describe('/api/admin/connections POST', () => {
  const mockedLoadConnections = jest.mocked(loadConnections);
  const mockedSaveConnection = jest.mocked(saveConnection);
  const mockedClosePoolsForConnection = jest.mocked(closePoolsForConnection);

  beforeEach(() => {
    mockedLoadConnections.mockReset().mockReturnValue([]);
    mockedSaveConnection.mockReset();
    mockedClosePoolsForConnection.mockReset().mockResolvedValue(undefined);
  });

  it('closes existing pools after saving a connection so reports use the new config', async () => {
    const connection = {
      id: 'crm',
      name: 'CRM',
      server: 'db.example.test',
      user: 'report',
      password: 'secret',
      database: 'Reports',
    };

    const response = await POST(
      createJsonRequest('/api/admin/connections', {
        body: { connection },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, id: 'crm' });
    expect(mockedSaveConnection).toHaveBeenCalledWith(connection);
    expect(mockedClosePoolsForConnection).toHaveBeenCalledWith('crm');
  });
});
