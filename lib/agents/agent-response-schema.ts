import { z } from 'zod';

/**
 * Final JSON from sub-agents (sql-analyst, trend, claims, explain).
 * Either a non-empty SQL or a non-empty explanation (or both).
 */
export const agentResponseSchema = z
  .object({
    sql: z.string(),
    explanation: z.string(),
    suggestions: z.array(z.string()).default([]),
    canRetry: z.boolean().optional(),
  })
  .refine(
    d => d.sql.trim().length > 0 || d.explanation.trim().length > 0,
    { message: 'Нужен непустой sql и/или explanation' },
  );

export type AgentResponseOutput = z.infer<typeof agentResponseSchema>;

/**
 * Drop sentences that describe validator/SQL rewrites (CTE→subquery, "must start with SELECT").
 * Keeps user-facing sentences when the model mixes business summary + technical note.
 */
export function filterTechnicalExplanation(sql: string, explanation: string): string {
  const trimmed = explanation.trim();
  if (!trimmed || !sql.trim()) return trimmed;

  const technicalSentence = (s: string) =>
    /\b(CTE|WITH\s*\(|замен[её]н\w*\s+на\s+подзапрос|подзапрос\s+(?:в\s+FROM|во\s+FROM)|начинал(?:ся|ась|ись|ось)\s+с\s+SELECT|начина(?:ется|лся|ются)\s+с\s+SELECT|как\s+требует\s+систем|валидатор\b|автоматически\s+добавлен\w*\s+ограничени)/i.test(
      s,
    );

  const parts = trimmed.split(/(?<=[.!?…])\s+/);
  const kept = parts.map(s => s.trim()).filter(s => s.length > 0 && !technicalSentence(s));
  return kept.join(' ').trim();
}

/** Best-effort parse when structured output mode fails (legacy model text / markdown). */
export function tryParseAgentResponseFromText(content: string): AgentResponseOutput | null {
  const extractJson = (text: string): string | null => {
    try {
      JSON.parse(text);
      return text;
    } catch { /* noop */ }
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenced) {
      try {
        JSON.parse(fenced[1]);
        return fenced[1];
      } catch { /* noop */ }
    }
    const braces = text.match(/\{[\s\S]*\}/);
    if (braces) {
      try {
        JSON.parse(braces[0]);
        return braces[0];
      } catch { /* noop */ }
    }
    return null;
  };

  const jsonStr = extractJson(content);
  if (jsonStr) {
    try {
      const raw = JSON.parse(jsonStr) as Record<string, unknown>;
      const parsed = agentResponseSchema.safeParse({
        sql: typeof raw.sql === 'string' ? raw.sql : '',
        explanation: typeof raw.explanation === 'string' ? raw.explanation : '',
        suggestions: Array.isArray(raw.suggestions) ? raw.suggestions.map(String) : [],
        canRetry: typeof raw.canRetry === 'boolean' ? raw.canRetry : undefined,
      });
      if (parsed.success) return parsed.data;
    } catch { /* noop */ }
  }

  const trimmed = content.trim();
  if (trimmed.length > 20) {
    return { sql: '', explanation: trimmed, suggestions: [], canRetry: false };
  }
  return null;
}
