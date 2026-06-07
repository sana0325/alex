import React, { useState } from 'react';
import { FreelancePlatform, PlatformCategory } from '../types';

const PLATFORMS: FreelancePlatform[] = [
  // General freelancing
  {
    id: 'upwork',
    name: 'Upwork',
    category: 'general',
    description: 'Найбільша фріланс-платформа. Є робота для всіх — розробники, дизайнери, перекладачі, маркетологи.',
    earning: '$5–$150/год',
    difficulty: 'medium',
    pros: ['Великий вибір проектів', 'Безпечні виплати', 'Довгострокові контракти'],
    icon: '🌐',
    color: 'from-green-900/30 to-green-950/20 border-green-800/40',
  },
  {
    id: 'fiverr',
    name: 'Fiverr',
    category: 'general',
    description: 'Продавай послуги по фіксованій ціні ("гіги"). Ідеально для дизайну, відео, тестів, копірайтингу.',
    earning: '$5–$500/гіг',
    difficulty: 'easy',
    pros: ['Клієнти самі знаходять тебе', 'Немає потреби надсилати заявки', 'Безкоштовна реєстрація'],
    icon: '🎯',
    color: 'from-emerald-900/30 to-emerald-950/20 border-emerald-800/40',
  },
  {
    id: 'freelancer',
    name: 'Freelancer.com',
    category: 'general',
    description: 'Класична платформа з проектами для будь-якої спеціалізації. Є безкоштовний план.',
    earning: '$3–$80/год',
    difficulty: 'medium',
    pros: ['Безкоштовні заявки (8/місяць)', 'Конкурси з призами', 'Міжнародна аудиторія'],
    icon: '💻',
    color: 'from-blue-900/30 to-blue-950/20 border-blue-800/40',
  },
  {
    id: 'peopleperhour',
    name: 'PeoplePerHour',
    category: 'general',
    description: 'Британська платформа з акцентом на якість. Менша конкуренція ніж на Upwork.',
    earning: '$10–$100/год',
    difficulty: 'medium',
    pros: ['Менша конкуренція', 'Якісніші клієнти', 'Hourly або fixed price'],
    icon: '⏱️',
    color: 'from-orange-900/30 to-orange-950/20 border-orange-800/40',
  },
  // Microtasks
  {
    id: 'toloka',
    name: 'Toloka (Yandex)',
    category: 'microtask',
    description: 'Мікро-завдання: розмітка даних, перевірка сайтів, опитування. Починай одразу без досвіду.',
    earning: '$0.5–$5/год',
    difficulty: 'easy',
    pros: ['Без досвіду', 'Почни одразу', 'Виплати через PayPal'],
    icon: '✅',
    color: 'from-yellow-900/30 to-yellow-950/20 border-yellow-800/40',
  },
  {
    id: 'appen',
    name: 'Appen',
    category: 'data',
    description: 'Розмітка даних для AI: тренування мовних моделей, перевірка пошукових результатів.',
    earning: '$9–$15/год',
    difficulty: 'easy',
    pros: ['Стабільні проекти', 'Гарна оплата для початківця', 'Гнучкий графік'],
    icon: '🤖',
    color: 'from-purple-900/30 to-purple-950/20 border-purple-800/40',
  },
  {
    id: 'clickworker',
    name: 'Clickworker',
    category: 'microtask',
    description: 'Текстові завдання, SEO-тексти, опитування, класифікація даних.',
    earning: '$3–$8/год',
    difficulty: 'easy',
    pros: ['Не потрібен досвід', 'Велика кількість завдань', 'Платить через PayPal'],
    icon: '📋',
    color: 'from-cyan-900/30 to-cyan-950/20 border-cyan-800/40',
  },
  // Writing & content
  {
    id: 'textbroker',
    name: 'Textbroker',
    category: 'writing',
    description: 'Платять за написання текстів для сайтів, блогів, SEO. Потрібне знання англійської.',
    earning: '$0.01–$0.05/слово',
    difficulty: 'easy',
    pros: ['Постійне замовлення', 'Немає заявок', 'Прямий заробіток'],
    icon: '✍️',
    color: 'from-rose-900/30 to-rose-950/20 border-rose-800/40',
  },
  {
    id: 'medium',
    name: 'Medium Partner Program',
    category: 'writing',
    description: 'Пиши статті та отримуй гроші від читачів-підписників. Пасивний дохід з часом.',
    earning: '$0–$1000/міс',
    difficulty: 'hard',
    pros: ['Пасивний дохід', 'Розвиток авторитету', 'Безкоштовна публікація'],
    icon: '📝',
    color: 'from-gray-800/30 to-gray-900/20 border-gray-700/40',
  },
  // Design
  {
    id: '99designs',
    name: '99designs',
    category: 'design',
    description: 'Тільки для дизайнерів. Брати участь у конкурсах або отримувати прямі замовлення.',
    earning: '$100–$2000/проект',
    difficulty: 'hard',
    pros: ['Висока оплата', 'Великі бренди', 'Міжнародна аудиторія'],
    icon: '🎨',
    color: 'from-pink-900/30 to-pink-950/20 border-pink-800/40',
  },
  // Transcription
  {
    id: 'rev',
    name: 'Rev.com',
    category: 'writing',
    description: 'Транскрибування аудіо/відео та субтитри. Потрібна хороша англійська.',
    earning: '$0.45–$1.10/хв аудіо',
    difficulty: 'easy',
    pros: ['Гнучкий графік', 'Без заявок', 'Регулярні виплати'],
    icon: '🎤',
    color: 'from-indigo-900/30 to-indigo-950/20 border-indigo-800/40',
  },
  // Content creation
  {
    id: 'youtube',
    name: 'YouTube AdSense',
    category: 'content',
    description: 'Монетизуй відео після 1000 підписників та 4000 годин перегляду.',
    earning: '$1–$20 за 1000 переглядів',
    difficulty: 'hard',
    pros: ['Пасивний дохід', 'Зростання аудиторії', 'Довгострокова перспектива'],
    icon: '▶️',
    color: 'from-red-900/30 to-red-950/20 border-red-800/40',
  },
  {
    id: 'shutterstock',
    name: 'Shutterstock',
    category: 'design',
    description: 'Продавай фото, ілюстрації, вектор та відео. Пасивний дохід від стокового контенту.',
    earning: '$0.10–$120 за ліцензію',
    difficulty: 'medium',
    pros: ['Пасивний дохід', 'Продавай одне фото нескінченно', 'Велика аудиторія'],
    icon: '📸',
    color: 'from-amber-900/30 to-amber-950/20 border-amber-800/40',
  },
];

