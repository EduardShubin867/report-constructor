import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { requestOsagoAgentMessage } from '@/lib/osago-agent-client';
import type { ToolSkill } from './types';

const callOsagoAgent: ToolSkill = {
  kind: 'tool',
  name: 'call_osago_agent',
  description:
    'Обращается к ОСАГО-агенту (ML-модель) с вопросом про маржу ОСАГО. Используй ВМЕСТО SQL когда пользователь спрашивает об убыточности, LR, прогнозах, объяснении трендов или анализе причин — то есть когда нужен аналитический вывод, а не таблица с данными. Возвращает markdown-ответ ОСАГО-агента.',
  inputSchema: z.object({
    query: z.string().describe('Вопрос к ОСАГО-агенту на русском языке — точная формулировка пользователя или её уточнение'),
  }) as z.ZodType<Record<string, unknown>>,

  async execute(args) {
    const query = String(args.query ?? '').trim();
    if (!query) return 'Не указан вопрос для ОСАГО-агента';

    try {
      const response = await requestOsagoAgentMessage({
        query,
        chatId: randomUUID(),
      });
      return response.content;
    } catch (err) {
      return `[ОШИБКА] ОСАГО-агент недоступен: ${err instanceof Error ? err.message : String(err)}. Сообщи пользователю об ошибке — не пытайся ответить самостоятельно.`;
    }
  },
};

export default callOsagoAgent;
