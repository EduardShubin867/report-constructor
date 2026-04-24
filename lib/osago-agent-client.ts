export interface OsagoAgentMessageResponse {
  id: string;
  session_id: string;
  content: string;
  role: string;
  created_at: string;
  metadata?: Record<string, unknown> | null;
}

interface OsagoAgentConfig {
  baseUrl: string;
  username: string;
  password: string;
  timeoutMs: number;
}

interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

let tokenPair: TokenPair | null = null;

function readConfig(): OsagoAgentConfig {
  const baseUrl = (process.env.OSAGO_AGENT_BASE_URL?.trim() || 'http://localhost:8000').replace(/\/+$/, '');
  const username = process.env.OSAGO_AGENT_USERNAME?.trim();
  const password = process.env.OSAGO_AGENT_PASSWORD;
  const timeoutMs = Number(process.env.OSAGO_AGENT_TIMEOUT_MS ?? '1200000');

  if (!username) throw new Error('OSAGO_AGENT_USERNAME is not set');
  if (!password) throw new Error('OSAGO_AGENT_PASSWORD is not set');

  return {
    baseUrl,
    username,
    password,
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 1200000,
  };
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: init.signal ?? controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = payload && typeof payload === 'object' && 'detail' in payload
      ? String((payload as { detail: unknown }).detail)
      : `HTTP ${response.status}`;
    throw new Error(detail);
  }
  return payload as T;
}

async function login(config: OsagoAgentConfig): Promise<TokenPair> {
  const url = new URL('/api/auth/login', config.baseUrl);
  url.searchParams.set('username', config.username);
  url.searchParams.set('password', config.password);

  const response = await fetchWithTimeout(url.toString(), { method: 'POST' }, config.timeoutMs);
  tokenPair = await parseJsonResponse<TokenPair>(response);
  return tokenPair;
}

async function getAccessToken(config: OsagoAgentConfig): Promise<string> {
  if (tokenPair?.access_token) return tokenPair.access_token;
  return (await login(config)).access_token;
}

async function postMessage(
  config: OsagoAgentConfig,
  token: string,
  params: { query: string; chatId: string },
): Promise<Response> {
  return fetchWithTimeout(new URL('/api/messages', config.baseUrl).toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      content: params.query,
      session_id: params.chatId,
    }),
  }, config.timeoutMs);
}

export async function requestOsagoAgentMessage(params: {
  query: string;
  chatId: string;
}): Promise<OsagoAgentMessageResponse> {
  const config = readConfig();
  const firstToken = await getAccessToken(config);
  let response = await postMessage(config, firstToken, params);

  if (response.status === 401) {
    tokenPair = null;
    const retryToken = (await login(config)).access_token;
    response = await postMessage(config, retryToken, params);
  }

  return parseJsonResponse<OsagoAgentMessageResponse>(response);
}

export async function fetchOsagoAgentChart(filename: string): Promise<Response> {
  const config = readConfig();
  const token = await getAccessToken(config);
  const url = new URL(`/api/charts/files/${encodeURIComponent(filename)}`, config.baseUrl);
  url.searchParams.set('token', token);
  let response = await fetchWithTimeout(url.toString(), { method: 'GET' }, config.timeoutMs);

  if (response.status === 401) {
    tokenPair = null;
    const retryToken = (await login(config)).access_token;
    url.searchParams.set('token', retryToken);
    response = await fetchWithTimeout(url.toString(), { method: 'GET' }, config.timeoutMs);
  }

  return response;
}

export function rewriteOsagoChartUrls(content: string, basePath: string): string {
  const normalizedBasePath = basePath.replace(/\/+$/, '');
  return content.replace(
    /\/api\/charts\/files\/([A-Za-z0-9._-]+)/g,
    (_match, filename: string) => `${normalizedBasePath}/api/osago-agent/charts/${encodeURIComponent(filename)}`,
  );
}
