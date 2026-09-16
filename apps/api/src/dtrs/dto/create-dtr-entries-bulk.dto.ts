import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsDateString,
} from 'class-validator';

import { DtrEntryValuesDto } from './create-dtr-entry.dto';

export class CreateDtrEntriesBulkDto extends DtrEntryValuesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(31)
  @ArrayUnique()
  @IsDateString({}, { each: true })
  workDates!: string[];
}
