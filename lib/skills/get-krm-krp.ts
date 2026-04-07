import { z } from 'zod';
import { getPool, queryWithTimeout, TIMEOUT } from '../db';
import type { ToolSkill } from './types';

const getKrmKrp: ToolSkill = {
  kind: 'tool',
  name: 'get_krm_krp_values',
  description:
    'Получить все возможные значения КРМ и КРП из справочников. Используй когда пользователь упоминает конкретные КРМ/КРП значения.',
  inputSchema: z.object({}) as z.ZodType<Record<string, unknown>>,

  async execute() {
    const pool = await getPool();
    const t = TIMEOUT.SKILL;
    const krm = await queryWithTimeout(pool.request(), 'SELECT ID, КРМ FROM [dbo].[КРМ] ORDER BY КРМ', t);
    const krp = await queryWithTimeout(pool.request(), 'SELECT ID, КРП FROM [dbo].[КРП] ORDER BY КРП ', t);
    return JSON.stringify({ КРМ: krm.recordset, КРП: krp.recordset }, null, 2);
  },
};

export default getKrmKrp;
