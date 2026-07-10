import React from 'react';

interface Props {
  onEnter: () => void;
}

export function Greeting({ onEnter }: Props) {
  return (
    <div className="fixed inset-0 z-[200] bg-[#05050a] flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        <div className="text-5xl mb-4 text-center">🥇⚡₿</div>
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
        <div className="bg-[#0a0a12] border border-[#22223a] rounded-lg p-4 mb-6 text-xs text-gray-400 space-y-1.5 font-mono">
          <div>🥇 Золото · ₿ Крипта · 💱 Валюти — один бот, три ринки</div>
          <div>🧠 ШІ DeepSeek вчиться з журналу угод щодня</div>
          <div>📓 Розбір результатів — кожні 2 дні</div>
          <div>📈 Плече 20x, драбина ставок від $2</div>
        </div>
        <div className="bg-yellow-950/30 border border-yellow-700/40 rounded-lg p-3 mb-6 text-[11px] text-yellow-300 leading-relaxed">
          Це реальна торгівля реальними коштами з плечем 20x. Угоди виконуються
          на біржі одразу. Перевір ключі API та ризик, перш ніж вмикати бота.
        </div>
        <button
          onClick={onEnter}
          className="w-full py-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-bold text-white uppercase tracking-wide transition-all"
        >
          Погнали заробляти
        </button>
      </div>
    </div>
  );
}
