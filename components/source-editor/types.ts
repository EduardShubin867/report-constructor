import type { DataSource, StoredConnection } from '@/lib/schema/types';

export type SourceEditorPhase = 'idle' | 'introspecting' | 'review' | 'saving' | 'saved';

export type ColumnFilterTier = 'off' | 'primary' | 'secondary';

export type ForeignKeyGroupPreset = 'all' | 'none';

export interface SourceEditorFormData {
  id: string;
  name: string;
  database: string;
  schema: string;
  whenToUse: string;
  tables: string;
  connectionId: string;
}

export type SourceEditorField = keyof SourceEditorFormData;

export interface SourceEditorProps {
  connections: StoredConnection[];
  initial?: DataSource;
  onSaved?: (source: DataSource) => void;
}
