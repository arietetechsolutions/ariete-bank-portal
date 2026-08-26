import { useMemo, useState } from 'react';
import { Loader2, AlertCircle, Landmark } from 'lucide-react';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import PipelineFunnel from '@/components/PipelineFunnel';
import { TONE_CHIP } from '@/components/StageChip';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { useBankAccounts } from '@/hooks/useBankAccounts';
import { useUpdateBankAccountStatus } from '@/hooks/useUpdateBankAccountStatus';
import { useAdmin } from '@/hooks/useAdmin';
import {
  BANK_ACCOUNT_STATUSES, BankAccountRecord, BankAccountStatus,
  SETTLED_STATUSES, STAGE_SHORT_LABELS, STAGE_TONES, STALLED_AFTER_DAYS,
} from '@/types/bankAccount';
import { cn, daysSince, formatDaysSince } from '@/lib/utils';

/** A stalled account is one waiting on somebody past the threshold. Settled
 *  stages are excluded: a client can sit in "Investment executed" for a year
 *  without anything being wrong. */
const isStalled = (acc: BankAccountRecord): boolean => {
  if (!acc.status || SETTLED_STATUSES.includes(acc.status)) return false;
  const days = daysSince(acc.status_changed_on);
  return days !== null && days >= STALLED_AFTER_DAYS;
};

