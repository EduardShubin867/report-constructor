import type { AnalysisContext, AnalysisContextFilters } from '@/lib/report-history-types';

const MAX_ITEMS = 8;
const MAX_SQL_CHARS = 2_500;
const MAX_TEXT_CHARS = 700;

const CITY_CANDIDATES = [
  'Москва',
  'Санкт-Петербург',
  'Казань',
  'Новосибирск',
  'Екатеринбург',
  'Нижний Новгород',
  'Самара',
  'Челябинск',
  'Ростов-на-Дону',
  'Уфа',
  'Красноярск',
  'Пермь',
  'Воронеж',
  'Волгоград',
  'Краснодар',
  'Омск',
];

const METRIC_PATTERNS: Array<[string, RegExp]> = [
  ['маржа', /марж/i],
  ['премия', /преми/i],
  ['убыточность', /(убыточ|loss\s*ratio|\blr\b)/i],
  ['убытки', /убыт(?!оч)/i],
  ['выплаты', /выплат/i],
  ['договоры', /договор/i],
  ['частота убытков', /частот/i],
  ['агенты', /агент/i],
];

const METRIC_COLUMN_RE = /(марж|преми|убыточ|loss|lr|выплат|убыт|договор|колич|сумм|процент|частот|средн)/i;

function cleanString(value: unknown, maxLength = 160): string | undefined {
  if (typeof value !== 'string') return undefined;
  const cleaned = value.trim().replace(/\s+/g, ' ');
  if (!cleaned) return undefined;
  return cleaned.length > maxLength ? `${cleaned.slice(0, maxLength - 1)}…` : cleaned;
}

function truncateText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const cleaned = value.trim();
  if (!cleaned) return undefined;
  return cleaned.length > maxLength ? `${cleaned.slice(0, maxLength - 1)}…` : cleaned;
}

function unique(values: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const raw of values) {
    const value = cleanString(raw);
    if (!value) continue;
    const key = value.toLocaleLowerCase('ru-RU');
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(value);
    if (output.length >= MAX_ITEMS) break;
  }
  return output;
}

function normalizeStringArray(value: unknown): string[] | undefined {
  const items = Array.isArray(value) ? unique(value.map(item => String(item))) : [];
  return items.length > 0 ? items : undefined;
}

function normalizePeriod(value: unknown): AnalysisContextFilters['period'] | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const period = value as Record<string, unknown>;
  const from = cleanString(period.from, 32);
  const to = cleanString(period.to, 32);
  const label = cleanString(period.label, 120);
  if (!from && !to && !label) return undefined;
  return {
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    ...(label ? { label } : {}),
  };
}

function normalizeFilters(value: unknown): AnalysisContextFilters | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const filters = value as Record<string, unknown>;
  const dg = normalizeStringArray(filters.dg);
  const territories = normalizeStringArray(filters.territories);
  const agents = normalizeStringArray(filters.agents);
  const period = normalizePeriod(filters.period);
  if (!dg && !territories && !agents && !period) return undefined;
  return {
    ...(dg ? { dg } : {}),
    ...(territories ? { territories } : {}),
    ...(agents ? { agents } : {}),
    ...(period ? { period } : {}),
  };
}

export function normalizeAnalysisContext(value: unknown): AnalysisContext | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const raw = value as Record<string, unknown>;
  const sourceRaw = raw.source && typeof raw.source === 'object' ? raw.source as Record<string, unknown> : null;
  const sourceId = cleanString(sourceRaw?.id, 120);
  const sourceName = cleanString(sourceRaw?.name, 160);
  const filters = normalizeFilters(raw.filters);
  const metrics = normalizeStringArray(raw.metrics);
  const dimensions = normalizeStringArray(raw.dimensions);
  const lastColumns = normalizeStringArray(raw.lastColumns);
  const lastSql = truncateText(raw.lastSql, MAX_SQL_CHARS);
  const lastQuestion = truncateText(raw.lastQuestion, MAX_TEXT_CHARS);
  const lastExplanation = truncateText(raw.lastExplanation, MAX_TEXT_CHARS);
  const updatedAt = cleanString(raw.updatedAt, 64);
  const rowCount = typeof raw.lastRowCount === 'number' && Number.isFinite(raw.lastRowCount)
    ? Math.max(0, Math.trunc(raw.lastRowCount))
    : undefined;

  const normalized: AnalysisContext = {
    ...(sourceId ? { source: { id: sourceId, ...(sourceName ? { name: sourceName } : {}) } } : {}),
    ...(filters ? { filters } : {}),
    ...(metrics ? { metrics } : {}),
    ...(dimensions ? { dimensions } : {}),
    ...(lastSql ? { lastSql } : {}),
    ...(lastQuestion ? { lastQuestion } : {}),
    ...(lastExplanation ? { lastExplanation } : {}),
    ...(rowCount !== undefined ? { lastRowCount: rowCount } : {}),
    ...(lastColumns ? { lastColumns } : {}),
    ...(updatedAt ? { updatedAt } : {}),
  };

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function mergeFilters(
  previous: AnalysisContextFilters | undefined,
  next: AnalysisContextFilters | undefined,
): AnalysisContextFilters | undefined {
  if (!previous && !next) return undefined;
  const dg = unique([...(previous?.dg ?? []), ...(next?.dg ?? [])]);
  const territories = unique([...(previous?.territories ?? []), ...(next?.territories ?? [])]);
  const agents = unique([...(previous?.agents ?? []), ...(next?.agents ?? [])]);
  const period = next?.period ?? previous?.period;
  return {
    ...(dg.length > 0 ? { dg } : {}),
    ...(territories.length > 0 ? { territories } : {}),
    ...(agents.length > 0 ? { agents } : {}),
    ...(period ? { period } : {}),
  };
}

