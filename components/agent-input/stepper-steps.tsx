import { Braces, CircleCheckBig, Search, Sparkles, Zap } from 'lucide-react';
import type { StepStatus } from '../AgentStepper';

export const stepIconProps = { className: 'h-4 w-4', strokeWidth: 2 } as const;

/* ── Stepper step definitions ──────────────────────────────────── */
export const STEPPER_STEPS = [
  {
    label: 'Анализ',
    icon: <Sparkles {...stepIconProps} />,
  },
  {
    label: 'Уточнение',
    icon: <Search {...stepIconProps} />,
  },
  {
    label: 'Построение',
    icon: <Braces {...stepIconProps} />,
  },
  {
    label: 'Выполнение',
    icon: <Zap {...stepIconProps} />,
  },
  {
    label: 'Готово',
    icon: <CircleCheckBig {...stepIconProps} />,
  },
];

export const BUILD_STEP_INDEX = 2;
export const EXECUTION_STEP_INDEX = 3;
export const FINAL_STEP_INDEX = STEPPER_STEPS.length - 1;

export function buildStepStatuses(activeIndex: number): StepStatus[] {
  return STEPPER_STEPS.map((_, idx) => {
    if (idx < activeIndex) return 'done';
    if (idx === activeIndex) return 'active';
    return 'pending';
  });
}
