import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { Button } from './ui/button';
import { cn } from './ui/utils';
import { Home, Activity, FileText, Settings, LogOut, User, ChevronRight, Scale, ArrowLeftRight, Layers, Database, Cloud } from 'lucide-react';

export default function Layout() {
  const { user, logout } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const menuItems = [
    { path: '/', icon: Home, label: t('home') },
    { path: '/recording-action', icon: Activity, label: t('recordingAction') },
    { path: '/intrans-recording-action', icon: ArrowLeftRight, label: t('intransRecordingAction') },
    { path: '/lpn-breakdown', icon: Layers, label: t('lpnBreakdown') },
    { path: '/record-documents', icon: FileText, label: t('recordDocuments') },
    { path: '/cloud-server', icon: Cloud, label: t('cloudServer') },
    { path: '/database', icon: Database, label: t('databases') },
    { path: '/setting', icon: Settings, label: t('setting') },
  ];

  return (
    <div className="flex h-screen bg-[#efebe9] overflow-hidden">
      {/* Sidebar */}
      <aside className="w-[272px] bg-[#fff8f0] border-r border-[#d7ccc8] flex flex-col shadow-lg">
        {/* Header / Brand */}
        <div className="px-5 pt-6 pb-5 border-b border-[#d7ccc8]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 brown-gradient-animated rounded-xl flex items-center justify-center shadow-md brown-glow-animated">
              <Scale className="w-5 h-5 text-white brown-pulse-animated" />
            </div>
            <div>
              <h1 className="font-bold text-base text-[#3e2723] leading-tight">
                Warehouse
              </h1>
              <p className="text-xs text-[#8d6e63] leading-tight">Incoming System</p>
            </div>
          </div>
        </div>

        {/* User Info */}
        <div className="px-5 py-4 border-b border-[#d7ccc8]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#f5ebe0] flex items-center justify-center flex-shrink-0 brown-pulse-animated">
              <User className="w-4 h-4 text-[#6d4c41]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[#3e2723] truncate">{user?.username}</p>
              <p className="text-xs text-[#8d6e63] capitalize">{user?.role || 'operator'}</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-200 group brown-hover-effect',
                  isActive
                    ? 'bg-gradient-to-r from-[#f5ebe0] to-[#efebe9] text-[#5d4037] shadow-sm border border-[#d7ccc8]'
                    : 'text-[#8d6e63] hover:bg-[#f5ebe0] hover:text-[#5d4037]'
                )}
              >
                <div className={cn(
                  'w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 flex-shrink-0',
                  isActive
                    ? 'brown-gradient-animated shadow-md brown-glow-animated'
                    : 'bg-[#efebe9] group-hover:bg-[#f5ebe0]'
                )}>
                  <Icon className={cn(
                    'w-4 h-4 transition-colors',
                    isActive ? 'text-white brown-pulse-animated' : 'text-[#8d6e63] group-hover:text-[#6d4c41]'
                  )} />
                </div>
                <span className={cn(
                  'flex-1 text-sm',
                  isActive ? 'font-semibold' : 'font-medium'
                )}>
                  {item.label}
                </span>
                {isActive && (
                  <ChevronRight className="w-4 h-4 text-[#8d6e63]" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Logout Button */}
        <div className="px-3 py-4 border-t border-[#d7ccc8]">
          <Button
            variant="outline"
            className="w-full justify-start gap-3 h-11 rounded-xl border-[#d7ccc8] text-[#8d6e63] hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-all duration-200 brown-hover-effect"
            onClick={handleLogout}
          >
            <LogOut className="w-4 h-4" />
            <span className="text-sm font-medium">{t('logout')}</span>
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto scroll-smooth">
        <div className="min-h-full">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
