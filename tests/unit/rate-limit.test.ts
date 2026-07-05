// The token-bucket rate limiter the server uses to bound each connection's message rate.

import { describe, it, expect } from 'vitest';
import { RateLimiter } from '../../src/net/rate-limit';

describe('RateLimiter (token bucket)', () => {
  it('allows a burst up to capacity, then blocks until refill', () => {
    const rl = new RateLimiter(5, 5, 0); // capacity 5, 5 tokens/s
    for (let i = 0; i < 5; i++) expect(rl.tryConsume(0)).toBe(true); // burst of 5
    expect(rl.tryConsume(0)).toBe(false); // bucket empty
    expect(rl.tryConsume(200)).toBe(true); // 0.2 s → +1 token
    expect(rl.tryConsume(200)).toBe(false); // empty again
    expect(rl.tryConsume(1200)).toBe(true); // a full second later → refilled
  });

  it('never accumulates beyond capacity while idle', () => {
    const rl = new RateLimiter(3, 10, 0);
    expect(rl.tryConsume(100_000)).toBe(true); // huge idle, but capped at 3
    expect(rl.tryConsume(100_000)).toBe(true);
    expect(rl.tryConsume(100_000)).toBe(true);
    expect(rl.tryConsume(100_000)).toBe(false);
  });
});
