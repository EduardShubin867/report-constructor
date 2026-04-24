export const MAX_RETRIES = 2;

/* Human-readable labels for agent skills */
export const SKILL_LABELS: Record<string, string> = {
  lookup_dg: 'Поиск ДГ',
  lookup_territory: 'Поиск территории',
  list_column_values: 'Просмотр значений',
  get_krm_krp_values: 'Загрузка КРМ/КРП',
  validate_query: 'Проверка запроса',
  read_instruction: 'Чтение инструкции',
};

/* Detail messages for skills (user-friendly) */
export const SKILL_DETAILS: Record<string, (args: Record<string, unknown>) => string> = {
  lookup_dg: (a) => `Ищу ДГ${a.query ? `: ${String(a.query).slice(0, 40)}` : ''}`,
  lookup_territory: (a) => `Ищу территорию${(a.search ?? a.query) ? `: ${String(a.search ?? a.query).slice(0, 40)}` : ''}`,
  list_column_values: (a) => `Просматриваю значения${a.column ? ` «${a.column}»` : ''}`,
  get_krm_krp_values: () => 'Загружаю справочники КРМ/КРП',
  validate_query: () => 'Проверяю корректность запроса',
  read_instruction: (a) => `Читаю инструкцию${a.name ? `: ${a.name}` : ''}`,
};

/* Skills that map to step 1 (Уточнение) — i.e. data gathering tools */
export const DATA_SKILLS = new Set(['lookup_dg', 'lookup_territory', 'list_column_values', 'get_krm_krp_values', 'read_instruction']);
