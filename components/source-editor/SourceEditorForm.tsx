import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { StoredConnection } from '@/lib/schema/types';
import type {
  SourceEditorField,
  SourceEditorFormData,
  SourceEditorPhase,
} from './types';

interface SourceEditorFormProps {
  form: SourceEditorFormData;
  phase: SourceEditorPhase;
  isEdit: boolean;
  connections: StoredConnection[];
  selectedConn?: StoredConnection;
  onFieldChange: (field: SourceEditorField, value: string) => void;
}

export default function SourceEditorForm({
  form,
  phase,
  isEdit,
  connections,
  selectedConn,
  onFieldChange,
}: SourceEditorFormProps) {
  const isIntrospecting = phase === 'introspecting';

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
          Источник
        </h3>

        <label className="block">
          <span className="mb-1 block text-xs text-on-surface-variant">ID (slug)</span>
          <input
            className="ui-field w-full rounded-lg px-3 py-2 text-sm focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="kasko"
            value={form.id}
            onChange={event => onFieldChange('id', event.target.value)}
            disabled={isIntrospecting || isEdit}
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs text-on-surface-variant">Название</span>
          <input
            className="ui-field w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
            placeholder="КАСКО Маржа"
            value={form.name}
            onChange={event => onFieldChange('name', event.target.value)}
            disabled={isIntrospecting}
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs text-on-surface-variant">Когда использовать</span>
          <textarea
            className="ui-field w-full resize-none rounded-lg px-3 py-2 text-sm focus:outline-none"
            rows={2}
            placeholder="Используй для вопросов по ОСАГО, страховой марже и убыточности"
            value={form.whenToUse}
            onChange={event => onFieldChange('whenToUse', event.target.value)}
            disabled={isIntrospecting}
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs text-on-surface-variant">База данных</span>
          <input
            className="ui-field w-full rounded-lg px-3 py-2 font-mono text-sm focus:outline-none"
            placeholder="ExportUCS"
            value={form.database}
            onChange={event => onFieldChange('database', event.target.value)}
            disabled={isIntrospecting}
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs text-on-surface-variant">Схема БД</span>
          <input
            className="ui-field w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
            placeholder="dbo"
            value={form.schema}
            onChange={event => onFieldChange('schema', event.target.value)}
            disabled={isIntrospecting}
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs text-on-surface-variant">
            Таблицы (по одной на строку)
          </span>
          <textarea
            className="ui-field w-full rounded-lg px-3 py-2 font-mono text-sm focus:outline-none"
            rows={5}
            placeholder={'Журнал_КАСКО_Маржа\nДГ\nТерритории'}
            value={form.tables}
            onChange={event => onFieldChange('tables', event.target.value)}
            disabled={isIntrospecting}
          />
        </label>
      </div>

      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
          Подключение
        </h3>

        {connections.length === 0 ? (
          <div className="rounded-lg border border-outline-variant/15 bg-surface-container/50 px-4 py-6 text-center text-sm text-on-surface-variant">
            Нет сохранённых подключений.
            <br />
            <span className="text-on-surface-variant">Создайте подключение в разделе выше.</span>
          </div>
        ) : (
          <div className="space-y-2">
            {connections.map(connection => (
              <Button
                key={connection.id}
                type="button"
                variant="outline"
                onClick={() => onFieldChange('connectionId', connection.id)}
                disabled={isIntrospecting}
                className={cn(
                  'h-auto min-h-0 w-full justify-start rounded-lg border px-3 py-2.5 text-left font-normal transition-colors',
                  form.connectionId === connection.id
                    ? 'border-primary/40 bg-primary-fixed/30'
                    : 'border-outline-variant/20 bg-surface-container-lowest hover:bg-surface-container-low',
                )}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${
                      form.connectionId === connection.id ? 'bg-emerald-500' : 'bg-outline-variant'
                    }`}
                  />
                  <span className="text-sm text-on-surface">{connection.name}</span>
                  <span className="ml-auto text-xs text-on-surface-variant/60">
                    {connection.dialect}
                  </span>
                </div>
                <div className="mt-0.5 ml-3.5 font-mono text-xs text-on-surface-variant/60">
                  {connection.server}
                </div>
              </Button>
            ))}
          </div>
        )}

        {selectedConn && (
          <div className="space-y-0.5 rounded-lg border border-outline-variant/15 bg-surface-container/40 px-3 py-2 text-xs text-on-surface-variant">
            <div>
              Сервер: <span className="font-mono text-on-surface">{selectedConn.server}</span>
            </div>
            {selectedConn.user && (
              <div>
                Пользователь: <span className="text-on-surface">{selectedConn.user}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
