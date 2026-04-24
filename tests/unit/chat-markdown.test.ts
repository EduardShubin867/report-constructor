import {
  isAllowedMarkdownImageUrl,
  sanitizeMarkdownLinkUrl,
} from '@/lib/chat-markdown';

describe('chat markdown safety helpers', () => {
  it('keeps safe links and blocks script-like links', () => {
    expect(sanitizeMarkdownLinkUrl('https://example.com/report')).toBe('https://example.com/report');
    expect(sanitizeMarkdownLinkUrl('/constructor/reports/chat')).toBe('/constructor/reports/chat');
    expect(sanitizeMarkdownLinkUrl('mailto:ops@example.com')).toBe('mailto:ops@example.com');

    expect(sanitizeMarkdownLinkUrl('javascript:alert(1)')).toBeNull();
    expect(sanitizeMarkdownLinkUrl('data:text/html;base64,PHNjcmlwdA==')).toBeNull();
    expect(sanitizeMarkdownLinkUrl('//evil.example/x')).toBeNull();
  });

  it('allows only local markdown image URLs', () => {
    expect(isAllowedMarkdownImageUrl('/constructor/api/osago-agent/charts/lr.jpg')).toBe(true);
    expect(isAllowedMarkdownImageUrl('/api/osago-agent/charts/lr.jpg')).toBe(true);

    expect(isAllowedMarkdownImageUrl('https://example.com/chart.jpg')).toBe(false);
    expect(isAllowedMarkdownImageUrl('//example.com/chart.jpg')).toBe(false);
    expect(isAllowedMarkdownImageUrl('javascript:alert(1)')).toBe(false);
  });
});
