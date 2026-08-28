import { SlidingWindowRateLimiter } from './rate-limit';

describe('SlidingWindowRateLimiter', () => {
  it('allows up to the limit and then refuses', () => {
    const limiter = new SlidingWindowRateLimiter(3, 1000);
    expect([1, 2, 3].map(() => limiter.tryConsume('ip'))).toEqual([
      true,
      true,
      true,
    ]);
    expect(limiter.tryConsume('ip')).toBe(false);
  });

  it('keeps callers separate', () => {
    const limiter = new SlidingWindowRateLimiter(1, 1000);
    expect(limiter.tryConsume('a')).toBe(true);
    expect(limiter.tryConsume('b')).toBe(true);
    expect(limiter.tryConsume('a')).toBe(false);
  });

  it('lets the window slide rather than resetting in fixed blocks', () => {
    const limiter = new SlidingWindowRateLimiter(2, 1000);
    expect(limiter.tryConsume('ip', 0)).toBe(true);
    expect(limiter.tryConsume('ip', 900)).toBe(true);
    expect(limiter.tryConsume('ip', 950)).toBe(false);
    // The first attempt has aged out by now, so one slot is free again.
    expect(limiter.tryConsume('ip', 1100)).toBe(true);
    expect(limiter.tryConsume('ip', 1150)).toBe(false);
  });

  it('a refused attempt does not extend the window', () => {
    const limiter = new SlidingWindowRateLimiter(1, 1000);
    expect(limiter.tryConsume('ip', 0)).toBe(true);
    expect(limiter.tryConsume('ip', 500)).toBe(false);
    expect(limiter.tryConsume('ip', 1001)).toBe(true);
  });

  it('prunes callers whose window has fully elapsed', () => {
    const limiter = new SlidingWindowRateLimiter(1, 1000);
    limiter.tryConsume('ip', 0);
    limiter.prune(2000);
    expect(limiter.tryConsume('ip', 2001)).toBe(true);
  });
});
