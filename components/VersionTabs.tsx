'use client';

export interface VersionTabInfo {
  id: number;
  label: string;
  query: string;
}

interface VersionTabsProps {
  versions: VersionTabInfo[];
  activeIdx: number;
  onSelect: (idx: number) => void;
}

export default function VersionTabs({ versions, activeIdx, onSelect }: VersionTabsProps) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
      {versions.map((v, idx) => {
        const isActive = idx === activeIdx;
        return (
          <button
            key={v.id}
            type="button"
            onClick={() => onSelect(idx)}
            title={v.query}
            className={`relative flex items-center gap-1 whitespace-nowrap rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-colors
              ${isActive
                ? 'border-primary bg-primary text-on-primary shadow-[0_6px_16px_rgba(52,92,150,0.18)]'
                : 'border-outline-variant/25 bg-white/72 text-on-surface-variant hover:border-outline-variant/45 hover:bg-surface-container-low/70 hover:text-on-surface'
              }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${isActive ? 'bg-on-primary/90' : 'bg-outline-variant/80'}`}
              aria-hidden
            />
            {v.label}
          </button>
        );
      })}
    </div>
  );
}
