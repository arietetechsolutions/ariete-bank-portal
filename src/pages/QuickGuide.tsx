import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import StageChip from '@/components/StageChip';
import {
  BankAccountStatus, FUNNEL_STAGES, STAGE_TONES, STALLED_AFTER_DAYS,
  StageTone, TERMINAL_STATUS,
} from '@/types/bankAccount';

/* Four steps, one per thing a bank has to do, each with a drawing of the
   screen it happens on. Written for a member of bank staff who has been given
   a login and nothing else: formal register throughout, no jargon, and no
   mention of how any of it is wired up.

   Every stage line ends in the action required of the bank, and the four
   stages that require nothing say so once, in the same form - the earlier
   draft repeated "You: Nothing" down the table.

   The stage list and the funnel diagram are both generated from FUNNEL_STAGES,
   so a stage added to src/types/bankAccount.ts appears in both and a missing
   line of copy is a type error rather than a silent gap. */

/** SVG cannot take a Tailwind class for a fill, so the stage tones are read
 *  straight off the CSS variables. The diagrams then track the palette. */
const TONE_FILL: Record<StageTone, string> = {
  neutral: 'hsl(var(--stage-neutral))',
  info: 'hsl(var(--stage-info))',
  gold: 'hsl(var(--stage-gold))',
  ok: 'hsl(var(--stage-ok))',
  lost: 'hsl(var(--lost))',
};

const INK = {
  fg: 'hsl(var(--foreground))',
  muted: 'hsl(var(--muted-foreground))',
  subtle: 'hsl(var(--subtle))',
  bg: 'hsl(var(--background))',
  card: 'hsl(var(--card))',
  stall: 'hsl(var(--stall))',
  stallFg: 'hsl(var(--stall-foreground))',
  lost: 'hsl(var(--lost))',
  lostFg: 'hsl(var(--lost-foreground))',
  // Chip label colours are literal hexes in the Tailwind config too - they sit
  // a step brighter than their base so a 13%-alpha tint stays readable.
  infoChip: '#8FBBE6',
  goldChip: '#DCC28C',
};

interface StageCopy {
  /** Diagram label, split where the artboard needs two lines. */
  lines: string[];
  /** The party responsible for the next action. Omitted on the final stage. */
  actor?: string;
  /** What the stage means, in one sentence. */
  what: string;
  /** The action required, emphasised at the end of the sentence. */
  action: string;
}

const STAGE_COPY: Record<BankAccountStatus, StageCopy> = {
  'Registered': {
    lines: ['Registered'], actor: 'Bank',
    what: 'Ariete has assigned a new client to your bank.',
    action: 'Begin the account opening process.',
  },
  'Onboarding': {
    lines: ['Onboarding'], actor: 'Bank',
    what: 'Documentation is being collected and the bank’s checks are in progress.',
    action: 'Complete onboarding, then record the account as opened.',
  },
  'Account Opened': {
    lines: ['Account', 'opened'], actor: 'Ariete',
    what: 'The account is active and able to receive funds.',
    action: 'No action required. Ariete issues the transfer instructions to the client.',
  },
  'Waiting for transfer': {
    lines: ['Waiting for', 'transfer'], actor: 'Client',
    what: 'The client holds the transfer instructions and the funds have not yet arrived.',
    action: 'No action required. Await receipt of the funds.',
  },
  'Transfer made - waiting for AML letter': {
    lines: ['Transfer made', 'awaiting AML'], actor: 'Bank',
    what: 'The funds have been received.',
    action: 'Issue the AML / source-of-funds letter.',
  },
  'AML Letter Issued': {
    lines: ['AML letter', 'issued'], actor: 'Ariete',
    what: 'The bank’s obligations for this client are complete.',
    action: 'No action required. Ariete executes the investment.',
  },
  'Investment executed': {
    lines: ['Investment', 'executed'],
    what: 'The client has completed the pipeline.',
    action: 'No action required. This is the final stage.',
  },
  'Lost': {
    lines: ['Lost'],
    what: 'The client withdrew, was declined, or has become unresponsive.',
    action: 'Record this stage so that the client is no longer pursued.',
  },
};

/* An illustrative list, not live data - the card is labelled Clients the same
   way the real one is, and the names are placeholders. */
const EXAMPLE_ROWS: { name: string; status: BankAccountStatus }[] = [
  { name: 'M. Bianchi', status: 'Registered' },
  { name: 'A. Conti', status: 'Onboarding' },
  { name: 'L. Rossi', status: 'Account Opened' },
  { name: 'S. Greco', status: 'Waiting for transfer' },
  { name: 'F. Russo', status: 'Investment executed' },
];

