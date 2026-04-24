import type { StepStatus } from '../AgentStepper';
import { buildStepStatuses, EXECUTION_STEP_INDEX, FINAL_STEP_INDEX } from './stepper-steps';
import type { Phase } from './types';

export type RunState = {
  phase: Phase;
  lastSql: string | null;
  explanation: string | null;
  suggestions: string[];
  skillRounds: number;
  error: string | null;
  activeStep: number;
  stepStatuses: StepStatus[];
  stepDetail: string;
  isRetrying: boolean;
};

export type RunAction =
  | { type: 'CLEAR_ERROR' }
  | { type: 'CLEAR_RESULT' }
  | { type: 'START' }
  | { type: 'START_RETRY'; step: number; detail: string }
  | { type: 'SET_STEP'; step: number; detail: string }
  | { type: 'SET_SQL'; sql: string | null; suggestions: string[]; skillRounds: number }
  | { type: 'VALIDATING' }
  | { type: 'SELF_CHECKING' }
  | { type: 'DONE'; explanation: string | null }
  | { type: 'ERROR'; message: string }
  | { type: 'ABORT' }
  | { type: 'SYNC_VERSION'; sql: string | null; explanation: string | null; skillRounds: number };

export const initialRunState: RunState = {
  phase: 'idle',
  lastSql: null,
  explanation: null,
  suggestions: [],
  skillRounds: 0,
  error: null,
  activeStep: 0,
  stepStatuses: buildStepStatuses(0),
  stepDetail: '',
  isRetrying: false,
};

export function runReducer(state: RunState, action: RunAction): RunState {
  switch (action.type) {
    case 'CLEAR_ERROR':
      return { ...state, error: null };
    case 'CLEAR_RESULT':
      return { ...state, lastSql: null, explanation: null, suggestions: [] };
    case 'START':
      return {
        ...state,
        phase: 'thinking',
        isRetrying: false,
        activeStep: 0,
        stepStatuses: buildStepStatuses(0),
        stepDetail: 'Анализирую ваш запрос…',
      };
    case 'START_RETRY':
      return {
        ...state,
        phase: 'retrying',
        isRetrying: true,
        activeStep: action.step,
        stepStatuses: buildStepStatuses(action.step),
        stepDetail: action.detail,
      };
    case 'SET_STEP':
      return {
        ...state,
        activeStep: action.step,
        stepStatuses: buildStepStatuses(action.step),
        stepDetail: action.detail,
      };
    case 'SET_SQL':
      return {
        ...state,
        lastSql: action.sql,
        suggestions: action.suggestions,
        skillRounds: action.skillRounds,
      };
    case 'VALIDATING':
      return {
        ...state,
        phase: 'validating',
        activeStep: EXECUTION_STEP_INDEX,
        stepStatuses: buildStepStatuses(EXECUTION_STEP_INDEX),
        stepDetail: 'Выполняю запрос к базе данных…',
      };
    case 'SELF_CHECKING':
      return { ...state, phase: 'self-checking' };
    case 'DONE':
      return {
        ...state,
        phase: 'done',
        isRetrying: false,
        explanation: action.explanation,
        activeStep: FINAL_STEP_INDEX,
        stepStatuses: buildStepStatuses(FINAL_STEP_INDEX),
        stepDetail: '',
      };
    case 'ERROR':
      return { ...state, phase: 'error', isRetrying: false, error: action.message };
    case 'ABORT':
      return {
        ...state,
        phase: 'idle',
        isRetrying: false,
        error: null,
        activeStep: 0,
        stepStatuses: buildStepStatuses(0),
        stepDetail: '',
      };
    case 'SYNC_VERSION':
      return {
        ...state,
        phase: 'done',
        isRetrying: false,
        lastSql: action.sql,
        explanation: action.explanation,
        suggestions: [],
        skillRounds: action.skillRounds,
        error: null,
        activeStep: FINAL_STEP_INDEX,
        stepStatuses: buildStepStatuses(FINAL_STEP_INDEX),
        stepDetail: '',
      };
    default:
      return state;
  }
}
