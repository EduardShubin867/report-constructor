/**
 * Base path for the application, derived from next.config.ts basePath.
 * Used to prefix client-side fetch() calls which don't auto-apply basePath
 * (unlike next/link and next/router which do it automatically).
 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '/constructor';

function readPublicBooleanEnv(value: string | undefined): boolean {
  const normalized = value?.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

/**
 * Enables the dev/debug log UI and verbose agent debug events.
 * Controlled explicitly through env instead of NODE_ENV.
 */
export const AGENT_DEBUG_ENABLED = readPublicBooleanEnv(process.env.NEXT_PUBLIC_AGENT_DEBUG_ENABLED);
