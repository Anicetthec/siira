import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { BaggageController } from './baggage.controller';
import { BaggageService } from './baggage.service';

@Module({
  controllers: [BaggageController],
  providers: [PrismaService, BaggageService],
})
export class BaggageModule {}
