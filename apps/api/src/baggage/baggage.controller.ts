import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { BaggageService } from './baggage.service';
import { CreateBaggageDto, UpdateBaggageStatusDto } from './baggage.dto';

@Controller('baggage')
export class BaggageController {
  constructor(private readonly baggageService: BaggageService) {}

  @Post()
  create(@Body() dto: CreateBaggageDto) {
    return this.baggageService.create(dto);
  }

  @Get()
  list() {
    return this.baggageService.list();
  }

  @Get(':trackingCode')
  findByTrackingCode(@Param('trackingCode') trackingCode: string) {
    return this.baggageService.findByTrackingCode(trackingCode);
  }

  @Patch(':trackingCode/status')
  updateStatus(@Param('trackingCode') trackingCode: string, @Body() dto: UpdateBaggageStatusDto) {
    return this.baggageService.updateStatus(trackingCode, dto);
  }
}
