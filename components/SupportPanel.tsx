import React from 'react';
import { SupportData } from '../types';

interface Props { support: SupportData; symbol?: string; }

function priceDec(symbol = '') {
  if (symbol.includes('BTC') || symbol.includes('XAU') || symbol.includes('XAG')) return 2;
  if (symbol.includes('ETH')) return 2;
  if (symbol.includes('JPY')) return 3;
  return 5;
}

export const SupportPanel: React.FC<Props> = ({ support, symbol = 'XAU/USD' }) => {
  const dec = priceDec(symbol);

  const adxColor = support.adxStrength > 25 ? '#00FF88'
    : support.adxStrength > 15 ? '#FFB800' : '#FF2D55';

  const bbColor = support.bbWidth > 0.1 ? '#00FF88' : '#FF7800';
  const volColor = support.volumeRatio > 1.2 ? '#00FF88'
    : support.volumeRatio > 0.8 ? '#00F5FF' : '#FF7800';

  return (
    <div className="space-y-3">
      <p className="font-tech text-xs px-1" style={{ color: '#00F5FF50' }}>
        ⬡ MARKET FILTERS · 6 ACTIVE
      </p>

      {/* Session status — full width */}
      <div className="rounded-xl p-4 relative overflow-hidden"
           style={{
             background: support.inSession ? 'rgba(0,255,136,.06)' : 'rgba(255,45,85,.06)',
             border: `1px solid ${support.inSession ? 'rgba(0,255,136,.25)' : 'rgba(255,45,85,.25)'}`,
             boxShadow: support.inSession ? '0 0 20px rgba(0,255,136,.1)' : '0 0 20px rgba(255,45,85,.1)',
           }}>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-tech text-xs mb-1" style={{ color: '#ffffff40' }}>TRADING SESSION</p>
            <p className="font-orbitron text-xl font-bold"
               style={{
                 color: support.inSession ? '#00FF88' : '#FF2D55',
                 textShadow: `0 0 12px ${support.inSession ? '#00FF88' : '#FF2D55'}`,
               }}>
              {support.inSession ? support.sessionName : 'CLOSED'}
            </p>
          </div>
          <div className="text-right">
            <div className="w-12 h-12 rounded-full flex items-center justify-center"
                 style={{
                   border: `2px solid ${support.inSession ? '#00FF88' : '#FF2D55'}`,
                   boxShadow: `0 0 16px ${support.inSession ? '#00FF8840' : '#FF2D5540'}`,
                 }}>
              <span className="font-orbitron text-xs font-bold"
                    style={{ color: support.inSession ? '#00FF88' : '#FF2D55' }}>
                {support.inSession ? 'ON' : 'OFF'}
              </span>
            </div>
          </div>
        </div>
        {/* Animated scan line */}
        {support.inSession && (
          <div className="absolute left-0 right-0 h-0.5 animate-scan pointer-events-none"
               style={{ background: 'linear-gradient(90deg,transparent,#00FF8840,transparent)' }} />
        )}
      </div>

      {/* ADX gauge */}
      <GaugeCard
        label="ADX STRENGTH"
        value={support.adxStrength.toFixed(1)}
        sub={support.adxStrength > 25 ? 'STRONG TREND' : support.adxStrength > 15 ? 'MODERATE' : 'WEAK'}
        color={adxColor}
        pct={Math.min(100, (support.adxStrength / 40) * 100)}
      />

      {/* BB Width */}
      <GaugeCard
        label="BB WIDTH (VOLATILITY)"
        value={`${(support.bbWidth * 100).toFixed(2)}%`}
        sub={support.bbWidth > 0.1 ? 'HIGH VOL' : 'LOW VOL'}
        color={bbColor}
        pct={Math.min(100, (support.bbWidth / 0.3) * 100)}
      />

      {/* Volume */}
      <GaugeCard
        label="VOLUME RATIO"
        value={`×${support.volumeRatio.toFixed(2)}`}
        sub={support.volumeRatio > 1.2 ? 'ELEVATED' : support.volumeRatio > 0.8 ? 'NORMAL' : 'LOW'}
        color={volColor}
        pct={Math.min(100, support.volumeRatio * 50)}
      />

      {/* ATR */}
      <div className="rounded-xl p-4"
           style={{ background: 'rgba(5,20,45,.85)', border: '1px solid rgba(0,245,255,.1)' }}>
        <p className="font-tech text-xs mb-2" style={{ color: '#ffffff35' }}>ATR(14) — AVERAGE TRUE RANGE</p>
        <p className="font-orbitron text-2xl font-bold text-glow-cyan" style={{ color: '#00F5FF' }}>
          {support.atr.toFixed(dec)}
        </p>
        <p className="font-tech text-xs mt-1" style={{ color: '#ffffff25' }}>1.5× SL · 2.5× TP base unit</p>
      </div>

      {/* Pivot levels */}
      <div className="rounded-xl p-4"
           style={{ background: 'rgba(5,20,45,.85)', border: '1px solid rgba(180,70,255,.2)' }}>
        <p className="font-tech text-xs mb-3" style={{ color: '#B347FF80' }}>⬡ PIVOT LEVELS</p>
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            { label: 'R1', value: support.pivotR1.toFixed(dec), color: '#00FF88' },
            { label: 'PP', value: support.pivotPP.toFixed(dec), color: '#00F5FF' },
            { label: 'S1', value: support.pivotS1.toFixed(dec), color: '#FF2D55' },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-lg p-2"
                 style={{ background: `${color}0d`, border: `1px solid ${color}25` }}>
              <p className="font-tech text-xs" style={{ color: `${color}80` }}>{label}</p>
              <p className="font-tech text-sm font-bold" style={{ color }}>{value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const GaugeCard: React.FC<{
  label: string; value: string; sub: string; color: string; pct: number;
}> = ({ label, value, sub, color, pct }) => (
  <div className="rounded-xl p-4"
       style={{ background: 'rgba(5,20,45,.85)', border: `1px solid ${color}25` }}>
    <div className="flex items-center justify-between mb-2">
      <p className="font-tech text-xs" style={{ color: '#ffffff35' }}>{label}</p>
      <p className="font-orbitron text-lg font-bold" style={{ color, textShadow: `0 0 10px ${color}80` }}>
        {value}
      </p>
    </div>
    {/* Bar */}
    <div className="h-2 rounded-full overflow-hidden mb-1" style={{ background: '#ffffff08' }}>
      <div className="h-full rounded-full transition-all duration-700"
           style={{
             width: `${pct}%`,
             background: `linear-gradient(90deg, ${color}80, ${color})`,
             boxShadow: `0 0 8px ${color}60`,
           }} />
    </div>
    <p className="font-tech text-xs" style={{ color: `${color}60` }}>{sub}</p>
  </div>
);
