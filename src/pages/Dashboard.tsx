import { useState } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
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

const Dashboard = () => {
  const { isAdmin } = useAdmin();
  const { data: bankAccounts, isLoading, error, refetch } = useBankAccounts();
  const { updateStatus, isUpdating } = useUpdateBankAccountStatus();
  const [confirmDialog, setConfirmDialog] = useState<{ id: string; newStatus: BankAccountStatus } | null>(null);

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
          <div className="max-w-5xl mx-auto">
            <h1 className="text-2xl font-bold text-foreground mb-6">{isAdmin ? 'All Clients' : 'Your Accounts'}</h1>

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

            {isLoading ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
            ) : error ? (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-6 text-center">
                <AlertCircle className="w-8 h-8 text-destructive mx-auto mb-3" />
                <p className="text-destructive font-medium mb-4">{error instanceof Error ? error.message : 'Failed to load accounts'}</p>
                <Button variant="outline" onClick={() => refetch()}>Retry</Button>
              </div>
            ) : !bankAccounts || bankAccounts.length === 0 ? (
              <div className="bg-secondary/50 rounded-lg p-12 text-center text-muted-foreground">No accounts yet.</div>
            ) : (
              <div className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead className="text-muted-foreground font-semibold">Client</TableHead>
                      <TableHead className="text-muted-foreground font-semibold">Email</TableHead>
                      {isAdmin && <TableHead className="text-muted-foreground font-semibold">Bank</TableHead>}
                      <TableHead className="text-muted-foreground font-semibold">Date Added</TableHead>
                      <TableHead className="text-muted-foreground font-semibold">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bankAccounts.map((acc) => (
                      <TableRow key={acc.id} className="border-border hover:bg-secondary/30">
                        <TableCell className="font-medium text-foreground">{acc.client_name || '-'}</TableCell>
                        <TableCell className="text-muted-foreground">{acc.email || '-'}</TableCell>
                        {isAdmin && <TableCell className="text-muted-foreground">{acc.bank_name || '-'}</TableCell>}
                        <TableCell className="text-muted-foreground">{new Date(acc.created_at).toLocaleDateString('en-US', { day: '2-digit', month: '2-digit', year: 'numeric' })}</TableCell>
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
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
