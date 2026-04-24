import type {
  OsagoChartSpec,
  OsagoChartThreshold,
  OsagoChartType,
  OsagoChartValueType,
} from '@/lib/report-history-types';

const CHART_TYPES: ReadonlySet<OsagoChartType> = new Set(['line', 'bar', 'pie']);
const VALUE_TYPES: ReadonlySet<OsagoChartValueType> = new Set(['number', 'money', 'percent']);
const MAX_CHARTS = 8;
const MAX_POINTS = 120;

function safeString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function safeValueType(value: unknown): OsagoChartValueType | undefined {
  return typeof value === 'string' && VALUE_TYPES.has(value as OsagoChartValueType)
    ? (value as OsagoChartValueType)
    : undefined;
}

function normalizeDatum(value: unknown): Record<string, string | number | null> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const output: Record<string, string | number | null> = {};
  Object.entries(value as Record<string, unknown>).forEach(([key, raw]) => {
    if (!key) return;
    if (typeof raw === 'string' || typeof raw === 'number' || raw === null) {
      output[key] = raw;
    }
  });
  return Object.keys(output).length > 0 ? output : null;
}

function normalizeSeries(value: unknown): OsagoChartSpec['series'] {
  if (!Array.isArray(value)) return undefined;
  const series = value.flatMap(item => {
    if (!item || typeof item !== 'object') return [];
    const key = safeString((item as { key?: unknown }).key);
    const label = safeString((item as { label?: unknown }).label);
    return key && label ? [{ key, label }] : [];
  });
  return series.length > 0 ? series : undefined;
}

function normalizeThresholds(value: unknown): OsagoChartThreshold[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const thresholds = value.flatMap(item => {
    if (!item || typeof item !== 'object') return [];
    const value = Number((item as { value?: unknown }).value);
    const label = safeString((item as { label?: unknown }).label);
    const tone = safeString((item as { tone?: unknown }).tone);
    if (!Number.isFinite(value) || !label) return [];
    const threshold: OsagoChartThreshold = { value, label };
    if (tone === 'success' || tone === 'warning' || tone === 'danger' || tone === 'info') {
      threshold.tone = tone;
    }
    return [threshold];
  });
  return thresholds.length > 0 ? thresholds : undefined;
}

export function normalizeOsagoChartSpecs(value: unknown): OsagoChartSpec[] {
  if (!Array.isArray(value)) return [];

  return value.slice(0, MAX_CHARTS).flatMap(item => {
    if (!item || typeof item !== 'object') return [];
    const candidate = item as Record<string, unknown>;
    const id = safeString(candidate.id);
    const type = safeString(candidate.type);
    const title = safeString(candidate.title);
    if (!id || !type || !CHART_TYPES.has(type as OsagoChartType) || !title) return [];

    const data: Record<string, string | number | null>[] = Array.isArray(candidate.data)
      ? candidate.data.slice(0, MAX_POINTS).reduce<Record<string, string | number | null>[]>((items, point) => {
          const datum = normalizeDatum(point);
          if (datum) items.push(datum);
          return items;
        }, [])
      : [];
    if (data.length === 0) return [];

    const spec: OsagoChartSpec = {
      id,
      type: type as OsagoChartType,
      title,
      data,
    };

    const valueType = safeValueType(candidate.valueType);
    const xKey = safeString(candidate.xKey);
    const labelKey = safeString(candidate.labelKey);
    const valueKey = safeString(candidate.valueKey);
    const series = normalizeSeries(candidate.series);
    const thresholds = normalizeThresholds(candidate.thresholds);

    if (valueType) spec.valueType = valueType;
    if (xKey) spec.xKey = xKey;
    if (labelKey) spec.labelKey = labelKey;
    if (valueKey) spec.valueKey = valueKey;
    if (series) spec.series = series;
    if (thresholds) spec.thresholds = thresholds;

    return [spec];
  });
}
