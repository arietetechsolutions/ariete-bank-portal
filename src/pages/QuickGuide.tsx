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

   The bank performs and records every stage, so every line in the stage table
   ends in an instruction. Two earlier drafts got this wrong: the first
   repeated "You: Nothing" down four rows, the second replaced it with "No
   action required" and handed those stages to Ariete. The funnel diagram
   carries stage names and colours only, for the same reason - a
   responsible-party label under each circle had nothing to distinguish.

   The stage list and the funnel diagram are both generated from FUNNEL_STAGES,
   so a stage added to src/types/bankAccount.ts appears in both and a missing
   line of copy is a type error rather than a silent gap. */

/** SVG cannot take a Tailwind class for a fill, so the stage tones are read
 *  straight off the CSS variables. The diagrams then track the palette. */
const TONE_FILL: Record<StageTone, string> = {
  registered: 'hsl(var(--stage-registered))',
  onboarding: 'hsl(var(--stage-onboarding))',
  opened: 'hsl(var(--stage-opened))',
  awaitingTransfer: 'hsl(var(--stage-awaiting-transfer))',
  awaitingAml: 'hsl(var(--stage-awaiting-aml))',
  amlIssued: 'hsl(var(--stage-aml-issued))',
  executed: 'hsl(var(--stage-executed))',
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
  // a step brighter than their base so a 13%-alpha tint stays readable. Only
  // the two stages the mock-ups depict are needed here.
  openedChip: '#6AB2FB',
  awaitingTransferChip: '#4CE6D9',
};

interface StageCopy {
  /** Diagram label, split where the artboard needs two lines. */
  lines: string[];
  /** What the stage means, in one sentence. */
  what: string;
  /** The action required, emphasised at the end of the sentence. */
  action: string;
}

const STAGE_COPY: Record<BankAccountStatus, StageCopy> = {
  'Registered': {
    lines: ['Registered'],
    what: 'Ariete has assigned a new client to your bank.',
    action: 'Begin the account opening process.',
  },
  'Onboarding': {
    lines: ['Onboarding'],
    what: 'Documentation is being collected and the bank’s checks are in progress.',
    action: 'Complete onboarding, then set the stage to Account Opened.',
  },
  'Account Opened': {
    lines: ['Account', 'opened'],
    what: 'The account is live and able to receive funds.',
    action: 'Once the client holds the transfer instructions, set the stage to Waiting for transfer.',
  },
  'Waiting for transfer': {
    lines: ['Waiting for', 'transfer'],
    what: 'The transfer instructions are with the client and the funds have not yet arrived.',
    action: 'Watch for the funds, and set the stage on the day they land.',
  },
  'Transfer made - waiting for AML letter': {
    lines: ['Transfer made', 'awaiting AML'],
    what: 'The funds have been received.',
    action: 'Issue the AML / source-of-funds letter, then set the stage to AML Letter Issued.',
  },
  'AML Letter Issued': {
    lines: ['AML letter', 'issued'],
    what: 'The AML / source-of-funds letter has been issued.',
    action: 'Set the stage to Investment executed once the investment is complete.',
  },
  'Investment executed': {
    lines: ['Investment', 'executed'],
    what: 'The investment has been completed and the client is through the pipeline.',
    action: 'This is the final stage; nothing follows it.',
  },
  'Lost': {
    lines: ['Lost'],
    what: 'The client withdrew, was declined, or has become unresponsive.',
    action: 'Set this stage at any point, so that the client is no longer pursued.',
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

/** A diagram, with an optional caption. Scrolls sideways rather than shrinking,
 *  so the labels never drop below the 12px floor on a narrow screen. */
const Figure = ({ caption, minWidth, children }: { caption?: string; minWidth: number; children: React.ReactNode }) => (
  <figure className="flex flex-col gap-3">
    <div className="overflow-x-auto">
      <div style={{ minWidth, maxWidth: '100%' }}>{children}</div>
    </div>
    {caption && <figcaption className="text-xs leading-[1.6] text-subtle">{caption}</figcaption>}
  </figure>
);

/* Funnel geometry. The artboard is laid out from these three numbers so the
   drawing follows FUNNEL_STAGES instead of being pinned to seven stages. */
const X0 = 70;
const GAP = 143.333;
const FUNNEL_W = X0 * 2 + GAP * (FUNNEL_STAGES.length - 1);

const FunnelDiagram = () => (
  <svg
    viewBox={`0 0 ${Math.round(FUNNEL_W)} 156`}
    role="img"
    aria-label="The stages in pipeline order, with Lost shown off the flow"
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
          {i < FUNNEL_STAGES.length - 1 && (
            <line
              x1={x + 15} y1="44" x2={x + GAP - 17} y2="44"
              stroke={INK.subtle} strokeOpacity=".4" strokeWidth="1.5" markerEnd="url(#qg-arrow-1)"
            />
          )}
        </g>
      );
    })}

    {/* Lost is off the flow - dashed, below the row, no arrow into it - but it
        gets the same plum circle the funnel stages get, a tinted fill and a
        full-strength edge. Outlined at 50% opacity on no fill it was the one
        thing on the page nobody could see. */}
    <g>
      <rect
        x={X0 - 24} y="102" width="372" height="46" rx="4"
        fill={INK.lost} fillOpacity=".12" stroke={INK.lost} strokeDasharray="6 4"
      />
      <circle cx={X0} cy="125" r="13" fill={INK.lost} />
      <text x={X0} y="129" textAnchor="middle" fontSize="12" fontWeight="600" fill={INK.bg}>×</text>
      <text x={X0 + 24} y="121" fontSize="12" fill={INK.fg}>Lost</text>
      <text x={X0 + 24} y="136" fontSize="11" fill={INK.lostFg}>May be recorded at any point</text>
    </g>
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
    <rect x="132" y="54" width="112" height="22" rx="3" fill={TONE_FILL.opened} fillOpacity=".13" stroke="#ffffff" strokeOpacity=".18" />
    <text x="142" y="69" fontSize="10" fill={INK.openedChip}>Account opened</text>
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
    <rect x="330" y="38" width="124" height="20" rx="3" fill={TONE_FILL.awaitingTransfer} fillOpacity=".13" />
    <text x="340" y="52" fontSize="10" fill={INK.awaitingTransferChip}>Waiting for transfer</text>
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
            <p className="text-sm text-subtle">How a client progresses through the portal, and what is required of the bank at each stage</p>
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
            <Figure minWidth={700}>
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
