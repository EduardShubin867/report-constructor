import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import type { ToolSkill } from './types';

const INSTRUCTIONS_DIR = join(process.cwd(), 'lib', 'skills', 'instructions');

/** Read available .md filenames directly from disk (no circular import) */
function availableNames(): string[] {
  try {
    return readdirSync(INSTRUCTIONS_DIR)
      .filter(f => f.endsWith('.md'))
      .map(f => f.replace(/\.md$/, ''));
  } catch {
    return [];
  }
}

const readInstruction: ToolSkill = {
  kind: 'tool',
  name: 'read_instruction',
  description:
    'Прочитать полный текст инструкции по имени. Вызови когда тебе нужна подробная информация из доступных инструкций (список инструкций указан в системном промпте).',
  parameters: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Имя инструкции (без .md)',
      },
    },
    required: ['name'],
  },

  async execute(args) {
    const name = String(args.name ?? '').trim();
    if (!name) return 'Не указано имя инструкции';

    const available = availableNames();
    if (!available.includes(name)) {
      return `Инструкция "${name}" не найдена. Доступные: ${available.join(', ')}`;
    }

    try {
      return readFileSync(join(INSTRUCTIONS_DIR, `${name}.md`), 'utf-8').trim();
    } catch {
      return `Ошибка чтения инструкции "${name}"`;
    }
  },
};

export default readInstruction;
