// ============================================================
// Market Status Service — determines NSE market status based
// on current IST time and a static holiday calendar.
// ============================================================

import type { MarketStatus } from 'shared/types.js';

// Static NSE holiday list for 2025 and 2026 (ISO date strings)
const NSE_HOLIDAYS: ReadonlySet<string> = new Set([
  // 2025
  '2025-02-26', // Mahashivratri
  '2025-03-14', // Holi
  '2025-03-31', // Id-Ul-Fitr (Ramadan Eid)
  '2025-04-10', // Shri Mahavir Jayanti
  '2025-04-14', // Dr. Baba Saheb Ambedkar Jayanti
  '2025-04-18', // Good Friday
  '2025-05-01', // Maharashtra Day
  '2025-06-07', // Bakri Id (Eid ul-Adha)
  '2025-08-15', // Independence Day
  '2025-08-16', // Ashura (Muharram)
  '2025-08-27', // Ganesh Chaturthi
  '2025-10-02', // Mahatma Gandhi Jayanti
  '2025-10-21', // Diwali (Laxmi Pujan)
  '2025-10-22', // Diwali Balipratipada
  '2025-11-05', // Prakash Gurpurb Sri Guru Nanak Dev
  '2025-11-26', // Constitution Day (tentative)
  '2025-12-25', // Christmas
  // 2026
  '2026-01-26', // Republic Day
  '2026-02-17', // Mahashivratri
  '2026-03-03', // Holi
  '2026-03-20', // Id-Ul-Fitr (Ramadan Eid)
  '2026-03-25', // Shri Mahavir Jayanti
  '2026-04-03', // Good Friday
  '2026-04-14', // Dr. Baba Saheb Ambedkar Jayanti
  '2026-05-01', // Maharashtra Day
  '2026-05-27', // Bakri Id (Eid ul-Adha)
  '2026-06-26', // Muharram
  '2026-08-15', // Independence Day
  '2026-08-17', // Ganesh Chaturthi (tentative)
  '2026-10-02', // Mahatma Gandhi Jayanti
  '2026-10-09', // Dussehra
  '2026-10-26', // Milad-un-Nabi (Prophet Mohammad's Birthday)
  '2026-11-09', // Diwali (Laxmi Pujan)
  '2026-11-10', // Diwali Balipratipada
  '2026-11-24', // Prakash Gurpurb Sri Guru Nanak Dev (tentative)
  '2026-12-25', // Christmas
]);

export interface MarketStatusService {
  getStatus(): MarketStatus;
  isMarketOpen(): boolean;
}

/**
 * Returns the current date/time in IST as a Date object
 * by parsing the locale string in the Asia/Kolkata timezone.
 */
function getCurrentIST(): Date {
  const now = new Date();
  const istString = now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
  return new Date(istString);
}

/**
 * Formats a Date (assumed IST) into a human-readable IST string.
 */
function formatISTTime(istDate: Date): string {
  return istDate.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Returns the ISO date string (YYYY-MM-DD) for an IST Date.
 */
function toISODateString(istDate: Date): string {
  const y = istDate.getFullYear();
  const m = String(istDate.getMonth() + 1).padStart(2, '0');
  const d = String(istDate.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function isTradingDay(istDate: Date): boolean {
  const day = istDate.getDay();
  // 0 = Sunday, 6 = Saturday
  if (day === 0 || day === 6) return false;
  return !NSE_HOLIDAYS.has(toISODateString(istDate));
}

/**
 * Returns minutes since midnight for the given IST date.
 */
function minutesSinceMidnight(istDate: Date): number {
  return istDate.getHours() * 60 + istDate.getMinutes();
}

// Time boundaries in minutes since midnight
const PRE_MARKET_START = 9 * 60;       // 9:00 AM
const MARKET_OPEN = 9 * 60 + 15;       // 9:15 AM
const MARKET_CLOSE = 15 * 60 + 30;     // 3:30 PM
const POST_MARKET_END = 16 * 60;       // 4:00 PM

export function createMarketStatusService(): MarketStatusService {
  return {
    getStatus(): MarketStatus {
      const istNow = getCurrentIST();
      const currentTimeIST = formatISTTime(istNow);

      if (!isTradingDay(istNow)) {
        return { status: 'closed', currentTimeIST };
      }

      const mins = minutesSinceMidnight(istNow);

      if (mins >= PRE_MARKET_START && mins < MARKET_OPEN) {
        return {
          status: 'pre-market',
          currentTimeIST,
          nextOpenTime: '09:15 AM IST',
        };
      }

      if (mins >= MARKET_OPEN && mins < MARKET_CLOSE) {
        return {
          status: 'open',
          currentTimeIST,
          nextCloseTime: '03:30 PM IST',
        };
      }

      if (mins >= MARKET_CLOSE && mins < POST_MARKET_END) {
        return {
          status: 'post-market',
          currentTimeIST,
        };
      }

      return { status: 'closed', currentTimeIST };
    },

    isMarketOpen(): boolean {
      return this.getStatus().status === 'open';
    },
  };
}
