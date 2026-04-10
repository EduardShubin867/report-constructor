'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import AgentChatWorkspace from '@/components/AgentChatWorkspace';
import ReportsChrome from '@/components/ReportsChrome';

const fadeSlide = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.2, ease: 'easeOut' as const },
};

export default function ChatRoute() {
  const [aiKey, setAiKey] = useState(0);

  return (
    <ReportsChrome onCreateReport={() => setAiKey(current => current + 1)}>
      <motion.div {...fadeSlide}>
        <AgentChatWorkspace key={aiKey} />
      </motion.div>
    </ReportsChrome>
  );
}
