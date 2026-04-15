import {
  CONTRACT_COUNT_COLUMN_KEY,
  buildGenericSelectAndJoins,
  buildGenericWhere,
  buildGroupedSelectAndJoins,
  detailReportOrderByLastResort,
  safeColumns,
  safeDetailSortColumn,
  safeGroupedSortColumn,
} from '@/lib/query-builder';
import { effectiveColumnFilterTier } from '@/lib/report-filter-tier';
import { getDataSources } from '@/lib/schema';
import { getGroupByColumnDefs, getSourceJoinDefs, getVisibleColumnDefs } from '@/lib/visible-columns';
import { createMockSqlRequest } from '../helpers/mock-sql-request';

function getFixtureSource() {
  const source = getDataSources().find(ds => {
    const table = ds.tables.find(candidate => candidate.columns.length > 0);
    return ds.manualReport && table && (table.foreignKeys?.some(fk => fk.filterConfig) ?? false);
  });

  if (!source) {
    throw new Error('Expected a manual report source with foreign keys');
  }

  const table = source.tables.find(candidate => candidate.columns.length > 0);
  if (!table) {
    throw new Error(`Source ${source.id} does not have a main table`);
  }

  return { source, table };
}

describe('query-builder helpers', () => {
  it('keeps only source-visible columns and sorts selected detail columns safely', () => {
    const { source } = getFixtureSource();
    const visible = getVisibleColumnDefs(source.id);
    const valid = visible[0];

    expect(valid).toBeDefined();
    expect(safeColumns([valid.key, '__missing__'], source.id)).toEqual([valid.key]);
    expect(safeDetailSortColumn(valid.key, [valid.key], source.id)).toBe(valid.key);
    expect(safeDetailSortColumn(valid.key, [], source.id)).toBeNull();
  });

  it('builds direct, foreign-key, and period filters with parameters', () => {
    const { source, table } = getFixtureSource();
    const alias = table.alias ?? 'm';
    const direct = table.columns.find(column => effectiveColumnFilterTier(column) != null);
    const fk = table.foreignKeys?.find(candidate => candidate.filterConfig);
    const period = table.columns.find(column => column.periodFilter && column.type === 'date');

    expect(direct).toBeDefined();
    expect(fk).toBeDefined();
    expect(period).toBeDefined();

    const request = createMockSqlRequest();
    const where = buildGenericWhere(
      request as never,
      {
        [direct!.name]: ['alpha'],
        [fk!.alias]: ['Томск', 'Москва'],
      },
      source,
      {
        [period!.name]: { from: '2026-01-01', to: '2026-01-31' },
      },
    );

    expect(where).toContain(`${alias}.[${direct!.name}] IN (@f0)`);
    expect(where).toContain(
      `${alias}.[${fk!.column}] IN (SELECT [${fk!.targetColumn}] FROM [${source.schema}].[${fk!.targetTable}] WHERE [${fk!.filterConfig!.displayField}] IN (@f1,@f2)`,
    );
    if (fk!.filterConfig?.targetWhere) {
      expect(where).toContain(fk!.filterConfig.targetWhere);
    }
    expect(where).toContain(`CAST(${alias}.[${period!.name}] AS DATE) >= @pr0f`);
    expect(where).toContain(`CAST(${alias}.[${period!.name}] AS DATE) <= @pr0t`);

    expect(request.inputs.map(input => input.name)).toEqual(['f0', 'f1', 'f2', 'pr0f', 'pr0t']);
    expect(request.inputs.find(input => input.name === 'pr0f')?.value).toBeInstanceOf(Date);
    expect(request.inputs.find(input => input.name === 'pr0t')?.value).toBeInstanceOf(Date);
  });

  it('adds JOINs and projected aliases for joined columns in detail mode', () => {
    const joinedColumn = getVisibleColumnDefs('osago').find(column => column.joinKey);
    expect(joinedColumn).toBeDefined();

    const joins = getSourceJoinDefs('osago');
    const result = buildGenericSelectAndJoins([joinedColumn!.key], 'osago');

    expect(result.select).toContain('.[ID]');
    expect(result.select).toContain(`AS [${joinedColumn!.key}]`);
    expect(result.joins).toContain(joins[joinedColumn!.joinKey!].sql);
  });

  it('omits ID from detail SELECT when the main table schema has no ID column', () => {
    const dvs = getDataSources().find(s => s.id === 'dvs');
    expect(dvs).toBeDefined();
    const result = buildGenericSelectAndJoins(['Премия'], 'dvs');
    expect(result.select).not.toMatch(/\.?\[ID\]/);
    expect(result.select).toContain('m.[Премия]');
  });

  it('detailReportOrderByLastResort uses numeric period or first column when ID is absent', () => {
    expect(detailReportOrderByLastResort('dvs', 'm')).toBe('ORDER BY m.[Срок] DESC');
  });

  it('builds grouped aggregates and keeps grouped sort allowlist tight', () => {
    const { source } = getFixtureSource();
    const groupByColumn = getGroupByColumnDefs(source.id)[0];
    const metricColumn = getVisibleColumnDefs(source.id).find(
      column => column.type === 'number' && column.key !== groupByColumn.key,
    );

    expect(groupByColumn).toBeDefined();
    expect(metricColumn).toBeDefined();

    const grouped = buildGroupedSelectAndJoins(
      [groupByColumn.key, metricColumn!.key],
      [groupByColumn.key],
      source.id,
      { includeContractCount: true },
    );

    expect(grouped.select).toContain(
      groupByColumn.sqlExpr ? `AS [${groupByColumn.key}]` : `.[${groupByColumn.key}]`,
    );
    expect(grouped.select).toContain(`SUM(`);
    expect(grouped.select).toContain(`COUNT(*) AS [${CONTRACT_COUNT_COLUMN_KEY}]`);
    expect(grouped.groupByClause).toContain('GROUP BY');

    const withoutCount = buildGroupedSelectAndJoins(
      [groupByColumn.key, metricColumn!.key],
      [groupByColumn.key],
      source.id,
      { includeContractCount: false },
    );
    expect(withoutCount.select).not.toContain(`COUNT(*) AS [${CONTRACT_COUNT_COLUMN_KEY}]`);

    expect(
      safeGroupedSortColumn(
        CONTRACT_COUNT_COLUMN_KEY,
        [metricColumn!.key],
        [groupByColumn.key],
        source.id,
        true,
      ),
    ).toBe(CONTRACT_COUNT_COLUMN_KEY);
    expect(
      safeGroupedSortColumn(metricColumn!.key, [metricColumn!.key], [groupByColumn.key], source.id, true),
    ).toBe(metricColumn!.key);
    expect(
      safeGroupedSortColumn(metricColumn!.key, [], [groupByColumn.key], source.id, true),
    ).toBeNull();
  });
});
