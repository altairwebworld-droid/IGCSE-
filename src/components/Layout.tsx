import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { logout } from '../firebase';
import { LayoutDashboard, BookOpen, LogOut, Settings, TrendingUp, Target, Brain, Sparkles } from 'lucide-react';

export default function Layout() {
  const { user, isAdmin } = useAuth();
  const location = useLocation();

  const isTaskSession = location.pathname.includes('/task/');

  if (isTaskSession) {
    return <Outlet />; // Fullscreen for tasks
  }

  return (
    <div className="flex min-h-screen bg-[#F8F9FC]">
      {/* Sidebar */}
      <div className="w-72 flex-shrink-0 bg-white border-r border-slate-100 relative flex flex-col">
        <div className="flex h-20 items-center px-8">
          <div className="bg-brand-600 p-2 rounded-xl mr-3 shadow-lg shadow-brand-200">
            <BookOpen className="h-6 w-6 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight text-slate-900">IGCSE Prep</span>
        </div>
        
        <div className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          <Link
            to="/"
            className={`flex items-center px-5 py-3.5 text-sm font-semibold rounded-2xl transition-all duration-200 ${
              location.pathname === '/' ? 'bg-brand-50 text-brand-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <LayoutDashboard className="h-5 w-5 mr-3" />
            Dashboard
          </Link>
          <Link
            to="/progress"
            className={`flex items-center px-5 py-3.5 text-sm font-semibold rounded-2xl transition-all duration-200 ${
              location.pathname === '/progress' ? 'bg-brand-50 text-brand-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <TrendingUp className="h-5 w-5 mr-3" />
            Progress
          </Link>
          <Link
            to="/focus-areas"
            className={`flex items-center px-5 py-3.5 text-sm font-semibold rounded-2xl transition-all duration-200 ${
              location.pathname === '/focus-areas' ? 'bg-brand-50 text-brand-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <Target className="h-5 w-5 mr-3" />
            Focus Areas
          </Link>
          <Link
            to="/flashcards"
            className={`flex items-center px-5 py-3.5 text-sm font-semibold rounded-2xl transition-all duration-200 ${
              location.pathname === '/flashcards' ? 'bg-brand-50 text-brand-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <Brain className="h-5 w-5 mr-3" />
            Flashcards
          </Link>
          <Link
            to="/study-aids"
            className={`flex items-center px-5 py-3.5 text-sm font-semibold rounded-2xl transition-all duration-200 ${
              location.pathname === '/study-aids' ? 'bg-brand-50 text-brand-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <Sparkles className="h-5 w-5 mr-3" />
            Study Aids
          </Link>
          {isAdmin && (
            <Link
              to="/admin"
              className={`flex items-center px-5 py-3.5 text-sm font-semibold rounded-2xl transition-all duration-200 ${
                location.pathname === '/admin' ? 'bg-brand-50 text-brand-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Settings className="h-5 w-5 mr-3" />
              Admin Settings
            </Link>
          )}
        </div>

        <div className="p-6 bg-white border-t border-slate-50">
          <div className="flex items-center mb-6 p-2 rounded-2xl bg-slate-50 border border-slate-100">
            <img src={user?.photoURL || ''} alt="Profile" className="h-10 w-10 rounded-xl mr-3 shadow-sm" />
            <div className="overflow-hidden">
              <p className="text-sm font-bold text-slate-900 truncate">{user?.displayName}</p>
              <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Student Account</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex w-full items-center px-5 py-3 text-sm font-bold text-red-600 rounded-2xl hover:bg-red-50 transition-all"
          >
            <LogOut className="h-5 w-5 mr-3" />
            Sign Out
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white/80 backdrop-blur-md h-20 flex items-center justify-between px-10 border-b border-slate-50 sticky top-0 z-10">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {location.pathname === '/' ? 'Dashboard' : 
             location.pathname === '/admin' ? 'Admin Settings' : 
             location.pathname === '/progress' ? 'Progress Tracking' :
             location.pathname === '/focus-areas' ? 'Focus Areas' :
             location.pathname === '/flashcards' ? 'Flashcards' :
             location.pathname === '/study-aids' ? 'Study Aids' : ''}
          </h1>
          
          <div className="flex items-center space-x-4">
            <div className="bg-slate-50 px-4 py-2 rounded-2xl border border-slate-100 flex items-center">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse" />
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Live Session Active</span>
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
