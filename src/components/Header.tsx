import { User, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import arieteLogo from '@/assets/ariete-logo.png';
import { useAuth } from '@/hooks/useAuth';
import { useAdmin } from '@/hooks/useAdmin';
import { useMyBank } from '@/hooks/useMyBank';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const Header = () => {
  const { user, signOut } = useAuth();
  const { isAdmin } = useAdmin();
  const { bankName } = useMyBank();
  const navigate = useNavigate();

  const handleLogout = async () => {
    const { error } = await signOut();
    if (error) toast.error('Logout error');
    else navigate('/auth');
  };

  return (
    <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="w-full px-4 py-4 flex items-center justify-between">
        <img src={arieteLogo} alt="Ariete Capital" className="h-10 w-auto" />
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 px-4 py-2 rounded-lg bg-secondary/50">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
              <User className="w-4 h-4 text-primary" />
            </div>
            <div className="text-sm">
              <p className="font-medium text-foreground">{user?.email || 'User'}</p>
              <p className="text-xs text-muted-foreground">{isAdmin ? 'Admin' : (bankName || 'Bank Staff')}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={handleLogout}>
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </header>
  );
};

export default Header;
