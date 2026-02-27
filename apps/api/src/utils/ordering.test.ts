import { describe, it, expect } from 'vitest';
import { getPositionAfter, getPositionBefore, getPositionBetween } from './ordering.js';

describe('getPositionAfter', () => {
  it('returns a non-empty string when list is empty', () => {
    const pos = getPositionAfter(null);
    expect(typeof pos).toBe('string');
    expect(pos.length).toBeGreaterThan(0);
  });

  it('returns a key lexicographically greater than the given key', () => {
    const first = getPositionAfter(null);
    const second = getPositionAfter(first);
    expect(second > first).toBe(true);
  });

  it('returns keys that stay ordered across multiple appends', () => {
    let last: string | null = null;
    const positions: string[] = [];
    for (let i = 0; i < 5; i++) {
      last = getPositionAfter(last);
      positions.push(last);
    }
    for (let i = 1; i < positions.length; i++) {
      expect(positions[i] > positions[i - 1]).toBe(true);
    }
  });
});

describe('getPositionBefore', () => {
  it('returns a non-empty string when list is empty', () => {
    const pos = getPositionBefore(null);
    expect(typeof pos).toBe('string');
    expect(pos.length).toBeGreaterThan(0);
  });

  it('returns a key lexicographically less than the given key', () => {
    const first = getPositionBefore(null);
    const before = getPositionBefore(first);
    expect(before < first).toBe(true);
  });
});

describe('getPositionBetween', () => {
  it('returns a key strictly between two existing keys', () => {
    const a = getPositionAfter(null);
    const b = getPositionAfter(a);
    const between = getPositionBetween(a, b);
    expect(between > a).toBe(true);
    expect(between < b).toBe(true);
  });

  it('behaves like getPositionBefore when before is null', () => {
    const existing = getPositionAfter(null);
    const before = getPositionBetween(null, existing);
    expect(before < existing).toBe(true);
  });

  it('behaves like getPositionAfter when after is null', () => {
    const existing = getPositionAfter(null);
    const after = getPositionBetween(existing, null);
    expect(after > existing).toBe(true);
  });
});
