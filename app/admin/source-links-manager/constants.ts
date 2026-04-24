import type { SourceLinkFormState } from './types';

export const emptyForm: SourceLinkFormState = {
  id: '',
  name: '',
  description: '',
  leftSourceId: '',
  leftJoinField: '',
  rightSourceId: '',
  rightJoinField: '',
  sharedPeriodEnabled: false,
  sharedPeriodLabel: '',
  sharedPeriodMode: 'single',
  sharedPeriodLeftFrom: '',
  sharedPeriodLeftTo: '',
  sharedPeriodRightFrom: '',
  sharedPeriodRightTo: '',
};

export const SHARED_PERIOD_MODE_OPTIONS = [
  {
    value: 'single',
    label: 'Одно поле (от — до по одному столбцу)',
  },
  {
    value: 'range',
    label: 'Два поля (начало ≥ от, конец ≤ до)',
  },
] as const;
