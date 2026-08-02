import { ArrayUnique, IsArray, IsUUID } from 'class-validator';

export class ReplaceUserCompaniesDto {
  @IsArray()
  @ArrayUnique({
    message: 'Duplicate company assignments are not allowed.',
  })
  @IsUUID('all', {
    each: true,
    message: 'Each company ID must be a valid UUID.',
  })
  companyIds!: string[];
}
