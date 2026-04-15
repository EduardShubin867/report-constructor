import { NextRequest } from 'next/server';

const TEST_ORIGIN = 'http://localhost';

export function createNextRequest(path: string, init?: ConstructorParameters<typeof NextRequest>[1]): NextRequest {
  return new NextRequest(new URL(path, TEST_ORIGIN), init);
}

export function createJsonRequest(
  path: string,
  {
    body,
    headers,
    method = 'POST',
  }: {
    body: unknown;
    headers?: HeadersInit;
    method?: string;
  },
): NextRequest {
  return createNextRequest(path, {
    method,
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

export function createTextRequest(
  path: string,
  {
    body,
    headers,
    method = 'POST',
  }: {
    body: string;
    headers?: HeadersInit;
    method?: string;
  },
): NextRequest {
  return createNextRequest(path, {
    method,
    headers,
    body,
  });
}

export function extractCookie(response: Response, cookieName: string): string | null {
  const raw = response.headers.get('set-cookie');
  if (!raw) return null;

  const match = raw.match(new RegExp(`${cookieName}=([^;]+)`));
  if (!match) return null;
  return `${cookieName}=${match[1]}`;
}