/* The artboard spells the count out ("Eight stages"), so the heading needs a
   word rather than a numeral - with a numeral fallback if the pipeline ever
   grows past this list. */
const NUMBER_WORDS = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve'];
const spellOut = (n: number) => NUMBER_WORDS[n] ?? String(n);

const StepHead = ({ step, title, lead }: { step: number; title: string; lead?: string }) => (
  <div className="flex max-w-[720px] flex-col gap-2">
    <span className="eyebrow">Step {step}</span>
    <h2 className="text-xl leading-[1.25] text-foreground sm:text-2xl">{title}</h2>
    {lead && <p className="text-sm leading-[1.6] text-muted-foreground">{lead}</p>}
  </div>
);

/** A diagram with its caption. Scrolls sideways rather than shrinking, so the
 *  labels never drop below the 12px floor on a narrow screen. */
const Figure = ({ caption, minWidth, children }: { caption: string; minWidth: number; children: React.ReactNode }) => (
  <figure className="flex flex-col gap-3">
    <div className="overflow-x-auto">
      <div style={{ minWidth, maxWidth: '100%' }}>{children}</div>
    </div>
    <figcaption className="text-xs leading-[1.6] text-subtle">{caption}</figcaption>
  </figure>
);

/* Funnel geometry. The artboard is laid out from these three numbers so the
   drawing follows FUNNEL_STAGES instead of being pinned to seven stages. */
const X0 = 70;
const GAP = 143.333;
const FUNNEL_W = X0 * 2 + GAP * (FUNNEL_STAGES.length - 1);

const FunnelDiagram = () => (
  <svg
    viewBox={`0 0 ${Math.round(FUNNEL_W)} 168`}
    role="img"
    aria-label="The stages in order, each labelled with who acts next"
    style={{ width: '100%', height: 'auto' }}
  >
    <defs>
      <marker id="qg-arrow-1" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <polygon points="0,1 10,5 0,9" fill={INK.subtle} fillOpacity=".75" />
      </marker>
    </defs>

    {FUNNEL_STAGES.map((status, i) => {
      const x = X0 + GAP * i;
      const copy = STAGE_COPY[status];
      return (
        <g key={status}>
          <circle cx={x} cy="44" r="13" fill={TONE_FILL[STAGE_TONES[status]]} />
          <text x={x} y="48" textAnchor="middle" fontSize="10" fontWeight="600" fill={INK.bg}>{i + 1}</text>
          {copy.lines.map((line, li) => (
            <text key={line} x={x} y={76 + li * 12} textAnchor="middle" fontSize="11" fill={INK.muted}>{line}</text>
          ))}
          {copy.actor && (
            <text x={x} y={copy.lines.length > 1 ? 106 : 94} textAnchor="middle" fontSize="10" fill={INK.subtle}>
              {copy.actor}
            </text>
          )}
          {i < FUNNEL_STAGES.length - 1 && (
            <line
              x1={x + 15} y1="44" x2={x + GAP - 17} y2="44"
              stroke={INK.subtle} strokeOpacity=".4" strokeWidth="1.5" markerEnd="url(#qg-arrow-1)"
            />
          )}
        </g>
      );
    })}

    {/* Lost sits off the flow, dashed: an exit available at any point rather
        than a step everyone passes through. */}
    <rect x={X0} y="124" width="300" height="34" rx="3" fill="none" stroke={INK.lost} strokeOpacity=".5" strokeDasharray="5 4" />
    <text x={X0 + 18} y="145" fontSize="11" fill={INK.lostFg}>Lost — may be recorded at any point</text>
  </svg>
);

