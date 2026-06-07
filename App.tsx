import React, { useState } from 'react';
import { FreelanceDashboard } from './components/FreelanceDashboard';
import { PlatformsList } from './components/PlatformsList';
import { EarningsTracker } from './components/EarningsTracker';
import { ProfileEditor } from './components/ProfileEditor';
import { FreelanceProfile, EarningEntry } from './types';

type Tab = 'dashboard' | 'platforms' | 'earnings' | 'profile';

const PROFILE_KEY = 'freelance_profile';
const EARNINGS_KEY = 'freelance_earnings';

function loadProfile(): FreelanceProfile {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    return raw ? JSON.parse(raw) : { name: '', title: '', bio: '', skills: [], hourlyRate: 15, currency: 'USD' };
  } catch {
    return { name: '', title: '', bio: '', skills: [], hourlyRate: 15, currency: 'USD' };
  }
}

function loadEarnings(): EarningEntry[] {
  try {
    const raw = localStorage.getItem(EARNINGS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export default function App() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [profile, setProfile] = useState<FreelanceProfile>(loadProfile);
  const [earnings, setEarnings] = useState<EarningEntry[]>(loadEarnings);

  const saveProfile = (p: FreelanceProfile) => {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
    setProfile(p);
  };

  const saveEarnings = (e: EarningEntry[]) => {
    localStorage.setItem(EARNINGS_KEY, JSON.stringify(e));
    setEarnings(e);
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: 'dashboard', label: 'Головна' },
    { id: 'platforms', label: 'Платформи' },
    { id: 'earnings', label: 'Заробіток' },
    { id: 'profile', label: 'Профіль' },
  ];

  const totalEarnings = earnings.reduce((sum, e) => sum + (e.currency === 'USD' ? e.amount : e.currency === 'EUR' ? e.amount * 1.08 : e.amount / 41), 0);

  return (
    <div className="min-h-screen bg-gray-950 text-white font-sans">
      {/* Top bar */}
      <div className="sticky top-0 z-40 bg-gray-950/95 backdrop-blur border-b border-gray-800/60 px-4 py-3">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <div className="flex items-center gap-2">
            <span className="text-2xl">💼</span>
            <div>
              <p className="text-xs text-gray-500 leading-none">Freelance Hub</p>
              <p className="text-base font-black leading-tight text-green-400">
                {profile.name || 'Мій дашборд'}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">Всього зароблено</p>
            <p className="text-base font-bold text-green-400">${totalEarnings.toFixed(2)}</p>
          </div>
        </div>
      </div>

      {/* Tab nav */}
      <div className="sticky top-[57px] z-30 bg-gray-950/95 backdrop-blur border-b border-gray-800/40">
        <div className="flex max-w-lg mx-auto">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 py-2.5 text-sm font-semibold transition-colors border-b-2 ${
                tab === t.id
                  ? 'border-green-400 text-green-400'
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-lg mx-auto px-4 py-4 pb-8">
        {tab === 'dashboard' && <FreelanceDashboard profile={profile} earnings={earnings} onTabChange={setTab} />}
        {tab === 'platforms' && <PlatformsList />}
        {tab === 'earnings' && <EarningsTracker earnings={earnings} onUpdate={saveEarnings} />}
        {tab === 'profile' && <ProfileEditor profile={profile} onSave={saveProfile} />}
      </div>
    </div>
  );
}
