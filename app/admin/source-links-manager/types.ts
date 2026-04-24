export type SourceOption = { id: string; name: string };

export type EditorState =
  | { open: false }
  | {
      open: true;
      initialId?: string;
    };

export type SourceLinkFormState = {
  id: string;
  name: string;
  description: string;
  leftSourceId: string;
  leftJoinField: string;
  rightSourceId: string;
  rightJoinField: string;
  sharedPeriodEnabled: boolean;
  sharedPeriodLabel: string;
  sharedPeriodMode: 'single' | 'range';
  sharedPeriodLeftFrom: string;
  sharedPeriodLeftTo: string;
  sharedPeriodRightFrom: string;
  sharedPeriodRightTo: string;
};
