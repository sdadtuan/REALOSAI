type Step = {
  id: string;
  label: string;
  status: 'done' | 'current' | 'pending';
};

type WinWizardStepsProps = {
  steps: Step[];
  onStepClick?: (id: string) => void;
};

export function WinWizardSteps({ steps, onStepClick }: WinWizardStepsProps) {
  return (
    <ol className="win-wizard-steps" aria-label="Tiến trình wizard">
      {steps.map((step, index) => (
        <li
          key={step.id}
          className={`win-wizard-steps__item win-wizard-steps__item--${step.status}`}
        >
          <button
            type="button"
            className="win-wizard-steps__btn"
            disabled={step.status === 'pending' || !onStepClick}
            onClick={() => onStepClick?.(step.id)}
          >
            <span className="win-wizard-steps__index">{index + 1}</span>
            <span className="win-wizard-steps__label">{step.label}</span>
          </button>
        </li>
      ))}
    </ol>
  );
}
