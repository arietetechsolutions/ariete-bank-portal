import { Loader2, AlertCircle } from 'lucide-react';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useBankAccounts } from '@/hooks/useBankAccounts';
import BankAccountStatusBadge from '@/components/BankAccountStatusBadge';

const Dashboard = () => {
  const { data: bankAccounts, isLoading, error, refetch } = useBankAccounts();

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-6 lg:p-8">
          <div className="max-w-5xl mx-auto">
            <h1 className="text-2xl font-bold text-foreground mb-6">Your Accounts</h1>

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
                      <TableHead className="text-muted-foreground font-semibold">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bankAccounts.map((acc) => (
                      <TableRow key={acc.id} className="border-border hover:bg-secondary/30">
                        <TableCell className="font-medium text-foreground">{acc.client_name || '-'}</TableCell>
                        <TableCell><BankAccountStatusBadge status={acc.status} /></TableCell>
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
