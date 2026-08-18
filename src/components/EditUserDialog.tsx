import { useState, useEffect } from 'react';
import { Edit, Shield, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Bank } from '@/hooks/useBanks';
import { UserProfile } from '@/hooks/useUsers';

interface EditUserDialogProps {
  user: UserProfile;
  banks: Bank[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export const EditUserDialog = ({ user, banks, open, onOpenChange, onSuccess }: EditUserDialogProps) => {
  const [bankId, setBankId] = useState(user.bank_id || '');
  const [role, setRole] = useState<'admin' | 'bank_staff'>(user.role);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setBankId(user.bank_id || '');
    setRole(user.role);
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error('Not authenticated');
      }

      const response = await supabase.functions.invoke('update-user', {
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: {
          userId: user.id,
          role,
          bankId,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (response.data.error) {
        throw new Error(response.data.error);
      }

      toast.success('User updated successfully');

      onOpenChange(false);
      onSuccess();
    } catch (err) {
      console.error('Error updating user:', err);
      toast.error(err instanceof Error ? err.message : 'Error updating user');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">Edit User</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Update role and bank for {user.email}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="bank" className="text-foreground">
                Bank
              </Label>
              <Select value={bankId} onValueChange={setBankId}>
                <SelectTrigger className="bg-secondary border-border text-foreground">
                  <SelectValue placeholder="Select a bank" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {banks.map((bank) => (
                    <SelectItem
                      key={bank.id}
                      value={bank.id}
                      className="text-foreground hover:bg-secondary"
                    >
                      {bank.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="role" className="text-foreground">
                <Shield className="w-4 h-4 inline mr-2" />
                Role
              </Label>
              <Select value={role} onValueChange={(value: 'admin' | 'bank_staff') => setRole(value)}>
                <SelectTrigger className="bg-secondary border-border text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="bank_staff" className="text-foreground hover:bg-secondary">
                    Bank Staff
                  </SelectItem>
                  <SelectItem value="admin" className="text-foreground hover:bg-secondary">
                    Admin
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-border text-foreground hover:bg-secondary"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="bg-gradient-gold hover:opacity-90 text-primary-foreground"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Edit className="w-4 h-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
