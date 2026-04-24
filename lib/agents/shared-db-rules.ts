import { buildAnalysisContextSummary } from '@/lib/analysis-context';
import type { AnalysisContext } from '@/lib/report-history-types';

export function isTerritoryScopedQuery(query: string): boolean {
  return /(город|регион|территор|санкт|петербург|спб|москв)/i.test(query);
}

export function getCriticalDatabaseRulesSection(): string {
  return `## Критичные правила работы с базой

1. **НЕ УГАДЫВАЙ значения.** Если пользователь упоминает ДГ, город, агента, территорию, регион или другое конкретное справочное значение — сначала проверь его через инструмент.
2. **Сначала lookup, потом SQL.** Не подставляй в SQL значения пользователя напрямую, если их можно уточнить через инструмент.
3. Если запрос про город, регион, территорию использования ТС или формулировку вида «по Санкт-Петербургу», «по Москве», «по территориям в регионе» — сначала вызови \`lookup_territory\`.
4. Для территориальных запросов используй \`LEFT JOIN [dbo].[Территории] AS ter ON m.[ID_ТерриторияИспользованияТС] = ter.[ID]\` и фильтруй по \`ter.[ID]\`, \`ter.[Наименование]\`, \`ter.[Регион]\`, \`ter.[ТипТерритории]\`.
5. Не подменяй территориальный фильтр прямым условием по \`m.[Регион]\` или \`m.[РегионФакт]\`, если пользователь спрашивает именно про город или территорию использования ТС.
6. Справочники вызывай ПАРАЛЛЕЛЬНО в одном раунде, если нужно несколько значений.
7. \`validate_query\` вызывай только с ГОТОВЫМ SQL, не для разведки и не для промежуточных черновиков.`;
}

export function getTerritoryScopedUserMessageNote(query: string): string {
  if (!isTerritoryScopedQuery(query)) return '';

  return '\n\nВажно: это территориальный запрос. Сначала вызови lookup_territory и фильтруй через JOIN [dbo].[Территории] AS ter ON m.[ID_ТерриторияИспользованияТС] = ter.[ID]. Не фильтруй по m.[Регион] или m.[РегионФакт] напрямую.';
}

export function getAnalysisContextSection(context: AnalysisContext | undefined): string {
  const summary = buildAnalysisContextSummary(context);
  if (!summary) return '';

  return `${summary}

Правила использования контекста:
1. Не считай контекст новым фильтром, если пользователь явно задаёт другие условия.
2. Для коротких follow-up запросов сохраняй предыдущие ДГ/территорию/период/разрез.
3. Если используешь значения из контекста в SQL, всё равно соблюдай правила lookup/валидации выше.`;
}
