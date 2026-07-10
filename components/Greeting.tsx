import React from 'react';

interface Props {
  onEnter: () => void;
}

const FEATURES = [
  { icon: '🥇⚡₿', text: 'Золото · Крипта · Валюти — один бот, багато ринків' },
  { icon: '🧠', text: 'ШІ DeepSeek вчиться з журналу угод щодня' },
  { icon: '📓', text: 'Чесний розбір результатів — кожні 2 дні' },
];

export function Greeting({ onEnter }: Props) {
  return (
    <div className="fixed inset-0 z-[200] bg-[#05050a]">
      <style>{`
        @keyframes botFloat { 0%, 100% { transform: translateY(0) rotate(-1deg); } 50% { transform: translateY(-10px) rotate(1deg); } }
        @keyframes botBlink { 0%, 92%, 100% { transform: scaleY(1); } 96% { transform: scaleY(0.1); } }
        @keyframes botArmLeft { 0%, 100% { transform: rotate(-8deg); } 50% { transform: rotate(-26deg); } }
        @keyframes botArmRight { 0%, 100% { transform: rotate(18deg); } 50% { transform: rotate(4deg); } }
        @keyframes botAntenna { 0%, 100% { box-shadow: 0 0 4px 1px rgba(96,165,250,0.6); } 50% { box-shadow: 0 0 10px 3px rgba(96,165,250,1); } }
        @keyframes barBounce { 0%, 100% { height: 20%; } 50% { height: 90%; } }
        @keyframes floatUp { 0% { transform: translateY(0) translateX(0); opacity: 0; } 10% { opacity: 1; } 90% { opacity: 1; } 100% { transform: translateY(-140px) translateX(var(--drift, 10px)); opacity: 0; } }
        @keyframes cardIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes glowPulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
        .bot-wrap { animation: botFloat 3.4s ease-in-out infinite; }
        .bot-eye { animation: botBlink 4.2s ease-in-out infinite; transform-origin: center; }
        .bot-arm-l { animation: botArmLeft 2.2s ease-in-out infinite; transform-origin: top center; }
        .bot-arm-r { animation: botArmRight 2.6s ease-in-out infinite; transform-origin: top center; }
        .bot-antenna-dot { animation: botAntenna 1.6s ease-in-out infinite; }
        .bot-bar { animation: barBounce 1.4s ease-in-out infinite; }
        .float-particle { position: absolute; bottom: -20px; animation: floatUp linear infinite; }
        .feature-card { animation: cardIn 0.5s ease-out both; }
        .glow-dot { animation: glowPulse 2s ease-in-out infinite; }
      `}</style>

      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {['💰', '₿', '🥇', '📈', '💎'].map((emoji, i) => (
          <span
            key={i}
            className="float-particle text-2xl select-none"
            style={{
              left: `${10 + i * 18}%`,
              animationDuration: `${5 + i}s`,
              animationDelay: `${i * 0.9}s`,
              ['--drift' as any]: `${(i % 2 === 0 ? 1 : -1) * 20}px`,
            }}
          >
            {emoji}
          </span>
        ))}
      </div>

      <div className="relative h-full overflow-y-auto p-6">
      <div className="max-w-md w-full mx-auto py-4">
        <div className="bot-wrap flex justify-center mb-2">
          <svg width="120" height="120" viewBox="0 0 120 120">
            <rect x="30" y="10" width="8" height="14" rx="4" fill="#3b82f6" />
            <circle className="bot-antenna-dot" cx="34" cy="8" r="5" fill="#60a5fa" />

            <rect x="14" y="24" width="92" height="56" rx="16" fill="#151a2e" stroke="#2b3358" strokeWidth="2" />
            <rect className="bot-eye" x="34" y="44" width="12" height="14" rx="6" fill="#60a5fa" />
            <rect className="bot-eye" x="74" y="44" width="12" height="14" rx="6" fill="#60a5fa" style={{ animationDelay: '0.15s' }} />

            <rect x="26" y="90" width="68" height="26" rx="8" fill="#101425" stroke="#2b3358" strokeWidth="2" />
            <rect className="bot-bar" x="34" y="98" width="7" height="12" fill="#10b981" style={{ animationDelay: '0s' }} />
            <rect className="bot-bar" x="45" y="98" width="7" height="12" fill="#ef4444" style={{ animationDelay: '0.25s' }} />
            <rect className="bot-bar" x="56" y="98" width="7" height="12" fill="#10b981" style={{ animationDelay: '0.5s' }} />
            <rect className="bot-bar" x="67" y="98" width="7" height="12" fill="#10b981" style={{ animationDelay: '0.75s' }} />
            <rect className="bot-bar" x="78" y="98" width="7" height="12" fill="#ef4444" style={{ animationDelay: '1s' }} />

            <rect className="bot-arm-l" x="4" y="46" width="10" height="30" rx="5" fill="#2b3358" />
            <rect className="bot-arm-r" x="106" y="46" width="10" height="30" rx="5" fill="#2b3358" />
          </svg>
        </div>

        <h1 className="text-xl font-black text-center text-white uppercase tracking-wide mb-2">
          Вітаю на борту, трейдере
        </h1>
        <p className="text-sm text-gray-400 text-center mb-6 leading-relaxed">
          Я — твій скальп-бот на ШІ. Читаю золото, крипту й валюти одночасно,
          шукаю сетапи по Smart Money Concepts і не сплю, поки ринок дихає.
          Кожну угоду записую в журнал, а раз на два дні сідаю й чесно розбираю
          сам себе: що спрацювало, що ні, і чому. Драбина ставок росте разом
          із твоїм балансом — від обережних $2 до серйозніших сум, коли є що
          захищати.
        </p>

        <div className="space-y-2 mb-6">
          {FEATURES.map((f, i) => (
            <div
              key={i}
              className="feature-card bg-[#0a0a12] border border-[#22223a] rounded-lg p-3 text-xs text-gray-300 flex items-center gap-3 font-mono"
              style={{ animationDelay: `${0.15 + i * 0.15}s` }}
            >
              <span className="text-lg shrink-0">{f.icon}</span>
              <span>{f.text}</span>
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 glow-dot ml-auto shrink-0" />
            </div>
          ))}
          <div className="feature-card bg-[#0a0a12] border border-[#22223a] rounded-lg p-3 text-xs text-gray-300 flex items-center gap-3 font-mono" style={{ animationDelay: '0.6s' }}>
            <span className="text-lg shrink-0">⚡</span>
            <span>Плече 20x, лімітні ордери — менше спреду й комісії</span>
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 glow-dot ml-auto shrink-0" />
          </div>
        </div>

        <div className="bg-yellow-950/30 border border-yellow-700/40 rounded-lg p-3 mb-6 text-[11px] text-yellow-300 leading-relaxed">
          Це реальна торгівля реальними коштами з плечем 20x. Угоди виконуються
          на біржі одразу. Перевір ключі API та ризик, перш ніж вмикати бота.
          Без ключів бот сам перейде на демо-рахунок — так само аналізує ринок
          і вчиться, просто без реальних грошей.
        </div>

        <button
          onClick={onEnter}
          className="w-full py-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-bold text-white uppercase tracking-wide transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          Погнали заробляти
        </button>
      </div>
      </div>
    </div>
  );
}
