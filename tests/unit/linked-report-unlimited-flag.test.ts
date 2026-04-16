import { isLinkedReportUnlimitedRowsAllowed } from '@/lib/linked-report-unlimited-flag';

describe('isLinkedReportUnlimitedRowsAllowed', () => {
  const old = process.env.LINKED_REPORT_ALLOW_UNLIMITED;

  afterEach(() => {
    process.env.LINKED_REPORT_ALLOW_UNLIMITED = old;
  });

  it('is false when unset', () => {
    delete process.env.LINKED_REPORT_ALLOW_UNLIMITED;
    expect(isLinkedReportUnlimitedRowsAllowed()).toBe(false);
  });

  it('accepts typical truthy env values', () => {
    for (const v of ['1', 'true', 'yes', 'on']) {
      process.env.LINKED_REPORT_ALLOW_UNLIMITED = v;
      expect(isLinkedReportUnlimitedRowsAllowed()).toBe(true);
    }
  });

  it('trims whitespace', () => {
    process.env.LINKED_REPORT_ALLOW_UNLIMITED = ' YES ';
    expect(isLinkedReportUnlimitedRowsAllowed()).toBe(true);
  });
});
