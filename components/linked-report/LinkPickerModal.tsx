import { Check, X } from 'lucide-react';
import type { ManualReportSourcePayload } from '@/lib/report-filters-data';
import type { SourceLink } from '@/lib/schema';
import { emptyBootstrap } from './constants';
import { getColumnLabel } from './helpers';

export function LinkPickerModal({
  links,
  currentLinkId,
  sourceNamesById,
  bootstrapBySourceId,
  onPick,
  onClose,
}: {
  links: SourceLink[];
  currentLinkId: string;
  sourceNamesById: Record<string, string>;
  bootstrapBySourceId: Record<string, ManualReportSourcePayload>;
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="flex max-h-[70vh] w-[460px] flex-col overflow-hidden rounded-2xl border border-outline-variant/20 bg-surface shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex flex-shrink-0 items-center justify-between border-b border-outline-variant/12 px-5 py-4">
          <h3 className="text-sm font-semibold text-on-surface">Выберите связь</h3>
          <button type="button" className="ui-button-ghost rounded-lg p-1" onClick={onClose}>
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
        <div className="space-y-1.5 overflow-y-auto p-3">
          {links.map(link => {
            const leftPayload  = bootstrapBySourceId[link.leftSourceId]  ?? emptyBootstrap;
            const rightPayload = bootstrapBySourceId[link.rightSourceId] ?? emptyBootstrap;
            const lName = sourceNamesById[link.leftSourceId]  ?? link.leftSourceId;
            const rName = sourceNamesById[link.rightSourceId] ?? link.rightSourceId;
            const active = link.id === currentLinkId;
            return (
              <div
                key={link.id}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-colors ${
                  active
                    ? 'border-primary/30 bg-primary-fixed/40'
                    : 'border-outline-variant/12 hover:bg-surface-container-low/60'
                }`}
                onClick={() => { onPick(link.id); onClose(); }}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-on-surface">{link.name}</p>
                  <p className="mt-0.5 truncate text-[11px] text-on-surface-variant">
                    {lName}: {getColumnLabel(leftPayload, link.leftJoinField)}
                    {' ↔ '}
                    {rName}: {getColumnLabel(rightPayload, link.rightJoinField)}
                  </p>
                  {link.description && (
                    <p className="mt-0.5 truncate text-[11px] text-on-surface-variant/60">
                      {link.description}
                    </p>
                  )}
                </div>
                {active && <Check className="h-4 w-4 flex-shrink-0 text-primary" strokeWidth={2.5} />}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
