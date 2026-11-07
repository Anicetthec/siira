import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateTripDto } from './trips.dto';

@Injectable()
export class TripsService {
  constructor(private readonly prisma: PrismaService) {}

  findUpcoming(companyId?: string, departureCity?: string, arrivalCity?: string) {
    return this.prisma.trip.findMany({
      where: {
        ...(companyId ? { companyId } : {}),
        departureAt: { gte: new Date() },
        status: { not: 'CANCELLED' },
        route: {
          ...(departureCity ? { departureCity: { contains: departureCity, mode: 'insensitive' } } : {}),
          ...(arrivalCity ? { arrivalCity: { contains: arrivalCity, mode: 'insensitive' } } : {}),
        },
      },
      include: { route: true, vehicle: true, seats: { where: { status: 'AVAILABLE' }, take: 1 }, _count: { select: { tickets: true } } },
      orderBy: { departureAt: 'asc' },
      take: 50,
    });
  }

  async create(dto: CreateTripDto) {
    const [company, vehicle, route] = await Promise.all([
      this.prisma.company.findUnique({ where: { id: dto.companyId } }),
      this.prisma.vehicle.findUnique({ where: { id: dto.vehicleId } }),
      this.prisma.route.findUnique({ where: { id: dto.routeId } }),
    ]);
    if (!company || !vehicle || !route || vehicle.companyId !== company.id) {
      throw new NotFoundException('Compagnie, véhicule ou trajet introuvable');
    }

    return this.prisma.trip.create({
      data: {
        companyId: dto.companyId,
        vehicleId: dto.vehicleId,
        routeId: dto.routeId,
        departureAt: new Date(dto.departureAt),
        arrivalAt: new Date(dto.arrivalAt),
        price: dto.price,
        seats: {
          create: Array.from({ length: vehicle.seatCount }, (_, index) => ({
            number: String(index + 1).padStart(2, '0'),
          })),
        },
      },
      include: { route: true, vehicle: true, seats: true },
    });
  }
}
