import { motion } from 'framer-motion';
import type { ColumnDef } from '@/lib/report-columns';
import { SourceLinkEditorGraphPreview } from './SourceLinkEditorGraphPreview';
import { SourceLinkEditorMetaFields } from './SourceLinkEditorMetaFields';
import { SourceLinkJoinSides } from './SourceLinkJoinSides';
import { SourceLinkSharedPeriodSection } from './SourceLinkSharedPeriodSection';
import type { SourceLinkFormState } from './types';

type SelectOption = { value: string; label: string };

type SourceLinkEditorProps = {
  initialId?: string;
  form: SourceLinkFormState;
  saving: boolean;
  canSave: boolean;
  leftColumns: ColumnDef[];
  rightColumns: ColumnDef[];
  sourceSelectOptions: SelectOption[];
  leftColumnOptions: SelectOption[];
  rightColumnOptions: SelectOption[];
  leftDateOptions: SelectOption[];
  rightDateOptions: SelectOption[];
  leftSourceName: string;
  rightSourceName: string;
  leftJoinLabel: string;
  rightJoinLabel: string;
  setField: <K extends keyof SourceLinkFormState>(key: K, value: SourceLinkFormState[K]) => void;
  setPeriodField: <K extends keyof SourceLinkFormState>(
    key: K,
    value: SourceLinkFormState[K],
  ) => void;
  onClose: () => void;
  onSave: () => void;
  onEnableSharedPeriod: () => void;
  onDisableSharedPeriod: () => void;
};

export function SourceLinkEditor({
  initialId,
  form,
  saving,
  canSave,
  leftColumns,
  rightColumns,
  sourceSelectOptions,
  leftColumnOptions,
  rightColumnOptions,
  leftDateOptions,
  rightDateOptions,
  leftSourceName,
  rightSourceName,
  leftJoinLabel,
  rightJoinLabel,
  setField,
  setPeriodField,
  onClose,
  onSave,
  onEnableSharedPeriod,
  onDisableSharedPeriod,
}: SourceLinkEditorProps) {
  const leftDateCols = leftColumns.filter(c => c.type === 'date');
  const rightDateCols = rightColumns.filter(c => c.type === 'date');

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      className="rounded-3xl border border-outline-variant/15 bg-surface-container-lowest p-6 shadow-sm"
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant">
            Редактор связи
          </p>
          <h3 className="mt-1 text-lg font-semibold text-on-surface">
            {initialId ? `Изменение: ${form.name || initialId}` : 'Новая связь'}
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-on-surface-variant hover:text-on-surface text-lg leading-none"
        >
          ×
        </button>
      </div>

      <SourceLinkEditorMetaFields form={form} initialId={initialId} setField={setField} />

      <SourceLinkJoinSides
        form={form}
        setField={setField}
        sourceSelectOptions={sourceSelectOptions}
        leftColumnOptions={leftColumnOptions}
        rightColumnOptions={rightColumnOptions}
      />

      <SourceLinkEditorGraphPreview
        leftSourceName={leftSourceName}
        rightSourceName={rightSourceName}
        leftJoinLabel={leftJoinLabel}
        rightJoinLabel={rightJoinLabel}
      />

      <SourceLinkSharedPeriodSection
        form={form}
        leftDateCols={leftDateCols}
        rightDateCols={rightDateCols}
        leftDateOptions={leftDateOptions}
        rightDateOptions={rightDateOptions}
        setPeriodField={setPeriodField}
        onEnable={onEnableSharedPeriod}
        onDisable={onDisableSharedPeriod}
      />

      <div className="mt-6 flex items-center gap-3">
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-2 text-sm text-on-surface-variant hover:text-on-surface transition-colors"
        >
          Отмена
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={!canSave || saving}
          className="ui-button-primary rounded-xl px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? 'Сохраняем…' : initialId ? 'Сохранить изменения' : 'Сохранить связь'}
        </button>
      </div>
    </motion.section>
  );
}
