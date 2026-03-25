import { getPool } from '../db';
import type { ToolSkill } from './types';

const getKrmKrp: ToolSkill = {
  kind: 'tool',
  name: 'get_krm_krp_values',
  description:
    'Получить все возможные значения КРМ и КРП из справочников. Используй когда пользователь упоминает конкретные КРМ/КРП значения.',
  parameters: {
    type: 'object',
    properties: {},
  },

  async execute() {
    const pool = await getPool();
    const krm = await pool.request().query('SELECT ID, КРМ FROM [dbo].[КРМ] ORDER BY КРМ');
    const krp = await pool.request().query('SELECT ID, КРП FROM [dbo].[КРП] ORDER BY КРП ');
    return JSON.stringify({ КРМ: krm.recordset, КРП: krp.recordset }, null, 2);
  },
};

export default getKrmKrp;
