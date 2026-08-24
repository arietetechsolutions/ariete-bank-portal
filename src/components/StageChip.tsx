import { cn } from '@/lib/utils';
import { BankAccountStatus, StageTone, STAGE_TONES } from '@/types/bankAccount';

// Tailwind needs literal class strings to compile, so tones map to fixed
// classes rather than being interpolated from the token name.
export const TONE_CHIP: Record<StageTone, string> = {
  neutral: 'bg-stage-neutral/[0.13] text-stage-neutral-fg',
  info: 'bg-stage-info/[0.13] text-stage-info-fg',
  gold: 'bg-stage-gold/[0.13] text-stage-gold-fg',
  ok: 'bg-stage-ok/[0.13] text-stage-ok-fg',
  // The lost tint is the darkest of the five, so its label needs a step
  // more lift than the token used elsewhere to clear 7:1.
  lost: 'bg-lost/[0.14] text-lost-chip',
};

export const TONE_BAR: Record<StageTone, string> = {
  neutral: 'bg-stage-neutral',
  info: 'bg-stage-info',
  gold: 'bg-stage-gold',
  ok: 'bg-stage-ok',
  lost: 'bg-lost',
};

export const toneFor = (status: BankAccountStatus | ''): StageTone =>
  status ? STAGE_TONES[status] : 'neutral';

/** The status as a tinted pill. Read-only - the dashboard's own cell wraps a
 *  Select in the same shape so staff can still change it. */
const StageChip = ({ status, className }: { status: BankAccountStatus | ''; className?: string }) => (
  <span
    className={cn(
      'inline-flex h-6 items-center whitespace-nowrap rounded-sm px-2.5 text-[12px]',
      status ? TONE_CHIP[STAGE_TONES[status]] : 'bg-muted text-subtle',
      className,
    )}
  >
    {status || '—'}
  </span>
);

export default StageChip;
