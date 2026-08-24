import { useMemo, useState } from 'react';
import { Loader2, AlertCircle, Landmark, UserPlus, CircleCheck, Clock, ArrowRightLeft, ShieldCheck, ClipboardCheck, TrendingUp, CircleX } from 'lucide-react';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { useBankAccounts } from '@/hooks/useBankAccounts';
import { useUpdateBankAccountStatus } from '@/hooks/useUpdateBankAccountStatus';
import { useAdmin } from '@/hooks/useAdmin';
import { BANK_ACCOUNT_STATUSES, BankAccountStatus } from '@/types/bankAccount';
import { cn, daysSince, formatDaysSince } from '@/lib/utils';

const STATUS_ICONS: Record<BankAccountStatus, React.ElementType> = {
  'Registered': ClipboardCheck,
  'Onboarding': UserPlus,
  'Account Opened': CircleCheck,
  'Waiting for transfer': Clock,
  'Transfer made - waiting for AML letter': ArrowRightLeft,
  'AML Letter Issued': ShieldCheck,
  'Investment executed': TrendingUp,
  'Lost': CircleX,
};

const Dashboard = () => {
  const { isAdmin } = useAdmin();
  const { data: bankAccounts, isLoading, error, refetch } = useBankAccounts();
  const { updateStatus, isUpdating } = useUpdateBankAccountStatus();
  const [confirmDialog, setConfirmDialog] = useState<{ id: string; newStatus: BankAccountStatus } | null>(null);
  // null = no filter, show every account. Set by clicking a count tile.
  const [statusFilter, setStatusFilter] = useState<BankAccountStatus | null>(null);

  // Deliberately counted over every account, not the filtered view - the
  // tiles double as the filter control, so freezing the other tiles to 0
  // once a filter is active would make it impossible to switch to another
  // status or see where the rest of the book sits.
  const statusCounts = useMemo(() => {
    const counts = new Map<BankAccountStatus, number>();
    for (const s of BANK_ACCOUNT_STATUSES) counts.set(s, 0);
    for (const acc of bankAccounts || []) {
      if (acc.status) counts.set(acc.status, (counts.get(acc.status) || 0) + 1);
    }
    return counts;
  }, [bankAccounts]);

  const visibleAccounts = useMemo(
    () => (statusFilter ? (bankAccounts || []).filter((acc) => acc.status === statusFilter) : bankAccounts || []),
    [bankAccounts, statusFilter],
  );

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

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-6 lg:p-8">
          <div className="max-w-6xl mx-auto">
            <h1 className="text-2xl font-bold text-foreground mb-1">{isAdmin ? 'All Clients' : 'Your Accounts'}</h1>
            <p className="text-muted-foreground mb-6">
              {isAdmin ? 'Every client across both banks' : 'Track and update your clients’ account-opening status'}
            </p>

            <AlertDialog open={!!confirmDialog} onOpenChange={(open) => !open && setConfirmDialog(null)}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirm Status Update</AlertDialogTitle>
                  <AlertDialogDescription>
                    Update status to <strong>{confirmDialog?.newStatus}</strong>?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleConfirm}>Confirm</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            {!isLoading && !error && bankAccounts && bankAccounts.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
                <button
                  type="button"
                  onClick={() => setStatusFilter(null)}
                  aria-pressed={statusFilter === null}
                  className={cn(
                    'bg-gradient-card border rounded-lg p-4 shadow-card text-left transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    statusFilter === null ? 'border-primary ring-1 ring-primary' : 'border-border',
                  )}
                >
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Landmark className="w-4 h-4" />
                    <span className="text-xs font-medium">Total</span>
                  </div>
                  <p className="text-2xl font-bold text-foreground">{bankAccounts.length}</p>
                </button>
                {BANK_ACCOUNT_STATUSES.map((status) => {
                  const Icon = STATUS_ICONS[status];
                  const isActive = statusFilter === status;
                  return (
                    <button
                      key={status}
                      type="button"
                      // Clicking the active tile again clears the filter, so
                      // the Total tile is a convenience rather than the only
                      // way back to the full list.
                      onClick={() => setStatusFilter(isActive ? null : status)}
                      aria-pressed={isActive}
                      className={cn(
                        'bg-gradient-card border rounded-lg p-4 shadow-card text-left transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        isActive ? 'border-primary ring-1 ring-primary' : 'border-border',
                      )}
                    >
                      <div className="flex items-center gap-2 text-muted-foreground mb-1">
                        <Icon className="w-4 h-4" />
                        <span className="text-xs font-medium leading-tight">{status}</span>
                      </div>
                      <p className="text-2xl font-bold text-foreground">{statusCounts.get(status)}</p>
                    </button>
                  );
                })}
              </div>
            )}

            {isLoading ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
            ) : error ? (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-6 text-center">
                <AlertCircle className="w-8 h-8 text-destructive mx-auto mb-3" />
                <p className="text-destructive font-medium mb-4">{error instanceof Error ? error.message : 'Failed to load accounts'}</p>
                <Button variant="outline" onClick={() => refetch()}>Retry</Button>
              </div>
            ) : !bankAccounts || bankAccounts.length === 0 ? (
              <div className="bg-secondary/50 rounded-lg p-12 text-center">
                <Landmark className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-foreground font-medium mb-1">No accounts yet</p>
                <p className="text-muted-foreground text-sm">Clients will appear here once they're routed to a bank</p>
              </div>
            ) : visibleAccounts.length === 0 ? (
              <div className="bg-secondary/50 rounded-lg p-12 text-center">
                <Landmark className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-foreground font-medium mb-1">No accounts with this status</p>
                <p className="text-muted-foreground text-sm mb-4">Nothing is currently sitting in &ldquo;{statusFilter}&rdquo;</p>
                <Button variant="outline" onClick={() => setStatusFilter(null)}>Show all accounts</Button>
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
                {statusFilter && (
                  <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-border bg-secondary/30">
                    <p className="text-sm text-muted-foreground">
                      Showing <span className="font-medium text-foreground">{visibleAccounts.length}</span> of {bankAccounts.length} &middot; filtered to &ldquo;{statusFilter}&rdquo;
                    </p>
                    <Button variant="ghost" size="sm" onClick={() => setStatusFilter(null)}>Clear filter</Button>
                  </div>
                )}
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border hover:bg-transparent">
                        <TableHead className="text-muted-foreground font-semibold">Client</TableHead>
                        <TableHead className="text-muted-foreground font-semibold">Email</TableHead>
                        {isAdmin && <TableHead className="text-muted-foreground font-semibold">Bank</TableHead>}
                        <TableHead className="text-muted-foreground font-semibold whitespace-nowrap">Days in Status</TableHead>
                        <TableHead className="text-muted-foreground font-semibold">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visibleAccounts.map((acc) => (
                        <TableRow key={acc.id} className="border-border hover:bg-secondary/30">
                          <TableCell className="font-medium text-foreground">{acc.client_name || '-'}</TableCell>
                          <TableCell className="text-muted-foreground">{acc.email || '-'}</TableCell>
                          {isAdmin && <TableCell className="text-muted-foreground">{acc.bank_name || '-'}</TableCell>}
                          <TableCell className="text-muted-foreground whitespace-nowrap tabular-nums">{formatDaysSince(daysSince(acc.status_changed_on))}</TableCell>
                          <TableCell>
                            <Select
                              value={acc.status || undefined}
                              onValueChange={(value) => handleStatusChange(acc.id, value as BankAccountStatus)}
                              disabled={isUpdating === acc.id}
                            >
                              <SelectTrigger className="w-[280px] h-8">
                                {isUpdating === acc.id ? (
                                  <div className="flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin" /><span>Updating...</span></div>
                                ) : (
                                  <SelectValue placeholder="Select status" />
                                )}
                              </SelectTrigger>
                              <SelectContent>
                                {BANK_ACCOUNT_STATUSES.map((s) => (
                                  <SelectItem key={s} value={s}>{s}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
