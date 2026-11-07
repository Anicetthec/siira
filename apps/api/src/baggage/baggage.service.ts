import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { BaggageStatus } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma.service';
import { CreateBaggageDto, UpdateBaggageStatusDto } from './baggage.dto';

@Injectable()
export class BaggageService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateBaggageDto) {
    if (dto.requestId) {
      const existing = await this.prisma.baggage.findUnique({ where: { requestId: dto.requestId }, include: { ticket: { include: { trip: { include: { route: true } }, customer: true } } } });
      if (existing) return existing;
    }
    const ticket = await this.prisma.ticket.findUnique({
      where: { reference: dto.ticketReference },
      include: { trip: { include: { route: true } }, customer: true },
    });
    if (!ticket) throw new NotFoundException('Billet introuvable');
    if (ticket.status === 'CANCELLED' || ticket.status === 'REFUNDED') {
      throw new ConflictException('Impossible d’enregistrer un bagage sur ce billet');
    }

    return this.prisma.baggage.create({
      data: {
        trackingCode: `BAG-${new Date().getFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`,
        description: dto.description,
        weightKg: dto.weightKg,
        note: dto.note,
        ticketId: ticket.id,
        requestId: dto.requestId,
      },
      include: { ticket: { include: { trip: { include: { route: true } }, customer: true } } },
    });
  }

  async findByTrackingCode(trackingCode: string) {
    const baggage = await this.prisma.baggage.findUnique({
      where: { trackingCode },
      include: { ticket: { include: { trip: { include: { route: true } }, customer: true } } },
    });
    if (!baggage) throw new NotFoundException('Bagage introuvable');
    return baggage;
  }

  async updateStatus(trackingCode: string, dto: UpdateBaggageStatusDto) {
    const baggage = await this.prisma.baggage.findUnique({ where: { trackingCode } });
    if (!baggage) throw new NotFoundException('Bagage introuvable');
    return this.prisma.baggage.update({
      where: { trackingCode },
      data: { status: dto.status, note: dto.note ?? baggage.note },
      include: { ticket: { include: { trip: { include: { route: true } }, customer: true } } },
    });
  }

  list() {
    return this.prisma.baggage.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 100,
      include: { ticket: { include: { trip: { include: { route: true } }, customer: true } } },
    });
  }
}