export function mergeAnalysisContexts(
  previous: AnalysisContext | undefined,
  next: AnalysisContext | undefined,
): AnalysisContext | undefined {
  const base = normalizeAnalysisContext(previous);
  const update = normalizeAnalysisContext(next);
  if (!base) return update;
  if (!update) return base;

  return normalizeAnalysisContext({
    source: update.source ?? base.source,
    filters: mergeFilters(base.filters, update.filters),
    metrics: unique([...(base.metrics ?? []), ...(update.metrics ?? [])]),
    dimensions: unique([...(base.dimensions ?? []), ...(update.dimensions ?? [])]),
    lastSql: update.lastSql ?? base.lastSql,
    lastQuestion: update.lastQuestion ?? base.lastQuestion,
    lastExplanation: update.lastExplanation ?? base.lastExplanation,
    lastRowCount: update.lastRowCount ?? base.lastRowCount,
    lastColumns: update.lastColumns ?? base.lastColumns,
    updatedAt: update.updatedAt ?? base.updatedAt,
  });
}

function normalizeDate(raw: string, endOfMonth = false): string {
  return /^\d{4}-\d{2}$/.test(raw)
    ? `${raw}-${endOfMonth ? '31' : '01'}`
    : raw;
}

function extractPeriod(text: string): AnalysisContextFilters['period'] | undefined {
  const range = text.match(/(?:с|от)\s+(20\d{2}-\d{2}(?:-\d{2})?).{0,40}?(?:по|до)\s+(20\d{2}-\d{2}(?:-\d{2})?)/i);
  if (range?.[1] && range[2]) {
    return {
      from: normalizeDate(range[1]),
      to: normalizeDate(range[2], true),
    };
  }

  const dates = [...text.matchAll(/\b20\d{2}-\d{2}(?:-\d{2})?\b/g)].map(match => match[0]);
  if (dates.length === 0) return undefined;
  if (dates.length === 1) return { label: dates[0] };
  return {
    from: normalizeDate(dates[0]),
    to: normalizeDate(dates[dates.length - 1], true),
  };
}

