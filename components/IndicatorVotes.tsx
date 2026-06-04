import React, { useState } from 'react';
import { IndicatorVote } from '../types';
import { INDICATOR_GROUPS } from '../constants';

interface Props { votes: IndicatorVote[]; }

const GROUP_ORDER: IndicatorVote['group'][] = ['trend', 'momentum', 'oscillator', 'channel'];

const GROUP_ICONS: Record<string, string> = {
  trend: '↗', momentum: '⚡', oscillator: '◎', channel: '⬡',
};

export const IndicatorVotes: React.FC<Props> = ({ votes }) => {
  const [expandedGroup, setExpandedGroup] = useState<string | null>('trend');

  const grouped = GROUP_ORDER.reduce((acc, g) => {
    acc[g] = votes.filter(v => v.group === g);
    return acc;
  }, {} as Record<string, IndicatorVote[]>);

  return (
    <div className="space-y-3">
      <p className="font-tech text-xs px-1" style={{ color: '#00F5FF50' }}>
        ◈ INDICATOR VOTES · 26 SIGNAL SOURCES
      </p>

      {GROUP_ORDER.map(group => {
        const groupVotes = grouped[group] ?? [];
        const gInfo  = INDICATOR_GROUPS[group];
        const longs  = groupVotes.filter(v => v.direction === 'LONG').length;
        const shorts = groupVotes.filter(v => v.direction === 'SHORT').length;
        const isOpen = expandedGroup === group;
        const score  = longs - shorts;
        const accent = score > 0 ? '#00FF88' : score < 0 ? '#FF2D55' : '#00F5FF';

        return (
          <div key={group} className="rounded-xl overflow-hidden"
               style={{
                 background: 'rgba(5,20,45,.85)',
                 border: `1px solid ${isOpen ? gInfo.color + '55' : 'rgba(255,255,255,.06)'}`,
                 boxShadow: isOpen ? `0 0 16px ${gInfo.color}20` : '',
               }}>
            <button
              className="w-full flex items-center justify-between px-4 py-3"
              onClick={() => setExpandedGroup(isOpen ? null : group)}
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">{GROUP_ICONS[group]}</span>
                <span className="font-orbitron text-xs font-bold" style={{ color: gInfo.color }}>
                  {gInfo.label.toUpperCase()}
                </span>
                <span className="font-tech text-xs" style={{ color: '#ffffff25' }}>
                  /{groupVotes.length}
                </span>
              </div>

              <div className="flex items-center gap-3">
                {/* Mini score bar */}
                <div className="flex gap-0.5 items-center h-4 w-12">
                  {groupVotes.map((v, i) => (
                    <div key={i} className="flex-1 h-full rounded-sm"
                         style={{
                           background: v.direction === 'LONG' ? '#00FF88'
                             : v.direction === 'SHORT' ? '#FF2D55' : '#ffffff15',
                         }} />
                  ))}
                </div>
                <div className="flex gap-2 font-tech text-xs">
                  <span style={{ color: '#00FF88' }}>▲{longs}</span>
                  <span style={{ color: '#FF2D55' }}>▼{shorts}</span>
                </div>
                <span className="font-tech text-xs" style={{ color: '#ffffff25' }}>
                  {isOpen ? '▲' : '▼'}
                </span>
              </div>
            </button>

            {isOpen && (
              <div style={{ borderTop: '1px solid rgba(255,255,255,.05)' }}>
                {groupVotes.map(v => <VoteRow key={v.id} vote={v} />)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

const VoteRow: React.FC<{ vote: IndicatorVote }> = ({ vote }) => {
  const isLong  = vote.direction === 'LONG';
  const isShort = vote.direction === 'SHORT';
  const color   = isLong ? '#00FF88' : isShort ? '#FF2D55' : '#ffffff25';
  const icon    = isLong ? '▲' : isShort ? '▼' : '—';

  return (
    <div className="flex items-start gap-3 px-4 py-2.5"
         style={{ borderBottom: '1px solid rgba(255,255,255,.03)' }}>
      <div className="mt-0.5 w-6 h-6 rounded flex items-center justify-center flex-shrink-0"
           style={{ background: `${color}15`, border: `1px solid ${color}40` }}>
        <span className="font-orbitron text-xs font-bold" style={{ color }}>{icon}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-tech text-sm text-white leading-tight">{vote.name}</p>
        <p className="font-tech text-xs leading-tight mt-0.5 truncate" style={{ color: '#ffffff35' }}>
          {vote.description}
        </p>
      </div>
    </div>
  );
};
