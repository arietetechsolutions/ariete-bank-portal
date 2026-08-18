import { Landmark, Users } from 'lucide-react';
import { useLocation, Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAdmin } from '@/hooks/useAdmin';

interface NavItem { icon: React.ElementType; label: string; href: string; adminOnly?: boolean; }

const navItems: NavItem[] = [
  { icon: Landmark, label: 'Accounts', href: '/' },
  { icon: Users, label: 'Bank Staff', href: '/users', adminOnly: true },
];

const Sidebar = () => {
  const location = useLocation();
  const { isAdmin } = useAdmin();

  return (
    <aside className="hidden md:flex w-64 min-h-[calc(100vh-73px)] bg-card border-r border-border flex-col">
      <nav className="flex-1 p-4">
        <ul className="space-y-1">
          {navItems.map((item) => {
            if (item.adminOnly && !isAdmin) return null;
            const isActive = location.pathname === item.href;
            return (
              <li key={item.label}>
                <Link to={item.href} className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                )}>
                  <item.icon className="w-5 h-5" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
};

export default Sidebar;
