import React from 'react';
import { FreelanceProfile, EarningEntry } from '../types';

interface Props {
  profile: FreelanceProfile;
  earnings: EarningEntry[];
  onTabChange: (tab: any) => void;
}

const TIPS = [
  'Заповни профіль на 100% — клієнти обирають виконавців з фото та детальним описом.',
  'Починай з нижчої ціни, щоб отримати перші відгуки. Потім підвищуй ставку.',
  'Відповідай на замовлення протягом 1 години — це різко збільшує шанс отримати роботу.',
  'Спеціалізуйся на одній ніші — дизайн логотипів, SEO-тексти, Python скрипти.',
  'Портфоліо з 3-5 реальних проектів важливіше за сертифікати.',
  'Upwork дає 10 безкоштовних заявок на місяць — використовуй їх мудро.',
  'Fiverr гig з відео-презентацією отримує в 3 рази більше замовлень.',
  'Додай у профіль тести знань на Upwork — вони з\'являються у пошуку.',
];

const STEPS = [
  { icon: '👤', title: 'Створи профіль', desc: 'Заповни ім\'я, навички та ставку у вкладці "Профіль"' },
  { icon: '🎯', title: 'Обери платформу', desc: 'Зайди у "Платформи" та знайди ту, що підходить під твої навички' },
  { icon: '📝', title: 'Зареєструйся', desc: 'Реєстрація безкоштовна на всіх платформах у нашому списку' },
  { icon: '💼', title: 'Відправ 5 заявок', desc: 'Перші відгуки — ключ до успіху. Не бійся низької ставки спочатку' },
  { icon: '💰', title: 'Записуй заробіток', desc: 'Фіксуй кожний платіж у "Заробіток" щоб бачити прогрес' },
];

export function FreelanceDashboard({ profile, earnings, onTabChange }: Props) {
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthEarnings = earnings.filter(e => e.date.startsWith(thisMonth));
  const monthTotal = monthEarnings.reduce((s, e) => s + (e.currency === 'USD' ? e.amount : e.currency === 'EUR' ? e.amount * 1.08 : e.amount / 41), 0);
  const allTime = earnings.reduce((s, e) => s + (e.currency === 'USD' ? e.amount : e.currency === 'EUR' ? e.amount * 1.08 : e.amount / 41), 0);
  const platforms = [...new Set(earnings.map(e => e.platform))];
  const todayTip = TIPS[now.getDate() % TIPS.length];
  const isNewUser = !profile.name && earnings.length === 0;

  return (
    <div className="space-y-4">
      {/* Welcome / stats */}
      {isNewUser ? (
        <div className="bg-gradient-to-br from-green-900/40 to-emerald-900/20 border border-green-800/40 rounded-2xl p-5">
          <p className="text-2xl font-black text-white mb-1">Вітаємо! 👋</p>
          <p className="text-gray-400 text-sm mb-4">Freelance Hub допоможе тобі заробляти без жодних вкладень. Слідуй крокам нижче щоб розпочати.</p>
          <button
            onClick={() => onTabChange('profile')}
            className="w-full bg-green-500 hover:bg-green-400 text-black font-bold py-2.5 rounded-xl text-sm transition-colors"
          >
            Заповнити профіль →
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
            <p className="text-xs text-gray-500 mb-1">Цього місяця</p>
            <p className="text-2xl font-black text-green-400">${monthTotal.toFixed(2)}</p>
            <p className="text-xs text-gray-600">{monthEarnings.length} операцій</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
            <p className="text-xs text-gray-500 mb-1">Всього</p>
            <p className="text-2xl font-black text-white">${allTime.toFixed(2)}</p>
            <p className="text-xs text-gray-600">{earnings.length} операцій</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
            <p className="text-xs text-gray-500 mb-1">Платформи</p>
            <p className="text-2xl font-black text-blue-400">{platforms.length}</p>
            <p className="text-xs text-gray-600">активних</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
            <p className="text-xs text-gray-500 mb-1">Ставка</p>
            <p className="text-2xl font-black text-yellow-400">${profile.hourlyRate}/г</p>
            <p className="text-xs text-gray-600">{profile.currency}</p>
          </div>
        </div>
      )}

      {/* Daily tip */}
      <div className="bg-blue-950/40 border border-blue-800/30 rounded-2xl p-4">
        <p className="text-xs text-blue-400 font-semibold mb-1.5">💡 Порада дня</p>
        <p className="text-sm text-gray-300">{todayTip}</p>
      </div>

      {/* Quick start steps */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
        <p className="text-sm font-bold text-white mb-3">Швидкий старт</p>
        <div className="space-y-3">
          {STEPS.map((step, i) => {
            const done =
              (i === 0 && !!profile.name) ||
              (i === 4 && earnings.length > 0);
            return (
              <div key={i} className="flex items-start gap-3">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm flex-shrink-0 ${done ? 'bg-green-500/20 text-green-400' : 'bg-gray-800 text-gray-400'}`}>
                  {done ? '✓' : step.icon}
                </div>
                <div>
                  <p className={`text-sm font-semibold ${done ? 'text-green-400 line-through' : 'text-white'}`}>{step.title}</p>
                  <p className="text-xs text-gray-500">{step.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Skills */}
      {profile.skills.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
          <p className="text-sm font-bold text-white mb-2">Мої навички</p>
          <div className="flex flex-wrap gap-2">
            {profile.skills.map(s => (
              <span key={s} className="bg-gray-800 text-gray-300 text-xs px-3 py-1 rounded-full">{s}</span>
            ))}
          </div>
        </div>
      )}

      {/* Recent earnings */}
      {earnings.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
          <p className="text-sm font-bold text-white mb-3">Останні надходження</p>
          <div className="space-y-2">
            {earnings.slice(-3).reverse().map(e => (
              <div key={e.id} className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-white">{e.task || e.platform}</p>
                  <p className="text-xs text-gray-500">{e.platform} · {e.date}</p>
                </div>
                <span className="text-green-400 font-bold text-sm">+{e.amount} {e.currency}</span>
              </div>
            ))}
          </div>
          <button onClick={() => onTabChange('earnings')} className="text-xs text-green-400 mt-2 hover:underline">
            Показати все →
          </button>
        </div>
      )}
    </div>
  );
}
