import React, { useState } from 'react';
import { IndicatorVote } from '../types';
import { INDICATOR_GROUPS } from '../constants';

interface Props {
  votes: IndicatorVote[];
}

const GROUP_ORDER: IndicatorVote['group'][] = ['trend', 'momentum', 'oscillator', 'channel'];

export const IndicatorVotes: React.FC<Props> = ({ votes }) => {
  const [expandedGroup, setExpandedGroup] = useState<string | null>('trend');

  const grouped = GROUP_ORDER.reduce((acc, g) => {
    acc[g] = votes.filter(v => v.group === g);
    return acc;
  }, {} as Record<string, IndicatorVote[]>);

  return (
    <div className="space-y-2">
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest px-1">
        Голоси індикаторів (26 сигнальних)
      </h2>
      {GROUP_ORDER.map(group => {
        const groupVotes = grouped[group] ?? [];
        const gInfo = INDICATOR_GROUPS[group];
        const longs = groupVotes.filter(v=>v.direction==='LONG').length;
        const shorts = groupVotes.filter(v=>v.direction==='SHORT').length;
        const isOpen = expandedGroup === group;

        return (
          <div key={group} className="bg-gray-900/70 border border-gray-800 rounded-xl overflow-hidden">
            {/* Group header */}
            <button
              className="w-full flex items-center justify-between px-4 py-3"
              onClick={() => setExpandedGroup(isOpen ? null : group)}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold" style={{ color: gInfo.color }}>
                  {gInfo.label}
                </span>
                <span className="text-xs text-gray-500">({groupVotes.length} інд.)</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-green-400 font-mono">▲{longs}</span>
                <span className="text-xs text-red-400 font-mono">▼{shorts}</span>
                <span className="text-gray-500 text-xs">{isOpen ? '▲' : '▼'}</span>
              </div>
            </button>

            {/* Indicator rows */}
            {isOpen && (
              <div className="border-t border-gray-800/60 divide-y divide-gray-800/40">
                {groupVotes.map(v => (
                  <VoteRow key={v.id} vote={v} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

const VoteRow: React.FC<{ vote: IndicatorVote }> = ({ vote }) => {
  const icon = vote.direction === 'LONG' ? '▲' : vote.direction === 'SHORT' ? '▼' : '—';
  const color = vote.direction === 'LONG' ? 'text-green-400' : vote.direction === 'SHORT' ? 'text-red-400' : 'text-gray-500';

  return (
    <div className="flex items-start gap-3 px-4 py-2.5">
      <span className={`text-base font-bold mt-0.5 w-4 shrink-0 ${color}`}>{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-200 font-medium leading-tight">{vote.name}</p>
        <p className="text-xs text-gray-500 leading-tight mt-0.5 truncate">{vote.description}</p>
      </div>
    </div>
  );
};
