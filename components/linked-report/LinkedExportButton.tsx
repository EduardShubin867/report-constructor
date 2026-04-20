import { FileSpreadsheet } from 'lucide-react';

export function LinkedExportButton({
  loading,
  onClick,
}: {
  loading: boolean;
  onClick: () => void | Promise<void>;
}) {
  return (
    <button
      type="button"
      onClick={() => void onClick()}
      disabled={loading}
      className="ui-button-secondary flex w-full items-center justify-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-semibold active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
    >
      <FileSpreadsheet className="h-4 w-4 text-primary" strokeWidth={2.1} />
      {loading ? 'Экспорт…' : 'Excel'}
    </button>
  );
}
