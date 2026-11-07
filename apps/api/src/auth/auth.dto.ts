import { IsEmail, IsString, MinLength } from 'class-validator';

export class CustomerRegisterDto {
  @IsString()
  fullName!: string;

  @IsString()
  phone!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}

export class CustomerLoginDto {
  @IsString()
  phone!: string;

  @IsString()
  password!: string;
}

export class CompanyLoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  password!: string;
}
