import { Users, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import { InviteUserDialog } from '@/components/InviteUserDialog';
import { BulkInviteDialog } from '@/components/BulkInviteDialog';
import { UsersTable } from '@/components/UsersTable';
import { useUsers } from '@/hooks/useUsers';
import { useBanks } from '@/hooks/useBanks';
import { useAdmin } from '@/hooks/useAdmin';
import { Button } from '@/components/ui/button';

const UserManagement = () => {
  const navigate = useNavigate();
  const { isAdmin, isLoading: isAdminLoading } = useAdmin();
  const { users, isLoading: isUsersLoading, error: usersError, refetch: refetchUsers } = useUsers();
  const { banks, isLoading: isBanksLoading, error: banksError } = useBanks();

  useEffect(() => {
    if (!isAdminLoading && !isAdmin) navigate('/');
  }, [isAdmin, isAdminLoading, navigate]);

  if (isAdminLoading) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }
  if (!isAdmin) return null;

  const isLoading = isUsersLoading || isBanksLoading;
  const error = usersError || banksError;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-6 lg:p-8">
          <div className="max-w-6xl mx-auto">
            <div className="flex justify-between items-center gap-4 mb-8">
              <div>
                <h1 className="mb-1.5 text-3xl leading-[1.1] text-foreground">User management</h1>
                <p className="text-muted-foreground">Invite new users and manage their bank assignments</p>
              </div>
              <div className="flex gap-2">
                <BulkInviteDialog banks={banks} onSuccess={refetchUsers} />
                <InviteUserDialog banks={banks} onSuccess={refetchUsers} />
              </div>
            </div>

            <div className="bg-card border border-border rounded-lg p-6 mb-8 shadow-card">
              <div className="flex items-center gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-md border border-border bg-primary/[0.1]"><Users className="h-5 w-5 text-primary" /></div>
                <div>
                  <p className="eyebrow mb-1.5">Total users</p>
                  <p className="tabular-nums text-3xl leading-none text-foreground">{users.length}</p>
                </div>
              </div>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
            ) : error ? (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-6 text-center">
                <AlertCircle className="w-8 h-8 text-destructive mx-auto mb-3" />
                <p className="text-destructive font-medium mb-2">Loading error</p>
                <p className="text-muted-foreground text-sm mb-4">{error}</p>
                <Button variant="outline" onClick={refetchUsers}><RefreshCw className="w-4 h-4 mr-2" />Retry</Button>
              </div>
            ) : users.length === 0 ? (
              <div className="bg-secondary/50 rounded-lg p-12 text-center">
                <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-foreground font-medium mb-2">No users found</p>
                <p className="text-muted-foreground text-sm">Invite the first user to get started</p>
              </div>
            ) : (
              <UsersTable users={users} banks={banks} onRefresh={refetchUsers} />
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default UserManagement;
