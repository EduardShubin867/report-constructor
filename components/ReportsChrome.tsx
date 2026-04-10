'use client';

import { Bot, Plus } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { motion, useScroll, useMotionValueEvent, AnimatePresence } from 'framer-motion';
import DbStatus from '@/components/DbStatus';

export type ReportsTab = 'ai' | 'manual';

interface ReportsChromeProps {
  onCreateReport: () => void;
  headerActions?: React.ReactNode;
  children: React.ReactNode;
}

const CHAT_HREF = '/reports/chat';
const MANUAL_HREF = '/reports/manual';

function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-xl border border-primary/15 bg-primary-fixed/80 text-primary ${
        compact ? 'h-8 w-8 rounded-lg' : 'h-9 w-9'
      }`}
      aria-hidden
    >
      <Bot className={compact ? 'h-4 w-4' : 'h-[18px] w-[18px]'} strokeWidth={2} />
    </span>
  );
}

const easeOut = [0.4, 0, 0.2, 1] as const;

const tabBtn = (active: boolean, compact?: boolean) =>
  `${compact ? 'px-2 py-1 text-xs' : 'px-3 py-2 text-sm'} rounded-lg font-semibold transition-colors ${
    active
      ? 'ui-chip-accent shadow-none text-primary'
      : 'text-on-surface-variant hover:bg-surface-container-low/80 hover:text-on-surface'
  }`;

export default function ReportsChrome({
  onCreateReport,
  headerActions,
  children,
}: ReportsChromeProps) {
  const pathname = usePathname();
  const tab: ReportsTab = pathname?.startsWith(MANUAL_HREF) ? 'manual' : 'ai';
  const [compact, setCompact] = useState(false);
  const [allowCompact, setAllowCompact] = useState(false);
  const lastY = useRef(0);
  const { scrollY } = useScroll();

  useEffect(() => {
    const media = window.matchMedia('(max-width: 1023px)');
    const sync = () => {
      setAllowCompact(media.matches);
      if (!media.matches) {
        setCompact(false);
        lastY.current = window.scrollY;
      }
    };

    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  useMotionValueEvent(scrollY, 'change', y => {
    if (!allowCompact) {
      return;
    }
    const prev = lastY.current;
    lastY.current = y;
    const delta = y - prev;
    if (y < 20) {
      setCompact(false);
      return;
    }
    if (delta > 8) setCompact(true);
    else if (delta < -8) setCompact(false);
  });

  const createLabel = tab === 'ai' ? 'Новый чат' : 'Новый отчет';

  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-on-surface">
      {/* Резервируем место под хедер — в обоих режимах контент не прыгает */}
      <div className="h-16 shrink-0" aria-hidden />

      <AnimatePresence initial={false} mode="popLayout">
        {!allowCompact || !compact ? (
          <motion.header
            key="header-expanded"
            layout
            initial={{ y: -56, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -56, opacity: 0, transition: { duration: 0.28, ease: easeOut } }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            className="fixed inset-x-0 top-0 z-50 flex h-16 items-center justify-between border-b border-outline-variant/10 bg-background/92 px-4 backdrop-blur-md sm:px-8"
          >
            <motion.div
              layout
              className="flex min-w-0 flex-1 items-center gap-2 sm:gap-4"
              transition={{ type: 'spring', stiffness: 400, damping: 35 }}
            >
              <Link
                href={CHAT_HREF}
                className="shrink-0"
                aria-label="ИИ аналитик"
              >
                <BrandMark />
                <span className="sr-only">ИИ аналитик</span>
              </Link>
              <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] sm:justify-center md:flex-none md:justify-start [&::-webkit-scrollbar]:hidden">
                <Link href={CHAT_HREF} className={tabBtn(tab === 'ai')}>
                  <span className="sm:hidden">Чат</span>
                  <span className="hidden sm:inline">Чат</span>
                </Link>
                <Link href={MANUAL_HREF} className={tabBtn(tab === 'manual')}>
                  <span className="sm:hidden">Ручной</span>
                  <span className="hidden sm:inline">Конструктор</span>
                </Link>
              </div>
            </motion.div>

            <motion.div
              layout
              className="flex shrink-0 items-center gap-2 sm:gap-3"
              transition={{ type: 'spring', stiffness: 400, damping: 35 }}
            >
              <div className="ui-chip hidden items-center gap-2 rounded-full px-3 py-1.5 sm:flex">
                <DbStatus variant="pill" />
              </div>
              <div className="sm:hidden">
                <DbStatus variant="dot" />
              </div>
              {headerActions}
              <button
                type="button"
                onClick={onCreateReport}
                className="ui-button-secondary hidden items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold active:scale-[0.98] sm:flex"
              >
                <Plus className="h-4 w-4 text-primary" strokeWidth={2.2} />
                {createLabel}
              </button>
              <button
                type="button"
                onClick={onCreateReport}
                className="ui-button-secondary flex h-9 w-9 items-center justify-center rounded-full sm:hidden"
                aria-label={createLabel}
              >
                <Plus className="h-4.5 w-4.5 text-primary" strokeWidth={2.2} />
              </button>
              <div
                className="ui-chip flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-semibold text-on-surface"
                aria-hidden
              >
                А
              </div>
            </motion.div>
          </motion.header>
        ) : (
          <motion.div
            key="header-compact"
            layout
            initial={{ y: -48, opacity: 0, scale: 0.94 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -40, opacity: 0, scale: 0.96, transition: { duration: 0.22, ease: easeOut } }}
            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
            className="pointer-events-none fixed left-1/2 top-3 z-50 w-[calc(100%-1.5rem)] max-w-xl -translate-x-1/2"
          >
            <motion.div
              layout
              className="ui-panel pointer-events-auto flex items-center gap-1.5 rounded-2xl px-2 py-1.5 backdrop-blur-xl sm:gap-2 sm:px-3 sm:py-2"
              transition={{ type: 'spring', stiffness: 450, damping: 36 }}
            >
              <Link
                href={CHAT_HREF}
                className="shrink-0"
                aria-label="ИИ аналитик"
              >
                <BrandMark compact />
                <span className="sr-only">ИИ аналитик</span>
              </Link>
              <span className="h-5 w-px shrink-0 bg-outline-variant/25" aria-hidden />
              <div className="flex min-w-0 flex-1 items-center justify-center gap-0.5 sm:gap-1">
                <Link href={CHAT_HREF} className={tabBtn(tab === 'ai', true)}>
                  Чат
                </Link>
                <Link href={MANUAL_HREF} className={tabBtn(tab === 'manual', true)}>
                  Конструктор
                </Link>
              </div>
              <span className="h-5 w-px shrink-0 bg-outline-variant/25" aria-hidden />
              <DbStatus variant="dot" />
              <div className="hidden min-w-0 items-center sm:flex">{headerActions}</div>
              <button
                type="button"
                onClick={onCreateReport}
                className="ui-button-secondary flex h-8 w-8 shrink-0 items-center justify-center rounded-full active:scale-95"
                aria-label={createLabel}
              >
                <Plus className="h-4 w-4 text-primary" strokeWidth={2.2} />
              </button>
              <div
                className="ui-chip flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-on-surface"
                aria-hidden
              >
                А
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="min-h-[calc(100vh-4rem)] flex-1 bg-background p-4 sm:p-6 xl:px-8">
        <div className="mx-auto max-w-[112rem]">{children}</div>
      </main>
    </div>
  );
}
