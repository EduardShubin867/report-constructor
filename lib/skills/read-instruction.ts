import type { ToolSkill } from './types';
import { readTextInstruction } from './text-instructions';

const readInstruction: ToolSkill = {
  kind: 'tool',
  name: 'read_instruction',
  description:
    'Прочитать полный текст текстовой инструкции по id. Id указан в каталоге инструкций в системном промпте (встроенные из репозитория и при необходимости из админ-панели). Вызови когда нужна подробная информация по теме.',
  parameters: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: 'Идентификатор инструкции (как в заголовке каталога: для файлов — имя без .md)',
      },
    },
    required: ['id'],
  },

  async execute(args) {
    const raw = args.id ?? args.name;
    const id = String(raw ?? '').trim();
    return readTextInstruction(id);
  },
};

export default readInstruction;
