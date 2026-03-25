'use client';

import { useMemo } from 'react';
import { formatSql } from '@/lib/sql-format';

type TokenType = 'keyword' | 'identifier' | 'string' | 'number' | 'comment' | 'space' | 'other';

interface Token {
  type: TokenType;
  value: string;
}

const KEYWORDS = new Set(
  [
    'SELECT', 'TOP', 'DISTINCT', 'FROM', 'WHERE', 'AND', 'OR', 'NOT', 'IN', 'IS', 'NULL',
    'LIKE', 'BETWEEN', 'GROUP', 'BY', 'ORDER', 'HAVING', 'LEFT', 'RIGHT', 'INNER', 'FULL',
    'OUTER', 'CROSS', 'JOIN', 'ON', 'AS', 'UNION', 'ALL', 'WITH', 'CASE', 'WHEN', 'THEN',
    'ELSE', 'END', 'ASC', 'DESC', 'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'CAST', 'CONVERT',
    'DATEADD', 'DATEDIFF', 'YEAR', 'MONTH', 'DAY', 'DATEFROMPARTS', 'GETDATE', 'ISNULL',
    'COALESCE', 'IIF', 'INTO', 'VALUES', 'EXISTS', 'OVER', 'PARTITION', 'ROWS', 'RANGE',
    'PRECEDING', 'FOLLOWING', 'UNBOUNDED', 'CURRENT', 'ROW', 'NTILE', 'RANK', 'DENSE_RANK',
    'ROW_NUMBER', 'LAG', 'LEAD', 'FIRST_VALUE', 'LAST_VALUE',
  ].map(k => k.toUpperCase()),
);

function tokenize(sql: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < sql.length) {
    const ch = sql[i];

    // Line comments
    if (ch === '-' && sql[i + 1] === '-') {
      let j = i;
      while (j < sql.length && sql[j] !== '\n') j++;
      tokens.push({ type: 'comment', value: sql.slice(i, j) });
      i = j;
      continue;
    }

    // String literals 'text'
    if (ch === "'") {
      let j = i + 1;
      while (j < sql.length) {
        if (sql[j] === "'" && sql[j + 1] === "'") { j += 2; continue; } // escaped quote
        if (sql[j] === "'") { j++; break; }
        j++;
      }
      tokens.push({ type: 'string', value: sql.slice(i, j) });
      i = j;
      continue;
    }

    // Bracket identifiers [...]
    if (ch === '[') {
      let j = i + 1;
      while (j < sql.length && sql[j] !== ']') j++;
      j++;
      tokens.push({ type: 'identifier', value: sql.slice(i, j) });
      i = j;
      continue;
    }

    // Numbers
    if (/\d/.test(ch)) {
      let j = i;
      while (j < sql.length && /[\d.]/.test(sql[j])) j++;
      tokens.push({ type: 'number', value: sql.slice(i, j) });
      i = j;
      continue;
    }

    // Whitespace (preserve newlines for formatting)
    if (/\s/.test(ch)) {
      let j = i;
      while (j < sql.length && /\s/.test(sql[j])) j++;
      tokens.push({ type: 'space', value: sql.slice(i, j) });
      i = j;
      continue;
    }

    // Words: keywords or plain identifiers
    if (/[a-zA-Z_\u0400-\u04FF]/.test(ch)) {
      let j = i;
      while (j < sql.length && /[a-zA-Z0-9_\u0400-\u04FF]/.test(sql[j])) j++;
      const word = sql.slice(i, j);
      tokens.push({
        type: KEYWORDS.has(word.toUpperCase()) ? 'keyword' : 'other',
        value: word,
      });
      i = j;
      continue;
    }

    tokens.push({ type: 'other', value: ch });
    i++;
  }

  return tokens;
}

const TOKEN_CLASS: Record<TokenType, string> = {
  keyword:    'text-blue-400 font-semibold',
  identifier: 'text-yellow-300',
  string:     'text-emerald-400',
  number:     'text-orange-400',
  comment:    'text-gray-500 italic',
  space:      '',
  other:      'text-gray-300',
};

interface SqlHighlightProps {
  sql: string;
  format?: boolean;  // auto-format to multiline (default true)
}

export default function SqlHighlight({ sql, format = true }: SqlHighlightProps) {
  const tokens = useMemo(() => tokenize(format ? formatSql(sql) : sql), [sql, format]);

  return (
    <pre className="p-3 bg-gray-950 border border-gray-800 rounded-lg text-xs leading-relaxed font-mono whitespace-pre-wrap break-words">
      {tokens.map((t, i) =>
        t.type === 'space'
          ? <span key={i}>{t.value}</span>
          : <span key={i} className={TOKEN_CLASS[t.type]}>{t.value}</span>,
      )}
    </pre>
  );
}
