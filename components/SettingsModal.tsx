import React, { useState } from 'react';
import { AppSettings } from '../types';
import { TIMEFRAME_OPTIONS, SYMBOL_OPTIONS } from '../constants';
import { getKeyStatus } from '../services/goldApi';

interface Props {
  settings: AppSettings;
  onSave: (s: AppSettings) => void;
  onClose: () => void;
}

const S = {
  bg:     'rgba(3,14,32,.98)',
  card:   'rgba(5,22,50,.9)',
  border: 'rgba(0,245,255,.12)',
  accent: '#00F5FF',
  gold:   '#FFB800',
  green:  '#00FF88',
  red:    '#FF2D55',
  purple: '#B347FF',
};

export const SettingsModal: React.FC<Props> = ({ settings, onSave, onClose }) => {
  const [s, setS] = useState<AppSettings>({ ...settings });
  const keyStatus = getKeyStatus();

  const field = (label: string, key: keyof AppSettings, type: 'text' | 'number' = 'text') => (
    <div>
      <label className="block font-tech text-xs mb-1" style={{ color: '#ffffff35' }}>{label}</label>
      <input
        type={type}
        value={s[key] as string | number}
        onChange={e => setS(prev => ({
          ...prev,
          [key]: type === 'number' ? (parseFloat(e.target.value) || 0) : e.target.value,
        }))}
        className="w-full rounded-lg px-3 py-2.5 font-tech text-sm text-white focus:outline-none"
        style={{
          background: 'rgba(0,245,255,.04)',
          border: '1px solid rgba(0,245,255,.15)',
        }}
      />
    </div>
  );

  const Section: React.FC<{ icon: string; title: string; children: React.ReactNode }> =
    ({ icon, title, children }) => (
      <div>
        <p className="font-orbitron text-xs font-bold mb-3 flex items-center gap-2"
           style={{ color: S.accent }}>
          <span>{icon}</span>{title}
        </p>
        {children}
      </div>
    );

  return (
    <div className="fixed inset-0 z-50 flex items-end" style={{ background: 'rgba(0,0,0,.85)' }}>
      <div className="w-full rounded-t-2xl max-h-[92vh] overflow-y-auto"
           style={{ background: S.bg, borderTop: `1px solid ${S.border}` }}>

        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between px-5 py-4"
             style={{ background: S.bg, borderBottom: `1px solid ${S.border}` }}>
          <p className="font-orbitron text-base font-black" style={{ color: S.accent, textShadow: `0 0 12px ${S.accent}80` }}>
            ⚙ SYSTEM CONFIG
          </p>
          <button onClick={onClose}
                  className="w-8 h-8 rounded flex items-center justify-center font-orbitron text-sm"
                  style={{ color: S.accent, border: `1px solid ${S.accent}40` }}>✕</button>
        </div>

        <div className="p-5 space-y-6">

          {/* API key status */}
          <Section icon="◈" title="API KEY POOL · 8 KEYS">
            <div className="rounded-xl p-4" style={{ background: S.card, border: `1px solid ${S.border}` }}>
              <div className="flex items-center justify-between mb-3">
                <span className="font-tech text-xs" style={{ color: '#ffffff50' }}>TwelveData · 8 keys</span>
                <span className="font-tech text-xs animate-blink" style={{ color: S.green }}>
                  ● ACTIVE #{keyStatus.active + 1}
                </span>
              </div>
              <div className="flex gap-1 mb-2 items-end h-10">
                {keyStatus.calls.map((calls, i) => {
                  const pct = Math.min(100, (calls / 790) * 100);
                  const active = i === keyStatus.active;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full rounded-sm relative overflow-hidden" style={{ height: 32, background: '#ffffff08' }}>
                        <div className="absolute bottom-0 left-0 right-0 rounded-sm transition-all"
                             style={{
                               height: `${Math.max(4, pct)}%`,
                               background: active ? S.gold : pct > 80 ? S.red : S.green,
                               boxShadow: active ? `0 0 8px ${S.gold}` : '',
                             }} />
                      </div>
                      <span className="font-tech text-xs" style={{ color: active ? S.gold : '#ffffff20' }}>{i + 1}</span>
                    </div>
                  );
                })}
              </div>
              <p className="font-tech text-xs text-center" style={{ color: '#ffffff25' }}>
                {keyStatus.total} / {keyStatus.limit} requests today
              </p>
            </div>
          </Section>

          {/* Custom key */}
          <Section icon="🔑" title="CUSTOM KEY (OPTIONAL)">
            {field('Your TwelveData API key (takes priority over pool)', 'apiKey', 'text')}
            <p className="font-tech text-xs mt-1" style={{ color: '#ffffff20' }}>
              Leave empty — pool rotates automatically
            </p>
          </Section>

          {/* Symbol */}
          <Section icon="◎" title="INSTRUMENT">
            <div className="grid grid-cols-4 gap-2">
              {SYMBOL_OPTIONS.map(sym => {
                const active = s.symbol === sym.value;
                return (
                  <button key={sym.value}
                    onClick={() => setS(prev => ({ ...prev, symbol: sym.value }))}
                    className="py-2 rounded-lg font-tech text-xs transition-all"
                    style={{
                      background: active ? `${S.gold}20` : 'rgba(255,255,255,.04)',
                      border: `1px solid ${active ? S.gold : 'rgba(255,255,255,.08)'}`,
                      color: active ? S.gold : '#ffffff40',
                      boxShadow: active ? `0 0 10px ${S.gold}40` : '',
                    }}>
                    {sym.display}
                  </button>
                );
              })}
            </div>
          </Section>

          {/* Timeframe */}
          <Section icon="⏱" title="TIMEFRAME">
            <div className="flex gap-2">
              {TIMEFRAME_OPTIONS.map(tf => {
                const active = s.timeframe === tf.value;
                return (
                  <button key={tf.value}
                    onClick={() => setS(prev => ({ ...prev, timeframe: tf.value as AppSettings['timeframe'] }))}
                    className="flex-1 py-2.5 rounded-lg font-tech text-sm transition-all"
                    style={{
                      background: active ? `${S.accent}20` : 'rgba(255,255,255,.04)',
                      border: `1px solid ${active ? S.accent : 'rgba(255,255,255,.08)'}`,
                      color: active ? S.accent : '#ffffff40',
                      boxShadow: active ? `0 0 10px ${S.accent}30` : '',
                    }}>
                    {tf.label}
                  </button>
                );
              })}
            </div>
          </Section>

          {/* Thresholds */}
          <Section icon="🎯" title="SIGNAL THRESHOLD (OF 26)">
            <div className="grid grid-cols-2 gap-3">
              {field('Long (min votes)', 'longThreshold', 'number')}
              {field('Short (min votes)', 'shortThreshold', 'number')}
            </div>
          </Section>

          {/* Risk */}
          <Section icon="💰" title="RISK MANAGEMENT">
            <div className="grid grid-cols-2 gap-3">
              {field('Stop = ATR ×', 'slMultiplier', 'number')}
              {field('Take = ATR ×', 'tpMultiplier', 'number')}
            </div>
          </Section>

          {/* Session */}
          <Section icon="🕐" title="SESSION (LOCAL TIME)">
            <div className="grid grid-cols-2 gap-3">
              {field('Start (local hour)', 'sessionStartUTC', 'number')}
              {field('End (local hour)', 'sessionEndUTC', 'number')}
            </div>
            <p className="font-tech text-xs mt-2" style={{ color: '#ffffff20' }}>
              Uses your device local time · Recommended 7–22
            </p>
          </Section>

          {/* Filters */}
          <Section icon="⬡" title="FILTERS">
            <div className="grid grid-cols-2 gap-3">
              {field('Min ADX', 'minAdx', 'number')}
              {field('Refresh (sec)', 'refreshSeconds', 'number')}
            </div>
          </Section>

          {/* Contrarian */}
          <Section icon="⟳" title="TRADE MODE">
            <button
              onClick={() => setS(prev => ({ ...prev, contrarian: !prev.contrarian }))}
              className="w-full py-4 rounded-xl font-orbitron text-xs font-bold transition-all"
              style={{
                background: s.contrarian ? 'rgba(180,70,255,.15)' : 'rgba(255,255,255,.04)',
                border: `2px solid ${s.contrarian ? S.purple : 'rgba(255,255,255,.1)'}`,
                color: s.contrarian ? S.purple : '#ffffff40',
                boxShadow: s.contrarian ? `0 0 16px ${S.purple}40` : '',
              }}>
              {s.contrarian ? '⟳ CONTRARIAN — AGAINST INDICATORS' : '→ NORMAL — WITH INDICATORS'}
            </button>
            <p className="font-tech text-xs mt-2 text-center" style={{ color: '#ffffff20' }}>
              {s.contrarian
                ? 'Indicators say LONG → we go SHORT, and vice versa'
                : 'We trade in the direction of the indicator majority'}
            </p>
          </Section>

          {/* Save */}
          <button
            onClick={() => { onSave(s); onClose(); }}
            className="w-full py-4 rounded-xl font-orbitron text-sm font-black transition-all"
            style={{
              background: `linear-gradient(135deg, ${S.gold}dd, ${S.gold}99)`,
              color: '#020c1b',
              boxShadow: `0 0 24px ${S.gold}60`,
            }}>
            ✓ SAVE CONFIG
          </button>
        </div>
      </div>
    </div>
  );
};
