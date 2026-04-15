import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { DataSource, TableSchema } from '@/lib/schema/types';
import SourceFilterTierCellButton from './ui/SourceFilterTierCellButton';
import SourceMiniLinkButton from './ui/SourceMiniLinkButton';
import type { ColumnFilterTier } from './types';
import { filterTierFromColumn } from './utils';

export interface SourceColumnsTableProps {
  source: DataSource;
  mainTable: TableSchema;
  onSetAllColumnFilterTier: (tableIdx: number, tier: ColumnFilterTier) => void;
  onSetAllGroupable: (tableIdx: number, enable: boolean) => void;
  onSetAllHidden: (tableIdx: number, hidden: boolean) => void;
  onSetColumnFilterTier: (
    tableIdx: number,
    colIdx: number,
    tier: ColumnFilterTier,
  ) => void;
  onToggleGroupable: (tableIdx: number, colIdx: number) => void;
  onTogglePeriodFilter: (tableIdx: number, colIdx: number) => void;
  onToggleHidden: (tableIdx: number, colIdx: number) => void;
}

const typeColors: Record<string, string> = {
  number: 'text-blue-600',
  string: 'text-emerald-600',
  date: 'text-amber-600',
  bit: 'text-violet-600',
};

export default function SourceColumnsTable({
  source,
  mainTable,
  onSetAllColumnFilterTier,
  onSetAllGroupable,
  onSetAllHidden,
  onSetColumnFilterTier,
  onToggleGroupable,
  onTogglePeriodFilter,
  onToggleHidden,
}: SourceColumnsTableProps) {
  const tableIdx = source.tables.indexOf(mainTable);

  return (
    <div className="overflow-hidden rounded-lg border border-outline-variant/20">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-surface-container text-xs text-on-surface-variant">
            <th className="px-3 py-2 text-left font-medium">Колонка</th>
            <th className="px-3 py-2 text-left font-medium">Тип</th>
            <th className="px-3 py-2 text-center font-medium">
              <div className="mx-auto flex max-w-[7rem] flex-col items-center gap-0.5">
                <span>Фильтр</span>
                <div className="flex flex-wrap justify-center gap-x-0.5 gap-y-0.5 text-[9px] leading-tight">
                  <SourceMiniLinkButton
                    inheritFontSize
                    title="Все колонки — основной фильтр (загрузка с страницей)"
                    onClick={() => onSetAllColumnFilterTier(tableIdx, 'primary')}
                  >
                    все О
                  </SourceMiniLinkButton>
                  <span className="text-outline-variant">·</span>
                  <SourceMiniLinkButton
                    inheritFontSize
                    title="Все колонки — дополнительный фильтр (по открытию дропдауна)"
                    onClick={() => onSetAllColumnFilterTier(tableIdx, 'secondary')}
                  >
                    все Д
                  </SourceMiniLinkButton>
                  <span className="text-outline-variant">·</span>
                  <SourceMiniLinkButton
                    inheritFontSize
                    onClick={() => onSetAllColumnFilterTier(tableIdx, 'off')}
                  >
                    снять
                  </SourceMiniLinkButton>
                </div>
              </div>
            </th>
            <th className="px-3 py-2 text-center font-medium">
              <div className="flex flex-col items-center gap-0.5">
                <span>Groupable</span>
                <div className="flex gap-1">
                  <SourceMiniLinkButton onClick={() => onSetAllGroupable(tableIdx, true)}>
                    все
                  </SourceMiniLinkButton>
                  <span className="text-outline-variant">/</span>
                  <SourceMiniLinkButton onClick={() => onSetAllGroupable(tableIdx, false)}>
                    снять
                  </SourceMiniLinkButton>
                </div>
              </div>
            </th>
            <th className="px-3 py-2 text-center font-medium">Период</th>
            <th className="px-3 py-2 text-center font-medium">
              <div className="flex flex-col items-center gap-0.5">
                <span>Видима</span>
                <div className="flex gap-1">
                  <SourceMiniLinkButton onClick={() => onSetAllHidden(tableIdx, false)}>
                    все
                  </SourceMiniLinkButton>
                  <span className="text-outline-variant">/</span>
                  <SourceMiniLinkButton onClick={() => onSetAllHidden(tableIdx, true)}>
                    скрыть
                  </SourceMiniLinkButton>
                </div>
              </div>
            </th>
          </tr>
        </thead>

        <tbody>
          {mainTable.columns.map((column, colIdx) => {
            const canGroupable =
              column.type === 'string' || column.type === 'date' || column.type === 'bit';
            const canPeriodFilter = column.type === 'date' || column.type === 'number';

            return (
              <tr
                key={column.name}
                className={`border-t border-outline-variant/10 transition-opacity hover:bg-surface-container-low/50 ${
                  column.hidden ? 'opacity-40' : ''
                }`}
              >
                <td className="px-3 py-1.5 font-mono text-xs text-on-surface">{column.name}</td>
                <td
                  className={`px-3 py-1.5 text-xs font-medium ${
                    typeColors[column.type] ?? 'text-on-surface-variant'
                  }`}
                >
                  {column.type}
                </td>
                <td className="px-3 py-1.5 text-center">
                  <div className="flex items-center justify-center gap-0.5">
                    <SourceFilterTierCellButton
                      title="Нет фильтра"
                      tone="neutral"
                      active={filterTierFromColumn(column) === 'off'}
                      onClick={() => onSetColumnFilterTier(tableIdx, colIdx, 'off')}
                    >
                      -
                    </SourceFilterTierCellButton>
                    <SourceFilterTierCellButton
                      title="Основной (загрузка с сервером)"
                      tone="primary"
                      active={filterTierFromColumn(column) === 'primary'}
                      onClick={() => onSetColumnFilterTier(tableIdx, colIdx, 'primary')}
                    >
                      О
                    </SourceFilterTierCellButton>
                    <SourceFilterTierCellButton
                      title="Дополнительный (по открытию)"
                      tone="secondary"
                      active={filterTierFromColumn(column) === 'secondary'}
                      onClick={() => onSetColumnFilterTier(tableIdx, colIdx, 'secondary')}
                    >
                      Д
                    </SourceFilterTierCellButton>
                  </div>
                </td>
                <td className="px-3 py-1.5 text-center">
                  {canGroupable ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      onClick={() => onToggleGroupable(tableIdx, colIdx)}
                      className={cn(
                        'mx-auto flex h-4 w-4 min-h-0 items-center justify-center gap-0 rounded border p-0 text-xs transition-colors hover:bg-transparent',
                        column.groupable
                          ? 'border-violet-500 bg-violet-600 text-white hover:bg-violet-600'
                          : 'border-outline-variant/40 text-transparent hover:border-outline-variant',
                      )}
                    >
                      ✓
                    </Button>
                  ) : (
                    <span className="mx-auto inline-block h-4 w-4 text-outline-variant">·</span>
                  )}
                </td>
                <td className="px-3 py-1.5 text-center">
                  {canPeriodFilter ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      onClick={() => onTogglePeriodFilter(tableIdx, colIdx)}
                      className={cn(
                        'mx-auto flex h-4 w-4 min-h-0 items-center justify-center gap-0 rounded-full border p-0 text-xs transition-colors hover:bg-transparent',
                        column.periodFilter
                          ? 'border-yellow-500 bg-yellow-600 text-white hover:bg-yellow-600'
                          : 'border-outline-variant/40 hover:border-outline-variant',
                      )}
                    >
                      {column.periodFilter && (
                        <span className="block h-2 w-2 rounded-full bg-white" />
                      )}
                    </Button>
                  ) : (
                    <span className="mx-auto inline-block h-4 w-4 text-outline-variant">·</span>
                  )}
                </td>
                <td className="px-3 py-1.5 text-center">
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={() => onToggleHidden(tableIdx, colIdx)}
                    className={cn(
                      'mx-auto flex h-4 w-4 min-h-0 items-center justify-center gap-0 rounded border p-0 text-xs transition-colors hover:bg-transparent',
                      !column.hidden
                        ? 'border-blue-500 bg-blue-600 text-white hover:bg-blue-600'
                        : 'border-outline-variant/40 text-transparent hover:border-outline-variant',
                    )}
                  >
                    ✓
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
