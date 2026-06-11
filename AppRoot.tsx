import React, { useState } from 'react';
import App      from './App';
import AppNews  from './AppNews';

type Mode = 'home' | 'scalp' | 'news';

export default function AppRoot() {
  const [mode, setMode] = useState<Mode>('home');

  if (mode === 'scalp') return <App />;
  if (mode === 'news')  return <AppNews onBack={() => setMode('home')} />;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 gap-8"
         style={{ background: '#020c1b' }}>

      {/* Title */}
      <div className="text-center mb-4">
        <p className="font-tech text-xs mb-2" style={{ color: 'rgba(0,245,255,.4)' }}>
          ◈ TRADING TERMINAL v2.0
        </p>
        <p className="font-orbitron text-2xl font-black" style={{ color: '#00F5FF', textShadow: '0 0 20px rgba(0,245,255,.5)' }}>
          ОБЕРІТЬ БОТ
        </p>
      </div>

      {/* Scalp Bot button */}
      <button
        onClick={() => setMode('scalp')}
        className="w-full max-w-sm rounded-2xl p-6 text-left relative overflow-hidden scanlines transition-transform active:scale-95"
        style={{
          background: 'linear-gradient(135deg, rgba(0,255,136,.08), rgba(2,12,27,.9))',
          border: '1px solid rgba(0,255,136,.35)',
          boxShadow: '0 0 30px rgba(0,255,136,.15)',
        }}
      >
        {/* Corner brackets */}
        {['tl','tr','bl','br'].map(pos => (
          <div key={pos} className={`absolute w-4 h-4 ${
            pos==='tl'?'top-0 left-0':pos==='tr'?'top-0 right-0':pos==='bl'?'bottom-0 left-0':'bottom-0 right-0'
          }`} style={{
            borderTop:    pos.startsWith('t') ? '2px solid #00FF88' : undefined,
            borderBottom: pos.startsWith('b') ? '2px solid #00FF88' : undefined,
            borderLeft:   pos.endsWith('l')   ? '2px solid #00FF88' : undefined,
            borderRight:  pos.endsWith('r')   ? '2px solid #00FF88' : undefined,
          }} />
        ))}

        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
               style={{ border: '2px solid rgba(0,255,136,.5)', background: 'rgba(0,255,136,.1)',
                        boxShadow: '0 0 16px rgba(0,255,136,.3)' }}>
            <span className="font-orbitron text-xl font-black" style={{ color: '#00FF88' }}>◈</span>
          </div>
          <div>
            <p className="font-orbitron text-lg font-black mb-1" style={{ color: '#00FF88' }}>
              SCALP BOT
            </p>
            <p className="font-tech text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,.5)' }}>
              32 індикатори · XAU/USD + 9 пар{'\n'}
              Автосигнал кожні 30 сек · ATR стоп{'\n'}
              Економічний календар вбудований
            </p>
            <div className="flex gap-2 mt-3">
              {['EMA','MACD','RSI','ADX','BB'].map(t => (
                <span key={t} className="font-tech text-xs px-2 py-0.5 rounded"
                      style={{ background: 'rgba(0,255,136,.1)', color: 'rgba(0,255,136,.7)',
                               border: '1px solid rgba(0,255,136,.2)' }}>{t}</span>
              ))}
            </div>
          </div>
        </div>
        <p className="font-orbitron text-xs mt-4 text-right" style={{ color: 'rgba(0,255,136,.5)' }}>
          ВІДКРИТИ →
        </p>
      </button>

      {/* News Trader button */}
      <button
        onClick={() => setMode('news')}
        className="w-full max-w-sm rounded-2xl p-6 text-left relative overflow-hidden scanlines transition-transform active:scale-95"
        style={{
          background: 'linear-gradient(135deg, rgba(255,45,85,.08), rgba(2,12,27,.9))',
          border: '1px solid rgba(255,45,85,.35)',
          boxShadow: '0 0 30px rgba(255,45,85,.15)',
        }}
      >
        {['tl','tr','bl','br'].map(pos => (
          <div key={pos} className={`absolute w-4 h-4 ${
            pos==='tl'?'top-0 left-0':pos==='tr'?'top-0 right-0':pos==='bl'?'bottom-0 left-0':'bottom-0 right-0'
          }`} style={{
            borderTop:    pos.startsWith('t') ? '2px solid #FF2D55' : undefined,
            borderBottom: pos.startsWith('b') ? '2px solid #FF2D55' : undefined,
            borderLeft:   pos.endsWith('l')   ? '2px solid #FF2D55' : undefined,
            borderRight:  pos.endsWith('r')   ? '2px solid #FF2D55' : undefined,
          }} />
        ))}

        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
               style={{ border: '2px solid rgba(255,45,85,.5)', background: 'rgba(255,45,85,.1)',
                        boxShadow: '0 0 16px rgba(255,45,85,.3)' }}>
            <span className="font-orbitron text-xl font-black" style={{ color: '#FF2D55' }}>⚡</span>
          </div>
          <div>
            <p className="font-orbitron text-lg font-black mb-1" style={{ color: '#FF2D55' }}>
              NEWS TRADER
            </p>
            <p className="font-tech text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,.5)' }}>
              Finnhub · Реальний час{'\n'}
              BEAT/MISS аналіз · рекомендовані пари{'\n'}
              Таймінг входу · стрічка новин
            </p>
            <div className="flex gap-2 mt-3">
              {['NFP','CPI','FED','GDP','PMI'].map(t => (
                <span key={t} className="font-tech text-xs px-2 py-0.5 rounded"
                      style={{ background: 'rgba(255,45,85,.1)', color: 'rgba(255,45,85,.7)',
                               border: '1px solid rgba(255,45,85,.2)' }}>{t}</span>
              ))}
            </div>
          </div>
        </div>
        <p className="font-orbitron text-xs mt-4 text-right" style={{ color: 'rgba(255,45,85,.5)' }}>
          ВІДКРИТИ →
        </p>
      </button>

      <p className="font-tech text-xs text-center" style={{ color: 'rgba(255,255,255,.15)' }}>
        TRADING TERMINAL · SCALP + NEWS
      </p>
    </div>
  );
}
