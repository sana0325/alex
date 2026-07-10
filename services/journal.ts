import { JournalEntry, JournalOutcome, JournalReview, OpenTrade, PendingOrder } from '../types';
import { JOURNAL_KEY, REVIEWS_KEY, REVIEW_INTERVAL_MS, PAPER_START_BALANCE, PAPER_BALANCE_KEY, PENDING_ORDER_KEY } from '../constants';

const OPEN_TRADES_KEY = 'scalp_bot_open_trades_v1';

function load<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function save<T>(key: string, items: T[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(items));
  } catch {
    /* ignore storage errors */
  }
}

export function getJournal(): JournalEntry[] {
  return load<JournalEntry>(JOURNAL_KEY).sort((a, b) => b.closedAt - a.closedAt);
}

export function recordClosedTrade(trade: OpenTrade, exitPrice: number, closedAt = Date.now()): JournalEntry {
  const directionSign = trade.side === 'LONG' ? 1 : -1;
  const priceDelta = (exitPrice - trade.entry) * directionSign;
  const pnlPercent = (priceDelta / trade.entry) * trade.leverage * 100;
  const pnlUSDT = trade.stakeUSDT * (pnlPercent / 100);

  let outcome: JournalOutcome = 'BREAKEVEN';
  if (pnlUSDT > trade.stakeUSDT * 0.01) outcome = 'WIN';
  else if (pnlUSDT < -trade.stakeUSDT * 0.01) outcome = 'LOSS';

  const entry: JournalEntry = {
    id: trade.id,
    symbol: trade.symbol,
    side: trade.side,
    entry: trade.entry,
    exit: exitPrice,
    sl: trade.sl,
    tp1: trade.tp1,
    stakeUSDT: trade.stakeUSDT,
    leverage: trade.leverage,
    pnlUSDT,
    pnlPercent,
    outcome,
    setup: trade.setup,
    aiReason: trade.aiReason,
    openedAt: trade.openedAt,
    closedAt,
    simulated: trade.simulated,
  };

  const all = load<JournalEntry>(JOURNAL_KEY);
  all.push(entry);
  save(JOURNAL_KEY, all);
  return entry;
}

export interface JournalStats {
  total: number;
  wins: number;
  losses: number;
  breakevens: number;
  winRate: number;
  netPnlUSDT: number;
  bySetup: Record<string, { total: number; wins: number; netPnlUSDT: number }>;
}

export function computeStats(entries: JournalEntry[]): JournalStats {
  const stats: JournalStats = { total: entries.length, wins: 0, losses: 0, breakevens: 0, winRate: 0, netPnlUSDT: 0, bySetup: {} };
  for (const e of entries) {
    if (e.outcome === 'WIN') stats.wins++;
    else if (e.outcome === 'LOSS') stats.losses++;
    else stats.breakevens++;
    stats.netPnlUSDT += e.pnlUSDT;

    const s = stats.bySetup[e.setup] ?? { total: 0, wins: 0, netPnlUSDT: 0 };
    s.total++;
    if (e.outcome === 'WIN') s.wins++;
    s.netPnlUSDT += e.pnlUSDT;
    stats.bySetup[e.setup] = s;
  }
  stats.winRate = stats.total > 0 ? (stats.wins / stats.total) * 100 : 0;
  return stats;
}

// ── 2-day review cadence ─────────────────────────────────────────────────────

export function getReviews(): JournalReview[] {
  return load<JournalReview>(REVIEWS_KEY).sort((a, b) => b.createdAt - a.createdAt);
}

export function saveReview(review: JournalReview): void {
  const all = load<JournalReview>(REVIEWS_KEY);
  all.push(review);
  save(REVIEWS_KEY, all);
}

export function lastReviewAt(): number {
  const reviews = getReviews();
  return reviews.length > 0 ? reviews[0].createdAt : 0;
}

export function isReviewDue(): boolean {
  return Date.now() - lastReviewAt() >= REVIEW_INTERVAL_MS;
}

export function entriesSince(timestamp: number): JournalEntry[] {
  return getJournal().filter(e => e.closedAt >= timestamp);
}

export function latestLessons(): string {
  const reviews = getReviews();
  return reviews.length > 0 ? reviews[0].lessons : '';
}

// ── Open trades (bot's own metadata: BingX positions don't carry our AI reasoning) ──

export function getOpenTrades(): OpenTrade[] {
  return load<OpenTrade>(OPEN_TRADES_KEY);
}

export function addOpenTrade(trade: OpenTrade): void {
  const all = load<OpenTrade>(OPEN_TRADES_KEY);
  all.push(trade);
  save(OPEN_TRADES_KEY, all);
}

export function removeOpenTrade(id: string): OpenTrade | null {
  const all = load<OpenTrade>(OPEN_TRADES_KEY);
  const idx = all.findIndex(t => t.id === id);
  if (idx === -1) return null;
  const [removed] = all.splice(idx, 1);
  save(OPEN_TRADES_KEY, all);
  return removed;
}

// ── Pending limit order (occupies the one trade slot while waiting to fill) ──

export function getPendingOrder(): PendingOrder | null {
  try {
    const raw = localStorage.getItem(PENDING_ORDER_KEY);
    return raw ? (JSON.parse(raw) as PendingOrder) : null;
  } catch {
    return null;
  }
}

export function savePendingOrder(order: PendingOrder | null): void {
  try {
    if (order) localStorage.setItem(PENDING_ORDER_KEY, JSON.stringify(order));
    else localStorage.removeItem(PENDING_ORDER_KEY);
  } catch { /* ignore storage errors */ }
}

// ── Virtual paper-trading balance (used whenever BingX isn't live) ──────────

export function getPaperBalance(): number {
  try {
    const raw = localStorage.getItem(PAPER_BALANCE_KEY);
    return raw ? Number(raw) : PAPER_START_BALANCE;
  } catch {
    return PAPER_START_BALANCE;
  }
}

export function adjustPaperBalance(deltaUSDT: number): number {
  const next = getPaperBalance() + deltaUSDT;
  try { localStorage.setItem(PAPER_BALANCE_KEY, String(next)); } catch { /* ignore */ }
  return next;
}
