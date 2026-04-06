import { Module } from '@nestjs/common';
import { StatsService } from './stats.service';
import { PrismaService } from '../../prisma/prisma.service';

@Module({
  providers: [StatsService, PrismaService],
  exports: [StatsService],
})
export class StatsModule {}
