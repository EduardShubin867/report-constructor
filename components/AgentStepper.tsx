'use client';

import { motion } from 'framer-motion';

export interface StepperStep {
  label: string;
  icon: React.ReactNode;
}

export type StepStatus = 'pending' | 'active' | 'done' | 'error';

interface AgentStepperProps {
  steps: StepperStep[];
  activeStep: number;
  statuses?: StepStatus[];
  detail?: string;
  isRetrying?: boolean;
}

/* ── Animated orbital ring (SVG arc that spins around the node) ── */
function OrbitalRing({ color }: { color: 'purple' | 'amber' }) {
  const stroke = color === 'purple' ? '#a855f7' : '#f59e0b';
  const strokeFaded = color === 'purple' ? '#a855f720' : '#f59e0b20';
  return (
    <motion.svg
      className="absolute -inset-1.5 w-[calc(100%+12px)] h-[calc(100%+12px)]"
      viewBox="0 0 48 48"
      animate={{ rotate: 360 }}
      transition={{ duration: 2.4, repeat: Infinity, ease: 'linear' }}
    >
      {/* Track */}
      <circle cx="24" cy="24" r="22" fill="none" stroke={strokeFaded} strokeWidth="2" />
      {/* Arc — 90° segment */}
      <circle
        cx="24" cy="24" r="22"
        fill="none"
        stroke={stroke}
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="35 103"
      />
    </motion.svg>
  );
}

/* ── Checkmark with draw-in animation ───────────────────────── */
function AnimatedCheck() {
  return (
    <motion.svg
      className="w-4 h-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <motion.path
        d="M5 13l4 4L19 7"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
      />
    </motion.svg>
  );
}

export default function AgentStepper({
  steps,
  activeStep,
  statuses,
  detail,
  isRetrying,
}: AgentStepperProps) {
  const getStatus = (idx: number): StepStatus => {
    if (statuses?.[idx]) return statuses[idx];
    if (idx < activeStep) return 'done';
    if (idx === activeStep) return 'active';
    return 'pending';
  };

  const ringColor = isRetrying ? 'amber' : 'purple';

  return (
    <div className="flex flex-col items-center gap-3 py-4">
      {/* Steps row */}
      <div className="flex items-center w-full max-w-xl">
        {steps.map((step, idx) => {
          const status = getStatus(idx);
          const isLast = idx === steps.length - 1;

          return (
            <div key={idx} className="flex items-center flex-1 last:flex-none">
              {/* Step node */}
              <div className="flex flex-col items-center gap-1.5 relative">
                <div className="relative">
                  {/* Orbital ring for active */}
                  {status === 'active' && <OrbitalRing color={ringColor} />}

                  {/* Circle */}
                  <motion.div
                    className={`
                      relative z-10 w-9 h-9 rounded-full flex items-center justify-center transition-colors duration-300
                      ${status === 'done'
                        ? 'bg-emerald-500 text-white'
                        : status === 'active'
                          ? isRetrying
                            ? 'bg-amber-500 text-white shadow-lg shadow-amber-200/50'
                            : 'bg-purple-600 text-white shadow-lg shadow-purple-200/50'
                          : status === 'error'
                            ? 'bg-red-500 text-white'
                            : 'bg-gray-100 text-gray-400 border border-gray-200'
                      }
                    `}
                    /* Subtle breathing scale on active icon */
                    animate={status === 'active' ? { scale: [1, 1.08, 1] } : { scale: 1 }}
                    transition={status === 'active' ? { duration: 2, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.3 }}
                  >
                    {status === 'done' ? (
                      <AnimatedCheck />
                    ) : (
                      <div className="w-4 h-4">{step.icon}</div>
                    )}
                  </motion.div>
                </div>

                {/* Label */}
                <span
                  className={`
                    text-[11px] font-medium whitespace-nowrap transition-colors duration-300
                    ${status === 'done'
                      ? 'text-emerald-600'
                      : status === 'active'
                        ? isRetrying ? 'text-amber-700' : 'text-purple-700'
                        : status === 'error'
                          ? 'text-red-600'
                          : 'text-gray-400'
                    }
                  `}
                >
                  {step.label}
                </span>
              </div>

              {/* Connector line */}
              {!isLast && (
                <div className="flex-1 mx-2 mt-[-18px]">
                  <div className="h-0.5 bg-gray-200 rounded-full overflow-hidden relative">
                    {idx < activeStep && (
                      <motion.div
                        className="absolute inset-0 bg-emerald-400 rounded-full"
                        initial={{ width: '0%' }}
                        animate={{ width: '100%' }}
                        transition={{ duration: 0.4, ease: 'easeOut' }}
                      />
                    )}
                    {idx === activeStep && (
                      <motion.div
                        className={`absolute inset-y-0 left-0 rounded-full ${isRetrying ? 'bg-amber-400' : 'bg-purple-400'}`}
                        initial={{ width: '0%' }}
                        animate={{ width: '50%' }}
                        transition={{ duration: 0.6, ease: 'easeOut' }}
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Detail text */}
      {detail && (
        <motion.p
          key={detail}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className={`text-xs font-medium ${isRetrying ? 'text-amber-600' : 'text-gray-500'}`}
        >
          {detail}
        </motion.p>
      )}
    </div>
  );
}
