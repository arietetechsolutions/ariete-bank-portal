import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import StageChip, { TONE_BAR } from '@/components/StageChip';
import { cn } from '@/lib/utils';
import {
  BankAccountStatus, FUNNEL_STAGES, STAGE_SHORT_LABELS, STAGE_TONES,
  STALLED_AFTER_DAYS, StageTone, TERMINAL_STATUS,
} from '@/types/bankAccount';

/* The guide is generated from the same constants the dashboard renders from -
   FUNNEL_STAGES, STAGE_TONES, STALLED_AFTER_DAYS - so a stage added to
   src/types/bankAccount.ts shows up here too. Only the prose below is hand
   written, and a missing entry is a type error rather than a silent gap. */

interface StageNote { what: string; waiting: string }

const STAGE_NOTES: Record<BankAccountStatus, StageNote> = {
  'Registered': {
    what: 'Ariete has routed the client to your bank. Nothing has been opened yet — this is the client landing on your desk.',
    waiting: 'Yours — start the onboarding',
  },
  'Onboarding': {
    what: 'Account opening is under way: documents collected, checks run, forms signed.',
    waiting: 'Yours — until the account is live',
  },
  'Account Opened': {
    what: 'The account exists and can receive funds.',
    waiting: 'Ariete’s — the client is told where to send the money',
  },
  'Waiting for transfer': {
    what: 'The client has the transfer details and the money has not landed yet.',
    waiting: 'The client’s',
  },
  'Transfer made - waiting for AML letter': {
    what: 'Funds are in. The bank prepares the AML / source-of-funds letter.',
    waiting: 'Yours — issue the letter',
  },
  'AML Letter Issued': {
    what: 'The letter is out. Compliance is cleared on the banking side.',
    waiting: 'Ariete’s — execute the investment',
  },
  'Investment executed': {
    what: 'Capital deployed. The client is through the pipeline.',
    waiting: 'Nobody’s — this is the end of the line',
  },
  'Lost': {
    what: 'The process closed without an account or an investment — withdrawn, rejected, or gone quiet.',
    waiting: '—',
  },
};

/* The tone legend is the single most useful thing on this page: the colours on
   the dashboard are keyed to WHO YOU ARE WAITING ON, not to how far along the
   funnel a client sits, and nobody guesses that unprompted. */
const TONE_LEGEND: { tone: StageTone; name: string; meaning: string }[] = [
  { tone: 'neutral', name: 'Grey', meaning: 'Early stage, with you, no external dependency' },
  { tone: 'info', name: 'Blue', meaning: 'Ariete moves next' },
  { tone: 'gold', name: 'Gold', meaning: 'Waiting on the client’s money or the bank’s letter' },
  { tone: 'ok', name: 'Green', meaning: 'Investment executed' },
  { tone: 'lost', name: 'Plum, dashed', meaning: 'An exit, not a step — it sits off the funnel' },
];

const PROBLEMS = [
  {
    title: 'Status lives in inboxes',
    body: 'Updates travel by email and chat. Two people read the same thread and come away with different ideas of where a client actually is.',
  },
  {
    title: 'Nothing shows what has stalled',
    body: 'A client waiting forty days on a transfer looks exactly like one that moved yesterday. The stuck cases are the expensive ones and they are the hardest to see.',
  },
  {
    title: 'Both sides chase each other',
    body: 'Ariete asks the bank for a status, the bank asks Ariete whether the client was contacted. The answer already exists — just not anywhere both sides can see.',
  },
];

const STEPS = [
  {
    title: 'The client is routed to you',
    body: 'Ariete assigns the client to your bank. They appear in your client list, with an email and a stage, the moment that happens.',
  },
  {
    title: 'You move the stage',
    body: 'Pick the new stage from the dropdown on the client’s row and confirm. Any stage, in any order — there is no forced path, because real cases skip and go backwards.',
  },
  {
    title: 'Everyone sees it',
    body: 'The change is written straight through to Ariete’s records. No export, no reconciliation, no second system to keep in step.',
  },
  {
    title: 'It goes on the record',
    body: 'Every change is written to the Bank Portal audit log with who made it and when, and the clock on "days in stage" restarts.',
  },
];

