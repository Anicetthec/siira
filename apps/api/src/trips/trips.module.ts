import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { TripsController } from './trips.controller';
import { TripsService } from './trips.service';

@Module({
  controllers: [TripsController],
  providers: [PrismaService, TripsService],
})
export class TripsModule {}
