import { useState } from 'react';
import { LogOut, Menu } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import arieteLogo from '@/assets/ariete-logo.png';
import { useAuth } from '@/hooks/useAuth';
import { useAdmin } from '@/hooks/useAdmin';
import { useMyBank } from '@/hooks/useMyBank';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { SidebarNav } from '@/components/Sidebar';
import { toast } from 'sonner';

const Header = () => {
  const { user, signOut } = useAuth();
  const { isAdmin } = useAdmin();
  const { bankName, contactName } = useMyBank();
  const navigate = useNavigate();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const displayName = contactName?.trim() || user?.email || 'User';
  // Two-letter monogram, mono-spaced - the design system substitutes initial
  // tiles for headshots rather than inventing photography.
  const initials = (contactName?.trim() || user?.email || '?')
    .split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('') || '?';

  const handleLogout = async () => {
    const { error } = await signOut();
    if (error) toast.error('Logout error');
    else navigate('/auth');
  };

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-sidebar">
      <div className="w-full px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[236px] border-border bg-sidebar p-3">
              <nav className="mt-8">
                <SidebarNav onNavigate={() => setMobileNavOpen(false)} />
              </nav>
            </SheetContent>
          </Sheet>
          <img src={arieteLogo} alt="Ariete Capital" className="h-10 w-auto" />
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="flex flex-col items-end gap-0.5">
              <span className="text-sm text-foreground">{displayName}</span>
              <span className="text-xs font-medium text-subtle">{isAdmin ? 'Admin' : (bankName || 'Bank staff')}</span>
            </div>
            <span className="flex h-8 w-8 flex-none items-center justify-center rounded-md border border-border bg-secondary tabular-nums text-xs text-muted-foreground">
              {initials}
            </span>
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
