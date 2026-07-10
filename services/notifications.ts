import { LocalNotifications } from '@capacitor/local-notifications';
import { JournalEntry } from '../types';

let permissionRequested = false;

export async function ensureNotificationPermission(): Promise<void> {
  if (permissionRequested) return;
  permissionRequested = true;
  try {
    await LocalNotifications.requestPermissions();
  } catch {
    /* not running on a native device (e.g. plain browser) — ignore */
  }
}

function notificationId(): number {
  return Math.floor(Date.now() % 2147483000) + Math.floor(Math.random() * 500);
}

export async function notifyTradeOpened(symbol: string, side: 'LONG' | 'SHORT', simulated: boolean): Promise<void> {
  const mode = simulated ? 'демо' : 'LIVE режим';
  const title = `📡 Сигнал ${side}: ${symbol}`;
  const body = `Угода відкрита (${mode})`;

  try {
    await LocalNotifications.schedule({
      notifications: [{
        id: notificationId(),
        title,
        body,
        schedule: { at: new Date(Date.now() + 200) },
      }],
    });
  } catch {
    /* not running on a native device — ignore */
  }
}

export async function notifyTradeClosed(entry: JournalEntry, updatedBalance: number | null): Promise<void> {
  const sign = entry.pnlUSDT >= 0 ? '+' : '';
  const outcomeWord = entry.outcome === 'WIN' ? '✅ Угода в плюсі' : entry.outcome === 'LOSS' ? '🔻 Угода в мінусі' : '➖ Угода в нулі';
  const demo = entry.simulated ? ' (демо)' : '';
  const balanceLine = updatedBalance !== null ? `\nБаланс: $${updatedBalance.toFixed(2)}` : '';

  const title = `${outcomeWord}${demo}: ${entry.symbol}`;
  const body = `${entry.side} ${sign}${entry.pnlUSDT.toFixed(2)}$ (${sign}${entry.pnlPercent.toFixed(1)}%)${balanceLine}`;

  try {
    await LocalNotifications.schedule({
      notifications: [{
        id: notificationId(),
        title,
        body,
        schedule: { at: new Date(Date.now() + 200) },
      }],
    });
  } catch {
    /* not running on a native device — ignore */
  }
}
