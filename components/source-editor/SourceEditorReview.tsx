import { Button } from '@/components/ui/button';
import { getTableDisplayName } from '@/lib/schema/display-name';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import type { DataSource, TableSchema } from '@/lib/schema/types';
import type { SourceEditorField, SourceEditorFormData } from './types';
import SourceColumnsTable, {
  type SourceColumnsTableProps,
} from './SourceColumnsTable';
import SourceForeignKeysPanel, {
  type SourceForeignKeysPanelProps,
} from './SourceForeignKeysPanel';
import SourceWhenToUseField from './SourceWhenToUseField';

interface SourceEditorReviewProps {
  source: DataSource;
  form: Pick<SourceEditorFormData, 'name' | 'whenToUse' | 'tables'>;
  mainTable?: TableSchema;
  refTables: TableSchema[];
  isEdit: boolean;
  rescanningTable: string | null;
  rescanMsg: Record<string, string>;
  onFieldChange: (field: SourceEditorField, value: string) => void;
  onToggleManualReport: () => void;
  onRescan: (tableName: string) => void;
  onSetTableDisplayName: (tableIdx: number, label: string) => void;
  columnActions: Omit<SourceColumnsTableProps, 'source' | 'mainTable'>;
  foreignKeyActions: Omit<SourceForeignKeysPanelProps, 'source' | 'mainTable'>;
}

export default function SourceEditorReview({
  source,
  form,
  mainTable,
  refTables,
  isEdit,
  rescanningTable,
  rescanMsg,
  onFieldChange,
  onToggleManualReport,
  onRescan,
  onSetTableDisplayName,
  columnActions,
  foreignKeyActions,
}: SourceEditorReviewProps) {
  const mainTableIdx = mainTable ? source.tables.indexOf(mainTable) : -1;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <div className="rounded-xl border border-primary/15 bg-primary-fixed/20 p-4">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-on-surface">Поля источника</h3>
            <p className="mt-0.5 text-xs text-on-surface-variant">
              Название и «Когда использовать» можно править и сохранять без повторной интроспекции.
              Повторное сканирование нужно только для изменений таблиц, колонок или связей.
            </p>
          </div>
          <span className="rounded-md border border-primary/15 bg-surface-container-lowest px-2 py-1 text-[11px] text-primary">
            Без интроспекции
          </span>
        </div>

        <div className="grid gap-3 lg:grid-cols-[minmax(220px,0.7fr)_minmax(0,1.3fr)]">
          <label className="block">
            <span className="mb-1 block text-xs text-on-surface-variant">Название</span>
            <input
              className="ui-field w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
              placeholder="КАСКО Маржа"
              value={form.name}
              onChange={event => onFieldChange('name', event.target.value)}
            />
          </label>
          <SourceWhenToUseField
            form={form}
            onChange={value => onFieldChange('whenToUse', value)}
          />
        </div>
      </div>

      {mainTable && (
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-on-surface">
              {getTableDisplayName(mainTable)}
            </h3>
            {mainTable.alias && (
              <span className="rounded bg-surface-container px-1.5 py-0.5 text-xs text-on-surface-variant">
                alias: {mainTable.alias}
              </span>
            )}
            <span className="text-xs text-on-surface-variant/60">
              {mainTable.columns.length} колонок
            </span>

            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={onToggleManualReport}
              className={cn(
                'h-auto min-h-0 gap-1.5 rounded border px-2.5 py-1 text-xs font-normal transition-colors',
                source.manualReport
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                  : 'border-outline-variant/20 bg-surface-container-lowest text-on-surface-variant hover:border-outline-variant/40 hover:bg-surface-container-low hover:text-on-surface',
              )}
            >
              <span
                className={`flex h-3 w-3 flex-shrink-0 items-center justify-center rounded border ${
                  source.manualReport
                    ? 'border-emerald-600 bg-emerald-600 text-white'
                    : 'border-outline-variant/40 bg-white'
                }`}
              >
                {source.manualReport && <span className="text-[8px] leading-none">✓</span>}
              </span>
              Доступен в ручном отчёте
            </Button>

            {isEdit && (
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={() => onRescan(mainTable.name)}
                disabled={rescanningTable === mainTable.name}
                className={cn(
                  'ml-auto h-auto min-h-0 gap-1.5 rounded border border-primary/12 bg-primary-fixed/70 px-2.5 py-1 text-xs font-normal text-on-primary-fixed-variant transition-colors hover:bg-primary-fixed disabled:cursor-not-allowed disabled:opacity-40',
                )}
              >
                {rescanningTable === mainTable.name ? (
                  <>
                    <span className="inline-block h-2.5 w-2.5 rounded-full border-2 border-on-primary-fixed-variant/70 border-t-transparent animate-spin" />
                    Сканирование...
                  </>
                ) : (
                  'Пересканировать'
                )}
              </Button>
            )}
          </div>

          <div className="mb-3 grid gap-2 rounded-lg border border-outline-variant/15 bg-surface-container-low/40 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <label className="block">
              <span className="mb-1 block text-[11px] text-on-surface-variant">
                Название в интерфейсе
              </span>
              <input
                type="text"
                value={mainTable.displayName ?? ''}
                onChange={event => onSetTableDisplayName(mainTableIdx, event.target.value)}
                placeholder={mainTable.name}
                className="ui-field w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
              />
            </label>
            <div className="rounded-lg border border-outline-variant/10 bg-surface-container-lowest px-3 py-2 text-xs text-on-surface-variant">
              <div className="text-[11px] uppercase tracking-wide text-on-surface-variant/70">
                SQL-имя
              </div>
              <div className="mt-1 font-mono text-on-surface">{mainTable.name}</div>
            </div>
          </div>

          {rescanMsg[mainTable.name] && (
            <div
              className={`mb-2 rounded px-2 py-1 text-xs ${
                rescanMsg[mainTable.name].startsWith('Ошибка')
                  ? 'bg-red-50 text-red-600'
                  : 'bg-emerald-50 text-emerald-700'
              }`}
            >
              {rescanMsg[mainTable.name]}
            </div>
          )}

          <SourceColumnsTable source={source} mainTable={mainTable} {...columnActions} />
          <SourceForeignKeysPanel source={source} mainTable={mainTable} {...foreignKeyActions} />
        </div>
      )}

      {refTables.length > 0 && (
        <div>
          <h4 className="mb-1 text-xs text-on-surface-variant/60">Справочные таблицы</h4>
          <div className="space-y-2">
            {refTables.map(table => {
              const tableIdx = source.tables.indexOf(table);
              return (
                <div
                  key={table.name}
                  className="grid gap-2 rounded-lg border border-outline-variant/15 bg-surface-container-low/40 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
                >
                  <label className="block">
                    <span className="mb-1 block text-[11px] text-on-surface-variant">
                      Название в интерфейсе
                    </span>
                    <input
                      type="text"
                      value={table.displayName ?? ''}
                      onChange={event => onSetTableDisplayName(tableIdx, event.target.value)}
                      placeholder={table.name}
                      className="ui-field w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
                    />
                  </label>
                  <div className="rounded-lg border border-outline-variant/10 bg-surface-container-lowest px-3 py-2 text-xs text-on-surface-variant">
                    <div className="text-[11px] uppercase tracking-wide text-on-surface-variant/70">
                      SQL-имя
                    </div>
                    <div className="mt-1 font-mono text-on-surface">{table.name}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </motion.div>
  );
}