const FEATURES = [
  {
    title: 'The funnel across the top',
    body: 'One card per stage: how many clients sit there, what share of your book that is, and the median days they have been sitting. Click a card to filter the table to it.',
  },
  {
    title: `The stalled ${STALLED_AFTER_DAYS}-day filter`,
    body: `Anything waiting ${STALLED_AFTER_DAYS} days or more without moving. Finished clients are excluded — sitting in "Investment executed" forever is not a problem.`,
  },
  {
    title: 'Days since status change',
    body: 'Every row carries the age of its current stage, with a bar that fills as it grows. Past 45 days the bar is full and the number carries the detail.',
  },
  {
    title: 'Colour means the next action',
    body: 'A stage’s colour tells you who is holding the ball, not how far along it is. Two stages sharing a colour share a next action.',
  },
  {
    title: 'You see your own bank',
    body: 'Bank staff see only the clients routed to their bank. Ariete administrators see every client across all banks.',
  },
  {
    title: 'Invite-only access',
    body: 'Accounts are created by invitation and tied to a bank. There is no public sign-up, and nothing is visible before sign-in.',
  },
];

/* An illustrative row set, not live data - the panel is labelled as such.
   Names are placeholders in the same shape as real records. */
const EXAMPLE_ROWS: { name: string; status: BankAccountStatus }[] = [
  { name: 'M. Bianchi', status: 'Registered' },
  { name: 'A. Conti', status: 'Onboarding' },
  { name: 'L. Rossi', status: 'Account Opened' },
  { name: 'S. Greco', status: 'Waiting for transfer' },
  { name: 'D. Marino', status: 'AML Letter Issued' },
  { name: 'F. Russo', status: 'Investment executed' },
];

const SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'pipeline', label: 'The pipeline' },
  { id: 'dashboard', label: 'Using the dashboard' },
];

const num = (i: number) => String(i + 1).padStart(2, '0');

/** Section heading: eyebrow above a Playfair line, the same pairing the
 *  dashboard uses for its page head. */
const SectionHead = ({ eyebrow, title, lead }: { eyebrow: string; title: string; lead: string }) => (
  <div className="flex max-w-[760px] flex-col gap-3">
    <span className="eyebrow">{eyebrow}</span>
    <h2 className="text-2xl leading-[1.2] text-foreground sm:text-3xl">{title}</h2>
    <p className="text-sm leading-[1.65] text-muted-foreground">{lead}</p>
  </div>
);

/** One stage of the funnel, rendered as a row rather than a card: the guide is
 *  read top to bottom, and seven cards side by side is the dashboard's job. */
const StageRow = ({ status, index }: { status: BankAccountStatus; index: number }) => {
  const note = STAGE_NOTES[status];
  return (
    <li className="flex gap-4 border-t border-border py-5 first:border-t-0 sm:gap-5">
      <div className="flex flex-none flex-col items-center gap-2 pt-0.5">
        <span className="tabular-nums text-xs font-medium text-dim">{num(index)}</span>
        <span className={cn('w-[2px] flex-1 rounded-sm', TONE_BAR[STAGE_TONES[status]])} />
      </div>
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2.5">
          <StageChip status={status} />
          {STAGE_SHORT_LABELS[status] !== status && (
            <span className="text-sm font-medium text-subtle">shown as “{STAGE_SHORT_LABELS[status]}”</span>
          )}
        </div>
        <p className="text-sm leading-[1.65] text-muted-foreground">{note.what}</p>
        <p className="text-sm font-medium text-subtle">Next move: {note.waiting}</p>
      </div>
    </li>
  );
};

