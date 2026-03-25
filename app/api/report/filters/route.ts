import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const pool = await getPool();

    const [агенты, регионы, видыДоговора, территории, дг, крм, крп] = await Promise.all([
      pool.request().query<{ Агент: string }>(
        'SELECT DISTINCT Агент FROM [dbo].[Журнал_ОСАГО_Маржа] WHERE Агент IS NOT NULL ORDER BY Агент'
      ),
      pool.request().query<{ Регион: string }>(
        'SELECT DISTINCT Регион FROM [dbo].[Журнал_ОСАГО_Маржа] WHERE Регион IS NOT NULL ORDER BY Регион'
      ),
      pool.request().query<{ ВидДоговора: string }>(
        'SELECT DISTINCT ВидДоговора FROM [dbo].[Журнал_ОСАГО_Маржа] WHERE ВидДоговора IS NOT NULL ORDER BY ВидДоговора'
      ),
      pool.request().query<{ Наименование: string }>(
        'SELECT DISTINCT Наименование FROM [dbo].[Территории] WHERE Наименование IS NOT NULL AND ПометкаУдаления = 0 ORDER BY Наименование'
      ),
      pool.request().query<{ Наименование: string }>(
        'SELECT DISTINCT Наименование FROM [dbo].[ДГ] WHERE Наименование IS NOT NULL ORDER BY Наименование'
      ),
      pool.request().query<{ КРМ: number }>(
        'SELECT DISTINCT КРМ FROM [dbo].[КРМ] ORDER BY КРМ'
      ),
      pool.request().query<{ КРП: number }>(
        'SELECT DISTINCT КРП FROM [dbo].[КРП] ORDER BY КРП'
      ),
    ]);

    return NextResponse.json({
      агенты: агенты.recordset.map(r => r.Агент),
      регионы: регионы.recordset.map(r => r.Регион),
      видыДоговора: видыДоговора.recordset.map(r => r.ВидДоговора),
      территории: территории.recordset.map(r => r.Наименование),
      дг: дг.recordset.map(r => r.Наименование),
      крм: крм.recordset.map(r => String(r.КРМ)),
      крп: крп.recordset.map(r => String(r.КРП)),
    });
  } catch (err) {
    console.error('Filters error:', err);
    return NextResponse.json({ error: 'Ошибка получения фильтров' }, { status: 500 });
  }
}
