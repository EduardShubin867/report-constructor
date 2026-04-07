'use client';

import { Check } from 'lucide-react';
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
function OrbitalRing({ color }: { color: 'primary' | 'amber' }) {
  const stroke = color === 'primary' ? '#6b38d4' : '#f59e0b';
  const strokeFaded = color === 'primary' ? '#6b38d420' : '#f59e0b20';
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
    <motion.div
      className="flex h-4 w-4 items-center justify-center"
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      <Check className="h-4 w-4" strokeWidth={3} />
    </motion.div>
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

  const getConnectorState = (status: StepStatus) => {
    if (status === 'done') {
      return { width: '100%', className: 'bg-emerald-500' };
    }
    if (status === 'active') {
      return {
        width: '50%',
        className: isRetrying ? 'bg-amber-400' : 'bg-primary',
      };
    }
    return { width: '0%', className: 'bg-transparent' };
  };

  const ringColor = isRetrying ? 'amber' : 'primary';

  return (
    <div className="flex flex-col items-center gap-4 py-2">
      {/* Steps row */}
      <div className="flex w-full max-w-3xl items-center">
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
                    initial={false}
                    className={`
                      relative z-10 flex h-10 w-10 items-center justify-center rounded-full transition-colors duration-300
                      ${status === 'done'
                        ? 'bg-emerald-500 text-white'
                        : status === 'active'
                          ? isRetrying
                            ? 'bg-amber-500 text-white shadow-lg shadow-amber-200/40'
                            : 'bg-primary text-on-primary shadow-lg shadow-primary/30 ring-4 ring-primary-fixed'
                          : status === 'error'
                            ? 'bg-error text-on-error'
                            : 'bg-surface-container-highest text-on-surface-variant'
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
                    whitespace-nowrap text-[11px] font-semibold transition-colors duration-300
                    ${status === 'done'
                      ? 'text-emerald-600'
                      : status === 'active'
                        ? isRetrying ? 'text-amber-700' : 'text-primary'
                        : status === 'error'
                          ? 'text-error'
                          : 'text-on-surface-variant opacity-60'
                    }
                  `}
                >
                  {step.label}
                </span>
              </div>

              {/* Connector line */}
              {!isLast && (
                <div className="mx-2 mt-[-20px] flex-1">
                  <div className="relative h-0.5 overflow-hidden rounded-full bg-outline-variant/40">
                    <motion.div
                      initial={false}
                      className={`absolute inset-y-0 left-0 rounded-full ${getConnectorState(status).className}`}
                      animate={{ width: getConnectorState(status).width }}
                      transition={{ duration: 0.25, ease: 'easeOut' }}
                    />
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
          className={`text-xs font-medium ${isRetrying ? 'text-amber-600' : 'text-on-surface-variant'}`}
        >
          {detail}
        </motion.p>
      )}
    </div>
  );
}
