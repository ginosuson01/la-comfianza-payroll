import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

function trimOptionalRequiredString({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

function trimOptionalNullableString({ value }: { value: unknown }): unknown {
  if (value === undefined || value === null) {
    return value;
  }

  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
}

export class UpdateCompanyDto {
  @IsOptional()
  @Transform(trimOptionalRequiredString)
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name?: string;

  @IsOptional()
  @Transform(trimOptionalNullableString)
  @IsString()
  @MaxLength(250)
  addressLine1?: string | null;

  @IsOptional()
  @Transform(trimOptionalNullableString)
  @IsString()
  @MaxLength(250)
  addressLine2?: string | null;

  @IsOptional()
  @Transform(trimOptionalNullableString)
  @IsString()
  @MaxLength(100)
  barangay?: string | null;

  @IsOptional()
  @Transform(trimOptionalNullableString)
  @IsString()
  @MaxLength(100)
  city?: string | null;

  @IsOptional()
  @Transform(trimOptionalNullableString)
  @IsString()
  @MaxLength(100)
  province?: string | null;

  @IsOptional()
  @Transform(trimOptionalNullableString)
  @IsString()
  @MaxLength(20)
  postalCode?: string | null;

  @IsOptional()
  @Transform(trimOptionalRequiredString)
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  country?: string;

  @IsOptional()
  @Transform(trimOptionalNullableString)
  @IsString()
  @MaxLength(150)
  contactName?: string | null;

  @IsOptional()
  @Transform(trimOptionalNullableString)
  @IsEmail()
  @MaxLength(254)
  contactEmail?: string | null;

  @IsOptional()
  @Transform(trimOptionalNullableString)
  @IsString()
  @MaxLength(30)
  contactPhone?: string | null;
}
