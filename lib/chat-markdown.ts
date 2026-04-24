const SAFE_LINK_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);

export function sanitizeMarkdownLinkUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const url = value.trim();
  if (!url || url.startsWith('//')) return null;

  if (url.startsWith('/') || url.startsWith('#')) return url;

  try {
    const parsed = new URL(url);
    return SAFE_LINK_PROTOCOLS.has(parsed.protocol) ? url : null;
  } catch {
    return null;
  }
}

export function isAllowedMarkdownImageUrl(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const url = value.trim();
  return url.startsWith('/') && !url.startsWith('//');
}

export function markdownUrlTransform(value: string, key: string): string {
  if (key === 'src') {
    return isAllowedMarkdownImageUrl(value) ? value : '';
  }
  return sanitizeMarkdownLinkUrl(value) ?? '';
}
