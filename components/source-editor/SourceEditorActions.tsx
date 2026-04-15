import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

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
        <Button
          type="button"
          onClick={onIntrospect}
          disabled={phase === 'introspecting' || !canIntrospect}
          variant="outline"
          className={cn(
            'ui-button-secondary rounded-lg disabled:cursor-not-allowed disabled:opacity-40',
          )}
        >
          {phase === 'introspecting' ? (
            <span className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-full border-2 border-on-surface-variant border-t-transparent animate-spin" />
              Интроспекция...
            </span>
          ) : (
            'Интроспектировать с AI'
          )}
        </Button>
      )}

      {phase === 'review' && (
        <>
          <Button
            type="button"
            onClick={onBackToForm}
            variant="outline"
            className="ui-button-secondary rounded-lg"
          >
            Назад
          </Button>
          <Button
            type="button"
            onClick={onIntrospect}
            disabled={!canIntrospect}
            variant="outline"
            className={cn(
              'ui-button-secondary rounded-lg disabled:cursor-not-allowed disabled:opacity-40',
            )}
          >
            Повторить интроспекцию
          </Button>
          <Button
            type="button"
            onClick={onSave}
            className="border-transparent bg-emerald-700 text-white hover:bg-emerald-600"
          >
            Сохранить источник
          </Button>
        </>
      )}

      {phase === 'saving' && (
        <Button
          type="button"
          disabled
          className="flex items-center gap-2 border-transparent bg-emerald-700 text-white opacity-60"
        >
          <span className="inline-block h-3 w-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
          Сохранение...
        </Button>
      )}
    </div>
  );
}
