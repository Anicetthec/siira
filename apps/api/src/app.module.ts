import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health.controller';
import { TripsModule } from './trips/trips.module';
import { TicketsModule } from './tickets/tickets.module';
import { BaggageModule } from './baggage/baggage.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), TripsModule, TicketsModule, BaggageModule, AuthModule],
  controllers: [HealthController],
})
export class AppModule {}
