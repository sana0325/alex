import React, { useState } from 'react';
import { Activity, LogOut, Settings } from 'lucide-react';
import { SettingsModal } from './SettingsModal';

interface LayoutProps {
  children: React.ReactNode;
  user: any;
  onLogout: () => void;
  currentPage: 'dashboard' | 'analysis';
  onNavigate: (page: 'dashboard' | 'analysis') => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, user, onLogout, currentPage, onNavigate }) => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#0b0f19] text-gray-100 font-sans selection:bg-blue-500/30 pb-safe">
      {/* Header - Sticky & Touch Optimized */}
      <header className="sticky top-0 z-50 bg-[#111827]/95 backdrop-blur-md border-b border-gray-800 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            {/* Logo Area - Large Touch Target */}
            <div 
              className="flex items-center gap-2 cursor-pointer active:opacity-70 transition-opacity" 
              onClick={() => onNavigate('dashboard')}
            >
              <div className="bg-gradient-to-tr from-blue-600 to-indigo-600 p-2 rounded-lg">
                <Activity className="h-6 w-6 text-white" />
              </div>
              <span className="font-bold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-400">
                CryptoScalp<span className="text-white font-light">Pro</span>
              </span>
            </div>

            {user && (
              <div className="flex items-center space-x-2 md:space-x-4">
                {/* Desktop Nav */}
                <nav className="hidden md:flex space-x-2">
                  <button
                    onClick={() => onNavigate('dashboard')}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      currentPage === 'dashboard' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Dashboard
                  </button>
                  <button
                     onClick={() => onNavigate('analysis')} 
                     className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      currentPage === 'analysis' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Analysis
                  </button>
                </nav>
                
                <div className="hidden md:block h-6 w-px bg-gray-700 mx-2"></div>
                
                {/* User Controls - Touch Optimized */}
                <div className="flex items-center gap-2 md:gap-3">
                  <button
                    onClick={() => setIsSettingsOpen(true)}
                    className="p-3 text-gray-400 hover:text-white hover:bg-gray-800 rounded-full transition-colors active:scale-95 touch-manipulation"
                    title="Execution Settings"
                  >
                    <Settings className="h-6 w-6" />
                  </button>
                  
                  <img 
                    src={user.user_metadata.avatar_url || `https://ui-avatars.com/api/?name=${user.email}`} 
                    alt="User" 
                    className="h-8 w-8 md:h-9 md:w-9 rounded-full border border-gray-700 select-none"
                  />
                  
                  <button
                    onClick={onLogout}
                    className="p-3 text-gray-400 hover:text-red-400 transition-colors active:scale-95 touch-manipulation"
                  >
                    <LogOut className="h-6 w-6" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content - SafeArea padding for mobile home indicators handled by pb-safe in container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-6">
        {children}
      </main>

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
};