const CATEGORIES: { id: PlatformCategory | 'all'; label: string }[] = [
  { id: 'all', label: 'Всі' },
  { id: 'general', label: 'Фріланс' },
  { id: 'microtask', label: 'Мікро' },
  { id: 'data', label: 'Дані/AI' },
  { id: 'writing', label: 'Тексти' },
  { id: 'design', label: 'Дизайн' },
  { id: 'content', label: 'Контент' },
];

const DIFFICULTY_LABEL: Record<string, { label: string; color: string }> = {
  easy: { label: 'Легко', color: 'text-green-400 bg-green-900/30' },
  medium: { label: 'Середньо', color: 'text-yellow-400 bg-yellow-900/30' },
  hard: { label: 'Складно', color: 'text-red-400 bg-red-900/30' },
};

export function PlatformsList() {
  const [filter, setFilter] = useState<PlatformCategory | 'all'>('all');
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = filter === 'all' ? PLATFORMS : PLATFORMS.filter(p => p.category === filter);

  return (
    <div className="space-y-4">
      {/* Filter pills */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {CATEGORIES.map(c => (
          <button
            key={c.id}
            onClick={() => setFilter(c.id)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              filter === c.id
                ? 'bg-green-500 text-black'
                : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <p className="text-xs text-gray-500">Усі платформи безкоштовні для реєстрації</p>

      {/* Platform cards */}
      <div className="space-y-3">
        {filtered.map(p => {
          const diff = DIFFICULTY_LABEL[p.difficulty];
          const isOpen = expanded === p.id;
          return (
            <div
              key={p.id}
              className={`bg-gradient-to-br ${p.color} border rounded-2xl overflow-hidden`}
            >
              <button
                className="w-full p-4 text-left"
                onClick={() => setExpanded(isOpen ? null : p.id)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{p.icon}</span>
                    <div>
                      <p className="font-bold text-white">{p.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{p.description}</p>
                    </div>
                  </div>
                  <span className="text-gray-500 text-lg flex-shrink-0">{isOpen ? '▲' : '▼'}</span>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <span className="text-green-400 font-bold text-sm">{p.earning}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${diff.color}`}>{diff.label}</span>
                </div>
              </button>

              {isOpen && (
                <div className="px-4 pb-4 border-t border-white/10 pt-3">
                  <p className="text-xs text-gray-400 font-semibold mb-2">Переваги:</p>
                  <ul className="space-y-1">
                    {p.pros.map((pro, i) => (
                      <li key={i} className="text-xs text-gray-300 flex items-center gap-2">
                        <span className="text-green-400">✓</span> {pro}
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-gray-500 mt-3">
                    Знайди "{p.name}" в Google для реєстрації
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
