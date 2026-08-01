import { IsString, MaxLength, MinLength } from 'class-validator';

export class RefreshTokenDto {
  @IsString()
  @MinLength(20)
  @MaxLength(8192)
  refreshToken!: string;
}
