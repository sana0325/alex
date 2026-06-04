import React from 'react';
import { GoldSignal } from '../types';

interface Props {
  signal: GoldSignal;
  currentPrice: number;
}

function priceDec(symbol: string): number {
  if (symbol.includes('XAU') || symbol.includes('XAG')) return 2;
  if (symbol.includes('JPY')) return 3;
  return 5;
}
function fmt(v: number, sym: string) { return v.toFixed(priceDec(sym)); }

export const SignalCard: React.FC<Props> = ({ signal, currentPrice }) => {
  const { direction, longVotes, shortVotes, confidence, filtersOk, filterReasons, isContrarian, symbol } = signal;
  const dec = priceDec(symbol);

  const isLong  = direction === 'LONG';
  const isShort = direction === 'SHORT';
  const isNone  = direction === 'NONE';

  const accent      = isLong ? '#00FF88' : isShort ? '#FF2D55' : '#00F5FF';
  const accentDim   = isLong ? 'rgba(0,255,136,.15)' : isShort ? 'rgba(255,45,85,.15)' : 'rgba(0,245,255,.1)';
  const glowClass   = isLong ? 'glow-green' : isShort ? 'glow-red' : 'glow-cyan';
  const textGlow    = isLong ? 'text-glow-green' : isShort ? 'text-glow-red' : 'text-glow-cyan';
  const textColor   = isLong ? '#00FF88' : isShort ? '#FF2D55' : '#00F5FF';
  const dirLabel    = isLong ? 'LONG ▲' : isShort ? 'SHORT ▼' : 'WAIT —';

  const longPct  = (longVotes  / 26) * 100;
  const shortPct = (shortVotes / 26) * 100;

  return (
    <div
      className={`relative rounded-2xl overflow-hidden scanlines ${glowClass}`}
      style={{
        background: `linear-gradient(145deg, #020c1b 0%, ${accentDim} 100%)`,
        border: `1px solid ${accent}55`,
      }}
    >
      {/* Corner brackets */}
      <div className="absolute top-0 left-0 w-5 h-5 z-10"
           style={{ borderTop: `2px solid ${accent}`, borderLeft: `2px solid ${accent}` }} />
      <div className="absolute top-0 right-0 w-5 h-5 z-10"
           style={{ borderTop: `2px solid ${accent}`, borderRight: `2px solid ${accent}` }} />
      <div className="absolute bottom-0 left-0 w-5 h-5 z-10"
           style={{ borderBottom: `2px solid ${accent}`, borderLeft: `2px solid ${accent}` }} />
      <div className="absolute bottom-0 right-0 w-5 h-5 z-10"
           style={{ borderBottom: `2px solid ${accent}`, borderRight: `2px solid ${accent}` }} />

      {/* Radar rings (only when signal active) */}
      {!isNone && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {[0,1,2].map(i => (
            <div key={i}
              className={`absolute rounded-full border ${
                i===0 ? 'animate-radar' : i===1 ? 'animate-radar-2' : 'animate-radar-3'
              }`}
              style={{
                width: 80, height: 80,
                borderColor: `${accent}55`,
              }}
            />
          ))}
        </div>
      )}

      {/* Scan line */}
      <div className="absolute left-0 right-0 h-px pointer-events-none animate-scan z-0"
           style={{ background: `linear-gradient(90deg, transparent, ${accent}40, transparent)` }} />

      {/* Contrarian badge */}
      {isContrarian && (
        <div className="flex justify-center pt-4 px-5 relative z-10">
          <span className="font-orbitron text-xs font-bold px-3 py-1 rounded border glow-purple"
                style={{ color: '#B347FF', borderColor: '#B347FF55', background: 'rgba(180,70,255,.1)' }}>
            ⟳ CONTRARIAN MODE
          </span>
        </div>
      )}

      {/* Header row */}
      <div className="flex items-center justify-between px-5 pt-4 pb-2 relative z-10">
        <div className="flex items-center gap-2">
          <span className="font-tech text-xs" style={{ color: '#00F5FF66' }}>SYS//SIGNAL</span>
          <span className="animate-blink text-xs" style={{ color: accent }}>●</span>
        </div>
        <span className="font-tech text-xs" style={{ color: '#ffffff33' }}>
          {new Date(signal.timestamp).toLocaleTimeString('uk-UA')}
        </span>
      </div>

      {/* Big direction display */}
      <div className="flex items-center justify-between px-5 pb-1 relative z-10">
        <div>
          <p className={`font-orbitron text-5xl font-black leading-none ${textGlow}`}
             style={{ color: textColor }}>
            {dirLabel}
          </p>
          <p className="font-tech text-xs mt-1" style={{ color: '#ffffff50' }}>
            {isContrarian ? 'TRADING AGAINST INDICATORS' : 'SIGNAL DIRECTION'}
          </p>
        </div>
        {/* Confidence ring */}
        <div className="relative flex items-center justify-center w-16 h-16">
          <svg className="absolute inset-0" viewBox="0 0 64 64">
            <circle cx="32" cy="32" r="28" fill="none" stroke="#ffffff10" strokeWidth="4" />
            <circle cx="32" cy="32" r="28" fill="none"
              stroke={accent} strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={`${(confidence / 100) * 175.9} 175.9`}
              transform="rotate(-90 32 32)"
              style={{ filter: `drop-shadow(0 0 4px ${accent})` }}
            />
          </svg>
          <span className="font-orbitron text-xs font-bold" style={{ color: accent }}>
            {confidence.toFixed(0)}%
          </span>
        </div>
      </div>

      {/* Symbol + Price */}
      <div className="px-5 pb-3 relative z-10">
        <p className="font-tech text-xs mb-0.5" style={{ color: '#FFB80088' }}>
          {symbol.replace('/', '')} · {signal.timeframe}
        </p>
        <p className="font-orbitron text-3xl font-bold text-glow-gold" style={{ color: '#FFB800' }}>
          {fmt(currentPrice > 0 ? currentPrice : signal.entryPrice, symbol)}
        </p>
      </div>

      {/* Divider */}
      <div className="mx-5 h-px" style={{ background: `linear-gradient(90deg, transparent, ${accent}40, transparent)` }} />

      {/* Vote bars */}
      <div className="px-5 py-3 relative z-10">
        {/* Long bar */}
        <div className="flex items-center gap-2 mb-2">
          <span className="font-tech text-xs w-12 text-right" style={{ color: '#00FF88' }}>
            L {longVotes}
          </span>
          <div className="flex-1 h-3 rounded-sm overflow-hidden" style={{ background: '#ffffff0a' }}>
            <div className="h-full rounded-sm transition-all duration-700"
                 style={{
                   width: `${longPct}%`,
                   background: 'linear-gradient(90deg, #00FF8880, #00FF88)',
                   boxShadow: '0 0 8px #00FF8880',
                 }} />
          </div>
          <span className="font-tech text-xs w-8" style={{ color: '#00FF8880' }}>
            {longPct.toFixed(0)}%
          </span>
        </div>
        {/* Short bar */}
        <div className="flex items-center gap-2">
          <span className="font-tech text-xs w-12 text-right" style={{ color: '#FF2D55' }}>
            S {shortVotes}
          </span>
          <div className="flex-1 h-3 rounded-sm overflow-hidden" style={{ background: '#ffffff0a' }}>
            <div className="h-full rounded-sm transition-all duration-700"
                 style={{
                   width: `${shortPct}%`,
                   background: 'linear-gradient(90deg, #FF2D5580, #FF2D55)',
                   boxShadow: '0 0 8px #FF2D5580',
                 }} />
          </div>
          <span className="font-tech text-xs w-8" style={{ color: '#FF2D5580' }}>
            {shortPct.toFixed(0)}%
          </span>
        </div>
        <div className="text-center mt-1">
          <span className="font-tech text-xs" style={{ color: '#ffffff30' }}>
            neutral: {signal.neutralVotes}/26
          </span>
        </div>
      </div>

      {/* SL / TP grid */}
      {!isNone && (
        <>
          <div className="mx-5 h-px" style={{ background: `linear-gradient(90deg, transparent, ${accent}40, transparent)` }} />
          <div className="grid grid-cols-3 gap-2 px-5 py-3 relative z-10">
            {[
              { label: 'ENTRY', value: fmt(signal.entryPrice, symbol), color: '#FFB800' },
              { label: 'STOP', value: fmt(signal.stopLoss, symbol), color: '#FF2D55' },
              { label: 'TAKE', value: fmt(signal.takeProfit, symbol), color: '#00FF88' },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-lg p-2 text-center"
                   style={{ background: '#ffffff06', border: `1px solid ${color}20` }}>
                <p className="font-tech text-xs mb-1" style={{ color: `${color}80` }}>{label}</p>
                <p className="font-tech text-sm font-bold" style={{ color, textShadow: `0 0 8px ${color}80` }}>
                  {value}
                </p>
              </div>
            ))}
          </div>
          <div className="px-5 pb-2 text-center relative z-10">
            <span className="font-tech text-xs" style={{ color: '#ffffff30' }}>
              RR 1:{signal.riskReward.toFixed(2)} · ATR {signal.support.atr.toFixed(dec)}
            </span>
          </div>
        </>
      )}

      {/* Filter warnings */}
      {!filtersOk && (
        <div className="mx-5 mb-4 rounded-lg p-3 relative z-10"
             style={{ background: 'rgba(255,120,0,.1)', border: '1px solid rgba(255,120,0,.3)' }}>
          <p className="font-tech text-xs mb-1" style={{ color: '#FF7800' }}>⚠ FILTERS FAILED</p>
          {filterReasons.map((r, i) => (
            <p key={i} className="font-tech text-xs" style={{ color: '#FF780090' }}>· {r}</p>
          ))}
        </div>
      )}
    </div>
  );
};
