import { Module } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { WalletService } from './wallet.service';
import { WalletController } from './wallet.controller';

@Module({
  controllers: [WalletController],
  providers: [WalletService, PrismaService],
})
export class UserModule {}
