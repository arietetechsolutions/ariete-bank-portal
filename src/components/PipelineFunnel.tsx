import { cn, daysSince } from '@/lib/utils';
import {
  BankAccountRecord, BankAccountStatus, FUNNEL_STAGES, SETTLED_STATUSES,
  STAGE_SHORT_LABELS, STAGE_TONES, TERMINAL_STATUS,
} from '@/types/bankAccount';
import { TONE_BAR } from '@/components/StageChip';

/** Median rather than mean: one client abandoned in Onboarding for 300 days
 *  would drag a mean far enough to make the whole row useless. */
const median = (values: number[]): number | null => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid];
};

interface StageStat {
  status: BankAccountStatus;
  num: string;
  count: number;
  sharePct: number;
  barPct: number;
  medianDays: number | null;
}

export const buildFunnel = (accounts: BankAccountRecord[]) => {
  const total = accounts.length;

  const stageStats: StageStat[] = FUNNEL_STAGES.map((status, i) => {
    const inStage = accounts.filter((a) => a.status === status);
    const ages = inStage.map((a) => daysSince(a.status_changed_on)).filter((d): d is number => d !== null);
    return {
      status,
      num: String(i + 1).padStart(2, '0'),
      count: inStage.length,
      sharePct: total ? Math.round((inStage.length / total) * 100) : 0,
      barPct: 0, // filled in below, once the peak stage is known
      medianDays: SETTLED_STATUSES.includes(status) ? null : median(ages),
    };
  });

  // Bars are scaled to the busiest stage, not to the total. Against the total
  // a realistic pipeline renders as seven barely-visible slivers.
  const peak = Math.max(1, ...stageStats.map((s) => s.count));
  for (const s of stageStats) s.barPct = Math.round((s.count / peak) * 100);

  const lostCount = accounts.filter((a) => a.status === TERMINAL_STATUS).length;

  return {
    stageStats,
    lostCount,
    lostRatePct: total ? Math.round((lostCount / total) * 100) : 0,
  };
};

interface PipelineFunnelProps {
  accounts: BankAccountRecord[];
  statusFilter: BankAccountStatus | null;
  onSelect: (status: BankAccountStatus | null) => void;
}

const PipelineFunnel = ({ accounts, statusFilter, onSelect }: PipelineFunnelProps) => {
  const { stageStats, lostCount, lostRatePct } = buildFunnel(accounts);

  return (
    <div className="flex items-stretch gap-2">
      <div className="flex flex-1 items-stretch gap-2">
        {stageStats.map((s) => {
          const isActive = statusFilter === s.status;
          const isDormant = s.count === 0;
          const tone = STAGE_TONES[s.status];
          return (
            <button
              key={s.status}
              type="button"
              onClick={() => onSelect(isActive ? null : s.status)}
              aria-pressed={isActive}
              className={cn(
                'flex min-w-0 flex-1 flex-col gap-3 rounded-sm border bg-card p-3.5 text-left',
                // Hover lifts the surface a step (card -> raised) as well as the
                // border. The lit surface still clears 7.4:1 for the smallest
                // label sitting on it, so lighting up costs no legibility.
                'transition-colors duration-normal hover:bg-secondary',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                isActive ? 'border-primary/60 bg-secondary' : 'border-white/[0.07] hover:border-white/[0.22]',
                // A dormant stage recedes through its figure colour and empty
                // bar, NOT through opacity: dimming the whole card took its
                // 11px label from 7.6:1 to 2.8:1, which is unreadable.
                isDormant && !isActive && 'bg-card/60',
              )}
            >
              <div className="flex items-start gap-1.5">
                <span className="font-mono text-[11px] font-medium leading-[1.4] text-dim">{s.num}</span>
                <span className="min-h-[34px] text-[12px] leading-[1.4] text-muted-foreground">
                  {STAGE_SHORT_LABELS[s.status]}
                </span>
              </div>
              <div className="flex items-end gap-2">
                <span className={cn(
                  'font-mono text-[32px] leading-none',
                  isDormant ? 'text-dormant' : s.status === 'Investment executed' ? 'text-stage-ok' : 'text-foreground',
                )}>
                  {s.count}
                </span>
                <span className="pb-1 font-mono text-[12px] text-subtle">{s.sharePct}%</span>
              </div>
              <div className="h-1 overflow-hidden rounded-sm bg-white/[0.05]">
                <div className={cn('h-1 rounded-sm', TONE_BAR[tone])} style={{ width: `${s.barPct}%` }} />
              </div>
              <div className={cn(
                'font-mono text-[11.5px] font-medium',
                isDormant ? 'text-dormant'
                  : s.medianDays === null ? 'text-subtle'
                  : s.medianDays >= 15 ? 'text-stall-foreground'
                  : 'text-subtle',
              )}>
                {isDormant ? 'dormant'
                  : s.medianDays === null ? 'terminal'
                  : `median ${s.medianDays}d in stage`}
              </div>
            </button>
          );
        })}
      </div>

      {/* Lost sits off the flow, dashed and plum-grey: an exit, not a step.
          Muted on purpose - a lost client is a fact to record, not an alarm. */}
      <button
        type="button"
        onClick={() => onSelect(statusFilter === TERMINAL_STATUS ? null : TERMINAL_STATUS)}
        aria-pressed={statusFilter === TERMINAL_STATUS}
        className={cn(
          'flex w-[150px] flex-none flex-col gap-3 rounded-sm border border-dashed bg-background/60 p-3.5 text-left',
          'transition-colors duration-normal hover:bg-lost/[0.08]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          statusFilter === TERMINAL_STATUS ? 'border-lost bg-lost/[0.08]' : 'border-lost/45 hover:border-lost/80',
        )}
      >
        <div className="min-h-[34px] text-[12px] text-lost-foreground">Lost · terminal</div>
        <div className="font-mono text-[32px] leading-none text-lost-foreground">{lostCount}</div>
        <div className="font-mono text-[11.5px] font-medium text-subtle">{lostRatePct}% of all records</div>
      </button>
    </div>
  );
};

export default PipelineFunnel;
