import React, { useState } from 'react';
import { FreelanceProfile, Currency } from '../types';

interface Props {
  profile: FreelanceProfile;
  onSave: (p: FreelanceProfile) => void;
}

const CURRENCIES: Currency[] = ['USD', 'EUR', 'UAH'];

const SUGGESTED_SKILLS = [
  'JavaScript', 'TypeScript', 'React', 'Vue.js', 'Node.js', 'Python', 'PHP',
  'WordPress', 'Figma', 'UI/UX Design', 'Graphic Design', 'Illustrator',
  'Photoshop', 'Video Editing', 'SEO', 'Copywriting', 'Translation', 'English',
  'Data Entry', 'Excel', 'Content Writing', 'Social Media', 'Logo Design',
];

export function ProfileEditor({ profile, onSave }: Props) {
  const [form, setForm] = useState<FreelanceProfile>({ ...profile });
  const [skillInput, setSkillInput] = useState('');
  const [saved, setSaved] = useState(false);

  const set = (field: keyof FreelanceProfile, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setSaved(false);
  };

  const addSkill = (skill: string) => {
    const s = skill.trim();
    if (!s || form.skills.includes(s)) return;
    set('skills', [...form.skills, s]);
    setSkillInput('');
  };

  const removeSkill = (skill: string) => {
    set('skills', form.skills.filter(s => s !== skill));
  };

  const save = () => {
    onSave(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const completeness = [
    !!form.name,
    !!form.title,
    !!form.bio,
    form.skills.length > 0,
    form.hourlyRate > 0,
  ].filter(Boolean).length;

  const pct = Math.round((completeness / 5) * 100);

  return (
    <div className="space-y-4">
      {/* Completeness */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
        <div className="flex justify-between items-center mb-2">
          <p className="text-sm font-bold text-white">Заповненість профілю</p>
          <p className={`text-sm font-bold ${pct === 100 ? 'text-green-400' : 'text-yellow-400'}`}>{pct}%</p>
        </div>
        <div className="h-2 bg-gray-800 rounded-full">
          <div
            className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-green-400' : 'bg-yellow-400'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        {pct < 100 && (
          <p className="text-xs text-gray-500 mt-1.5">Повний профіль збільшує шанс отримати замовлення на 40%</p>
        )}
      </div>

      {/* Name */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 space-y-3">
        <p className="text-sm font-bold text-white">Особисті дані</p>

        <div>
          <label className="text-xs text-gray-400 mb-1 block">Ім'я *</label>
          <input
            type="text"
            value={form.name}
            onChange={e => set('name', e.target.value)}
            placeholder="Іван Петренко"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-green-500"
          />
        </div>

        <div>
          <label className="text-xs text-gray-400 mb-1 block">Спеціалізація *</label>
          <input
            type="text"
            value={form.title}
            onChange={e => set('title', e.target.value)}
            placeholder="Full Stack Developer · UI/UX Designer"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-green-500"
          />
        </div>

        <div>
          <label className="text-xs text-gray-400 mb-1 block">Опис *</label>
          <textarea
            value={form.bio}
            onChange={e => set('bio', e.target.value)}
            rows={3}
            placeholder="Розкажи про свій досвід, що ти вмієш та які проекти робиш..."
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-green-500 resize-none"
          />
        </div>
      </div>

      {/* Rate */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
        <p className="text-sm font-bold text-white mb-3">Ставка</p>
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-xs text-gray-400 mb-1 block">Годинна ставка *</label>
            <input
              type="number"
              value={form.hourlyRate}
              onChange={e => set('hourlyRate', parseFloat(e.target.value) || 0)}
              min="1"
              placeholder="15"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500"
            />
          </div>
          <div className="w-24">
            <label className="text-xs text-gray-400 mb-1 block">Валюта</label>
            <select
              value={form.currency}
              onChange={e => set('currency', e.target.value as Currency)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500"
            >
              {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Для початківця рекомендуємо $8–15/год. Після 5 відгуків підвищуй.
        </p>
      </div>

      {/* Skills */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
        <p className="text-sm font-bold text-white mb-3">Навички *</p>

        {/* Added skills */}
        {form.skills.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {form.skills.map(s => (
              <span
                key={s}
                className="bg-green-900/30 border border-green-800/40 text-green-300 text-xs px-3 py-1 rounded-full flex items-center gap-1.5"
              >
                {s}
                <button onClick={() => removeSkill(s)} className="text-green-600 hover:text-red-400 leading-none">✕</button>
              </span>
            ))}
          </div>
        )}

        {/* Custom input */}
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={skillInput}
            onChange={e => setSkillInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addSkill(skillInput)}
            placeholder="Введи навичку..."
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-green-500"
          />
          <button
            onClick={() => addSkill(skillInput)}
            className="bg-green-500 hover:bg-green-400 text-black font-bold px-3 py-2 rounded-lg text-sm transition-colors"
          >
            +
          </button>
        </div>

        {/* Suggestions */}
        <p className="text-xs text-gray-500 mb-2">Популярні:</p>
        <div className="flex flex-wrap gap-1.5">
          {SUGGESTED_SKILLS.filter(s => !form.skills.includes(s)).slice(0, 12).map(s => (
            <button
              key={s}
              onClick={() => addSkill(s)}
              className="bg-gray-800 text-gray-400 text-xs px-2.5 py-1 rounded-full hover:bg-gray-700 hover:text-white transition-colors"
            >
              + {s}
            </button>
          ))}
        </div>
      </div>

      {/* Save */}
      <button
        onClick={save}
        className={`w-full font-bold py-3 rounded-xl text-sm transition-colors ${
          saved
            ? 'bg-green-600 text-white'
            : 'bg-green-500 hover:bg-green-400 text-black'
        }`}
      >
        {saved ? '✓ Збережено!' : 'Зберегти профіль'}
      </button>
    </div>
  );
}
