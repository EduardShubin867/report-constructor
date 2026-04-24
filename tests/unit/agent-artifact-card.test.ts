import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

jest.mock('framer-motion', () => {
  const react = require('react') as typeof import('react');
  return {
    motion: {
      article: ({
        children,
        layoutId: _layoutId,
        transition: _transition,
        ...props
      }: React.HTMLAttributes<HTMLElement> & { layoutId?: string; transition?: unknown }) =>
        react.createElement('article', props, children),
    },
  };
});

jest.mock('@/components/SqlHighlight', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@/components/agent-chat/MarkdownText', () => {
  const react = require('react') as typeof import('react');
  return {
    __esModule: true,
    default: ({ text }: { text: string }) =>
      react.createElement('div', { className: 'mock-markdown' }, text),
  };
});

import AgentArtifactCard from '@/components/AgentArtifactCard';

describe('AgentArtifactCard', () => {
  it('renders artifact summaries through the markdown renderer', () => {
    const html = renderToStaticMarkup(React.createElement(AgentArtifactCard, {
      artifact: {
        data: [],
        columns: ['Маржа'],
        rowCount: 1,
        validatedSql: 'SELECT 1',
        sql: 'SELECT 1',
        explanation: '## Заголовок\n- Пункт',
      },
      summary: '## Заголовок\n- Пункт',
      exporting: false,
      layoutId: 'artifact-1',
      onOpen: () => {},
      onExport: () => {},
      onRefine: () => {},
    }));

    expect(html).toContain('mock-markdown');
  });
});
