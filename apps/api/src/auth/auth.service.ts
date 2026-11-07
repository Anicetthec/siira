import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { CompanyLoginDto, CustomerLoginDto, CustomerRegisterDto } from './auth.dto';

function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, storedHash: string) {
  const [salt, expected] = storedHash.split(':');
  if (!salt || !expected) return false;
  const actual = scryptSync(password, salt, 64);
  const expectedBuffer = Buffer.from(expected, 'hex');
  return actual.length === expectedBuffer.length && timingSafeEqual(actual, expectedBuffer);
}

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async registerCustomer(dto: CustomerRegisterDto) {
    const phone = dto.phone.trim();
    const existing = await this.prisma.customer.findUnique({ where: { phone } });
    if (existing?.passwordHash) throw new ConflictException('Un compte existe déjà avec ce téléphone');
    const customer = existing
      ? await this.prisma.customer.update({ where: { id: existing.id }, data: { fullName: dto.fullName.trim(), passwordHash: hashPassword(dto.password) } })
      : await this.prisma.customer.create({ data: { fullName: dto.fullName.trim(), phone, passwordHash: hashPassword(dto.password) } });
    return { id: customer.id, fullName: customer.fullName, phone: customer.phone, role: 'CUSTOMER' };
  }

  async loginCustomer(dto: CustomerLoginDto) {
    const customer = await this.prisma.customer.findUnique({ where: { phone: dto.phone.trim() } });
    if (!customer?.passwordHash || !verifyPassword(dto.password, customer.passwordHash)) {
      throw new UnauthorizedException('Téléphone ou mot de passe incorrect');
    }
    return { id: customer.id, fullName: customer.fullName, phone: customer.phone, role: 'CUSTOMER' };
  }

  async loginCompany(dto: CompanyLoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase().trim() }, include: { company: true } });
    if (!user || !user.passwordHash || !verifyPassword(dto.password, user.passwordHash) || user.role !== UserRole.COMPANY_ADMIN) {
      throw new UnauthorizedException('Email ou mot de passe incorrect');
    }
    return { id: user.id, email: user.email, fullName: user.fullName, role: user.role, company: user.company };
  }
}
