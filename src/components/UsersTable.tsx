import { useState, useMemo, useEffect } from 'react';
import { Shield, Calendar, Mail, User, Edit, Trash2, MoreHorizontal, Send, Search, ArrowUp, ArrowDown, ArrowUpDown, Clock, X, KeyRound } from 'lucide-react';
import { UserProfile } from '@/hooks/useUsers';
import { Bank } from '@/hooks/useBanks';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { getFunctionErrorMessage } from '@/lib/utils';
import { EditUserDialog } from './EditUserDialog';
import { DeleteUserDialog } from './DeleteUserDialog';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from '@/components/ui/pagination';

const ITEMS_PER_PAGE = 20;

interface UsersTableProps {
  users: UserProfile[];
  banks: Bank[];
  onRefresh: () => void;
}

type SortField = 'bank' | 'created_at' | 'last_sign_in_at';
type SortDirection = 'asc' | 'desc';

export const UsersTable = ({ users, banks, onRefresh }: UsersTableProps) => {
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [deletingUser, setDeletingUser] = useState<UserProfile | null>(null);
  const [resendingUserId, setResendingUserId] = useState<string | null>(null);
  const [resettingUserId, setResettingUserId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [bankFilter, setBankFilter] = useState('all');
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Reset to page 1 whenever filters change
  useEffect(() => { setCurrentPage(1); }, [searchQuery, bankFilter]);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const getBankName = (bankId: string | null) => {
    if (!bankId) return '-';
    const bank = banks.find(b => b.id === bankId);
    return bank?.name || bankId;
  };

  const handleResendInvite = async (userId: string) => {
    setResendingUserId(userId);
    try {
      const response = await supabase.functions.invoke('resend-invite', {
        body: { userId },
      });

      if (response.error) throw new Error(await getFunctionErrorMessage(response.error));
      if (response.data.error) throw new Error(response.data.error);

      toast.success(response.data.message || 'Invitation resent successfully');
    } catch (err) {
      console.error('Error resending invite:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to resend invitation');
    } finally {
      setResendingUserId(null);
    }
  };

  const handleResetPassword = async (userId: string) => {
    setResettingUserId(userId);
    try {
      const response = await supabase.functions.invoke('reset-password', {
        body: { userId },
      });

      if (response.error) throw new Error(await getFunctionErrorMessage(response.error));
      if (response.data.error) throw new Error(response.data.error);

      toast.success(response.data.message || 'Password reset email sent successfully');
    } catch (err) {
      console.error('Error resetting password:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to send password reset');
    } finally {
      setResettingUserId(null);
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortField(null);
        setSortDirection(null);
      }
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 ml-1 inline opacity-50" />;
    if (sortDirection === 'asc') return <ArrowUp className="w-3 h-3 ml-1 inline" />;
    return <ArrowDown className="w-3 h-3 ml-1 inline" />;
  };

  const hasActiveFilters = searchQuery !== '' || bankFilter !== 'all';

  const filteredAndSortedUsers = useMemo(() => {
    let result = [...users];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(u =>
        (u.email?.toLowerCase().includes(query)) ||
        (u.contact_name?.toLowerCase().includes(query))
      );
    }

    if (bankFilter !== 'all') {
      result = result.filter(u => u.bank_id === bankFilter);
    }

    if (sortField && sortDirection) {
      result.sort((a, b) => {
        let aVal: string | null;
        let bVal: string | null;

        if (sortField === 'bank') {
          aVal = getBankName(a.bank_id);
          bVal = getBankName(b.bank_id);
        } else {
          aVal = a[sortField];
          bVal = b[sortField];
        }

        if (!aVal && !bVal) return 0;
        if (!aVal) return 1;
        if (!bVal) return -1;

        const cmp = aVal.localeCompare(bVal);
        return sortDirection === 'asc' ? cmp : -cmp;
      });
    }

    return result;
  }, [users, searchQuery, bankFilter, sortField, sortDirection, banks]);

  const totalPages = Math.ceil(filteredAndSortedUsers.length / ITEMS_PER_PAGE);
  const paginatedUsers = filteredAndSortedUsers.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  return (
    <>
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by email or contact name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-secondary border-border text-foreground"
          />
        </div>
        <Select value={bankFilter} onValueChange={setBankFilter}>
          <SelectTrigger className="w-full sm:w-[200px] bg-secondary border-border text-foreground">
            <SelectValue placeholder="Filter by bank" />
          </SelectTrigger>
          <SelectContent className="bg-card border-border">
            <SelectItem value="all" className="text-foreground hover:bg-secondary">All Banks</SelectItem>
            {banks.map((bank) => (
              <SelectItem key={bank.id} value={bank.id} className="text-foreground hover:bg-secondary">
                {bank.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setSearchQuery(''); setBankFilter('all'); setCurrentPage(1); }}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4 mr-1" />
            Clear
          </Button>
        )}
      </div>

      {filteredAndSortedUsers.length === 0 ? (
        <div className="rounded-lg border border-border bg-gradient-card p-8 text-center">
          <p className="text-muted-foreground">No users match the current filters.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-gradient-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground font-medium">
                  <Mail className="w-4 h-4 inline mr-2" />
                  Email
                </TableHead>
                <TableHead className="text-muted-foreground font-medium">
                  <User className="w-4 h-4 inline mr-2" />
                  Contact Name
                </TableHead>
                <TableHead
                  className="text-muted-foreground font-medium cursor-pointer select-none hover:text-foreground"
                  onClick={() => handleSort('bank')}
                >
                  Bank
                  {getSortIcon('bank')}
                </TableHead>
                <TableHead className="text-muted-foreground font-medium">
                  <Shield className="w-4 h-4 inline mr-2" />
                  Role
                </TableHead>
                <TableHead
                  className="text-muted-foreground font-medium cursor-pointer select-none hover:text-foreground"
                  onClick={() => handleSort('created_at')}
                >
                  <Calendar className="w-4 h-4 inline mr-2" />
                  Created
                  {getSortIcon('created_at')}
                </TableHead>
                <TableHead
                  className="text-muted-foreground font-medium cursor-pointer select-none hover:text-foreground"
                  onClick={() => handleSort('last_sign_in_at')}
                >
                  <Clock className="w-4 h-4 inline mr-2" />
                  Last Login
                  {getSortIcon('last_sign_in_at')}
                </TableHead>
                <TableHead className="text-muted-foreground font-medium w-[50px]">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedUsers.map((user) => (
                <TableRow key={user.id} className="border-border hover:bg-secondary/50">
                  <TableCell className="text-foreground font-medium">
                    {user.email || '-'}
                  </TableCell>
                  <TableCell className="text-foreground">
                    {user.contact_name || '-'}
                  </TableCell>
                  <TableCell className="text-foreground">
                    {getBankName(user.bank_id)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={user.role === 'admin' ? 'default' : 'secondary'}
                      className={
                        user.role === 'admin'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-secondary text-secondary-foreground'
                      }
                    >
                      {user.role === 'admin' ? 'Admin' : 'Bank Staff'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(user.created_at)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(user.last_sign_in_at)}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8" disabled={resendingUserId === user.id || resettingUserId === user.id}>
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Open menu</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-card border-border">
                        <DropdownMenuItem
                          onClick={() => setEditingUser(user)}
                          className="text-foreground hover:bg-secondary cursor-pointer"
                        >
                          <Edit className="w-4 h-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        {user.email_confirmed_at ? (
                          <DropdownMenuItem
                            onClick={() => handleResetPassword(user.id)}
                            disabled={resettingUserId === user.id}
                            className="text-foreground hover:bg-secondary cursor-pointer"
                          >
                            <KeyRound className="w-4 h-4 mr-2" />
                            {resettingUserId === user.id ? 'Sending...' : 'Reset Password'}
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            onClick={() => handleResendInvite(user.id)}
                            disabled={resendingUserId === user.id}
                            className="text-foreground hover:bg-secondary cursor-pointer"
                          >
                            <Send className="w-4 h-4 mr-2" />
                            {resendingUserId === user.id ? 'Sending...' : 'Resend Invite'}
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() => setDeletingUser(user)}
                          className="text-destructive hover:bg-destructive/10 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4">
          <p className="text-sm text-muted-foreground">
            Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, filteredAndSortedUsers.length)} of {filteredAndSortedUsers.length} users
          </p>
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  onClick={(e) => { e.preventDefault(); if (currentPage > 1) setCurrentPage(p => p - 1); }}
                  aria-disabled={currentPage === 1}
                  className={currentPage === 1 ? 'pointer-events-none opacity-50' : ''}
                />
              </PaginationItem>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                .reduce<(number | 'ellipsis')[]>((acc, p, idx, arr) => {
                  if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('ellipsis');
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, idx) =>
                  p === 'ellipsis' ? (
                    <PaginationItem key={`ellipsis-${idx}`}>
                      <PaginationEllipsis />
                    </PaginationItem>
                  ) : (
                    <PaginationItem key={p}>
                      <PaginationLink
                        href="#"
                        isActive={currentPage === p}
                        onClick={(e) => { e.preventDefault(); setCurrentPage(p as number); }}
                      >
                        {p}
                      </PaginationLink>
                    </PaginationItem>
                  )
                )}
              <PaginationItem>
                <PaginationNext
                  href="#"
                  onClick={(e) => { e.preventDefault(); if (currentPage < totalPages) setCurrentPage(p => p + 1); }}
                  aria-disabled={currentPage === totalPages}
                  className={currentPage === totalPages ? 'pointer-events-none opacity-50' : ''}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}

      {editingUser && (
        <EditUserDialog
          user={editingUser}
          banks={banks}
          open={!!editingUser}
          onOpenChange={(open) => !open && setEditingUser(null)}
          onSuccess={() => {
            setEditingUser(null);
            onRefresh();
          }}
        />
      )}

      {deletingUser && (
        <DeleteUserDialog
          user={deletingUser}
          open={!!deletingUser}
          onOpenChange={(open) => !open && setDeletingUser(null)}
          onSuccess={() => {
            setDeletingUser(null);
            onRefresh();
          }}
        />
      )}
    </>
  );
};
