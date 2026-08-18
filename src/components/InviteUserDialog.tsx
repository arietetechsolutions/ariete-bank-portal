import { useState } from 'react';
import { UserPlus, Mail, User, Shield, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Bank } from '@/hooks/useBanks';

interface InviteUserDialogProps { banks: Bank[]; onSuccess: () => void; }

export const InviteUserDialog = ({ banks, onSuccess }: InviteUserDialogProps) => {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [contactName, setContactName] = useState('');
  const [bankId, setBankId] = useState('');
  const [role, setRole] = useState<'admin' | 'bank_staff'>('bank_staff');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !contactName || !bankId) { toast.error('Please fill in all required fields'); return; }

    setIsLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('invite-user', {
        headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
        body: { email, contactName, bankId, role },
      });

      if (response.error) throw new Error(response.error.message);
      if (response.data.error) throw new Error(response.data.error);

      toast.success(response.data.message || 'Invitation sent successfully');
      setEmail(''); setContactName(''); setBankId(''); setRole('bank_staff'); setOpen(false);
      onSuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error sending invitation');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-gradient-gold hover:opacity-90 text-primary-foreground">
          <UserPlus className="w-4 h-4 mr-2" />Invite User
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Invite New User</DialogTitle>
          <DialogDescription>Send an email invitation with access credentials.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="email"><Mail className="w-4 h-4 inline mr-2" />Email *</Label>
              <Input id="email" type="email" placeholder="email@bank.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="contactName"><User className="w-4 h-4 inline mr-2" />Contact Name *</Label>
              <Input id="contactName" type="text" placeholder="Jane Doe" value={contactName} onChange={(e) => setContactName(e.target.value)} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="bank">Bank *</Label>
              <Select value={bankId} onValueChange={setBankId} required>
                <SelectTrigger><SelectValue placeholder="Select a bank" /></SelectTrigger>
                <SelectContent>
                  {banks.map((bank) => <SelectItem key={bank.id} value={bank.id}>{bank.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="role"><Shield className="w-4 h-4 inline mr-2" />Role</Label>
              <Select value={role} onValueChange={(v: 'admin' | 'bank_staff') => setRole(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank_staff">Bank Staff</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={isLoading} className="bg-gradient-gold hover:opacity-90 text-primary-foreground">
              {isLoading ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending...</>) : (<><Mail className="w-4 h-4 mr-2" />Send Invitation</>)}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
