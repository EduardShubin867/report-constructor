import {
  buildAnalysisContextSummary,
  deriveAnalysisContextFromArtifact,
  isLikelyContextFollowUpQuery,
  normalizeAnalysisContext,
} from '@/lib/analysis-context';

describe('analysis context helpers', () => {
  it('derives filters, metrics, dimensions, and source from an executed report', () => {
    const context = deriveAnalysisContextFromArtifact({
      query: 'Покажи убыточность по ДГ 131 в Москве с 2025-01 по 2025-12',
      assistantText: 'Отчёт показывает убыточность и маржу по Москве.',
      sql: `
        SELECT ter.[Регион] AS [Регион],
               SUM(m.[Премия]) AS [Премия],
               ROUND(100.0 * SUM(m.[Убытки]) / NULLIF(SUM(m.[Премия]), 0), 2) AS [УбыточностьПроцент]
        FROM [dbo].[Журнал_ОСАГО_Маржа] m
        LEFT JOIN [dbo].[Территории] AS ter ON m.[ID_ТерриторияИспользованияТС] = ter.[ID]
        WHERE m.[ID_ДГ] LIKE N'%131%'
          AND ter.[Регион] = N'Москва'
          AND m.[ДатаЗаключения] >= '2025-01-01'
          AND m.[ДатаЗаключения] <= '2025-12-31'
        GROUP BY ter.[Регион]
      `,
      result: {
        columns: ['Регион', 'Премия', 'УбыточностьПроцент'],
        rowCount: 1,
      },
      selectedSource: { sourceId: 'osago-margin', sourceName: 'ОСАГО маржа' },
      createdAt: '2026-04-23T08:00:00.000Z',
    });

    expect(context).toMatchObject({
      source: { id: 'osago-margin', name: 'ОСАГО маржа' },
      filters: {
        dg: ['131'],
        territories: ['Москва'],
        period: { from: '2025-01-01', to: '2025-12-31' },
      },
      metrics: expect.arrayContaining(['убыточность', 'маржа', 'премия']),
      dimensions: expect.arrayContaining(['Регион']),
      lastQuestion: 'Покажи убыточность по ДГ 131 в Москве с 2025-01 по 2025-12',
      lastRowCount: 1,
    });
  });

  it('normalizes and summarizes only meaningful context fields', () => {
    const normalized = normalizeAnalysisContext({
      source: { id: 'source-1', name: 'Источник' },
      filters: { dg: ['131', '', '131'], territories: ['Москва'] },
      metrics: ['маржа', 'маржа', 'LR'],
      dimensions: ['Регион'],
      lastSql: 'SELECT 1',
      lastExplanation: 'Краткий вывод',
    });

    expect(normalized).toMatchObject({
      filters: { dg: ['131'], territories: ['Москва'] },
      metrics: ['маржа', 'LR'],
    });

    const summary = buildAnalysisContextSummary(normalized);
    expect(summary).toContain('Источник: Источник');
    expect(summary).toContain('ДГ: 131');
    expect(summary).toContain('Территории/регионы: Москва');
    expect(summary).toContain('Последний SQL');
  });

  it('detects short follow-up queries that should keep prior context', () => {
    expect(isLikelyContextFollowUpQuery('почему так?')).toBe(true);
    expect(isLikelyContextFollowUpQuery('а теперь разбери по агентам')).toBe(true);
    expect(isLikelyContextFollowUpQuery('А по москве?')).toBe(true);
    expect(isLikelyContextFollowUpQuery('А за 2024?')).toBe(true);
    expect(isLikelyContextFollowUpQuery('Покажи новый отчёт по всем договорам за 2024 год')).toBe(false);
  });
});
