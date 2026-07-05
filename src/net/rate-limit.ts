// A token-bucket rate limiter. Pure + isomorphic (the caller passes the clock in), so it's
// unit-testable and runs anywhere. The server gives each connection one of these to bound how
// many messages it may send — an abusive/buggy client can flood, but the server just drops the
// excess (and disconnects a persistent flooder). Part of M4's "the client is untrusted" pass.

export class RateLimiter {
  private tokens: number;
  private last: number;

  /**
   * @param capacity   max burst (bucket size)
   * @param refillPerSec  tokens replenished per second (the sustained rate)
   * @param now        current time (ms)
   */
  constructor(
    private readonly capacity: number,
    private readonly refillPerSec: number,
    now: number,
  ) {
    this.tokens = capacity;
    this.last = now;
  }

  /** Try to consume one token at time `now` (ms). Returns true if allowed, false if over-rate. */
  tryConsume(now: number): boolean {
    const elapsed = Math.max(0, (now - this.last) / 1000);
    this.last = now;
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillPerSec);
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }
    return false;
  }
}
