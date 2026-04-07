import { Expose } from 'class-transformer';
import { IsNumber, IsString, IsDate } from 'class-validator';

export class WalletDto {
  @Expose()
  @IsNumber()
  id!: number;

  @Expose()
  @IsNumber()
  userId!: number;

  @Expose()
  @IsString()
  balance!: string;

  @Expose()
  @IsDate()
  createdAt!: Date;

  @Expose()
  @IsDate()
  updatedAt!: Date;
}
