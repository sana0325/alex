import { AiSignal, Candle, JournalEntry, JournalReview } from '../types';
import { JournalStats } from './journal';

const DEEPSEEK_ENDPOINT = 'https://api.deepseek.com/chat/completions';
const FETCH_TIMEOUT_MS = 20000;

// Without this, a request suspended mid-flight by Android's background JS
// throttling (screen locked / app backgrounded) can hang indefinitely rather
// than failing — that left a stale "Помилка ШІ-аналізу" status sitting on
// screen long after the app was reopened.
async function callDeepSeek(apiKey: string, systemPrompt: string, userPrompt: string): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(DEEPSEEK_ENDPOINT, {
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
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
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

  return `You are a professional ${symbol} (${market}) M5 SCALPER trading with 20x leverage — think and act like a scalper, NOT an intraday/swing trader. A scalper's edge is speed and reaction: you take the next realistic 5-20 minute move the instant price shows it, with a tight stop and a close, quickly-reachable target. You do NOT sit and wait for a slow multi-step textbook pattern to fully complete before acting — if two or three fast signs line up right now, that is enough to act on. Several setups a session is normal for a scalper; being unable to find one for hours is a sign you're being too much of a patient intraday trader, not a scalper.

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

=== STEP 2: APPLY THE MATCHING PLAYBOOK (pick whichever fires fastest — you don't need every playbook's confirmations at once) ===
MOMENTUM playbook (a scalper's bread and butter — check this first, every scan):
- A fresh impulse candle just broke a swing (BOS) or swept liquidity and closed back through it, within the last 1-3 candles — enter on the immediate 1-2 candle pullback/retest in the impulse direction. A shallow tap back into the impulse candle's own body is enough; do NOT wait for a full OB/FVG retest to form, that is intraday patience, not scalping.
- TP: the nearest swing/POC/round liquidity level in that direction, even a small one — bank the fast, high-probability win instead of holding out for the "next major liquidity" far away.
TREND playbook (use when there's no fresh impulse but structure is trending):
- Continuation: pullbacks into OB/FVG in trend direction after BOS.
- Countertrend only after sweep + CHoCH.
RANGE playbook (do NOT wait out ranges — trade them):
- Fade the edges: LONG from lower third of the box, SHORT from upper third, best with a sweep of the box boundary.
- TP: POC or the opposite edge, whichever is closer.
- Never enter in the middle third of the box.
VOLATILE playbook:
- WAIT until 2 consecutive candles with body < 1.5 * AB before re-entering, unless a clear CHoCH already confirmed the new direction.
ANTI-FADE RULE (applies to ALL playbooks):
- NEVER SHORT while the last 3-4 candles are consecutive strong bullish bodies (> AB), and never LONG against the mirror case. An active impulse must first print a CHoCH or at least 1 corrective candle before you may trade against it.

=== STEP 3: SCORE THE SETUP (flexible, factors compensate each other) ===
+2  fresh impulse (BOS or sweep) within the last 1-3 candles, entry on the immediate pullback (MOMENTUM path)
+2  entry zone matches the active playbook (OB/FVG in trend; box edge in range)
+2  liquidity sweep into the zone
+1  fresh CHoCH/BOS confirms direction (within last 15 candles)
+1  POC confluence (zone within 0.8 * ATR of POC)
+1  unfilled FVG overlapping the entry zone
+1  rejection wick / impulse candle off the zone on the last 1-3 candles
+1  entry in the direction of the larger structure (last 60 candles)
-2  zone already mitigated before (stale)
-1  entry in the middle of the recent range (no man's land)
-1  the move already extended far before you're reacting (chasing) — a scalper reacts early, not after the move is obvious to everyone

Threshold: trade at score >= 2 (leverage is 20x — a mediocre setup gets liquidated fast, be selective about WHICH setup, but don't be slow to act ON a valid one). Below threshold -> WAIT and state the score in "reason".
${learningBlock}

=== SL / TP (ATR-relative, self-adjusting, SCALP-sized) ===
- SL goes just beyond the nearest LIQUIDITY POOL (recent swing extreme including wicks) plus 0.3 * ATR buffer. Never place SL just beyond the entry candle — that's the stop-hunt zone.
- SL distance: min 0.5 * ATR, max 1.5 * ATR — a scalper's stop is tight. If the nearest clean pool is farther than that, this isn't a scalp: output WAIT instead of stretching the stop.
- TP: the nearest realistic target (liquidity / POC / box edge / round pullback level) whose distance is GREATER than the SL distance — prefer the closer, quickly-reachable target over a distant one.

=== HARD SAFETY RULES (never bend these) ===
1. LONG: sl < entry < tp1. SHORT: tp1 < entry < sl.
2. SKIP every trade where |tp1 - entry| <= |entry - sl|. Pick a further TP or output WAIT.
3. entry within 0.6 * ATR of the last close — a scalper enters near the current price, never chases.

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
