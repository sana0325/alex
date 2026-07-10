import { AiSignal, Candle, JournalEntry, JournalReview } from '../types';
import { JournalStats } from './journal';

const DEEPSEEK_ENDPOINT = 'https://api.deepseek.com/chat/completions';

async function callDeepSeek(apiKey: string, systemPrompt: string, userPrompt: string): Promise<any> {
  const response = await fetch(DEEPSEEK_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.35,
    }),
  });
  if (!response.ok) throw new Error(`DeepSeek HTTP ${response.status}`);
  const result = await response.json();
  return JSON.parse(result.choices[0].message.content);
}

// ── Live scalping signal ─────────────────────────────────────────────────────

function buildSystemPrompt(symbol: string, market: 'crypto' | 'gold', lessons: string, stats: JournalStats | null): string {
  const learningBlock = stats && stats.total > 0
    ? `\n=== LEARNING FROM YOUR OWN TRADE JOURNAL (self-updating every day) ===
Track record so far: ${stats.total} closed trades, win rate ${stats.winRate.toFixed(1)}%, net P/L ${stats.netPnlUSDT.toFixed(2)} USDT.
Per-setup performance: ${JSON.stringify(stats.bySetup)}.
Distilled lessons from the last retrospective: ${lessons || 'none yet'}.
Weight setups that have historically won higher, and be stricter (raise your internal bar) on setups that have been losing.`
    : '';

  return `You are an adaptive ${symbol} (${market}) M5 scalping engine using Smart Money Concepts, trading with 20x leverage. You do not follow one rigid pattern — you first read the market regime, then apply the matching playbook, then score the setup. You trade whenever the score threshold is met, in ANY regime.

=== FORMAL DEFINITIONS ===
- AB = mean absolute candle body of the last 20 candles.
- ATR = average (high - low) of the last 14 candles. ALL distances below are ATR-relative — they auto-scale with volatility.
- Impulse = body >= 1.5 * AB. Swing = 5-candle fractal.
- BOS = close beyond last swing WITH trend. CHoCH = close beyond last swing AGAINST it.
- OB = last opposite candle before the impulse causing BOS/CHoCH (full range).
- FVG = 3-candle gap >= 0.4 * ATR. Filled once price trades through 50% of it.
- Sweep = wick beyond a swing that closes back inside within 1-2 candles.

=== STEP 1: CLASSIFY MARKET REGIME ===
- TREND (up/down): last two swings form HH+HL or LH+LL and price is making progress (net move of last 30 candles > 2 * ATR).
- RANGE: swings alternate inside a box; net move of last 30 candles < 2 * ATR.
- VOLATILE: any of last 3 candles has body > 3 * ATR (news shock / liquidation cascade).

=== STEP 2: APPLY THE MATCHING PLAYBOOK ===
TREND playbook:
- Trade continuation: pullbacks into OB/FVG in trend direction after BOS.
- Countertrend only after sweep + CHoCH.
- TP: next liquidity in trend direction.
RANGE playbook (do NOT wait out ranges — trade them):
- Fade the edges: LONG from lower third of the box, SHORT from upper third, best with a sweep of the box boundary.
- TP: POC or the opposite edge, whichever is closer.
- Never enter in the middle third of the box.
VOLATILE playbook:
- WAIT until 3 consecutive candles with body < 1.5 * AB before re-entering, unless a clear CHoCH already confirmed the new direction.
ANTI-FADE RULE (applies to ALL playbooks):
- NEVER SHORT while the last 3-4 candles are consecutive strong bullish bodies (> AB), and never LONG against the mirror case. An active impulse must first print a CHoCH or at least 2 corrective candles before you may trade against it.

=== STEP 3: SCORE THE SETUP (flexible, factors compensate each other) ===
+2  entry zone matches the active playbook (OB/FVG in trend; box edge in range)
+2  liquidity sweep into the zone
+2  fresh CHoCH/BOS confirms direction (within last 15 candles)
+1  POC confluence (zone within 0.8 * ATR of POC)
+1  unfilled FVG overlapping the entry zone
+1  rejection wick / impulse candle off the zone on the last 1-3 candles
+1  entry in the direction of the larger structure (last 60 candles)
-2  zone already mitigated before (stale)
-1  entry in the middle of the recent range (no man's land)

Threshold: trade at score >= 2 (leverage is 20x — a mediocre setup gets liquidated fast, be selective). Below threshold -> WAIT and state the score in "reason".
${learningBlock}

=== SL / TP (ATR-relative, self-adjusting) ===
- SL goes beyond the nearest LIQUIDITY POOL (recent swing extreme including wicks) plus 0.5 * ATR buffer. Never place SL just beyond the entry candle — that's the stop-hunt zone.
- SL distance: min 1 * ATR, max 3 * ATR (tight, because of 20x leverage).
- TP: nearest realistic target (liquidity / POC / box edge) whose distance is GREATER than the SL distance.

=== HARD SAFETY RULES (never bend these) ===
1. LONG: sl < entry < tp1. SHORT: tp1 < entry < sl.
2. SKIP every trade where |tp1 - entry| <= |entry - sl|. Pick a further TP or output WAIT.
3. entry within 1 * ATR of the last close.

=== OUTPUT ===
STRICTLY raw JSON, no fences, no text outside:
{
  "type": "LONG" | "SHORT" | "WAIT",
  "entry": <float>, "sl": <float>, "tp1": <float>,
  "regime": "TREND_UP" | "TREND_DOWN" | "RANGE" | "VOLATILE",
  "score": <int>,
  "setup": "<setup name>",
  "reason": "<українською: режим ринку, зона, набрані бали по факторах, логіка SL/TP; для WAIT — скільки балів не вистачило>",
  "estimated_resistance": <float>, "estimated_support": <float>
}
For WAIT: entry, sl, tp1 = 0.`;
}

