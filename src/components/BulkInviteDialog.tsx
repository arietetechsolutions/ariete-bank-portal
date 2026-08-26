import { useState, useMemo } from 'react';
import { Users, Mail, Shield, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { getFunctionErrorMessage } from '@/lib/utils';
import { Bank } from '@/hooks/useBanks';

interface BulkInviteDialogProps {
  banks: Bank[];
  onSuccess: () => void;
}

interface BulkResult {
  succeeded: number;
  failed: { email: string; error: string }[];
  total: number;
}

interface ParsedEntry {
  email: string;
  contactName: string;
  valid: boolean;
  error?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseEntries(text: string): ParsedEntry[] {
  return text
    .split(/\n+/)
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map(line => {
      const commaIndex = line.indexOf(',');
      if (commaIndex === -1) {
        return { email: line.trim(), contactName: '', valid: false, error: 'Missing contact name (use: email, contact name)' };
      }
      const email = line.substring(0, commaIndex).trim().toLowerCase();
      const contactName = line.substring(commaIndex + 1).trim();

      if (!email || !EMAIL_REGEX.test(email)) {
        return { email: email || line, contactName, valid: false, error: 'Invalid email' };
      }
      if (!contactName) {
        return { email, contactName: '', valid: false, error: 'Missing contact name' };
      }
      return { email, contactName, valid: true };
    });
}

export const BulkInviteDialog = ({ banks, onSuccess }: BulkInviteDialogProps) => {
  const [open, setOpen] = useState(false);
  const [entriesText, setEntriesText] = useState('');
  const [bankId, setBankId] = useState('');
  const [role, setRole] = useState<'admin' | 'bank_staff'>('bank_staff');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<BulkResult | null>(null);

  const parsedEntries = useMemo(() => parseEntries(entriesText), [entriesText]);
  const validEntries = useMemo(() => parsedEntries.filter(e => e.valid), [parsedEntries]);
  const invalidEntries = useMemo(() => parsedEntries.filter(e => !e.valid), [parsedEntries]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResult(null);

    if (validEntries.length === 0) {
      toast.error('No valid entries found');
      return;
    }
    if (!bankId) {
      toast.error('Please select a bank');
      return;
    }

    setIsLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('bulk-invite', {
        headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
        body: {
          entries: validEntries.map(e => ({ email: e.email, contactName: e.contactName })),
          bankId,
          role,
        },
      });

      if (response.error) throw new Error(await getFunctionErrorMessage(response.error));
      if (response.data.error) throw new Error(response.data.error);

      const bulkResult: BulkResult = {
        succeeded: response.data.succeeded,
        failed: response.data.failed || [],
        total: response.data.total,
      };
      setResult(bulkResult);

      if (bulkResult.failed.length === 0) {
        toast.success(`All ${bulkResult.succeeded} invitations sent successfully`);
        onSuccess();
      } else {
        toast.error(`${bulkResult.succeeded} sent, ${bulkResult.failed.length} failed`);
        onSuccess();
      }
    } catch (err) {
      console.error('Error in bulk invite:', err);
      toast.error(err instanceof Error ? err.message : 'Error sending invitations');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setEntriesText('');
    setBankId('');
    setRole('bank_staff');
    setResult(null);
  };

  const handleClose = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) handleReset();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogTrigger asChild>
        <Button variant="outline" className="border-border text-foreground hover:bg-secondary">
          <Users className="w-4 h-4 mr-2" />
          Bulk Invite
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[525px] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">Bulk Invite Users</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Invite multiple users at once. Enter one entry per line in the format: email, contact name. Bank and role are shared.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="py-4 space-y-4">
            <div className="flex items-center gap-3 p-4 rounded-lg bg-green-500/10 border border-green-500/20">
              <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
              <div>
                <p className="font-medium text-green-500">{result.succeeded} invitation(s) sent</p>
              </div>
            </div>
            {result.failed.length > 0 && (
              <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 space-y-2">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-destructive shrink-0" />
                  <p className="font-medium text-destructive">{result.failed.length} failed</p>
                </div>
                <ul className="text-sm text-muted-foreground space-y-1 ml-7">
                  {result.failed.map((f, i) => (
                    <li key={i}>{f.email}: {f.error}</li>
                  ))}
                </ul>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => handleClose(false)} className="border-border text-foreground hover:bg-secondary">
                Close
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="entries" className="text-foreground">
                  <Mail className="w-4 h-4 inline mr-2" />
                  Users (email, contact name) *
                </Label>
                <Textarea
                  id="entries"
                  placeholder={"john@example.com, John Doe\njane@example.com, Jane Smith\nmark@example.com, Mark Brown"}
                  value={entriesText}
                  onChange={(e) => setEntriesText(e.target.value)}
                  className="bg-secondary border-border text-foreground min-h-[140px] resize-y tabular-nums text-sm"
                  disabled={isLoading}
                />
                <div className="text-sm text-muted-foreground space-y-0.5">
                  <p>One entry per line: <span className="tabular-nums">email, contact name</span></p>
                  {parsedEntries.length > 0 && (
                    <p className="text-foreground">
                      {validEntries.length} valid entry(ies)
                      {invalidEntries.length > 0 && (
                        <span className="text-destructive">
                          {' '}- {invalidEntries.length} invalid: {invalidEntries.map(e => `${e.email || 'empty'} (${e.error})`).join(', ')}
                        </span>
                      )}
                    </p>
                  )}
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="bulkBank" className="text-foreground">
                  Bank *
                </Label>
                <Select value={bankId} onValueChange={setBankId} disabled={isLoading}>
                  <SelectTrigger className="bg-secondary border-border text-foreground">
                    <SelectValue placeholder="Select a bank" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {banks.map((bank) => (
                      <SelectItem key={bank.id} value={bank.id} className="text-foreground hover:bg-secondary">
                        {bank.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="bulkRole" className="text-foreground">
                  <Shield className="w-4 h-4 inline mr-2" />
                  Role
                </Label>
                <Select value={role} onValueChange={(v: 'admin' | 'bank_staff') => setRole(v)} disabled={isLoading}>
                  <SelectTrigger className="bg-secondary border-border text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="bank_staff" className="text-foreground hover:bg-secondary">Bank Staff</SelectItem>
                    <SelectItem value="admin" className="text-foreground hover:bg-secondary">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleClose(false)}
                className="border-border text-foreground hover:bg-secondary"
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isLoading || validEntries.length === 0}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4 mr-2" />
                    Send {validEntries.length} Invitation{validEntries.length !== 1 ? 's' : ''}
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};
