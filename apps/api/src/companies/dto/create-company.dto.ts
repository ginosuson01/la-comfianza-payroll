import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

function trimRequiredString({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

function trimOptionalString({ value }: { value: unknown }): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : undefined;
}

export class CreateCompanyDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @MinLength(2)
  @MaxLength(30)
  @Matches(/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/, {
    message:
      'Company code may contain uppercase letters, numbers, and single hyphens only.',
  })
  code!: string;

  @Transform(trimRequiredString)
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name!: string;

  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(250)
  addressLine1?: string;

  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(250)
  addressLine2?: string;

  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(100)
  barangay?: string;

  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(100)
  province?: string;

  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(20)
  postalCode?: string;

  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(100)
  country?: string;

  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(150)
  contactName?: string;

  @IsOptional()
  @Transform(trimOptionalString)
  @IsEmail()
  @MaxLength(254)
  contactEmail?: string;

  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(30)
  contactPhone?: string;
}
