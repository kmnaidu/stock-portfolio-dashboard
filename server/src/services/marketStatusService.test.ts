import { describe, it, expect, vi, afterEach } from 'vitest';
import { createMarketStatusService } from './marketStatusService.js';

function mockIST(dateString: string) {
  // dateString should be in IST, e.g. "2026-04-20T10:30:00"
  // We need to convert IST to UTC for Date mock
  const istDate = new Date(dateString + '+05:30');
  vi.setSystemTime(istDate);
}

describe('MarketStatusService', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "open" during market hours on a weekday', () => {
    vi.useFakeTimers();
    // Monday 20 Apr 2026, 10:30 AM IST
    mockIST('2026-04-20T10:30:00');

    const service = createMarketStatusService();
    const status = service.getStatus();

    expect(status.status).toBe('open');
    expect(status.nextCloseTime).toBe('03:30 PM IST');
  });

  it('returns "pre-market" between 9:00 and 9:15 AM', () => {
    vi.useFakeTimers();
    // Monday 20 Apr 2026, 9:10 AM IST
    mockIST('2026-04-20T09:10:00');

    const service = createMarketStatusService();
    const status = service.getStatus();

    expect(status.status).toBe('pre-market');
    expect(status.nextOpenTime).toBe('09:15 AM IST');
  });

  it('returns "post-market" between 3:30 and 4:00 PM', () => {
    vi.useFakeTimers();
    // Monday 20 Apr 2026, 3:45 PM IST
    mockIST('2026-04-20T15:45:00');

    const service = createMarketStatusService();
    expect(service.getStatus().status).toBe('post-market');
  });

  it('returns "closed" after 4:00 PM on a weekday', () => {
    vi.useFakeTimers();
    // Monday 20 Apr 2026, 5:00 PM IST
    mockIST('2026-04-20T17:00:00');

    const service = createMarketStatusService();
    expect(service.getStatus().status).toBe('closed');
  });

  it('returns "closed" before 9:00 AM on a weekday', () => {
    vi.useFakeTimers();
    // Monday 20 Apr 2026, 8:00 AM IST
    mockIST('2026-04-20T08:00:00');

    const service = createMarketStatusService();
    expect(service.getStatus().status).toBe('closed');
  });

  it('returns "closed" on Saturday', () => {
    vi.useFakeTimers();
    // Saturday 25 Apr 2026, 10:30 AM IST
    mockIST('2026-04-25T10:30:00');

    const service = createMarketStatusService();
    expect(service.getStatus().status).toBe('closed');
  });

  it('returns "closed" on Sunday', () => {
    vi.useFakeTimers();
    // Sunday 26 Apr 2026, 10:30 AM IST
    mockIST('2026-04-26T10:30:00');

    const service = createMarketStatusService();
    expect(service.getStatus().status).toBe('closed');
  });

  it('returns "closed" on NSE holiday (Republic Day)', () => {
    vi.useFakeTimers();
    // Monday 26 Jan 2026, 10:30 AM IST — Republic Day
    mockIST('2026-01-26T10:30:00');

    const service = createMarketStatusService();
    expect(service.getStatus().status).toBe('closed');
  });

  it('returns "closed" on Diwali holiday', () => {
    vi.useFakeTimers();
    // Monday 9 Nov 2026, 10:30 AM IST — Diwali
    mockIST('2026-11-09T10:30:00');

    const service = createMarketStatusService();
    expect(service.getStatus().status).toBe('closed');
  });

  it('isMarketOpen returns true during market hours', () => {
    vi.useFakeTimers();
    mockIST('2026-04-20T11:00:00');

    const service = createMarketStatusService();
    expect(service.isMarketOpen()).toBe(true);
  });

  it('isMarketOpen returns false when closed', () => {
    vi.useFakeTimers();
    mockIST('2026-04-25T11:00:00'); // Saturday

    const service = createMarketStatusService();
    expect(service.isMarketOpen()).toBe(false);
  });

  it('boundary: exactly 9:15 AM is "open"', () => {
    vi.useFakeTimers();
    mockIST('2026-04-20T09:15:00');

    const service = createMarketStatusService();
    expect(service.getStatus().status).toBe('open');
  });

  it('boundary: exactly 3:30 PM is "post-market"', () => {
    vi.useFakeTimers();
    mockIST('2026-04-20T15:30:00');

    const service = createMarketStatusService();
    expect(service.getStatus().status).toBe('post-market');
  });

  it('includes currentTimeIST in response', () => {
    vi.useFakeTimers();
    mockIST('2026-04-20T10:30:00');

    const service = createMarketStatusService();
    const status = service.getStatus();

    expect(status.currentTimeIST).toBeDefined();
    expect(typeof status.currentTimeIST).toBe('string');
    expect(status.currentTimeIST.length).toBeGreaterThan(0);
  });
});