const UpdateDiagram = () => (
  <svg
    viewBox="0 0 880 182"
    role="img"
    aria-label="Three steps: locate the client row, select the new stage, confirm"
    style={{ width: '100%', height: 'auto' }}
  >
    <defs>
      <marker id="qg-arrow-2" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <polygon points="0,1 10,5 0,9" fill={INK.subtle} fillOpacity=".75" />
      </marker>
    </defs>

    <text x="8" y="18" fontSize="11" fill={INK.subtle}>1</text>
    <text x="24" y="18" fontSize="11" fill={INK.muted}>Locate the client</text>
    <rect x="8" y="32" width="250" height="72" rx="3" fill={INK.card} stroke="#ffffff" strokeOpacity=".1" />
    <text x="26" y="60" fontSize="11" fill={INK.fg}>L. Rossi</text>
    <text x="26" y="78" fontSize="10" fill={INK.subtle}>l.rossi@example.com</text>
    <rect x="132" y="54" width="112" height="22" rx="3" fill={TONE_FILL.info} fillOpacity=".13" stroke="#ffffff" strokeOpacity=".18" />
    <text x="142" y="69" fontSize="10" fill={INK.infoChip}>Account opened</text>
    <text x="234" y="69" fontSize="9" fill={INK.subtle}>▾</text>
    <line x1="266" y1="68" x2="300" y2="68" stroke={INK.subtle} strokeOpacity=".5" strokeWidth="1.5" markerEnd="url(#qg-arrow-2)" />

    <text x="308" y="18" fontSize="11" fill={INK.subtle}>2</text>
    <text x="324" y="18" fontSize="11" fill={INK.muted}>Select the new stage</text>
    <rect x="308" y="32" width="250" height="140" rx="3" fill={INK.card} stroke="#ffffff" strokeOpacity=".1" />
    <rect x="316" y="40" width="234" height="22" rx="3" fill="#ffffff" fillOpacity=".05" stroke="#ffffff" strokeOpacity=".14" />
    <text x="326" y="55" fontSize="10" fill={INK.muted}>Account opened</text>
    <text x="538" y="55" fontSize="9" fill={INK.subtle}>▴</text>
    <text x="326" y="78" fontSize="10" fill={INK.subtle}>Registered</text>
    <text x="326" y="98" fontSize="10" fill={INK.subtle}>Onboarding</text>
    <text x="326" y="118" fontSize="10" fill={INK.subtle}>Account opened</text>
    <rect x="316" y="125" width="234" height="20" fill="#ffffff" fillOpacity=".07" />
    <text x="326" y="138" fontSize="10" fill={INK.fg}>Waiting for transfer</text>
    <text x="326" y="158" fontSize="10" fill={INK.subtle}>Transfer made…</text>
    <line x1="566" y1="68" x2="600" y2="68" stroke={INK.subtle} strokeOpacity=".5" strokeWidth="1.5" markerEnd="url(#qg-arrow-2)" />

    <text x="608" y="18" fontSize="11" fill={INK.subtle}>3</text>
    <text x="624" y="18" fontSize="11" fill={INK.muted}>Confirm</text>
    <rect x="608" y="32" width="250" height="96" rx="3" fill={INK.card} stroke="#ffffff" strokeOpacity=".1" />
    <text x="626" y="58" fontSize="11" fill={INK.fg}>Confirm status update</text>
    <text x="626" y="76" fontSize="10" fill={INK.subtle}>Update status to</text>
    <text x="626" y="90" fontSize="10" fill={INK.muted}>Waiting for transfer?</text>
    <rect x="700" y="98" width="60" height="20" rx="3" fill="none" stroke="#ffffff" strokeOpacity=".18" />
    <text x="730" y="112" textAnchor="middle" fontSize="10" fill={INK.subtle}>Cancel</text>
    <rect x="768" y="98" width="72" height="20" rx="3" fill="#ffffff" fillOpacity=".9" />
    <text x="804" y="112" textAnchor="middle" fontSize="10" fill={INK.bg}>Confirm</text>
  </svg>
);

const StalledDiagram = () => (
  <svg
    viewBox="0 0 700 104"
    role="img"
    aria-label={`The stalled filter lists records that have not changed stage in ${STALLED_AFTER_DAYS} days`}
    style={{ width: '100%', height: 'auto' }}
  >
    <defs>
      <marker id="qg-arrow-3" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <polygon points="0,1 10,5 0,9" fill={INK.subtle} fillOpacity=".75" />
      </marker>
    </defs>
    <rect x="8" y="30" width="146" height="34" rx="3" fill={INK.stall} fillOpacity=".09" stroke={INK.stall} strokeOpacity=".4" />
    <text x="81" y="51" textAnchor="middle" fontSize="11" fill={INK.stallFg}>Stalled {STALLED_AFTER_DAYS}d+ · 3</text>
    <line x1="164" y1="47" x2="202" y2="47" stroke={INK.subtle} strokeOpacity=".5" strokeWidth="1.5" markerEnd="url(#qg-arrow-3)" />
    <rect x="212" y="24" width="464" height="46" rx="3" fill={INK.stall} fillOpacity=".05" stroke={INK.stall} strokeOpacity=".22" />
    <text x="232" y="52" fontSize="11" fill={INK.fg}>S. Greco</text>
    <rect x="330" y="38" width="124" height="20" rx="3" fill={TONE_FILL.gold} fillOpacity=".13" />
    <text x="340" y="52" fontSize="10" fill={INK.goldChip}>Waiting for transfer</text>
    <text x="656" y="52" textAnchor="end" fontSize="11" fill={INK.stallFg}>41d</text>
  </svg>
);

