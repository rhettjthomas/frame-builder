import { describe, expect, it } from 'vitest';
import { toSeriesId } from '../src/core/slug';

describe('toSeriesId', () => {
  it('slugifies a normal series name', () => {
    expect(toSeriesId('Hope Has a Name')).toBe('hope-has-a-name');
  });

  it('collapses punctuation and repeated separators', () => {
    expect(toSeriesId('Advent: Light  &  Life!')).toBe('advent-light-life');
  });

  it('trims leading and trailing separators', () => {
    expect(toSeriesId('  --Easter 2027--  ')).toBe('easter-2027');
  });

  it('strips accents rather than dropping the letter', () => {
    expect(toSeriesId('Café Series')).toBe('cafe-series');
  });

  it('returns an empty string when there is nothing usable', () => {
    expect(toSeriesId('   ')).toBe('');
    expect(toSeriesId('!!!')).toBe('');
  });
});
