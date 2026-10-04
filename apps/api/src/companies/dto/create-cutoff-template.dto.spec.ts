import 'reflect-metadata';

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CutoffFrequency } from '@payroll/database';

import { CreateCutoffTemplateDto } from './create-cutoff-template.dto';

function validInput() {
  return {
    code: ' semi-monthly-main ',
    name: ' Standard Semi-Monthly ',

    frequency: CutoffFrequency.SEMI_MONTHLY,

    configuration: {
      periods: [
        {
          code: ' first ',
          name: ' First Period ',

          start: {
            mode: 'DAY',
            day: 1,
            monthOffset: 0,
          },

          end: {
            mode: 'DAY',
            day: 15,
            monthOffset: 0,
          },

          pay: {
            mode: 'DAY',
            day: 25,
            monthOffset: 0,
          },
        },

        {
          code: ' second ',
          name: ' Second Period ',

          start: {
            mode: 'DAY',
            day: 16,
            monthOffset: 0,
          },

          end: {
            mode: 'LAST_DAY',
            monthOffset: 0,
          },

          pay: {
            mode: 'DAY',
            day: 10,
            monthOffset: 1,
          },
        },
      ],
    },
  };
}

describe('CreateCutoffTemplateDto', () => {
  it('accepts and normalizes a valid SEMI_MONTHLY template', async () => {
    const dto = plainToInstance(CreateCutoffTemplateDto, validInput());

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);

    expect(dto.code).toBe('SEMI-MONTHLY-MAIN');

    expect(dto.name).toBe('Standard Semi-Monthly');

    expect(dto.configuration.periods[0].code).toBe('FIRST');

    expect(dto.configuration.periods[1].code).toBe('SECOND');
  });

  it('rejects a non-SEMI_MONTHLY frequency', async () => {
    const dto = plainToInstance(CreateCutoffTemplateDto, {
      ...validInput(),

      frequency: CutoffFrequency.MONTHLY,
    });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });

  it('requires exactly two periods', async () => {
    const input = validInput();

    input.configuration.periods = input.configuration.periods.slice(0, 1);

    const dto = plainToInstance(CreateCutoffTemplateDto, input);

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects DAY without a day number', async () => {
    const input = validInput();

    delete (
      input.configuration.periods[0].start as {
        day?: number;
      }
    ).day;

    const dto = plainToInstance(CreateCutoffTemplateDto, input);

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects an unsupported month offset', async () => {
    const input = validInput();

    input.configuration.periods[0].start.monthOffset = 2;

    const dto = plainToInstance(CreateCutoffTemplateDto, input);

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });
});
