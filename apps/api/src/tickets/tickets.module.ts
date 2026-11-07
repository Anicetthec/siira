import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';

@Module({
  controllers: [TicketsController],
  providers: [PrismaService, TicketsService],
})
export class TicketsModule {}
