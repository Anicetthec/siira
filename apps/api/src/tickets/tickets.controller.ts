import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { BoardTicketDto, CreateTicketDto } from './tickets.dto';
import { TicketsService } from './tickets.service';

@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Post()
  reserve(@Body() dto: CreateTicketDto) {
    return this.ticketsService.reserve(dto);
  }

  @Get(':reference')
  findByReference(@Param('reference') reference: string) {
    return this.ticketsService.findByReference(reference);
  }

  @Post(':reference/board')
  board(@Param('reference') reference: string, @Body() dto: BoardTicketDto) {
    return this.ticketsService.board(reference, dto);
  }
}
