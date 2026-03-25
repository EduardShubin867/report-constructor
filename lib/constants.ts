/**
 * Base path for the application, derived from next.config.ts basePath.
 * Used to prefix client-side fetch() calls which don't auto-apply basePath
 * (unlike next/link and next/router which do it automatically).
 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '/constructor';
