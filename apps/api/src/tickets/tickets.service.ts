import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PaymentStatus, SeatStatus, TicketStatus } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { BoardTicketDto, CreateTicketDto } from './tickets.dto';

@Injectable()
export class TicketsService {
  constructor(private readonly prisma: PrismaService) {}

  async reserve(dto: CreateTicketDto) {
    return this.prisma.$transaction(async (tx) => {
      if (dto.requestId) {
        const existing = await tx.ticket.findUnique({ where: { requestId: dto.requestId }, include: { trip: { include: { route: true } }, seat: true, customer: true, payments: true } });
        if (existing) return existing;
      }
      const seat = await tx.seat.findUnique({ where: { id: dto.seatId }, include: { trip: true } });
      if (!seat || seat.tripId !== dto.tripId) throw new NotFoundException('Place ou voyage introuvable');
      if (seat.status !== SeatStatus.AVAILABLE) throw new ConflictException('Cette place vient d’être réservée');

      const reservedSeat = await tx.seat.updateMany({
        where: { id: dto.seatId, tripId: dto.tripId, status: SeatStatus.AVAILABLE },
        data: { status: dto.paymentProvider === 'CASH' ? SeatStatus.SOLD : SeatStatus.RESERVED },
      });
      if (reservedSeat.count !== 1) throw new ConflictException('Cette place vient d’être réservée');

      const customer = await tx.customer.upsert({
        where: { phone: dto.phone },
        update: { fullName: dto.fullName },
        create: { fullName: dto.fullName, phone: dto.phone },
      });
      const reference = `FT-${new Date().getFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`;
      const ticket = await tx.ticket.create({
        data: {
          reference,
          qrToken: randomUUID(),
          status: dto.paymentProvider === 'CASH' ? TicketStatus.PAID : TicketStatus.PENDING_PAYMENT,
          amount: dto.amount ?? seat.trip.price,
          customerId: customer.id,
          tripId: dto.tripId,
          seatId: dto.seatId,
          counterId: dto.counterId,
          requestId: dto.requestId,
          payments: { create: { amount: dto.amount ?? seat.trip.price, provider: dto.paymentProvider, status: dto.paymentProvider === 'CASH' ? PaymentStatus.CONFIRMED : PaymentStatus.PENDING } },
        },
        include: { trip: { include: { route: true } }, seat: true, customer: true, payments: true },
      });
      return ticket;
    });
  }

  findByReference(reference: string) {
    return this.prisma.ticket.findUnique({
      where: { reference },
      include: { trip: { include: { route: true, company: true } }, seat: true, customer: true, payments: true, refund: true },
    });
  }

  async board(reference: string, dto: BoardTicketDto) {
    return this.prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.findUnique({ where: { reference } });
      if (!ticket || ticket.qrToken !== dto.qrToken) throw new NotFoundException('QR code invalide');
      if (ticket.status !== TicketStatus.PAID) throw new ConflictException('Billet non payé, annulé ou déjà embarqué');
      await tx.ticket.update({ where: { id: ticket.id }, data: { status: TicketStatus.BOARDED, boardedAt: new Date() } });
      return tx.seat.update({ where: { id: ticket.seatId }, data: { status: SeatStatus.BOARDED } });
    });
  }
}
