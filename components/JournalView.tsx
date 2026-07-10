import React from 'react';
import { JournalEntry, JournalReview } from '../types';
import { JournalStats } from '../services/journal';

interface Props {
  entries: JournalEntry[];
  stats: JournalStats;
  reviews: JournalReview[];
  onAnalyzeNow: () => void;
  analyzing: boolean;
  nextReviewLabel: string;
  deepseekKeyPresent: boolean;
}

const fmtDate = (ts: number) => new Date(ts).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

export function JournalView({ entries, stats, reviews, onAnalyzeNow, analyzing, nextReviewLabel, deepseekKeyPresent }: Props) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Угод у журналі" value={String(stats.total)} color="text-white" />
        <StatCard label="Вінрейт" value={`${stats.winRate.toFixed(1)}%`} color={stats.winRate >= 50 ? 'text-green-400' : 'text-red-400'} />
        <StatCard label="Чистий P/L" value={`${stats.netPnlUSDT >= 0 ? '+' : ''}${stats.netPnlUSDT.toFixed(2)}$`} color={stats.netPnlUSDT >= 0 ? 'text-green-400' : 'text-red-400'} />
        <StatCard label="W / L / BE" value={`${stats.wins} / ${stats.losses} / ${stats.breakevens}`} color="text-gray-300" />
      </div>

      {Object.keys(stats.bySetup).length > 0 && (
        <div className="border border-[#131322] rounded-lg overflow-hidden bg-[#07070d]">
          <div className="p-3 bg-[#0a0a15] border-b border-[#1a1a2e] text-xs font-black text-white uppercase tracking-wider">По сетапах</div>
          <div className="divide-y divide-[#131322]">
            {Object.entries(stats.bySetup).map(([setup, s]) => (
              <div key={setup} className="px-4 py-2 flex justify-between items-center text-xs font-mono text-gray-300">
                <span>{setup}</span>
                <span className="text-gray-500">{s.wins}/{s.total} ({((s.wins / s.total) * 100).toFixed(0)}%)</span>
                <span className={s.netPnlUSDT >= 0 ? 'text-green-400' : 'text-red-400'}>{s.netPnlUSDT >= 0 ? '+' : ''}{s.netPnlUSDT.toFixed(2)}$</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="border border-[#131322] rounded-lg overflow-hidden bg-[#07070d]">
        <div className="p-3 bg-[#0a0a15] border-b border-[#1a1a2e] flex justify-between items-center flex-wrap gap-2">
          <span className="text-xs font-black text-white uppercase tracking-wider">Розбір угод ШІ (кожні 2 дні)</span>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-500">{nextReviewLabel}</span>
            <button
              onClick={onAnalyzeNow}
              disabled={analyzing || !deepseekKeyPresent}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-600 rounded text-[11px] font-bold text-white transition-all"
            >
              {analyzing ? 'Аналізую...' : 'Аналізувати зараз'}
            </button>
          </div>
        </div>
        {!deepseekKeyPresent && (
          <div className="px-4 py-3 text-xs text-yellow-400">Додайте DeepSeek API ключ у налаштуваннях, щоб бот міг аналізувати журнал.</div>
        )}
        {reviews.length === 0 && deepseekKeyPresent && (
          <div className="px-4 py-4 text-xs text-gray-500 text-center">Ще немає розборів. Перший з'явиться, коли накопичаться закриті угоди.</div>
        )}
        <div className="divide-y divide-[#131322]">
          {reviews.map(r => (
            <div key={r.id} className="px-4 py-3 space-y-2">
              <div className="flex justify-between items-center text-[10px] text-gray-500 font-mono">
                <span>{fmtDate(r.periodFrom)} → {fmtDate(r.periodTo)}</span>
                <span>{r.tradesAnalyzed} угод · вінрейт {r.winRate.toFixed(0)}%</span>
              </div>
              <p className="text-xs text-gray-300 leading-relaxed">{r.summary}</p>
              {r.lessons && (
                <div className="bg-[#0a0a15] border border-[#1a1a2e] rounded p-2 text-xs text-blue-300 leading-relaxed">
                  <span className="text-blue-400 font-bold uppercase text-[10px] block mb-1">Висновки на майбутнє</span>
                  {r.lessons}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="border border-[#131322] rounded-lg overflow-hidden bg-[#07070d]">
        <div className="p-3 bg-[#0a0a15] border-b border-[#1a1a2e] text-xs font-black text-white uppercase tracking-wider">Історія угод</div>
        {entries.length === 0 ? (
          <div className="px-4 py-4 text-xs text-gray-500 text-center">Ще немає закритих угод.</div>
        ) : (
          <div className="divide-y divide-[#131322] max-h-[500px] overflow-y-auto">
            {entries.map(e => (
              <div key={e.id} className="px-4 py-2.5 text-xs font-mono">
                <div className="flex justify-between items-center">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${e.side === 'LONG' ? 'bg-green-950 text-green-400' : 'bg-red-950 text-red-400'}`}>
                    {e.symbol} {e.side}
                  </span>
                  <span className={`font-bold ${e.pnlUSDT >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {e.pnlUSDT >= 0 ? '+' : ''}{e.pnlUSDT.toFixed(2)}$ ({e.pnlPercent.toFixed(1)}%)
                  </span>
                </div>
                <div className="text-gray-500 mt-1">{fmtDate(e.closedAt)} · {e.setup}</div>
                {e.aiReason && <div className="text-gray-600 mt-1 line-clamp-2">{e.aiReason}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-[#07070d] border border-[#131322] rounded-lg p-3">
      <div className="text-[10px] text-gray-500 uppercase font-bold mb-1">{label}</div>
      <div className={`text-lg font-mono font-black ${color}`}>{value}</div>
    </div>
  );
}
