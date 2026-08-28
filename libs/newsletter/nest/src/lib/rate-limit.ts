/**
 * A per-client sliding window, held in memory.
 *
 * Deliberately not distributed: this process is the only one serving the form,
 * and reaching for Redis to slow down a handful of signups would be the wrong
 * trade. If the app is ever scaled horizontally this becomes per-instance, and
 * the limit effectively multiplies by the instance count — worth remembering
 * rather than discovering.
 */
export class SlidingWindowRateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  /** Records an attempt. Returns false when the caller is over the limit. */
  tryConsume(key: string, now = Date.now()): boolean {
    const cutoff = now - this.windowMs;
    const recent = (this.hits.get(key) ?? []).filter((at) => at > cutoff);

    if (recent.length >= this.limit) {
      this.hits.set(key, recent);
      return false;
    }

    recent.push(now);
    this.hits.set(key, recent);
    return true;
  }

  /** Drops entries whose window has fully elapsed, so the map cannot grow forever. */
  prune(now = Date.now()): void {
    const cutoff = now - this.windowMs;
    for (const [key, times] of this.hits) {
      const recent = times.filter((at) => at > cutoff);
      if (recent.length === 0) {
        this.hits.delete(key);
      } else {
        this.hits.set(key, recent);
      }
    }
  }
}
