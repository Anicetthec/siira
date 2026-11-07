import { IsDateString, IsInt, IsString, Min } from 'class-validator';

export class CreateTripDto {
  @IsString()
  companyId!: string;

  @IsString()
  vehicleId!: string;

  @IsString()
  routeId!: string;

  @IsDateString()
  departureAt!: string;

  @IsDateString()
  arrivalAt!: string;

  @IsInt()
  @Min(0)
  price!: number;
}
