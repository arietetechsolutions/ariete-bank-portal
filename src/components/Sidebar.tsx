import { BookOpen, Landmark, Users } from 'lucide-react';
import { useLocation, Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAdmin } from '@/hooks/useAdmin';

interface NavItem { icon: React.ElementType; label: string; href: string; visible: (isAdmin: boolean) => boolean; }

const navItems: NavItem[] = [
  { icon: Landmark, label: 'Clients', href: '/', visible: () => true },
  { icon: Users, label: 'User Management', href: '/users', visible: (isAdmin) => isAdmin },
  // Last, and visible to everyone: it is reference material, not a task.
  { icon: BookOpen, label: 'Quick Guide', href: '/quick-guide', visible: () => true },
];

export const SidebarNav = ({ onNavigate }: { onNavigate?: () => void }) => {
  const location = useLocation();
  const { isAdmin } = useAdmin();

  return (
    <ul className="space-y-1">
      {navItems.map((item) => {
        if (!item.visible(isAdmin)) return null;
        const isActive = location.pathname === item.href;
        return (
          <li key={item.label}>
            {/* Active state is a 2px rust rule plus a wash, not a filled
                block - the accent is allowed one appearance per view and a
                solid rust button would spend it on navigation. */}
            <Link to={item.href} onClick={onNavigate} className={cn(
              "flex items-center gap-2.5 rounded-md border-l-2 px-3 py-2.5 text-base transition-colors duration-fast",
              isActive
                ? "border-primary bg-primary/[0.12] font-semibold text-primary"
                : "border-transparent text-muted-foreground hover:bg-secondary hover:text-foreground"
            )}>
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
};

const Sidebar = () => {
  return (
    <aside className="hidden min-h-[calc(100vh-73px)] w-[236px] flex-none flex-col border-r border-border bg-sidebar md:flex">
      <nav className="flex-1 px-3 py-6">
        <SidebarNav />
      </nav>
    </aside>
  );
};

export default Sidebar;
