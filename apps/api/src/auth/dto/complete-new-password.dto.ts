import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class CompleteNewPasswordDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  username!: string;

  @IsString()
  @MinLength(20)
  @MaxLength(2048)
  session!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(256)
  newPassword!: string;
}
