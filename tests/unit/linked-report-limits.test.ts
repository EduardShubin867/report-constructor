import {
  getLinkedReportMergedRowCap,
  getLinkedReportSourceRowCap,
  LINKED_REPORT_ROW_UNLIMITED,
  resolveMergedRowLimit,
  resolveSourceRowLimit,
} from '@/lib/linked-report';

describe('getLinkedReportMergedRowCap', () => {
  const oldEnv = process.env.LINKED_REPORT_MERGED_ROW_CAP;

  afterEach(() => {
    process.env.LINKED_REPORT_MERGED_ROW_CAP = oldEnv;
  });

  it('defaults to 200000 when env unset', () => {
    delete process.env.LINKED_REPORT_MERGED_ROW_CAP;
    expect(getLinkedReportMergedRowCap()).toBe(200_000);
  });

  it('reads positive integer from env', () => {
    process.env.LINKED_REPORT_MERGED_ROW_CAP = '50000';
    expect(getLinkedReportMergedRowCap()).toBe(50_000);
  });

  it('falls back on invalid env', () => {
    process.env.LINKED_REPORT_MERGED_ROW_CAP = 'nope';
    expect(getLinkedReportMergedRowCap()).toBe(200_000);
  });
});

describe('resolveMergedRowLimit', () => {
  const oldEnv = process.env.LINKED_REPORT_MERGED_ROW_CAP;

  afterEach(() => {
    process.env.LINKED_REPORT_MERGED_ROW_CAP = oldEnv;
  });

  it('uses 5000 when mergedRowLimit omitted', () => {
    delete process.env.LINKED_REPORT_MERGED_ROW_CAP;
    expect(resolveMergedRowLimit({})).toBe(5000);
  });

  it('uses env cap when mergedRowLimit is null', () => {
    process.env.LINKED_REPORT_MERGED_ROW_CAP = '12000';
    expect(resolveMergedRowLimit({ mergedRowLimit: null })).toBe(12_000);
  });

  it('clamps explicit number to cap', () => {
    process.env.LINKED_REPORT_MERGED_ROW_CAP = '10000';
    expect(resolveMergedRowLimit({ mergedRowLimit: 8000 })).toBe(8000);
    expect(resolveMergedRowLimit({ mergedRowLimit: 20_000 })).toBe(10_000);
  });

  describe('unlimited sentinel -1', () => {
    const oldUnlimited = process.env.LINKED_REPORT_ALLOW_UNLIMITED;

    afterEach(() => {
      process.env.LINKED_REPORT_ALLOW_UNLIMITED = oldUnlimited;
    });

    it('rejects -1 when LINKED_REPORT_ALLOW_UNLIMITED off', () => {
      delete process.env.LINKED_REPORT_ALLOW_UNLIMITED;
      expect(() =>
        resolveMergedRowLimit({ mergedRowLimit: LINKED_REPORT_ROW_UNLIMITED }),
      ).toThrow(/LINKED_REPORT_ALLOW_UNLIMITED/);
    });

    it('accepts -1 when LINKED_REPORT_ALLOW_UNLIMITED on', () => {
      process.env.LINKED_REPORT_ALLOW_UNLIMITED = '1';
      expect(resolveMergedRowLimit({ mergedRowLimit: LINKED_REPORT_ROW_UNLIMITED })).toBe(-1);
    });
  });
});

describe('getLinkedReportSourceRowCap', () => {
  const oldEnv = process.env.LINKED_REPORT_SOURCE_ROW_CAP;

  afterEach(() => {
    process.env.LINKED_REPORT_SOURCE_ROW_CAP = oldEnv;
  });

  it('defaults to 50000 when env unset', () => {
    delete process.env.LINKED_REPORT_SOURCE_ROW_CAP;
    expect(getLinkedReportSourceRowCap()).toBe(50_000);
  });

  it('reads env', () => {
    process.env.LINKED_REPORT_SOURCE_ROW_CAP = '8000';
    expect(getLinkedReportSourceRowCap()).toBe(8000);
  });
});

describe('resolveSourceRowLimit', () => {
  const oldEnv = process.env.LINKED_REPORT_SOURCE_ROW_CAP;

  afterEach(() => {
    process.env.LINKED_REPORT_SOURCE_ROW_CAP = oldEnv;
  });

  it('uses 1000 when sourceRowLimit omitted', () => {
    delete process.env.LINKED_REPORT_SOURCE_ROW_CAP;
    expect(resolveSourceRowLimit({})).toBe(1000);
  });

  it('uses env cap when sourceRowLimit is null', () => {
    process.env.LINKED_REPORT_SOURCE_ROW_CAP = '9000';
    expect(resolveSourceRowLimit({ sourceRowLimit: null })).toBe(9000);
  });

  it('clamps explicit number to cap', () => {
    process.env.LINKED_REPORT_SOURCE_ROW_CAP = '5000';
    expect(resolveSourceRowLimit({ sourceRowLimit: 3000 })).toBe(3000);
    expect(resolveSourceRowLimit({ sourceRowLimit: 20_000 })).toBe(5000);
  });

  describe('unlimited sentinel -1', () => {
    const oldUnlimited = process.env.LINKED_REPORT_ALLOW_UNLIMITED;

    afterEach(() => {
      process.env.LINKED_REPORT_ALLOW_UNLIMITED = oldUnlimited;
    });

    it('rejects source -1 when LINKED_REPORT_ALLOW_UNLIMITED off', () => {
      delete process.env.LINKED_REPORT_ALLOW_UNLIMITED;
      expect(() =>
        resolveSourceRowLimit({ sourceRowLimit: LINKED_REPORT_ROW_UNLIMITED }),
      ).toThrow(/LINKED_REPORT_ALLOW_UNLIMITED/);
    });

    it('accepts source -1 when LINKED_REPORT_ALLOW_UNLIMITED on', () => {
      process.env.LINKED_REPORT_ALLOW_UNLIMITED = 'true';
      expect(resolveSourceRowLimit({ sourceRowLimit: LINKED_REPORT_ROW_UNLIMITED })).toBe(-1);
    });
  });
});