/** One stage: number, chip, then what it means with the instruction last. */
const StageRow = ({ status, label }: { status: BankAccountStatus; label: string }) => {
  const copy = STAGE_COPY[status];
  return (
    <li className="flex flex-col gap-2 border-t border-white/[0.06] py-3.5 first:border-t-0 sm:flex-row sm:items-baseline sm:gap-4">
      <span className="flex flex-none items-center gap-3 sm:w-[300px]">
        <span className="tabular-nums text-xs font-medium text-dim">{label}</span>
        <StageChip status={status} />
      </span>
      <span className="min-w-0 flex-1 text-sm leading-[1.6] text-muted-foreground">
        {copy.what} <span className="text-foreground">{copy.action}</span>
      </span>
    </li>
  );
};

const QuickGuide = () => (
  <div className="min-h-screen bg-background">
    <Header />
    <div className="flex">
      <Sidebar />
      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-[1080px]">

          <div className="flex flex-col gap-1.5 border-b border-border px-6 py-6 lg:px-8">
            <h1 className="text-3xl leading-[1.1] text-foreground">Quick Guide</h1>
            <p className="text-sm text-stage-neutral">How a client progresses through the portal, and what is required of the bank at each stage</p>
          </div>

          {/* -------------------------------------------------- Step 1 */}
          <section className="flex flex-col gap-5 px-6 pt-10 lg:px-8">
            <StepHead
              step={1}
              title="Clients are assigned to your bank."
              lead="Ariete assigns each client to your bank. Clients appear in this list at their current stage; records are created by Ariete and are not added by the bank."
            />
            <div className="w-full max-w-[420px] rounded-lg border border-border bg-card">
              <div className="border-b border-white/[0.06] px-4 py-3">
                <span className="eyebrow">Clients</span>
              </div>
              <ul>
                {EXAMPLE_ROWS.map((row) => (
                  <li key={row.name} className="flex items-center justify-between gap-3 border-b border-white/[0.045] px-4 py-2.5 last:border-b-0">
                    <span className="text-sm text-foreground">{row.name}</span>
                    <StageChip status={row.status} />
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* -------------------------------------------------- Step 2 */}
          <section className="flex flex-col gap-5 px-6 pt-14 lg:px-8">
            <StepHead step={2} title={`${spellOut(FUNNEL_STAGES.length + 1)} stages, and the action each requires.`} />
            <Figure caption="The label beneath each stage indicates the party responsible for the next action." minWidth={700}>
              <FunnelDiagram />
            </Figure>
            <div className="rounded-lg border border-border bg-card px-5 py-2">
              <ul>
                {FUNNEL_STAGES.map((status, i) => (
                  <StageRow key={status} status={status} label={String(i + 1).padStart(2, '0')} />
                ))}
                <StageRow status={TERMINAL_STATUS} label="×" />
              </ul>
            </div>
          </section>

          {/* -------------------------------------------------- Step 3 */}
          <section className="flex flex-col gap-5 px-6 pt-14 lg:px-8">
            <StepHead
              step={3}
              title="Recording a change of stage."
              lead="Select the new stage on the client’s row and confirm. Any stage may be selected, including an earlier one, should a stage be recorded in error."
            />
            <Figure caption="The change is recorded on confirmation and is visible to Ariete immediately." minWidth={660}>
              <UpdateDiagram />
            </Figure>
          </section>

          {/* -------------------------------------------------- Step 4 */}
          <section className="flex flex-col gap-5 px-6 pt-14 lg:px-8">
            <StepHead
              step={4}
              title="Identifying records that require attention."
              lead={`Records that have not changed stage for ${STALLED_AFTER_DAYS} days or more are flagged for review.`}
            />
            <Figure caption="The figure on the filter is the number of records currently flagged." minWidth={520}>
              <StalledDiagram />
            </Figure>
          </section>

          {/* -------------------------------------------------- Close */}
          <section className="px-6 pb-16 pt-14 lg:px-8">
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-card px-6 py-6">
              <p className="text-sm text-muted-foreground">
                If a record appears incorrect or a client is missing, please contact your Ariete representative. Client routing is managed by Ariete.
              </p>
              <Link
                to="/"
                className="inline-flex h-[42px] flex-none items-center gap-2 rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors duration-fast hover:bg-primary/90"
              >
                View your clients
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </section>

        </div>
      </main>
    </div>
  </div>
);

export default QuickGuide;
