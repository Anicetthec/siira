import { Body, Controller, Post } from '@nestjs/common';
import { CompanyLoginDto, CustomerLoginDto, CustomerRegisterDto } from './auth.dto';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('client/register')
  registerCustomer(@Body() dto: CustomerRegisterDto) {
    return this.authService.registerCustomer(dto);
  }

  @Post('client/login')
  loginCustomer(@Body() dto: CustomerLoginDto) {
    return this.authService.loginCustomer(dto);
  }

  @Post('societe/login')
  loginCompany(@Body() dto: CompanyLoginDto) {
    return this.authService.loginCompany(dto);
  }
}