function extractDg(text: string): string[] {
  const values = [
    ...[...text.matchAll(/\bдг\s*([0-9A-Za-zА-Яа-я_-]{1,24})/giu)].map(match => match[1]),
    ...[...text.matchAll(/\[ID_ДГ\][^'\n]*N?'%?([^'%']+)%?'/giu)].map(match => match[1]),
  ];
  return unique(values);
}

function extractTerritories(text: string): string[] {
  const quoted = [
    ...[...text.matchAll(/(?:ter\.)?\[(?:Регион|Территория|Наименование)\]\s*(?:=|LIKE)\s*N?'%?([^'%']+)%?'/giu)].map(match => match[1]),
  ];
  const cityMatches = CITY_CANDIDATES.filter(city => new RegExp(city.replace('-', '[-\\s]'), 'i').test(text));
  return unique([...quoted, ...cityMatches]);
}

function extractAgents(text: string): string[] {
  return unique([
    ...[...text.matchAll(/\[Агент\]\s*(?:=|LIKE)\s*N?'%?([^'%']+)%?'/giu)].map(match => match[1]),
  ]);
}

function extractMetrics(text: string): string[] {
  return METRIC_PATTERNS.flatMap(([label, pattern]) => pattern.test(text) ? [label] : []);
}

function extractDimensions(columns: string[] | undefined): string[] {
  if (!columns) return [];
  return unique(columns.filter(column => !METRIC_COLUMN_RE.test(column)));
}

export interface DeriveAnalysisContextParams {
  previous?: AnalysisContext;
  query: string;
  assistantText?: string;
  sql?: string;
  result?: {
    columns?: string[];
    rowCount?: number;
  };
  selectedSource?: {
    sourceId: string;
    sourceName: string;
  } | null;
  createdAt?: string;
}

export function deriveAnalysisContextFromArtifact(params: DeriveAnalysisContextParams): AnalysisContext | undefined {
  const combined = [params.query, params.assistantText, params.sql, params.result?.columns?.join(' ')].filter(Boolean).join('\n');
  const filters = normalizeFilters({
    dg: extractDg(combined),
    territories: extractTerritories(combined),
    agents: extractAgents(combined),
    period: extractPeriod(combined),
  });

  const update = normalizeAnalysisContext({
    source: params.selectedSource
      ? { id: params.selectedSource.sourceId, name: params.selectedSource.sourceName }
      : undefined,
    filters,
    metrics: extractMetrics(combined),
    dimensions: extractDimensions(params.result?.columns),
    lastSql: params.sql,
    lastQuestion: params.query,
    lastExplanation: params.assistantText,
    lastRowCount: params.result?.rowCount,
    lastColumns: params.result?.columns,
    updatedAt: params.createdAt,
  });

  return mergeAnalysisContexts(params.previous, update);
}

export function deriveAnalysisContextFromText(params: DeriveAnalysisContextParams): AnalysisContext | undefined {
  return deriveAnalysisContextFromArtifact({
    ...params,
    result: undefined,
  });
}

export function getLatestAnalysisContextFromTurns(
  turns: Array<{ assistant: { analysisContext?: AnalysisContext } }> | undefined,
): AnalysisContext | undefined {
  if (!turns?.length) return undefined;
  for (let index = turns.length - 1; index >= 0; index -= 1) {
    const context = normalizeAnalysisContext(turns[index].assistant.analysisContext);
    if (context) return context;
  }
  return undefined;
}

export function isLikelyContextFollowUpQuery(query: string): boolean {
  const normalized = query.trim().replace(/\s+/g, ' ').toLowerCase();
  if (!normalized) return false;
  if (normalized.length > 90) return false;

  const conversationalFollowUp = /(почему|чем вызван|из-за чего|как так|разбери|детальн|глубже|а теперь|теперь|по ним|по нему|по ней|их|эти|это|так|сравни|дальше|ещ[её])/.test(normalized);
  const shortFilterChange = normalized.length <= 36
    && /^(?:а\s+)?(?:по|за|в|если\s+по)\s+.+[?!]?$/i.test(normalized);

  return (conversationalFollowUp || shortFilterChange)
    && !/(нов(?:ый|ую|ое)|с нуля|по всем|весь портфель|другой источник|другая таблиц)/.test(normalized);
}

function joinList(items: string[] | undefined): string | null {
  return items && items.length > 0 ? items.join(', ') : null;
}

export function buildAnalysisContextSummary(context: AnalysisContext | undefined): string {
  const normalized = normalizeAnalysisContext(context);
  if (!normalized) return '';

  const lines: string[] = ['## Контекст предыдущего анализа'];
  if (normalized.source) {
    lines.push(`Источник: ${normalized.source.name ?? normalized.source.id}`);
  }

  const filterParts = [
    joinList(normalized.filters?.dg) ? `ДГ: ${joinList(normalized.filters?.dg)}` : null,
    joinList(normalized.filters?.territories) ? `Территории/регионы: ${joinList(normalized.filters?.territories)}` : null,
    joinList(normalized.filters?.agents) ? `Агенты: ${joinList(normalized.filters?.agents)}` : null,
    normalized.filters?.period
      ? `Период: ${[
          normalized.filters.period.from ? `с ${normalized.filters.period.from}` : null,
          normalized.filters.period.to ? `по ${normalized.filters.period.to}` : null,
          normalized.filters.period.label ?? null,
        ].filter(Boolean).join(' ')}`
      : null,
  ].filter(Boolean);
  if (filterParts.length > 0) lines.push(`Фильтры: ${filterParts.join('; ')}`);

  if (normalized.metrics?.length) lines.push(`Метрики: ${normalized.metrics.join(', ')}`);
  if (normalized.dimensions?.length) lines.push(`Разрезы: ${normalized.dimensions.join(', ')}`);
  if (normalized.lastColumns?.length) lines.push(`Последние колонки: ${normalized.lastColumns.join(', ')}`);
  if (typeof normalized.lastRowCount === 'number') lines.push(`Последний результат: ${normalized.lastRowCount} строк`);
  if (normalized.lastQuestion) lines.push(`Последний вопрос: ${normalized.lastQuestion}`);
  if (normalized.lastExplanation) lines.push(`Последний вывод: ${normalized.lastExplanation}`);
  if (normalized.lastSql) lines.push(`Последний SQL:\n${normalized.lastSql}`);

  lines.push('Если пользователь использует местоимения или короткие продолжения ("их", "это", "по ним", "почему так", "разбери глубже"), считай их продолжением этого контекста, если запрос явно не задаёт новый фильтр.');

  return lines.join('\n');
}