const Dashboard = () => {
  const { isAdmin } = useAdmin();
  const { data: bankAccounts, isLoading, error, refetch } = useBankAccounts();
  const { updateStatus, isUpdating } = useUpdateBankAccountStatus();
  const [confirmDialog, setConfirmDialog] = useState<{ id: string; newStatus: BankAccountStatus } | null>(null);
  // null = no filter. Set by clicking a funnel stage or the Lost tile.
  const [statusFilter, setStatusFilter] = useState<BankAccountStatus | null>(null);
  const [stalledOnly, setStalledOnly] = useState(false);

  // Memoised so the fresh [] on a loading render does not invalidate every
  // downstream useMemo on each pass.
  const accounts = useMemo(() => bankAccounts || [], [bankAccounts]);

  const visibleAccounts = useMemo(() => accounts.filter((acc) => {
    if (statusFilter && acc.status !== statusFilter) return false;
    if (stalledOnly && !isStalled(acc)) return false;
    return true;
  }), [accounts, statusFilter, stalledOnly]);

  const stalledCount = useMemo(() => accounts.filter(isStalled).length, [accounts]);

  // Derived from the data rather than hardcoded to GC/CBH - bank staff see a
  // single bank here, and the set of banks is Airtable's to decide.
  const bankCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const acc of accounts) {
      if (acc.bank_name) counts.set(acc.bank_name, (counts.get(acc.bank_name) || 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [accounts]);

  const handleStatusChange = (id: string, newStatus: BankAccountStatus) => {
    setConfirmDialog({ id, newStatus });
  };

  const handleConfirm = async () => {
    if (!confirmDialog) return;
    const { id, newStatus } = confirmDialog;
    setConfirmDialog(null);

    const success = await updateStatus(id, newStatus);
    if (success) {
      toast.success('Status updated successfully');
      refetch();
    }
  };

  const clearFilters = () => { setStatusFilter(null); setStalledOnly(false); };
  const hasFilter = statusFilter !== null || stalledOnly;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="min-w-0 flex-1">
          <div className="mx-auto max-w-[1440px]">
            {/* Page head - Playfair is reserved for exactly this. */}
            <div className="flex flex-wrap items-end justify-between gap-6 border-b border-border px-6 py-6 lg:px-8">
              <div className="flex flex-col gap-1.5">
                <h1 className="text-3xl leading-[1.1] text-foreground">
                  {isAdmin ? 'All clients' : 'Your clients'}
                </h1>
                {/* Deliberately just the description. The record count already
                    sits in the table footer, and a "last updated" clock on a
                    view that silently refetches every 30s tells staff nothing
                    they can act on. */}
                <p className="text-sm text-stage-neutral">
                  {isAdmin ? 'Every client across both banks' : 'Track and update your clients’ account-opening status'}
                </p>
              </div>
            </div>

            <AlertDialog open={!!confirmDialog} onOpenChange={(open) => !open && setConfirmDialog(null)}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-xl">Confirm status update</AlertDialogTitle>
                  <AlertDialogDescription>
                    Update status to <strong className="text-foreground">{confirmDialog?.newStatus}</strong>?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleConfirm}>Confirm</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            {!isLoading && !error && accounts.length > 0 && (
              <div className="flex flex-col gap-4 px-6 pt-6 lg:px-8">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <span className="eyebrow">Pipeline · count / share / median days in stage</span>
                  {bankCounts.length > 1 && (
                    <div className="flex gap-4 tabular-nums text-xs text-stage-neutral">
                      {bankCounts.map(([name, count]) => <span key={name}>{name} {count}</span>)}
                    </div>
                  )}
                </div>
                <PipelineFunnel accounts={accounts} statusFilter={statusFilter} onSelect={setStatusFilter} />
              </div>
            )}

            {!isLoading && !error && accounts.length > 0 && (
              <div className="flex flex-wrap items-center gap-3 px-6 pt-6 lg:px-8">
                <button
                  type="button"
                  onClick={clearFilters}
                  aria-pressed={!hasFilter}
                  className={cn(
                    'flex h-[38px] items-center rounded-md border px-3.5 text-sm transition-colors duration-fast',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    !hasFilter ? 'border-border bg-secondary text-foreground' : 'border-border text-muted-foreground hover:text-foreground',
                  )}
                >
                  All stages
                </button>
                {statusFilter && (
                  <span className={cn('flex h-[38px] items-center rounded-md px-3.5 text-sm', TONE_CHIP[STAGE_TONES[statusFilter]])}>
                    {statusFilter}
                  </span>
                )}
                {/* The alarm colour never appears without the number it refers to. */}
                <button
                  type="button"
                  onClick={() => setStalledOnly((v) => !v)}
                  aria-pressed={stalledOnly}
                  disabled={stalledCount === 0}
                  className={cn(
                    'flex h-[38px] items-center gap-2 rounded-md border px-3.5 text-sm transition-colors duration-fast',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-45',
                    stalledOnly
                      ? 'border-stall/70 bg-stall/[0.14] text-stall-foreground'
                      : 'border-stall/35 bg-stall/[0.08] text-stall-foreground hover:border-stall/60',
                  )}
                >
                  Stalled {STALLED_AFTER_DAYS}d+ · <span className="tabular-nums">{stalledCount}</span>
                </button>
                {hasFilter && (
                  <>
                    <span className="ml-auto tabular-nums text-xs text-subtle">
                      {visibleAccounts.length} of {accounts.length}
                    </span>
                    <Button variant="ghost" size="sm" onClick={clearFilters}>Clear</Button>
                  </>
                )}
              </div>
            )}

            <div className="px-6 py-6 lg:px-8">
              {isLoading ? (
                <div className="flex items-center justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>
              ) : error ? (
                <div className="rounded-lg border border-destructive/25 bg-destructive/[0.08] p-6 text-center">
                  <AlertCircle className="mx-auto mb-3 h-7 w-7 text-destructive" />
                  <p className="mb-4 text-destructive-foreground">{error instanceof Error ? error.message : 'Failed to load accounts'}</p>
                  <Button variant="outline" onClick={() => refetch()}>Retry</Button>
                </div>
              ) : accounts.length === 0 ? (
                <div className="rounded-lg border border-border bg-card p-12 text-center">
                  <Landmark className="mx-auto mb-4 h-10 w-10 text-dim" />
                  <p className="mb-1 text-lg text-foreground">No clients yet</p>
                  <p className="text-sm text-muted-foreground">Clients appear here once they’re routed to a bank</p>
                </div>
              ) : visibleAccounts.length === 0 ? (
                <div className="rounded-lg border border-border bg-card p-12 text-center">
                  <p className="mb-1 text-lg text-foreground">Nothing matches this filter</p>
                  <p className="mb-4 text-sm text-muted-foreground">
                    {stalledOnly && statusFilter ? `No ${statusFilter} client has been sitting for ${STALLED_AFTER_DAYS} days or more`
                      : stalledOnly ? `Nothing has been sitting for ${STALLED_AFTER_DAYS} days or more`
                      : `Nothing is currently in ${statusFilter}`}
                  </p>
                  <Button variant="outline" onClick={clearFilters}>Show all clients</Button>
                </div>
              ) : (
                <div className="overflow-hidden rounded-lg border border-border bg-card">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border hover:bg-transparent">
                          <TableHead className="h-auto py-3 text-xs font-medium text-subtle">Client</TableHead>
                          <TableHead className="h-auto py-3 text-xs font-medium text-subtle">Email</TableHead>
                          {isAdmin && <TableHead className="h-auto py-3 text-xs font-medium text-subtle">Bank</TableHead>}
                          <TableHead className="h-auto py-3 text-xs font-medium text-subtle">Stage</TableHead>
                          <TableHead className="h-auto py-3 text-right text-xs font-medium text-subtle whitespace-nowrap">Days since status change</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {visibleAccounts.map((acc) => {
                          const days = daysSince(acc.status_changed_on);
                          const stalled = isStalled(acc);
                          const settled = !!acc.status && SETTLED_STATUSES.includes(acc.status);
                          // Age bar tops out at 45 days - past that the bar is
                          // full and the number carries the detail.
                          const agePct = days === null || settled ? 0 : Math.min(100, Math.round((days / 45) * 100));
                          return (
                            <TableRow
                              key={acc.id}
                              className={cn('h-11 border-border hover:bg-secondary', stalled && 'bg-stall/[0.05]')}
                            >
                              <TableCell className="py-0">
                                <div className="flex min-w-0 items-center gap-2.5">
                                  {/* A 3px flag, not a whole red row: visible when
                                      scanning, quiet when reading one record. */}
                                  <span className={cn('h-[22px] w-[3px] flex-none rounded-sm',
                                    stalled ? 'bg-stall' : acc.status === 'Lost' ? 'bg-lost/50' : 'bg-transparent')} />
                                  <span className="truncate text-sm text-foreground">{acc.client_name || '—'}</span>
                                </div>
                              </TableCell>
                              <TableCell className="py-0 text-sm text-stage-neutral">{acc.email || '—'}</TableCell>
                              {isAdmin && <TableCell className="py-0 tabular-nums text-xs text-muted-foreground">{acc.bank_name || '—'}</TableCell>}
                              <TableCell className="py-0">
                                <Select
                                  value={acc.status || undefined}
                                  onValueChange={(value) => handleStatusChange(acc.id, value as BankAccountStatus)}
                                  disabled={isUpdating === acc.id}
                                >
                                  {/* The trigger IS the stage chip - one element
                                      that shows the stage and changes it, rather
                                      than a chip sitting next to a control. */}
                                  <SelectTrigger className={cn(
                                    'h-6 w-auto gap-1.5 whitespace-nowrap rounded-full border-0 px-2.5 text-xs [&>svg]:h-3 [&>svg]:w-3 [&>svg]:opacity-45',
                                    acc.status ? TONE_CHIP[STAGE_TONES[acc.status]] : 'bg-muted text-subtle',
                                  )}>
                                    {isUpdating === acc.id ? (
                                      <div className="flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin" /><span>Updating…</span></div>
                                    ) : (
                                      // The short label, not SelectValue: the chip has to fit a
                                      // table cell, and "Transfer made - waiting for AML letter"
                                      // does not. The dropdown below still lists the full names.
                                      <span>{acc.status ? STAGE_SHORT_LABELS[acc.status] : 'Set stage'}</span>
                                    )}
                                  </SelectTrigger>
                                  <SelectContent>
                                    {BANK_ACCOUNT_STATUSES.map((s) => (
                                      <SelectItem key={s} value={s} className="text-sm">{s}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell className="py-0">
                                <div className="flex items-center justify-end gap-2.5">
                                  <div className="h-1 w-14 overflow-hidden rounded-sm bg-secondary">
                                    <div className={cn('h-1 rounded-sm',
                                      stalled ? 'bg-stall' : days !== null && days >= 15 ? 'bg-stage-gold' : 'bg-stage-info')}
                                      style={{ width: `${agePct}%` }} />
                                  </div>
                                  <span className={cn('min-w-[62px] text-right tabular-nums text-sm',
                                    stalled ? 'text-stall-foreground' : settled ? 'text-subtle' : 'text-foreground')}>
                                    {settled ? '—' : formatDaysSince(days)}
                                  </span>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="flex items-center justify-between border-t border-border px-4 py-3">
                    <span className="tabular-nums text-xs text-subtle">
                      Showing {visibleAccounts.length === accounts.length ? `all ${accounts.length}` : `${visibleAccounts.length} of ${accounts.length}`} record{accounts.length === 1 ? '' : 's'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
