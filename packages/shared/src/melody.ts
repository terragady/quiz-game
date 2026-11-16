// Tunes for "name that tune" questions are stored as text and synthesized in
// the browser. A melody is space-separated notes, each NOTE:BEATS, where NOTE
// is a pitch like C4, F#5 or Bb3, or R for a rest. Example: "E4:1 D4:0.5 R:1".

export interface Melody {
  bpm: number;
  notes: string;
}

export interface MelodyNote {
  /** Frequency in Hz, or null for a rest. */
  frequency: number | null;
  beats: number;
}

const SEMITONES: Record<string, number> = {
  C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2,
};

const NOTE_PATTERN = /^(?:R|([A-G])(#|b)?([0-8])):(\d+(?:\.\d+)?)$/;

export function parseMelody(notes: string): MelodyNote[] {
  const tokens = notes.trim().split(/\s+/);
  return tokens.map((token) => {
    const match = NOTE_PATTERN.exec(token);
    if (!match) throw new Error(`Invalid melody note "${token}".`);
    const [, letter, accidental, octave, beats] = match;
    const beatCount = Number(beats);
    if (beatCount <= 0) throw new Error(`Invalid melody note "${token}".`);
    if (!letter) return { frequency: null, beats: beatCount };
    const shift = accidental === '#' ? 1 : accidental === 'b' ? -1 : 0;
    const fromA4 = SEMITONES[letter] + shift + (Number(octave) - 4) * 12;
    return { frequency: 440 * 2 ** (fromA4 / 12), beats: beatCount };
  });
}

export function melodySeconds(melody: Melody): number {
  const beats = parseMelody(melody.notes).reduce((sum, note) => sum + note.beats, 0);
  return (beats * 60) / melody.bpm;
}
