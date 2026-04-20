import { Button } from '@/components/ui/button';
import { getSourceTableDisplayName } from '@/lib/schema/display-name';
import { cn } from '@/lib/utils';
import type {
  DataSource,
  ForeignKey,
  ForeignKeyFilterConfig,
  TableSchema,
} from '@/lib/schema/types';
import type { ForeignKeyGroupPreset } from './types';
import { getFkPanelKey } from './utils';

export interface SourceForeignKeysPanelProps {
  source: DataSource;
  mainTable: TableSchema;
  fkFilterOpen: Record<string, boolean>;
  onSetFkFilterTier: (tableIdx: number, fkIdx: number, tier: 'primary' | 'secondary') => void;
  onSetFkFilterPanelOpen: (tableIdx: number, fkIdx: number, open: boolean) => void;
  onAddFkFilter: (tableIdx: number, fkIdx: number) => void;
  onRemoveFkFilter: (tableIdx: number, fkIdx: number) => void;
  onSetFkFilterConfig: (
    tableIdx: number,
    fkIdx: number,
    config: Partial<ForeignKeyFilterConfig>,
  ) => void;
  onIsFkGroupByFieldChecked: (foreignKey: ForeignKey, field: string) => boolean;
  onToggleFkGroupByField: (tableIdx: number, fkIdx: number, field: string) => void;
  onSetFkGroupByPreset: (
    tableIdx: number,
    fkIdx: number,
    preset: ForeignKeyGroupPreset,
  ) => void;
}

