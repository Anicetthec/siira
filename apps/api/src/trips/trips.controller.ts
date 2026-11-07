import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { CreateTripDto } from './trips.dto';
import { TripsService } from './trips.service';

@Controller('trips')
export class TripsController {
  constructor(private readonly tripsService: TripsService) {}

  @Get()
  findUpcoming(
    @Query('companyId') companyId?: string,
    @Query('departureCity') departureCity?: string,
    @Query('arrivalCity') arrivalCity?: string,
  ) {
    return this.tripsService.findUpcoming(companyId, departureCity, arrivalCity);
  }

  @Post()
  create(@Body() dto: CreateTripDto) {
    return this.tripsService.create(dto);
  }
}
