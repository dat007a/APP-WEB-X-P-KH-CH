import React from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { auth } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { 
  LayoutDashboard, 
  Users, 
  Settings, 
  FileText, 
  ClipboardList,
  History, 
  LogOut, 
  Scissors,
  Menu,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);

  const handleLogout = () => {
    auth.signOut();
    navigate('/login');
  };

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard, roles: ['admin', 'cashier', 'barber'] },
    { name: 'Nhân sự', path: '/admin', icon: Users, roles: ['admin'] },
    { name: 'Báo cáo KPI', path: '/reports', icon: FileText, roles: ['admin', 'cashier'] },
    { name: 'KPI Phiếu', path: '/kpi-tickets', icon: ClipboardList, roles: ['admin', 'cashier'] },
    { name: 'Nhật ký log', path: '/logs', icon: History, roles: ['admin', 'cashier'] },
    { name: 'Cài đặt', path: '/settings', icon: Settings, roles: ['admin'] },
  ];

  const filteredNav = navItems.filter(item => !item.roles || (profile && item.roles.includes(profile.role)));

  const showSidebar = profile && profile.role !== 'barber';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex font-sans overflow-hidden">
      {/* Sidebar */}
      {showSidebar && (
        <motion.aside 
          initial={false}
          animate={{ width: isSidebarOpen ? 260 : 80 }}
          className="bg-white border-r border-slate-200 flex flex-col transition-all duration-300 relative z-20 shadow-sm"
        >
          <div className="p-4 h-20 flex items-center justify-between border-b border-slate-100">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-indigo-200">
                <Scissors className="w-6 h-6 text-white" />
              </div>
              {isSidebarOpen && (
                <div className="leading-tight">
                  <h1 className="font-black text-lg tracking-tight text-slate-800">BARBER<span className="text-indigo-600">CONTROL</span></h1>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Hệ Thống Tường Barber Phát Triển</p>
                </div>
              )}
            </div>
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-400"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>

          <nav className="flex-1 p-4 space-y-1 overflow-y-auto overflow-x-hidden">
            {filteredNav.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 p-3 rounded-xl transition-all group relative ${
                    isActive 
                      ? 'bg-indigo-50 text-indigo-600 font-bold' 
                      : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                  }`}
                >
                  <item.icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-indigo-600' : 'group-hover:text-slate-800'}`} />
                  {isSidebarOpen && (
                    <span className="text-sm whitespace-nowrap">{item.name}</span>
                  )}
                  {!isSidebarOpen && (
                    <div className="absolute left-16 bg-slate-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 whitespace-nowrap">
                      {item.name}
                    </div>
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="p-4 border-t border-slate-100">
            {profile && isSidebarOpen && (
              <div className="mb-4 p-3 bg-slate-50 rounded-xl flex items-center gap-3 border border-slate-100">
                <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center text-sm font-bold shadow-sm">
                  {profile.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate text-slate-800">{profile.name}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">{profile.role}</p>
                </div>
              </div>
            )}
            <button
              onClick={handleLogout}
              className={`w-full flex items-center gap-3 p-3 rounded-xl text-slate-500 hover:bg-red-50 hover:text-red-500 transition-all group`}
            >
              <LogOut className="w-5 h-5 shrink-0 group-hover:text-red-500" />
              {isSidebarOpen && <span className="text-sm font-medium">Đăng xuất</span>}
            </button>
          </div>
        </motion.aside>
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-20 px-8 border-b border-slate-200 flex items-center justify-between bg-white z-10 shrink-0 shadow-sm">
          {!showSidebar ? (
             <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shrink-0">
                  <Scissors className="w-5 h-5 text-white" />
                </div>
                <div className="leading-tight">
                  <h1 className="font-black text-sm tracking-tight text-slate-800 uppercase">Barber Control</h1>
                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Hệ Thống Tường Barber</p>
                </div>
             </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-slate-400 font-bold uppercase tracking-widest">
              <span>Trang chủ</span>
              <ChevronRight className="w-4 h-4" />
              <span className="text-slate-800">
                {navItems.find(i => i.path === location.pathname)?.name || 'Dashboard'}
              </span>
            </div>
          )}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3 bg-slate-50 px-4 py-2 rounded-full border border-slate-100">
               <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-lg shadow-green-200" />
               <span className="text-xs font-bold text-slate-600 capitalize">
                 {profile?.role}: {profile?.name}
               </span>
            </div>
            <div className="text-right hidden sm:block">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Hệ thống v2.4</p>
              <p className="text-sm font-black text-indigo-600 tabular-nums">
                {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </p>
            </div>
          </div>
        </header>
        
        <div className="flex-1 overflow-auto p-8 lg:p-10 bg-slate-50/50">
          {children}
        </div>
      </main>
    </div>
  );
}
