import type { OsagoChartSpec } from '@/lib/report-history-types';

export type OsagoAgentResult = {
  explanation?: string;
  suggestions?: string[];
  format?: 'plain' | 'markdown';
  charts?: OsagoChartSpec[];
  metadata?: unknown;
};
