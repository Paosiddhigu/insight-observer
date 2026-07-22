import type { AppPhase } from '../types';

const STEPS: { phase: AppPhase; label: string }[] = [
  { phase: 'setup', label: 'Load Video' },
  { phase: 'watching', label: 'Watch' },
  { phase: 'evaluating', label: 'Analyze' },
  { phase: 'interviewing', label: 'Interview' },
  { phase: 'complete', label: 'Report' },
];

function phaseIndex(phase: AppPhase): number {
  if (phase === 'setup') return 0;
  if (phase === 'watching') return 1;
  if (phase === 'evaluating' || phase === 'interview-ready') return 2;
  if (phase === 'interviewing' || phase === 'synthesizing') return 3;
  return 4;
}

interface Props {
  phase: AppPhase;
}

export function StepIndicator({ phase }: Props) {
  const active = phaseIndex(phase);

  return (
    <nav className="step-indicator" aria-label="Progress">
      {STEPS.map((step, index) => (
        <div key={step.label} className={`step ${index <= active ? 'active' : ''} ${index === active ? 'current' : ''}`}>
          <span className="step-dot">{index + 1}</span>
          <span className="step-label">{step.label}</span>
        </div>
      ))}
    </nav>
  );
}
