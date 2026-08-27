import { cn } from '@/lib/utils';
import { BankAccountStatus, StageTone, STAGE_TONES } from '@/types/bankAccount';

// Tailwind needs literal class strings to compile, so tones map to fixed
// classes rather than being interpolated from the token name.
export const TONE_CHIP: Record<StageTone, string> = {
  registered: 'bg-stage-registered/[0.13] text-stage-registered-fg',
  onboarding: 'bg-stage-onboarding/[0.13] text-stage-onboarding-fg',
  opened: 'bg-stage-opened/[0.13] text-stage-opened-fg',
  awaitingTransfer: 'bg-stage-awaiting-transfer/[0.13] text-stage-awaiting-transfer-fg',
  awaitingAml: 'bg-stage-awaiting-aml/[0.13] text-stage-awaiting-aml-fg',
  amlIssued: 'bg-stage-aml-issued/[0.13] text-stage-aml-issued-fg',
  executed: 'bg-stage-executed/[0.13] text-stage-executed-fg',
  // The lost tint is the darkest of the eight, so its label needs a step
  // more lift than the token used elsewhere to clear 7:1.
  lost: 'bg-lost/[0.14] text-lost-chip',
};

export const TONE_BAR: Record<StageTone, string> = {
  registered: 'bg-stage-registered',
  onboarding: 'bg-stage-onboarding',
  opened: 'bg-stage-opened',
  awaitingTransfer: 'bg-stage-awaiting-transfer',
  awaitingAml: 'bg-stage-awaiting-aml',
  amlIssued: 'bg-stage-aml-issued',
  executed: 'bg-stage-executed',
  lost: 'bg-lost',
};

export const toneFor = (status: BankAccountStatus | ''): StageTone =>
  status ? STAGE_TONES[status] : 'registered';

/** The status as a tinted pill. Read-only - the dashboard's own cell wraps a
 *  Select in the same shape so staff can still change it. */
const StageChip = ({ status, className }: { status: BankAccountStatus | ''; className?: string }) => (
  <span
    className={cn(
      'inline-flex h-6 items-center whitespace-nowrap rounded-full px-2.5 text-xs',
      status ? TONE_CHIP[STAGE_TONES[status]] : 'bg-muted text-subtle',
      className,
    )}
  >
    {status || '—'}
  </span>
);

export default StageChip;
