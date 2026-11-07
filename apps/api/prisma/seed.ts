import { PrismaClient } from '@prisma/client';
import { randomBytes, scryptSync } from 'node:crypto';

const prisma = new PrismaClient();
const passwordHash = (password: string) => {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
};

async function main() {
  const company = await prisma.company.upsert({
    where: { code: 'RAK' },
    update: {},
    create: { name: 'Rakieta Transport', code: 'RAK', phone: '+22670000000' },
  });
  await prisma.user.upsert({
    where: { email: 'admin@rakieta.bf' },
    update: {},
    create: { email: 'admin@rakieta.bf', fullName: 'Administrateur Rakieta', passwordHash: passwordHash('Rakieta@2026'), role: 'COMPANY_ADMIN', companyId: company.id },
  });
  const vehicle = await prisma.vehicle.upsert({
    where: { registration: 'BF 3021 AB' },
    update: {},
    create: { registration: 'BF 3021 AB', label: 'Autocar climatisé', seatCount: 50, companyId: company.id },
  });
  const route = await prisma.route.upsert({
    where: { departureCity_arrivalCity: { departureCity: 'Ouagadougou', arrivalCity: 'Bobo-Dioulasso' } },
    update: {},
    create: { departureCity: 'Ouagadougou', arrivalCity: 'Bobo-Dioulasso', distanceKm: 365 },
  });
  const departureAt = new Date();
  departureAt.setDate(departureAt.getDate() + 1);
  departureAt.setHours(7, 0, 0, 0);
  const existingTrip = await prisma.trip.findFirst({ where: { companyId: company.id, vehicleId: vehicle.id, routeId: route.id, departureAt } });
  if (!existingTrip) {
    await prisma.trip.create({
      data: {
        companyId: company.id,
        vehicleId: vehicle.id,
        routeId: route.id,
        departureAt,
        price: 7500,
        seats: { create: Array.from({ length: vehicle.seatCount }, (_, index) => ({ number: String(index + 1).padStart(2, '0') })) },
      },
    });
  }
}

main().finally(() => prisma.$disconnect());
