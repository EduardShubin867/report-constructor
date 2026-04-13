export const MAX_RETRIES = 2;

export const DATA_SKILLS = new Set([
  'lookup_dg',
  'lookup_territory',
  'list_column_values',
  'get_krm_krp_values',
  'read_instruction',
]);

export const SKILL_LABELS: Record<string, string> = {
  lookup_dg: 'Поиск ДГ',
  lookup_territory: 'Поиск территории',
  list_column_values: 'Просмотр значений',
  get_krm_krp_values: 'Загрузка КРМ/КРП',
  validate_query: 'Проверка запроса',
  read_instruction: 'Чтение инструкции',
};

export const SKILL_DETAILS: Record<string, (args: Record<string, unknown>) => string> = {
  lookup_dg: args => `Ищу ДГ${args.query ? `: ${String(args.query).slice(0, 40)}` : ''}`,
  lookup_territory: args =>
    `Ищу территорию${(args.search ?? args.query) ? `: ${String(args.search ?? args.query).slice(0, 40)}` : ''}`,
  list_column_values: args => `Просматриваю значения${args.column ? ` «${args.column}»` : ''}`,
  get_krm_krp_values: () => 'Загружаю справочники КРМ/КРП',
  validate_query: () => 'Проверяю корректность запроса',
  read_instruction: args => `Читаю инструкцию${args.name ? `: ${args.name}` : ''}`,
};
