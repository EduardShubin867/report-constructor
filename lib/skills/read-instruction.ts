import { z } from 'zod';
import type { ToolSkill } from './types';
import { readTextInstruction } from './text-instructions';

const readInstruction: ToolSkill = {
  kind: 'tool',
  name: 'read_instruction',
  description:
    'Прочитать полный текст текстовой инструкции по id. Id указан в каталоге инструкций в системном промпте (встроенные из репозитория и при необходимости из админ-панели). Вызови когда нужна подробная информация по теме.',
  inputSchema: z
    .object({
      id: z
        .string()
        .optional()
        .describe('Идентификатор инструкции (как в заголовке каталога: для файлов — имя без .md)'),
      name: z.string().optional().describe('Алиас для id (устаревшее имя параметра)'),
    })
    .refine(d => !!(d.id?.trim() || d.name?.trim()), {
      message: 'Нужен id или name',
    }) as z.ZodType<Record<string, unknown>>,

  async execute(args) {
    const raw = args.id ?? args.name;
    const id = String(raw ?? '').trim();
    return readTextInstruction(id);
  },
};

export default readInstruction;
