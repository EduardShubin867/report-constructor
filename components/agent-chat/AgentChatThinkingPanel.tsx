import type { ReactNode } from 'react';
import { LoaderCircle } from 'lucide-react';
import AgentStepper, { type StepStatus } from '@/components/AgentStepper';

type StepperStep = { label: string; icon: ReactNode };

type Props = {
  steps: StepperStep[];
  activeStep: number;
  statuses: StepStatus[];
  detail: string;
  isRetrying: boolean;
};

export default function AgentChatThinkingPanel({
  steps,
  activeStep,
  statuses,
  detail,
  isRetrying,
}: Props) {
  return (
    <div className="flex justify-start">
      <div className="ui-panel w-full max-w-none rounded-[28px] px-5 py-4 sm:px-6">
        <div className="mb-4 flex items-center gap-2">
          <span className="ui-chip-accent inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]">
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" strokeWidth={2.1} />
            Ассистент думает
          </span>
        </div>
        <AgentStepper
          steps={steps}
          activeStep={activeStep}
          statuses={statuses}
          detail={detail}
          isRetrying={isRetrying}
        />
      </div>
    </div>
  );
}
