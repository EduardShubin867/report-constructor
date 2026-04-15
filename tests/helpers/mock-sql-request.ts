export interface MockSqlInputCall {
  name: string;
  type: unknown;
  value: unknown;
}

export interface MockSqlRequest {
  cancel: jest.Mock;
  input: jest.Mock;
  inputs: MockSqlInputCall[];
  query: jest.Mock;
}

export function createMockSqlRequest(): MockSqlRequest {
  const inputs: MockSqlInputCall[] = [];

  const request: MockSqlRequest = {
    cancel: jest.fn(),
    input: jest.fn((name: string, type: unknown, value: unknown) => {
      inputs.push({ name, type, value });
      return request;
    }),
    inputs,
    query: jest.fn(),
  };

  return request;
}

export function createMockPool() {
  const requests: MockSqlRequest[] = [];

  return {
    pool: {
      request: jest.fn(() => {
        const request = createMockSqlRequest();
        requests.push(request);
        return request;
      }),
    },
    requests,
  };
}
