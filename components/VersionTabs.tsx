'use client';

import { motion } from 'framer-motion';

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
            className={`relative px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap
              ${isActive
                ? 'text-purple-700'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
          >
            {v.label}
            {isActive && (
              <motion.div
                layoutId="version-tab-indicator"
                className="absolute inset-0 bg-purple-100 rounded-lg -z-10"
                transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
