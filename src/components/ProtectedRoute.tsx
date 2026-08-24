import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading, passwordSet } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-hero flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  // A session alone is not enough. An invite link is itself a login - GoTrue
  // mints a full token pair at /auth/v1/verify - so gating only on "a user
  // exists" let anyone who clicked an invite email reach the dashboard without
  // ever choosing a password, leaving the account with no password at all and
  // a refresh token that rotates indefinitely.
  if (!passwordSet) return <Navigate to="/set-password" replace />;

  return <>{children}</>;
};

export default ProtectedRoute;
