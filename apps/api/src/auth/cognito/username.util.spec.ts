import { BadRequestException } from '@nestjs/common';

import { createUsernameBase } from './username.util';

describe('createUsernameBase', () => {
  it('generates first initial plus surname', () => {
    expect(createUsernameBase('Juan', 'Dela Cruz')).toBe('jdelacruz');
  });

  it('normalizes uppercase names', () => {
    expect(createUsernameBase('GINO', 'SUSON')).toBe('gsuson');
  });

  it('removes spaces from surnames', () => {
    expect(createUsernameBase('Juan', 'Dela Cruz')).toBe('jdelacruz');
  });

  it('removes punctuation', () => {
    expect(createUsernameBase('Anne-Marie', "O'Neil")).toBe('aoneil');
  });

  it('removes diacritics', () => {
    expect(createUsernameBase('José', 'García')).toBe('jgarcia');
  });

  it('rejects missing names', () => {
    expect(() => createUsernameBase('', '')).toThrow(BadRequestException);
  });
});
