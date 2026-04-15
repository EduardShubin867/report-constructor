import { useState } from 'react';
import type {
  ColumnSchema,
  DataSource,
  ForeignKey,
  ForeignKeyFilterConfig,
  StoredConnection,
  TableSchema,
} from '@/lib/schema/types';
import type {
  ColumnFilterTier,
  ForeignKeyGroupPreset,
  SourceEditorField,
} from './types';
import {
  EMPTY_SOURCE_EDITOR_FORM,
  getFkPanelKey,
  sourceToForm,
} from './utils';

interface UseSourceEditorLocalStateParams {
  initial?: DataSource;
  connections: StoredConnection[];
}

function clearColumnFilter(column: ColumnSchema): ColumnSchema {
  const next = { ...column } as ColumnSchema;
  delete next.filterTier;
  delete next.filterable;
  return next;
}

export function useSourceEditorLocalState({
  initial,
  connections,
}: UseSourceEditorLocalStateParams) {
  const [form, setForm] = useState(initial ? sourceToForm(initial) : EMPTY_SOURCE_EDITOR_FORM);
  const [source, setSource] = useState<DataSource | null>(initial ?? null);
  const [fkFilterOpen, setFkFilterOpen] = useState<Record<string, boolean>>({});

  function setField(field: SourceEditorField, value: string) {
    setForm(current => ({ ...current, [field]: value }));
  }

  function updateSource(mutator: (current: DataSource) => DataSource) {
    setSource(current => {
      if (!current) return current;
      return mutator(current);
    });
  }

  function updateTable(tableIdx: number, mutator: (table: TableSchema) => TableSchema) {
    updateSource(current => ({
      ...current,
      tables: current.tables.map((table, currentTableIdx) =>
        currentTableIdx === tableIdx ? mutator(table) : table,
      ),
    }));
  }

  function updateColumn(
    tableIdx: number,
    colIdx: number,
    mutator: (column: ColumnSchema) => ColumnSchema,
  ) {
    updateTable(tableIdx, table => ({
      ...table,
      columns: table.columns.map((column, currentColIdx) =>
        currentColIdx === colIdx ? mutator(column) : column,
      ),
    }));
  }

  function updateForeignKey(
    tableIdx: number,
    fkIdx: number,
    mutator: (foreignKey: ForeignKey) => ForeignKey,
  ) {
    updateTable(tableIdx, table => ({
      ...table,
      foreignKeys: (table.foreignKeys ?? []).map((foreignKey, currentFkIdx) =>
        currentFkIdx === fkIdx ? mutator(foreignKey) : foreignKey,
      ),
    }));
  }

  function setColumnFilterTier(tableIdx: number, colIdx: number, tier: ColumnFilterTier) {
    updateColumn(tableIdx, colIdx, column => {
      if (tier === 'off') return clearColumnFilter(column);
      return { ...column, filterTier: tier, filterable: undefined };
    });
  }

  function setAllColumnFilterTier(tableIdx: number, tier: ColumnFilterTier) {
    updateTable(tableIdx, table => ({
      ...table,
      columns: table.columns.map(column => {
        if (tier === 'off') return clearColumnFilter(column);
        return { ...column, filterTier: tier, filterable: undefined };
      }),
    }));
  }

  function toggleHidden(tableIdx: number, colIdx: number) {
    updateColumn(tableIdx, colIdx, column =>
      column.hidden ? { ...column, hidden: undefined } : { ...column, hidden: true },
    );
  }

  function setAllHidden(tableIdx: number, hidden: boolean) {
    updateTable(tableIdx, table => ({
      ...table,
      columns: table.columns.map(column =>
        hidden ? { ...column, hidden: true } : { ...column, hidden: undefined },
      ),
    }));
  }

  function setAllGroupable(tableIdx: number, enable: boolean) {
    updateTable(tableIdx, table => ({
      ...table,
      columns: table.columns.map(column => {
        const eligible =
          column.type === 'string' || column.type === 'date' || column.type === 'bit';
        if (!eligible) return column;
        return enable ? { ...column, groupable: true } : { ...column, groupable: undefined };
      }),
    }));
  }

  function toggleGroupable(tableIdx: number, colIdx: number) {
    updateColumn(tableIdx, colIdx, column =>
      column.groupable ? { ...column, groupable: undefined } : { ...column, groupable: true },
    );
  }

  function togglePeriodFilter(tableIdx: number, colIdx: number) {
    updateColumn(tableIdx, colIdx, column =>
      column.periodFilter
        ? { ...column, periodFilter: undefined }
        : { ...column, periodFilter: true },
    );
  }

  function toggleManualReport() {
    updateSource(current => ({ ...current, manualReport: !current.manualReport }));
  }

  function setFkFilterTier(tableIdx: number, fkIdx: number, tier: 'primary' | 'secondary') {
    updateForeignKey(tableIdx, fkIdx, foreignKey => ({ ...foreignKey, filterTier: tier }));
  }

  function setFkFilterPanelOpen(tableIdx: number, fkIdx: number, open: boolean) {
    const panelKey = getFkPanelKey(tableIdx, fkIdx);
    setFkFilterOpen(current => ({ ...current, [panelKey]: open }));
  }

  function addFkFilter(tableIdx: number, fkIdx: number) {
    updateForeignKey(tableIdx, fkIdx, foreignKey => {
      const guessDisplay =
        foreignKey.targetFields.find(field => /наименован|названи|имя/i.test(field)) ??
        foreignKey.targetFields[0] ??
        '';
      const guessLabel =
        foreignKey.alias.length <= 6 ? foreignKey.alias.toUpperCase() : foreignKey.targetTable;
      return {
        ...foreignKey,
        filterConfig: {
          displayField: guessDisplay,
          label: guessLabel,
        },
        filterTier: foreignKey.filterTier ?? 'primary',
      };
    });
    setFkFilterOpen(current => ({ ...current, [getFkPanelKey(tableIdx, fkIdx)]: true }));
  }

  function removeFkFilter(tableIdx: number, fkIdx: number) {
    setFkFilterPanelOpen(tableIdx, fkIdx, false);
    updateForeignKey(tableIdx, fkIdx, foreignKey => ({
      ...foreignKey,
      filterConfig: undefined,
      filterTier: undefined,
    }));
  }

  function setFkFilterConfig(
    tableIdx: number,
    fkIdx: number,
    config: Partial<ForeignKeyFilterConfig>,
  ) {
    updateForeignKey(tableIdx, fkIdx, foreignKey => ({
      ...foreignKey,
      filterConfig: {
        ...(foreignKey.filterConfig ?? { displayField: '', label: '' }),
        ...config,
      },
    }));
  }

  function isFkGroupByFieldChecked(foreignKey: ForeignKey, field: string): boolean {
    if (foreignKey.groupByFields === undefined) return true;
    return foreignKey.groupByFields.includes(field);
  }

  function toggleFkGroupByField(tableIdx: number, fkIdx: number, field: string) {
    updateForeignKey(tableIdx, fkIdx, foreignKey => {
      const allFields = foreignKey.targetFields;
      let nextFields: string[] | undefined;

      if (foreignKey.groupByFields === undefined) {
        nextFields = allFields.filter(currentField => currentField !== field);
      } else {
        const fields = new Set(foreignKey.groupByFields);
        if (fields.has(field)) fields.delete(field);
        else fields.add(field);
        nextFields = Array.from(fields);
      }

      if (nextFields.length === 0) {
        return { ...foreignKey, groupByFields: [] };
      }

      if (
        nextFields.length === allFields.length &&
        allFields.every(fieldName => nextFields.includes(fieldName))
      ) {
        return { ...foreignKey, groupByFields: undefined };
      }

      return { ...foreignKey, groupByFields: nextFields };
    });
  }

  function setFkGroupByPreset(
    tableIdx: number,
    fkIdx: number,
    preset: ForeignKeyGroupPreset,
  ) {
    updateForeignKey(tableIdx, fkIdx, foreignKey => ({
      ...foreignKey,
      groupByFields: preset === 'all' ? undefined : [],
    }));
  }

  function clearReviewedSource() {
    setSource(null);
    setFkFilterOpen({});
  }

  const selectedConn = connections.find(connection => connection.id === form.connectionId);
  const mainTable = source?.tables.find(table => table.columns.length > 0);
  const refTables = source?.tables.filter(table => table.columns.length === 0) ?? [];
  const canIntrospect =
    !!form.id &&
    !!form.name &&
    !!form.database &&
    !!form.connectionId &&
    !!form.tables.trim();

  return {
    form,
    setField,
    source,
    setSource,
    fkFilterOpen,
    selectedConn,
    mainTable,
    refTables,
    canIntrospect,
    clearReviewedSource,
    setColumnFilterTier,
    setAllColumnFilterTier,
    toggleHidden,
    setAllHidden,
    setAllGroupable,
    setFkFilterTier,
    toggleGroupable,
    togglePeriodFilter,
    toggleManualReport,
    setFkFilterPanelOpen,
    addFkFilter,
    removeFkFilter,
    setFkFilterConfig,
    isFkGroupByFieldChecked,
    toggleFkGroupByField,
    setFkGroupByPreset,
  };
}