export default function SourceForeignKeysPanel({
  source,
  mainTable,
  fkFilterOpen,
  onSetFkFilterTier,
  onSetFkFilterPanelOpen,
  onAddFkFilter,
  onRemoveFkFilter,
  onSetFkFilterConfig,
  onIsFkGroupByFieldChecked,
  onToggleFkGroupByField,
  onSetFkGroupByPreset,
}: SourceForeignKeysPanelProps) {
  if (!mainTable.foreignKeys?.length) return null;

  const tableIdx = source.tables.indexOf(mainTable);

  return (
    <div className="mt-4 rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-3">
      <h4 className="text-sm font-semibold text-on-surface">
        Внешние ключи (JOIN к справочникам)
      </h4>
      <p className="mt-1 text-xs leading-relaxed text-on-surface-variant/60">
        Связь колонки журнала со справочной таблицей. По желанию можно добавить{' '}
        <span className="text-on-surface-variant">фильтр в ручном отчёте</span>: тогда в отчёте
        появится мультиселект по значениям из справочника (как по полю в журнале).
      </p>

      <div className="mt-3 space-y-3">
        {mainTable.foreignKeys.map((foreignKey, fkIdx) => {
          const panelKey = getFkPanelKey(tableIdx, fkIdx);
          const isOpen = !!fkFilterOpen[panelKey];
          const hasFilter = !!foreignKey.filterConfig;
          const filterConfig = foreignKey.filterConfig ?? { displayField: '', label: '' };
          const targetTableLabel = getSourceTableDisplayName(source, foreignKey.targetTable);

          return (
            <div
              key={`${foreignKey.column}-${foreignKey.alias}-${fkIdx}`}
              className="overflow-hidden rounded-lg border border-outline-variant/20 bg-surface-container-lowest"
            >
              <div className="border-b border-outline-variant/10 bg-surface-container/40 px-3 py-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-on-surface">
                      Справочник <span className="text-on-surface">{targetTableLabel}</span>{' '}
                      <span className="font-mono text-emerald-400/90">
                        [{source.schema}].[{foreignKey.targetTable}]
                      </span>
                    </p>
                    <p className="mt-1 font-mono text-[11px] leading-snug text-on-surface-variant">
                      <span className="text-on-surface-variant/60">В журнале:</span>{' '}
                      [{foreignKey.column}] <span className="text-outline-variant">→</span> ключ
                      справочника [{foreignKey.targetColumn}]
                      <span className="text-outline-variant"> · </span>
                      <span className="text-on-surface-variant/60">псевдоним JOIN:</span>{' '}
                      <span className="text-amber-400/90">{foreignKey.alias}</span>
                    </p>
                  </div>

                  {hasFilter ? (
                    <span className="shrink-0 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                      фильтр в отчёте
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-md border border-outline-variant/20 bg-surface-container px-2 py-0.5 text-[10px] text-on-surface-variant/60">
                      только JOIN
                    </span>
                  )}
                </div>
              </div>

              <div className="px-3 py-2.5">
                {foreignKey.targetFields.length > 0 && (
                  <div className="mb-3 border-b border-outline-variant/10 pb-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-medium text-on-surface">
                        Группировка по справочнику
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        <Button
                          type="button"
                          variant="outline"
                          size="xs"
                          onClick={() => onSetFkGroupByPreset(tableIdx, fkIdx, 'all')}
                          className="h-auto min-h-0 rounded-md border-outline-variant/30 bg-surface-container px-2 py-0.5 text-[10px] font-medium text-on-surface hover:border-outline-variant"
                        >
                          Все поля
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="xs"
                          onClick={() => onSetFkGroupByPreset(tableIdx, fkIdx, 'none')}
                          className="h-auto min-h-0 rounded-md border-outline-variant/30 bg-surface-container px-2 py-0.5 text-[10px] font-medium text-on-surface hover:border-outline-variant"
                        >
                          Ни одного
                        </Button>
                      </div>
                    </div>

                    <p className="mt-1 text-[11px] leading-relaxed text-on-surface-variant/60">
                      Какие колонки справочника доступны как измерения в ручном отчёте (GROUP
                      BY). По умолчанию — все; пустой набор отключает этот FK для группировки.
                    </p>

                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1.5">
                      {foreignKey.targetFields.map(field => (
                        <label
                          key={field}
                          className="flex cursor-pointer items-center gap-1.5 text-[11px] text-on-surface"
                        >
                          <input
                            type="checkbox"
                            checked={onIsFkGroupByFieldChecked(foreignKey, field)}
                            onChange={() => onToggleFkGroupByField(tableIdx, fkIdx, field)}
                            className="rounded border-outline-variant/30 bg-white text-emerald-600 focus:ring-emerald-600/40"
                          />
                          <span className="font-mono text-on-surface-variant">{field}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {!hasFilter ? (
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-on-surface-variant/60">
                      Добавьте фильтр, если нужен выпадающий список по этому справочнику в ручном
                      отчёте.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onAddFkFilter(tableIdx, fkIdx)}
                      className="h-auto min-h-0 shrink-0 rounded-lg border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
                    >
                      Добавить фильтр...
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-col gap-2 border-b border-outline-variant/10 pb-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                      <div className="text-xs text-on-surface-variant">
                        <span className="text-on-surface-variant/60">Подпись в отчёте:</span>{' '}
                        <span className="font-medium text-on-surface">
                          {filterConfig.label || '—'}
                        </span>
                        <span className="mx-1.5 text-outline-variant">·</span>
                        <span className="text-on-surface-variant/60">поле списка:</span>{' '}
                        <span className="font-mono text-on-surface">
                          {filterConfig.displayField || '—'}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] uppercase tracking-wide text-on-surface-variant/60">
                          Блок в отчёте
                        </span>
                        <div className="flex rounded-lg border border-outline-variant/30 p-0.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="xs"
                            title="Показывать в основном блоке «Самое важное»"
                            onClick={() => onSetFkFilterTier(tableIdx, fkIdx, 'primary')}
                            className={cn(
                              'h-auto min-h-0 rounded-md px-2 py-1 text-[11px] font-medium transition-colors hover:bg-transparent',
                              (foreignKey.filterTier ?? 'primary') === 'primary'
                                ? 'bg-emerald-600 text-white hover:bg-emerald-600'
                                : 'text-on-surface-variant hover:text-on-surface',
                            )}
                          >
                            Основной
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="xs"
                            title="Показывать в блоке «Остальные фильтры»"
                            onClick={() => onSetFkFilterTier(tableIdx, fkIdx, 'secondary')}
                            className={cn(
                              'h-auto min-h-0 rounded-md px-2 py-1 text-[11px] font-medium transition-colors hover:bg-transparent',
                              foreignKey.filterTier === 'secondary'
                                ? 'bg-teal-700 text-white hover:bg-teal-700'
                                : 'text-on-surface-variant hover:text-on-surface',
                            )}
                          >
                            Дополнительный
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onSetFkFilterPanelOpen(tableIdx, fkIdx, !isOpen)}
                        className={cn(
                          'h-auto min-h-0 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                          isOpen
                            ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
                            : 'border-outline-variant/30 bg-surface-container text-on-surface hover:border-outline-variant',
                        )}
                      >
                        {isOpen ? 'Свернуть настройки' : 'Изменить поля'}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onRemoveFkFilter(tableIdx, fkIdx)}
                        className="h-auto min-h-0 rounded-lg border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100"
                      >
                        Убрать фильтр
                      </Button>
                    </div>

                    {isOpen && (
                      <div className="mt-3 space-y-3 rounded-lg border border-outline-variant/15 bg-surface-container-low/50 p-3">
                        <p className="text-[11px] text-on-surface-variant/60">
                          Поле списка — колонка справочника, из которой берутся подписи в фильтре
                          (часто «Наименование»). Условие WHERE — опционально, накладывается на
                          справочник.
                        </p>

                        <div className="flex flex-wrap gap-3">
                          <label className="flex min-w-[140px] flex-1 flex-col gap-1">
                            <span className="text-xs font-medium text-on-surface-variant">
                              Подпись у фильтра в отчёте
                            </span>
                            <input
                              className="ui-field rounded-md px-2 py-1.5 text-xs focus:outline-none"
                              placeholder="Например: ДГ"
                              value={filterConfig.label}
                              onChange={event =>
                                onSetFkFilterConfig(tableIdx, fkIdx, {
                                  label: event.target.value,
                                })
                              }
                            />
                          </label>

                          <label className="flex min-w-[140px] flex-1 flex-col gap-1">
                            <span className="text-xs font-medium text-on-surface-variant">
                              Поле справочника для списка значений
                            </span>
                            <input
                              className="ui-field rounded-md px-2 py-1.5 font-mono text-xs focus:outline-none"
                              placeholder="Наименование"
                              value={filterConfig.displayField}
                              onChange={event =>
                                onSetFkFilterConfig(tableIdx, fkIdx, {
                                  displayField: event.target.value,
                                })
                              }
                            />
                          </label>

                          <label className="flex min-w-[180px] flex-[2] flex-col gap-1">
                            <span className="text-xs font-medium text-on-surface-variant">
                              Доп. условие к справочнику (SQL WHERE)
                            </span>
                            <input
                              className="ui-field rounded-md px-2 py-1.5 font-mono text-xs focus:outline-none"
                              placeholder="ПометкаУдаления = 0"
                              value={filterConfig.targetWhere ?? ''}
                              onChange={event =>
                                onSetFkFilterConfig(tableIdx, fkIdx, {
                                  targetWhere: event.target.value || undefined,
                                })
                              }
                            />
                          </label>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
