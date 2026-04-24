import { flexRender, type Row } from '@tanstack/react-table';
import { Fragment } from 'react';
import type { ReportColumn } from './types';
import { pluralRecords } from './utils';

export type ClientGroupSection = {
  sk: string;
  label: string;
  rows: Row<Record<string, unknown>>[];
};

type Props = {
  sections: ClientGroupSection[];
  displayColumnsLength: number;
  groupColumnMeta: ReportColumn | null;
  numericKeys: Set<string>;
};

export function UnifiedReportTableBodyClientGrouped({
  sections,
  displayColumnsLength,
  groupColumnMeta,
  numericKeys,
}: Props) {
  return (
    <>
      {sections.map(section => {
        const headerTitle = groupColumnMeta?.label ?? 'Значение связи';
        const headerValue = section.label.trim() === '' ? '(пусто)' : section.label;
        return (
          <Fragment key={section.sk}>
            <tr className="border-b border-[#e7e5e3] bg-[#eaf0f6]">
              <td colSpan={displayColumnsLength} className="px-3 py-1.5 text-[12px]">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span>
                    <span className="font-medium text-[#2b4560]">{headerTitle}</span>
                    <span className="ml-1.5 font-mono text-[#3a5a7a]">{headerValue}</span>
                  </span>
                  <span className="text-[#75726e]">
                    {section.rows.length.toLocaleString('ru-RU')} {pluralRecords(section.rows.length)}
                  </span>
                </div>
              </td>
            </tr>
            {section.rows.map(row => (
              <tr key={row.id} className="border-b border-[#e7e5e3] hover:bg-[#f5f5f4]">
                {row.getVisibleCells().map(cell => (
                  <td
                    key={cell.id}
                    className={`whitespace-nowrap px-3 py-1.5 text-[12px] text-[#1c1b1a] ${
                      numericKeys.has(cell.column.id) ? 'text-right font-mono tabular-nums' : ''
                    }`}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </Fragment>
        );
      })}
    </>
  );
}