const QuickGuide = () => {
  const [active, setActive] = useState(SECTIONS[0].id);

  // Scroll-spy for the section nav. rootMargin pulls the trigger line down to
  // just under the sticky header so a section counts as current once its head
  // has cleared the chrome, not when its last pixel enters the viewport.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length > 0) setActive(visible[0].target.id);
      },
      { rootMargin: '-140px 0px -60% 0px', threshold: 0 },
    );
    for (const s of SECTIONS) {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="min-w-0 flex-1">
          <div className="mx-auto max-w-[1200px]">

            {/* Page head, then the section nav sticks under the app header. */}
            <div className="flex flex-col gap-1.5 border-b border-border px-6 py-6 lg:px-8">
              <h1 className="text-3xl leading-[1.1] text-foreground">Quick Guide</h1>
              <p className="text-sm text-stage-neutral">What this portal is for, what every stage means, and how to read the dashboard</p>
            </div>

            <nav className="sticky top-[73px] z-40 flex gap-1 overflow-x-auto border-b border-border bg-background/95 px-6 py-2.5 backdrop-blur lg:px-8">
              {SECTIONS.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className={cn(
                    'whitespace-nowrap rounded-md border-b-2 px-3 py-1.5 text-sm transition-colors duration-fast',
                    active === s.id
                      ? 'border-foreground font-semibold text-foreground'
                      : 'border-transparent text-muted-foreground hover:text-foreground',
                  )}
                >
                  {s.label}
                </a>
              ))}
            </nav>

            {/* ---------------------------------------------------------- */}
            <section id="overview" className="scroll-mt-[140px] px-6 pt-12 lg:px-8">
              <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:gap-12">
                <div className="flex max-w-[620px] flex-col gap-5">
                  <span className="eyebrow">Ariete Bank Portal</span>
                  <h2 className="text-3xl leading-[1.1] text-foreground sm:text-3xl">
                    One shared view of every client you are opening an account for.
                  </h2>
                  <p className="text-base leading-[1.65] text-muted-foreground">
                    Ariete routes the client to your bank. You move them through the pipeline. Both sides
                    read the same status on the same day, from first registration to investment executed.
                  </p>
                  {/* The one solid rust element on this page. The design system
                      allows the accent a single appearance per view, which is
                      also why the sidebar's active state is a rule, not a fill. */}
                  <div className="pt-1">
                    <Link
                      to="/"
                      className="inline-flex h-[42px] items-center gap-2 rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors duration-fast hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    >
                      Go to your clients
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                </div>

                <div className="w-full flex-none rounded-lg border border-border bg-card lg:w-[380px]">
                  <div className="flex items-center justify-between border-b border-border px-4 py-3">
                    <span className="eyebrow">Example · your client list</span>
                  </div>
                  <ul>
                    {EXAMPLE_ROWS.map((row) => (
                      <li key={row.name} className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 last:border-b-0">
                        <span className="text-sm text-foreground">{row.name}</span>
                        <StageChip status={row.status} />
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>

            {/* ---------------------------------------------------------- */}
            <section className="flex flex-col gap-7 px-6 pt-16 lg:px-8">
              <SectionHead
                eyebrow="The problem"
                title="Account opening breaks down in the gaps between two companies."
                lead="Ariete holds the client relationship, the bank holds the account. Neither side can see what the other is doing, so the status of a deal becomes something you ask about rather than something you look up."
              />
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {PROBLEMS.map((p, i) => (
                  <div key={p.title} className="flex flex-col gap-2.5 rounded-lg border border-border bg-card p-5">
                    <span className="tabular-nums text-xs font-medium text-dim">/ {num(i)}</span>
                    <h3 className="text-sm font-semibold text-foreground">{p.title}</h3>
                    <p className="text-sm leading-[1.6] text-muted-foreground">{p.body}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* ---------------------------------------------------------- */}
            <section className="flex flex-col gap-7 px-6 pt-16 lg:px-8">
              <SectionHead
                eyebrow="How it works"
                title="Four steps, and only one of them is yours."
                lead="The portal is deliberately small. You update a stage; everything downstream of that — the shared view, the ageing clock, the audit trail — happens on its own."
              />
              <div className="grid gap-3 sm:grid-cols-2">
                {STEPS.map((s, i) => (
                  <div key={s.title} className="flex gap-4 rounded-lg border border-border bg-card p-5">
                    <span className="tabular-nums text-xs font-medium leading-[1.5] text-dim">{num(i)}</span>
                    <div className="flex min-w-0 flex-col gap-2">
                      <h3 className="text-sm font-semibold text-foreground">{s.title}</h3>
                      <p className="text-sm leading-[1.6] text-muted-foreground">{s.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* ---------------------------------------------------------- */}
            <section id="pipeline" className="flex scroll-mt-[140px] flex-col gap-7 px-6 pt-16 lg:px-8">
              <SectionHead
                eyebrow={`The pipeline · ${FUNNEL_STAGES.length} stages + 1 exit`}
                title="From registered to investment executed."
                lead="These are the only stages that exist. The name in the chip is exactly the value stored on the record, so what you read here is what Ariete reads on their side."
              />

              <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-5">
                <span className="eyebrow">Reading the colours</span>
                <p className="max-w-[720px] text-sm leading-[1.6] text-muted-foreground">
                  Colour is keyed to who you are waiting on, not to how far along the funnel a client sits.
                  Two stages in the same colour need the same kind of next action.
                </p>
                <ul className="mt-1 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                  {TONE_LEGEND.map((t) => (
                    <li key={t.tone} className="flex items-start gap-2.5">
                      <span className={cn('mt-[7px] h-[3px] w-6 flex-none rounded-sm', TONE_BAR[t.tone])} />
                      <span className="text-sm leading-[1.5] text-muted-foreground">
                        <span className="font-medium text-foreground">{t.name}</span> — {t.meaning}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-lg border border-border bg-card px-5 py-2">
                <ul>
                  {FUNNEL_STAGES.map((status, i) => (
                    <StageRow key={status} status={status} index={i} />
                  ))}
                </ul>
              </div>

              {/* Lost gets the dashed, off-the-flow treatment the dashboard's
                  terminal tile uses - an exit, not a step everyone passes. */}
              <div className="flex gap-4 rounded-lg border border-dashed border-lost/45 bg-background/60 p-5 sm:gap-5">
                <span className="flex-none pt-0.5 tabular-nums text-xs font-medium text-lost-foreground">×</span>
                <div className="flex min-w-0 flex-col gap-2">
                  <StageChip status={TERMINAL_STATUS} className="self-start" />
                  <p className="text-sm leading-[1.65] text-muted-foreground">{STAGE_NOTES[TERMINAL_STATUS].what}</p>
                  <p className="text-sm font-medium text-subtle">
                    It sits outside the funnel on the dashboard, counted separately as a share of all records.
                  </p>
                </div>
              </div>
            </section>

            {/* ---------------------------------------------------------- */}
            <section id="dashboard" className="flex scroll-mt-[140px] flex-col gap-7 px-6 pt-16 lg:px-8">
              <SectionHead
                eyebrow="Using the dashboard"
                title="Everything on the clients screen, and what it is telling you."
                lead="The numbers are there to point you at the cases that need a person. Most of the screen is about age and where things are stuck, not about totals."
              />
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {FEATURES.map((f) => (
                  <div key={f.title} className="flex flex-col gap-2.5 rounded-lg border border-border bg-card p-5">
                    <h3 className="text-sm font-semibold text-foreground">{f.title}</h3>
                    <p className="text-sm leading-[1.6] text-muted-foreground">{f.body}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* ---------------------------------------------------------- */}
            <section className="px-6 pb-20 pt-16 lg:px-8">
              <div className="flex flex-col items-start gap-5 rounded-lg border border-border bg-card px-6 py-10 sm:items-center sm:text-center">
                <span className="eyebrow">Get started</span>
                <h2 className="max-w-[560px] text-3xl leading-[1.15] text-foreground">
                  Open your client list and update anything that has moved.
                </h2>
                <p className="max-w-[520px] text-sm leading-[1.65] text-muted-foreground">
                  Start with the stalled filter — it is the shortest list on the screen and the one worth your morning.
                </p>
                {/* Outline, not rust: the accent was already spent in the hero. */}
                <Link
                  to="/"
                  className="inline-flex h-[42px] items-center gap-2 rounded-md border border-border px-5 text-sm font-medium text-foreground transition-colors duration-fast hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Go to your clients
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </section>

          </div>
        </main>
      </div>
    </div>
  );
};

export default QuickGuide;
