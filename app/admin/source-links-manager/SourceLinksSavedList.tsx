import type { ColumnDef } from '@/lib/report-columns';
import type { SourceLink } from '@/lib/schema';
import type { SourceOption } from './types';
import { SourceLinkListCard } from './SourceLinkListCard';

type SourceLinksSavedListProps = {
  loading: boolean;
  links: SourceLink[];
  sources: SourceOption[];
  columnsBySource: Record<string, ColumnDef[]>;
  deletingId: string | null;
  onEdit: (link: SourceLink) => void;
  onDelete: (id: string) => void;
};

export function SourceLinksSavedList({
  loading,
  links,
  sources,
  columnsBySource,
  deletingId,
  onEdit,
  onDelete,
}: SourceLinksSavedListProps) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-on-surface">Сохранённые связи</h3>
          <p className="mt-1 text-xs text-on-surface-variant">
            Каждая связь определяет пару источников и поля, по которым новая вкладка будет собирать
            общий отчёт.
          </p>
        </div>
      </div>

      <div className="grid gap-4">
        {loading ? (
          <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest px-4 py-6 text-sm text-on-surface-variant">
            Загрузка…
          </div>
        ) : links.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-outline-variant/20 bg-surface-container-lowest px-4 py-8 text-center text-sm text-on-surface-variant">
            Пока нет ни одной связи. Создайте первую, чтобы в отчётах появилась вкладка сводки.
          </div>
        ) : (
          links.map(link => {
            const leftName =
              sources.find(source => source.id === link.leftSourceId)?.name ?? link.leftSourceId;
            const rightName =
              sources.find(source => source.id === link.rightSourceId)?.name ?? link.rightSourceId;
            const leftLabel =
              columnsBySource[link.leftSourceId]?.find(column => column.key === link.leftJoinField)
                ?.label ?? link.leftJoinField;
            const rightLabel =
              columnsBySource[link.rightSourceId]?.find(column => column.key === link.rightJoinField)
                ?.label ?? link.rightJoinField;

            return (
              <SourceLinkListCard
                key={link.id}
                link={link}
                leftName={leftName}
                rightName={rightName}
                leftLabel={leftLabel}
                rightLabel={rightLabel}
                deleting={deletingId === link.id}
                onEdit={() => onEdit(link)}
                onDelete={() => onDelete(link.id)}
              />
            );
          })
        )}
      </div>
    </section>
  );
}
