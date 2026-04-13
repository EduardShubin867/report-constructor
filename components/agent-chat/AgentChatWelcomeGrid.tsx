import { motion } from 'framer-motion';
import { fadeSlide } from '@/components/agent-chat/animations';
import type { WelcomeCard } from '@/components/agent-chat/types';

type Props = {
  cards: WelcomeCard[];
  onPickQuery: (query: string) => void;
};

export default function AgentChatWelcomeGrid({ cards, onPickQuery }: Props) {
  return (
    <motion.div {...fadeSlide} className="flex flex-col gap-2 py-1">
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-on-surface-variant/70">
        Популярные запросы
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-2.5 xl:grid-cols-3">
        {cards.map(card => (
          <button
            key={card.key}
            type="button"
            onClick={() => onPickQuery(card.query)}
            className="ui-panel group flex items-start gap-2.5 rounded-2xl p-2.5 text-left transition-all duration-300 hover:-translate-y-0.5 hover:border-outline-variant/30 hover:bg-white sm:flex-col sm:gap-2 sm:p-3"
          >
            <div className="ui-chip-accent flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-colors group-hover:bg-primary-fixed">
              {card.icon}
            </div>
            <div className="min-w-0">
              <p className="font-headline text-sm font-semibold text-on-surface">{card.title}</p>
              <p className="mt-0.5 line-clamp-1 text-xs leading-5 text-on-surface-variant sm:line-clamp-2">
                {card.query}
              </p>
            </div>
          </button>
        ))}
      </div>
    </motion.div>
  );
}
