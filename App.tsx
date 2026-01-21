import React, { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from './services/supabase';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { AnalysisPage } from './components/AnalysisPage';
import { Activity, Zap, Hexagon, BarChart3, Lock, ChevronRight } from 'lucide-react';

function App() {
  const [session, setSession] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState<'dashboard' | 'analysis'>('dashboard');
  const [selectedPair, setSelectedPair] = useState<string>('BTCUSDT');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Check active session
    if (isSupabaseConfigured()) {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setLoading(false);
        });

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
        });
        return () => subscription.unsubscribe();
    } else {
        // Fallback for demo without Supabase keys
        setLoading(false);
    }
  }, []);

  const handleLogin = async () => {
    if(!isSupabaseConfigured()) {
        // Simulating login for demo
        setSession({ user: { id: 'demo-user', email: 'demo@example.com', user_metadata: { avatar_url: '' } } });
        return;
    }
    await supabase.auth.signInWithOAuth({
      provider: 'google',
    });
  };

  const handleLogout = async () => {
    if(isSupabaseConfigured()) {
        await supabase.auth.signOut();
    }
    setSession(null);
  };

  const navigateToAnalysis = (pair: string) => {
    setSelectedPair(pair);
    setCurrentPage('analysis');
  };

  if (loading) {
    return <div className="min-h-screen bg-[#030712] flex items-center justify-center text-blue-500 animate-pulse tracking-widest font-mono text-xs">INITIALIZING SYSTEM...</div>;
  }

  if (!session) {
    return (
      <div className="relative min-h-screen bg-[#030712] overflow-hidden flex flex-col items-center justify-center text-white selection:bg-blue-500/30 font-sans">
        
        {/* --- Background Ambient Effects --- */}
        <div className="absolute inset-0 z-0 pointer-events-none">
            {/* Deep Glow Gradient */}
            <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-900/10 rounded-full blur-[120px]" />
            <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-indigo-900/10 rounded-full blur-[120px]" />
            
            {/* Grid Overlay */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(17,24,39,0.3)_1px,transparent_1px),linear-gradient(90deg,rgba(17,24,39,0.3)_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_10%,transparent_100%)] opacity-20" />
            
            {/* Floating Particles/Candles (Simulated with div) */}
            <div className="absolute top-1/4 left-1/4 w-1 h-12 bg-gradient-to-b from-transparent via-green-500/20 to-transparent opacity-30 animate-pulse" style={{ animationDuration: '3s' }} />
            <div className="absolute top-2/3 right-1/3 w-1 h-16 bg-gradient-to-b from-transparent via-red-500/20 to-transparent opacity-30 animate-pulse" style={{ animationDuration: '4s' }} />
            <div className="absolute top-1/2 right-10 w-1 h-8 bg-gradient-to-b from-transparent via-blue-500/20 to-transparent opacity-20 animate-pulse" style={{ animationDuration: '2.5s' }} />
        </div>

        {/* --- Hero Visual: The Market Brain --- */}
        <div className="relative z-10 mb-12 group perspective-[1000px]">
           {/* Outer Ring */}
           <div className="absolute inset-0 border border-blue-500/10 rounded-full animate-[spin_10s_linear_infinite]" />
           <div className="absolute -inset-4 border border-dashed border-gray-800 rounded-full animate-[spin_20s_linear_infinite_reverse] opacity-50" />
           
           {/* Central Core */}
           <div className="relative w-32 h-32 md:w-40 md:h-40 bg-[#0b0f19] rounded-full border border-gray-800 flex items-center justify-center shadow-[0_0_50px_rgba(59,130,246,0.15)] overflow-hidden">
              {/* Internal Grid Scan */}
              <div className="absolute inset-0 bg-[linear-gradient(0deg,transparent_49%,rgba(59,130,246,0.2)_50%,transparent_51%)] bg-[size:100%_8px] animate-[translateY_2s_linear_infinite]" />
              
              {/* Icon */}
              <Hexagon className="text-blue-500 relative z-10 drop-shadow-[0_0_10px_rgba(59,130,246,0.8)]" size={48} strokeWidth={1.5} />
              
              {/* Inner Pulse */}
              <div className="absolute inset-0 bg-blue-500/5 rounded-full animate-ping" style={{ animationDuration: '3s' }} />
           </div>

           {/* Floating Data Nodes */}
           <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-6 flex gap-1">
              <div className="w-1 h-1 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
              <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
              <div className="w-1 h-1 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
           </div>
        </div>

        {/* --- Typography --- */}
        <div className="relative z-10 text-center space-y-6 max-w-2xl px-6">
          <h1 className="text-5xl md:text-7xl font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white via-gray-200 to-gray-500 drop-shadow-sm">
            Read the Market.<br/>
            <span className="text-gray-600">Not the Noise.</span>
          </h1>
          
          <div className="flex items-center justify-center gap-4 text-sm md:text-base text-gray-400 font-medium tracking-wide uppercase opacity-80">
            <span className="flex items-center gap-1"><Activity size={14} className="text-blue-500" /> Adaptive Analysis</span>
            <span className="w-1 h-1 bg-gray-700 rounded-full" />
            <span className="flex items-center gap-1"><BarChart3 size={14} className="text-blue-500" /> Order Flow</span>
            <span className="w-1 h-1 bg-gray-700 rounded-full" />
            <span className="flex items-center gap-1"><Lock size={14} className="text-blue-500" /> Control</span>
          </div>
        </div>

        {/* --- Action Area --- */}
        <div className="relative z-10 mt-16 w-full max-w-sm px-6">
          <button
            onClick={handleLogin}
            className="group relative w-full flex items-center justify-between bg-white/5 hover:bg-white/10 border border-white/10 hover:border-blue-500/50 backdrop-blur-md text-gray-200 py-4 px-6 rounded-xl transition-all duration-300 shadow-2xl hover:shadow-[0_0_20px_rgba(59,130,246,0.15)] overflow-hidden"
          >
            {/* Button Highlight Effect */}
            <div className="absolute top-0 left-0 w-1 h-full bg-blue-500 group-hover:w-1.5 transition-all" />
            
            <div className="flex items-center gap-3">
               <div className="bg-white rounded-full p-1.5">
                 <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="#000" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" /><path fill="#000" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="#000" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" /><path fill="#000" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /></svg>
               </div>
               <div className="text-left">
                  <span className="block text-xs text-gray-500 font-semibold uppercase tracking-wider">Access Terminal</span>
                  <span className="block font-medium text-white">Sign in with Google</span>
               </div>
            </div>
            <ChevronRight className="text-gray-500 group-hover:text-blue-400 group-hover:translate-x-1 transition-all" size={20} />
          </button>
          
          <div className="mt-6 text-center">
            <p className="text-[10px] text-gray-600 uppercase tracking-widest">
                {isSupabaseConfigured() ? 'Secure Connection Ready' : 'Demo Mode Active'}
            </p>
          </div>
        </div>

        {/* --- Footer Status Line --- */}
        <div className="absolute bottom-6 w-full flex justify-between px-8 text-[10px] text-gray-700 font-mono">
            <span>SYS: ONLINE</span>
            <span>V 2.4.0-PRO</span>
        </div>

      </div>
    );
  }

  return (
    <Layout 
      user={session.user} 
      onLogout={handleLogout}
      currentPage={currentPage}
      onNavigate={setCurrentPage}
    >
      {currentPage === 'dashboard' ? (
        <Dashboard onSelectPair={navigateToAnalysis} />
      ) : (
        <AnalysisPage 
          symbol={selectedPair} 
          user={session.user} 
          onBack={() => setCurrentPage('dashboard')} 
        />
      )}
    </Layout>
  );
}

export default App;