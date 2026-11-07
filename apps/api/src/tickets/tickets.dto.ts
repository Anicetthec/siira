import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { PaymentProvider } from '@prisma/client';

export class CreateTicketDto {
  @IsString()
  tripId!: string;

  @IsString()
  seatId!: string;

  @IsString()
  fullName!: string;

  @IsString()
  phone!: string;

  @IsEnum(PaymentProvider)
  paymentProvider!: PaymentProvider;

  @IsOptional()
  @IsString()
  counterId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  amount?: number;

  @IsOptional()
  @IsString()
  requestId?: string;
}

export class BoardTicketDto {
  @IsString()
  qrToken!: string;
}
