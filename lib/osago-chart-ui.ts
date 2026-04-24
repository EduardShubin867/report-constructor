import type { OsagoChartSpec } from '@/lib/report-history-types';

export const OSAGO_CHART_COLORS = ['#2563eb', '#16a34a', '#dc2626', '#f59e0b', '#7c3aed', '#0891b2'] as const;
export const OSAGO_CHART_POSITIVE_COLOR = '#16a34a';
export const OSAGO_CHART_NEGATIVE_COLOR = '#dc2626';

export interface OsagoChartLegendItem {
  id: string;
  label: string;
  color: string;
  variant: 'solid' | 'dashed';
}

export function osagoThresholdColor(tone: string | undefined): string {
  if (tone === 'danger') return OSAGO_CHART_NEGATIVE_COLOR;
  if (tone === 'success') return OSAGO_CHART_POSITIVE_COLOR;
  if (tone === 'warning') return '#f59e0b';
  return '#64748b';
}

function stringValue(value: string | number | null | undefined): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return value.toLocaleString('ru-RU');
  return null;
}

export function buildOsagoChartLegendItems(spec: OsagoChartSpec): OsagoChartLegendItem[] {
  const items: OsagoChartLegendItem[] = [];

  if (spec.type === 'pie' && spec.labelKey) {
    const labelKey = spec.labelKey;
    spec.data.slice(0, OSAGO_CHART_COLORS.length).forEach((datum, index) => {
      const label = stringValue(datum[labelKey]);
      if (!label) return;
      items.push({
        id: `segment:${label}:${index}`,
        label,
        color: OSAGO_CHART_COLORS[index % OSAGO_CHART_COLORS.length],
        variant: 'solid',
      });
    });
    return items;
  }

  if (spec.type === 'bar' && spec.series?.[0]) {
    const series = spec.series[0];
    const values = spec.data.map(datum => Number(datum[series.key])).filter(Number.isFinite);
    const hasPositive = values.some(value => value >= 0);
    const hasNegative = values.some(value => value < 0);

    if (hasPositive && hasNegative) {
      items.push(
        {
          id: `series:${series.key}:positive`,
          label: `${series.label} >= 0`,
          color: OSAGO_CHART_POSITIVE_COLOR,
          variant: 'solid',
        },
        {
          id: `series:${series.key}:negative`,
          label: `${series.label} < 0`,
          color: OSAGO_CHART_NEGATIVE_COLOR,
          variant: 'solid',
        },
      );
    } else {
      items.push({
        id: `series:${series.key}`,
        label: series.label,
        color: hasNegative ? OSAGO_CHART_NEGATIVE_COLOR : OSAGO_CHART_POSITIVE_COLOR,
        variant: 'solid',
      });
    }
  } else {
    spec.series?.forEach((series, index) => {
      items.push({
        id: `series:${series.key}`,
        label: series.label,
        color: OSAGO_CHART_COLORS[index % OSAGO_CHART_COLORS.length],
        variant: 'solid',
      });
    });
  }

  spec.thresholds?.forEach(threshold => {
    items.push({
      id: `threshold:${threshold.label}:${threshold.value}`,
      label: threshold.label,
      color: osagoThresholdColor(threshold.tone),
      variant: 'dashed',
    });
  });

  return items;
}