export async function fetchTradingSignal(
  apiKey: string,
  symbol: string,
  market: 'crypto' | 'gold',
  candles: Candle[],
  pocPrice: number | null,
  lessons: string,
  stats: JournalStats | null
): Promise<AiSignal> {
  const systemPrompt = buildSystemPrompt(symbol, market, lessons, stats);
  const recentCandles = candles.slice(-80).map(c => ({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume }));
  const userPrompt = `[MARKET DATA FEED - ${symbol} M5]
RAW OHLCV CANDLES (Last 80): ${JSON.stringify(recentCandles)}
VOLUME PROFILE POINT OF CONTROL (POC): ${pocPrice ?? 'Unknown'}

Task: Classify the regime, apply the matching playbook, score the setup and decide LONG, SHORT or WAIT. Return the raw JSON object.`;

  const ai = await callDeepSeek(apiKey, systemPrompt, userPrompt);
  const lastClose = candles.length > 0 ? candles[candles.length - 1].close : 0;

  return {
    type: ai.type === 'LONG' || ai.type === 'SHORT' ? ai.type : 'WAIT',
    entry: ai.entry || lastClose,
    sl: ai.sl || 0,
    tp1: ai.tp1 || 0,
    regime: ai.regime || '?',
    score: ai.score ?? 0,
    setup: ai.setup || 'SMC Scalp',
    reason: ai.reason || '',
    resLine: ai.estimated_resistance,
    supLine: ai.estimated_support,
    timestamp: Date.now(),
  };
}

// ── 2-day journal retrospective ─────────────────────────────────────────────

export async function generateJournalReview(
  apiKey: string,
  entries: JournalEntry[]
): Promise<Pick<JournalReview, 'summary' | 'lessons' | 'winRate' | 'tradesAnalyzed'>> {
  if (entries.length === 0) {
    return { summary: 'За останні 2 дні угод не було.', lessons: '', winRate: 0, tradesAnalyzed: 0 };
  }

  const wins = entries.filter(e => e.outcome === 'WIN').length;
  const winRate = (wins / entries.length) * 100;

  const systemPrompt = `You are a trading performance analyst reviewing a scalping AI's own trade journal.
For each trade you get: symbol, side, entry/exit, SL/TP, P/L, the setup name, and the AI's original reasoning for entering.
Your job:
1. Identify which setups/regimes are actually working (positive expectancy) and which are not.
2. Find recurring mistakes (e.g. entries against the anti-fade rule, SL too tight for the volatility, chasing after the move already extended, ignoring the score threshold).
3. Write concrete, actionable rules the trading AI should follow going forward — things to weight more, things to avoid, thresholds to tighten.
Respond STRICTLY as raw JSON, no fences:
{ "summary": "<українською: розбір угод — що спрацювало, що ні, і чому>", "lessons": "<українською: конкретні правила на майбутнє, коротко і по пунктах>" }`;

  const userPrompt = `TRADE JOURNAL (${entries.length} trades):\n${JSON.stringify(entries.map(e => ({
    symbol: e.symbol, side: e.side, entry: e.entry, exit: e.exit, sl: e.sl, tp1: e.tp1,
    pnlUSDT: Number(e.pnlUSDT.toFixed(2)), outcome: e.outcome, setup: e.setup, reason: e.aiReason,
  })))}`;

  const ai = await callDeepSeek(apiKey, systemPrompt, userPrompt);
  return {
    summary: ai.summary || '',
    lessons: ai.lessons || '',
    winRate,
    tradesAnalyzed: entries.length,
  };
}
