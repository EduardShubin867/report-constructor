import { motion } from 'framer-motion';
import type { DataSource, TableSchema } from '@/lib/schema/types';
import SourceColumnsTable, {
  type SourceColumnsTableProps,
} from './SourceColumnsTable';
import SourceForeignKeysPanel, {
  type SourceForeignKeysPanelProps,
} from './SourceForeignKeysPanel';

interface SourceEditorReviewProps {
  source: DataSource;
  mainTable?: TableSchema;
  refTables: TableSchema[];
  isEdit: boolean;
  rescanningTable: string | null;
  rescanMsg: Record<string, string>;
  onToggleManualReport: () => void;
  onRescan: (tableName: string) => void;
  columnActions: Omit<SourceColumnsTableProps, 'source' | 'mainTable'>;
  foreignKeyActions: Omit<SourceForeignKeysPanelProps, 'source' | 'mainTable'>;
}

export default function SourceEditorReview({
  source,
  mainTable,
  refTables,
  isEdit,
  rescanningTable,
  rescanMsg,
  onToggleManualReport,
  onRescan,
  columnActions,
  foreignKeyActions,
}: SourceEditorReviewProps) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      {mainTable && (
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-on-surface">{mainTable.name}</h3>
            {mainTable.alias && (
              <span className="rounded bg-surface-container px-1.5 py-0.5 text-xs text-on-surface-variant">
                alias: {mainTable.alias}
              </span>
            )}
            <span className="text-xs text-on-surface-variant/60">
              {mainTable.columns.length} колонок
            </span>

            <button
              type="button"
              onClick={onToggleManualReport}
              className={`flex items-center gap-1.5 rounded border px-2.5 py-1 text-xs transition-colors ${
                source.manualReport
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                  : 'border-outline-variant/20 bg-surface-container-lowest text-on-surface-variant hover:border-outline-variant/40 hover:bg-surface-container-low hover:text-on-surface'
              }`}
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
            </button>

            {isEdit && (
              <button
                type="button"
                onClick={() => onRescan(mainTable.name)}
                disabled={rescanningTable === mainTable.name}
                className="ml-auto flex items-center gap-1.5 rounded border border-primary/12 bg-primary-fixed/70 px-2.5 py-1 text-xs text-on-primary-fixed-variant transition-colors hover:bg-primary-fixed disabled:cursor-not-allowed disabled:opacity-40"
              >
                {rescanningTable === mainTable.name ? (
                  <>
                    <span className="inline-block h-2.5 w-2.5 rounded-full border-2 border-on-primary-fixed-variant/70 border-t-transparent animate-spin" />
                    Сканирование...
                  </>
                ) : (
                  'Пересканировать'
                )}
              </button>
            )}
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
          <div className="flex flex-wrap gap-2">
            {refTables.map(table => (
              <span
                key={table.name}
                className="rounded border border-outline-variant/15 bg-surface-container-low/50 px-2 py-1 text-xs text-on-surface"
              >
                {table.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
