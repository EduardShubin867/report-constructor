/**
 * Formats a single-line SQL string into a multi-line readable form.
 * Adds newlines before major clause keywords, splits long SELECT lists,
 * and indents AND/OR.
 */
export function formatSql(sql: string): string {
  // Normalize whitespace
  let s = sql.replace(/\s+/g, ' ').trim();

  // Clause keywords that start a new line (longer patterns first)
  const clauses = [
    'LEFT OUTER JOIN',
    'RIGHT OUTER JOIN',
    'FULL OUTER JOIN',
    'LEFT JOIN',
    'RIGHT JOIN',
    'INNER JOIN',
    'FULL JOIN',
    'CROSS JOIN',
    'GROUP BY',
    'ORDER BY',
    'UNION ALL',
    'FROM',
    'JOIN',
    'WHERE',
    'HAVING',
    'UNION',
  ];

  for (const kw of clauses) {
    const pat = kw.replace(/\s+/g, '\\s+');
    s = s.replace(
      new RegExp(`([^\\n]) +(${pat}) +`, 'gi'),
      (_, pre, matched) => `${pre}\n${matched.replace(/\s+/g, ' ')} `,
    );
  }

  // Indent AND / OR within WHERE / HAVING / ON
  s = s.replace(/ +(AND|OR) +/gi, '\n  $1 ');

  // Split long SELECT column lists: put each column on its own line
  // Match the SELECT ... FROM block and split by commas
  s = s.replace(/^(SELECT(?:\s+TOP\s+\d+)?(?:\s+DISTINCT)?)\s+(.+?)\n(FROM\b)/i, (_, sel, cols, from) => {
    const parts = splitColumns(cols);
    if (parts.length <= 2) return `${sel} ${cols}\n${from}`;
    return `${sel}\n  ${parts.join(',\n  ')}\n${from}`;
  });

  return s;
}

/**
 * Split a SELECT column list by top-level commas (not inside parentheses).
 */
function splitColumns(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';

  for (const ch of text) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if (ch === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}
