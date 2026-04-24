import type { FiltersMap, Side } from './types';

export type ConfigState = {
  leftColumns: string[];
  rightColumns: string[];
  leftFilters: FiltersMap;
  rightFilters: FiltersMap;
  sharedPeriod: { from: string; to: string };
  aggregateByColumnKey: string;
  raiseMergedRowLimit: boolean;
  raiseSourceRowLimit: boolean;
  fullyUnlimitedRows: boolean;
  lazyOptions: Record<Side, Record<string, string[]>>;
  lazyLoading: Record<Side, Record<string, boolean>>;
};

export type ConfigAction =
  | { type: 'RESET'; leftColumns: string[]; rightColumns: string[] }
  | { type: 'SET_LEFT_COLUMNS'; columns: string[] }
  | { type: 'SET_RIGHT_COLUMNS'; columns: string[] }
  | { type: 'SET_LEFT_FILTERS'; filters: FiltersMap }
  | { type: 'SET_RIGHT_FILTERS'; filters: FiltersMap }
  | { type: 'SET_SHARED_PERIOD'; period: { from: string; to: string } }
  | { type: 'SET_AGGREGATE_KEY'; key: string }
  | { type: 'SET_RAISE_MERGED'; value: boolean }
  | { type: 'SET_RAISE_SOURCE'; value: boolean }
  | { type: 'SET_FULLY_UNLIMITED'; value: boolean }
  | { type: 'LAZY_START'; side: Side; key: string }
  | { type: 'LAZY_DONE'; side: Side; key: string; values: string[] }
  | { type: 'LAZY_FAIL'; side: Side; key: string };

export function makeInitialConfig(leftColumns: string[], rightColumns: string[]): ConfigState {
  return {
    leftColumns,
    rightColumns,
    leftFilters: {},
    rightFilters: {},
    sharedPeriod: { from: '', to: '' },
    aggregateByColumnKey: '',
    raiseMergedRowLimit: false,
    raiseSourceRowLimit: false,
    fullyUnlimitedRows: false,
    lazyOptions: { left: {}, right: {} },
    lazyLoading: { left: {}, right: {} },
  };
}

export function configReducer(state: ConfigState, action: ConfigAction): ConfigState {
  switch (action.type) {
    case 'RESET':
      return makeInitialConfig(action.leftColumns, action.rightColumns);
    case 'SET_LEFT_COLUMNS':
      return { ...state, leftColumns: action.columns };
    case 'SET_RIGHT_COLUMNS':
      return { ...state, rightColumns: action.columns };
    case 'SET_LEFT_FILTERS':
      return { ...state, leftFilters: action.filters };
    case 'SET_RIGHT_FILTERS':
      return { ...state, rightFilters: action.filters };
    case 'SET_SHARED_PERIOD':
      return { ...state, sharedPeriod: action.period };
    case 'SET_AGGREGATE_KEY':
      return { ...state, aggregateByColumnKey: action.key };
    case 'SET_RAISE_MERGED':
      return { ...state, raiseMergedRowLimit: action.value };
    case 'SET_RAISE_SOURCE':
      return { ...state, raiseSourceRowLimit: action.value };
    case 'SET_FULLY_UNLIMITED':
      return { ...state, fullyUnlimitedRows: action.value };
    case 'LAZY_START':
      return {
        ...state,
        lazyLoading: {
          ...state.lazyLoading,
          [action.side]: { ...state.lazyLoading[action.side], [action.key]: true },
        },
      };
    case 'LAZY_DONE':
      return {
        ...state,
        lazyOptions: {
          ...state.lazyOptions,
          [action.side]: { ...state.lazyOptions[action.side], [action.key]: action.values },
        },
        lazyLoading: {
          ...state.lazyLoading,
          [action.side]: { ...state.lazyLoading[action.side], [action.key]: false },
        },
      };
    case 'LAZY_FAIL':
      return {
        ...state,
        lazyLoading: {
          ...state.lazyLoading,
          [action.side]: { ...state.lazyLoading[action.side], [action.key]: false },
        },
      };
    default:
      return state;
  }
}
