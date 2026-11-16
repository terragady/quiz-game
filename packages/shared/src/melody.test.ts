import { describe, expect, it } from 'vitest';

import { melodySeconds, parseMelody } from './melody.js';

describe('parseMelody', () => {
  it('turns notes into frequencies and beats', () => {
    const [a4, c4, rest, fSharp5, bFlat3] = parseMelody(
      'A4:1 C4:0.5 R:2 F#5:1 Bb3:1',
    );
    expect(a4).toEqual({ frequency: 440, beats: 1 });
    expect(c4.frequency).toBeCloseTo(261.63, 1);
    expect(c4.beats).toBe(0.5);
    expect(rest).toEqual({ frequency: null, beats: 2 });
    expect(fSharp5.frequency).toBeCloseTo(739.99, 1);
    expect(bFlat3.frequency).toBeCloseTo(233.08, 1);
  });

  it('rejects notes it cannot read', () => {
    expect(() => parseMelody('H4:1')).toThrow(/Invalid melody note/);
    expect(() => parseMelody('C4')).toThrow(/Invalid melody note/);
    expect(() => parseMelody('C4:0')).toThrow(/Invalid melody note/);
  });

  it('works out how long a melody lasts', () => {
    expect(melodySeconds({ bpm: 120, notes: 'C4:1 D4:1 R:2' })).toBe(2);
  });
});
