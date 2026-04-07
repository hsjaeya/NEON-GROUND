import { Expose, Type } from 'class-transformer';
import {
  IsNumber,
  IsString,
  IsDate,
  IsOptional,
  IsEmail,
} from 'class-validator';
import { WalletDto } from './wallet.dto';

export class UserResponseDto {
  @Expose()
  @IsNumber()
  id!: number;

  @Expose()
  @IsEmail()
  email!: string;

  @Expose()
  @IsString()
  username!: string;

  @Expose()
  @IsDate()
  createdAt!: Date;

  @Expose()
  @Type(() => WalletDto)
  wallets!: WalletDto[];
}
