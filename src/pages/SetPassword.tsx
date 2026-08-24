import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, Lock, CheckCircle } from 'lucide-react';
import arieteLogo from '@/assets/ariete-logo.png';
import { z } from 'zod';

const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

const SetPassword = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkSession = async () => {
      try {
        // A token in the URL always wins over whatever session is already
        // cached - otherwise opening someone else's invite/recovery link in
        // a browser where you're already logged in silently keeps you
        // signed in as yourself instead of switching to the invited account.
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const type = hashParams.get('type');

        if (accessToken && (type === 'invite' || type === 'recovery' || type === 'signup' || type === 'magiclink')) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken, refresh_token: refreshToken || '',
          });
          if (sessionError) setError('Failed to verify invitation.');
          return;
        }

        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) { setError('Invalid or expired invitation link.'); return; }
        if (session) return;

        setError('Invalid invitation link.');
      } catch {
        setError('Something went wrong verifying your invitation. Please try the link again.');
      } finally {
        setIsVerifying(false);
      }
    };
    checkSession();
  }, []);

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      passwordSchema.parse(password);
    } catch (err) {
      if (err instanceof z.ZodError) { toast.error(err.errors[0].message); return; }
    }
    if (password !== confirmPassword) { toast.error('Passwords do not match'); return; }

    setIsLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setIsLoading(false);

    if (error) {
      toast.error(error.message);
    } else {
      setIsSuccess(true);
      toast.success('Password set successfully!');
      setTimeout(() => navigate('/'), 2000);
    }
  };

  if (isVerifying) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-border bg-card">
          <CardHeader className="text-center space-y-4">
            <div className="flex justify-center"><img src={arieteLogo} alt="Ariete Capital" className="h-16 w-auto" /></div>
            <div>
              <CardTitle className="font-display text-2xl font-bold text-foreground">Invitation Error</CardTitle>
              <CardDescription className="text-destructive mt-2">{error}</CardDescription>
            </div>
          </CardHeader>
          <CardContent><Button onClick={() => navigate('/auth')} className="w-full">Go to Login</Button></CardContent>
        </Card>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-border bg-card">
          <CardHeader className="text-center space-y-4">
            <div className="flex justify-center"><CheckCircle className="w-16 h-16 text-green-500" /></div>
            <div>
              <CardTitle className="font-display text-2xl font-bold text-foreground">Account Created!</CardTitle>
              <CardDescription className="text-muted-foreground">Redirecting to dashboard...</CardDescription>
            </div>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-border bg-card">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center"><img src={arieteLogo} alt="Ariete Capital" className="h-16 w-auto" /></div>
          <div>
            <CardTitle className="font-display text-2xl font-bold text-foreground">Welcome!</CardTitle>
            <CardDescription className="text-muted-foreground">Set your password to complete your account setup</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSetPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password" className="text-foreground">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input id="password" type="password" placeholder="••••••••" value={password}
                  onChange={(e) => setPassword(e.target.value)} className="pl-10" required minLength={8} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-foreground">Confirm Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input id="confirmPassword" type="password" placeholder="••••••••" value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)} className="pl-10" required minLength={8} />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Setting password...</>) : 'Set Password'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default SetPassword;
