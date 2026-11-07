import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { BaggageStatus } from '@prisma/client';

export class CreateBaggageDto {
  @IsString()
  ticketReference!: string;

  @IsString()
  description!: string;

  @IsInt()
  @Min(1)
  weightKg!: number;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  requestId?: string;
}

export class UpdateBaggageStatusDto {
  @IsEnum(BaggageStatus)
  status!: BaggageStatus;

  @IsOptional()
  @IsString()
  note?: string;
}
