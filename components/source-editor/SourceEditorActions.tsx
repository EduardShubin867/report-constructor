import type { SourceEditorPhase } from './types';

interface SourceEditorActionsProps {
  phase: SourceEditorPhase;
  canIntrospect: boolean;
  onIntrospect: () => void;
  onBackToForm: () => void;
  onSave: () => void;
}

export default function SourceEditorActions({
  phase,
  canIntrospect,
  onIntrospect,
  onBackToForm,
  onSave,
}: SourceEditorActionsProps) {
  if (phase === 'saved') return null;

  return (
    <div className="flex items-center gap-3">
      {(phase === 'idle' || phase === 'introspecting') && (
        <button
          type="button"
          onClick={onIntrospect}
          disabled={phase === 'introspecting' || !canIntrospect}
          className="ui-button-secondary rounded-lg disabled:cursor-not-allowed disabled:opacity-40"
        >
          {phase === 'introspecting' ? (
            <span className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-full border-2 border-on-surface-variant border-t-transparent animate-spin" />
              Интроспекция...
            </span>
          ) : (
            'Интроспектировать с AI'
          )}
        </button>
      )}

      {phase === 'review' && (
        <>
          <button type="button" onClick={onBackToForm} className="ui-button-secondary rounded-lg">
            Назад
          </button>
          <button
            type="button"
            onClick={onIntrospect}
            disabled={!canIntrospect}
            className="ui-button-secondary rounded-lg disabled:cursor-not-allowed disabled:opacity-40"
          >
            Повторить интроспекцию
          </button>
          <button
            type="button"
            onClick={onSave}
            className="rounded-lg bg-emerald-700 px-4 py-2 text-sm text-white transition-colors hover:bg-emerald-600"
          >
            Сохранить источник
          </button>
        </>
      )}

      {phase === 'saving' && (
        <button
          type="button"
          disabled
          className="flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm text-white opacity-60"
        >
          <span className="inline-block h-3 w-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
          Сохранение...
        </button>
      )}
    </div>
  );
}
